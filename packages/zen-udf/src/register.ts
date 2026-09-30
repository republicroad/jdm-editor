/**
 * 完整 JSON Schema 属性(与 brdeapi.geetest.com/zen_custom_node_function.json 对齐)。
 * index signature 允许嵌套 schema(properties/items/$defs/anyOf 等)。
 */
export interface JsonSchemaProperty {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  anyOf?: JsonSchemaProperty[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | JsonSchemaProperty;
  $ref?: string;
  $defs?: Record<string, JsonSchemaProperty>;
  enum?: unknown[];
  format?: string;
  [key: string]: unknown;
}

export interface JsonSchema {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  anyOf?: JsonSchema[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | JsonSchemaProperty;
  $ref?: string;
  $defs?: Record<string, JsonSchemaProperty>;
  [key: string]: unknown;
}

/** 扁平参数 schema(执行/绑定用，funcBindParams 依赖) */
export interface UdfSchemaParameter {
  type?: string;
  description?: string;
  default?: unknown;
}

/** 单个自定义函数(namespace/tools 格式中的 tool)，对应 createJdmNode 的 kind */
export interface CustomFunctionTool {
  name: string;
  title: string;
  type: 'function';
  description?: string;
  parameters: {
    properties: Record<string, JsonSchemaProperty>;
    required?: string[];
    title?: string;
    type?: 'object';
  };
  returns: JsonSchema;
  namespace: string;
  kind: string;
  semantics: UdfSemantics;
  idempotent?: boolean;
  /** 弃用标记（A4）：由 UdfSchema.deprecated 透传 */
  deprecated?: { since?: string; note?: string };
}

/** 自定义节点命名空间(namespace/tools 格式)，对应侧边栏 group */
export interface CustomNodeNamespace {
  /** 恒为 'namespace'(集合容器档；契约字段保留供未来场景) */
  type: 'namespace';
  title: string;
  name: string;
  description?: string;
  tools: CustomFunctionTool[];
  /** ADR-009：pack 元数据（origin 徽标/版本/许可），经 setPackMeta 记录后随视图透传 */
  meta?: UdfPackMeta;
}

/** 算子语义三元（Y1）：query 纯读 / observe 观测累积（处理时间，回放不重执行）/ act 处置效果（回放读 journal） */
export type UdfSemantics = 'query' | 'observe' | 'act';
const UDF_SEMANTICS: readonly UdfSemantics[] = ['query', 'observe', 'act'];

/** UDF 声明 schema(向后兼容：扁平 parameters 与完整 parametersSchema 二选一或并存) */
export interface UdfSchema {
  parameters?: Record<string, UdfSchemaParameter>;
  returns?: { type?: string; description?: string };
  namespace?: string;
  /** 完整 JSON Schema 形式的参数定义(用于 /api/custom-nodes/schema 下发) */
  parametersSchema?: {
    properties: Record<string, JsonSchemaProperty>;
    required?: string[];
    title?: string;
    type?: 'object';
  };
  /** 完整 JSON Schema 形式的返回值定义 */
  returnsSchema?: JsonSchema;
  description?: string;
  /** 算子语义（Y1）：缺省 'query'；决定回放模式下的执行策略 */
  semantics?: UdfSemantics;
  /** act 语义的幂等声明（Z1）：缺失时 validatePack 产生警告（不阻断），verdict 审计可见 */
  idempotent?: boolean;
  /** 弃用标记（A4）：目录/补全/画布三处标黄提示；since 为弃用发生的版本 */
  deprecated?: { since?: string; note?: string };
}

interface UdfEntry {
  fn: UdfFunction;
  schema: UdfSchema;
}

/**
 * 单次工具调用的执行上下文（fn 的第二参数）：租户身份 + 取消信号。
 * signal 在 kwargs.timeout 到点或上游取消时 abort——重 I/O 函数（Redis/DB/HTTP）
 * 必须把它传给底层客户端，否则超时返回后底层调用仍占着连接继续执行。
 */
export interface ToolCallContext {
  namespace?: string;
  name: string;
  tenantId?: string;
  userId?: string;
  requestId?: string;
  signal: AbortSignal;
  /** 绝对截止时间（epoch ms）；kwargs.timeout 缺省时为 null */
  deadlineAt: number | null;
}

/** 可注册的 UDF 函数签名(动态注册表，运行时统一以单个 kwargs 对象调用；第二参为调用上下文) */
type UdfFunction = (kwargs: Record<string, unknown>, call?: ToolCallContext) => unknown;

/** JSON Schema type 语义匹配（校验用；'any'/'null' 恒真，未知类型不判违例） */
function matchJsonType(value: unknown, type: string): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    default:
      return true;
  }
}

function describeJsonType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function jsonT2pyT(jsonType: string): (v: unknown) => unknown {
  const m: Record<string, (v: unknown) => unknown> = {
    null: () => null,
    any: (v) => v,
    boolean: (v) => Boolean(v),
    string: (v) => (v === null || v === undefined ? '' : String(v)),
    object: (v) => (typeof v === 'object' && v !== null ? v : {}),
    array: (v) => (Array.isArray(v) ? v : []),
    integer: (v) => {
      const n = Number(v);
      return Number.isInteger(n) ? n : 0;
    },
    number: (v) => Number(v),
  };
  return m[jsonType] ?? ((v) => v);
}

/**
 * 归一化 UdfSchema：
 * - 提供了 parametersSchema 时，自动派生扁平 parameters(供 funcBindParams 绑定/执行)
 * - 只提供扁平 parameters 时，自动合成 parametersSchema(供 schema 下发，保持旧调用方兼容)
 */
function normalizeUdfSchema(schema: UdfSchema): UdfSchema {
  const normalized: UdfSchema = {
    parameters: schema.parameters ?? {},
    returns: schema.returns ?? { type: 'null' },
    namespace: schema.namespace ?? 'default',
    description: schema.description,
    semantics: schema.semantics ?? 'query',
    deprecated: schema.deprecated,
  };

  if (schema.parametersSchema) {
    normalized.parametersSchema = schema.parametersSchema;
    if (!normalized.parameters || Object.keys(normalized.parameters).length === 0) {
      const derived: Record<string, UdfSchemaParameter> = {};
      for (const [name, prop] of Object.entries(schema.parametersSchema.properties)) {
        derived[name] = {
          type: typeof prop.type === 'string' ? prop.type : 'null',
          description: prop.description,
          default: prop.default,
        };
      }
      normalized.parameters = derived;
    }
  } else if (schema.parameters && Object.keys(schema.parameters).length > 0) {
    const synthesized: {
      properties: Record<string, JsonSchemaProperty>;
      required: string[];
      title: string;
      type: 'object';
    } = {
      properties: {},
      required: [],
      title: '',
      type: 'object',
    };
    for (const [name, param] of Object.entries(schema.parameters)) {
      synthesized.properties[name] = {
        type: param.type,
        description: param.description,
        default: param.default,
      };
      if (param.default === undefined) {
        synthesized.required.push(name);
      }
    }
    normalized.parametersSchema = synthesized;
  }

  if (schema.returnsSchema) {
    normalized.returnsSchema = schema.returnsSchema;
    if (!normalized.returns || normalized.returns.type === undefined) {
      normalized.returns = {
        type: schema.returnsSchema.type,
        description: schema.returnsSchema.description,
      };
    }
  }

  return normalized;
}

class UdfRegistry {
  private functions = new Map<string, UdfEntry>();
  /** ADR-009：pack 元数据（namespace → meta），目录徽标/过滤的数据源；setPackMeta 写入 */
  private packMetas = new Map<string, UdfPackMeta>();

  /**
   * 平台硬化：跨名冲突校验——裸 kind 解析中 namespace 优先，函数名/namespace 交叉同名
   * 会使其中一方 kind 不可达，注册期直接失败（force 可显式接管）。
   * 函数名与自身 namespace 同名（如 contrib/roster.ts 的 roster 工具）为遗留既定契约，放行：
   * 语义确定为 namespace 优先。
   */
  private assertNoNamespaceCollision(name: string, namespace: string): void {
    const existingNamespaces = new Set<string>();
    for (const entry of this.functions.values()) {
      existingNamespaces.add(entry.schema.namespace ?? 'default');
    }
    if (name !== namespace && existingNamespaces.has(name)) {
      throw new Error(
        `[udf] 函数 '${name}' 与现有 namespace 同名：裸 kind 解析时 namespace 优先，函数锁定 kind 不可达（force 可显式接管）`,
      );
    }
    if (name !== namespace && [...this.functions.keys()].some((fnName) => fnName === namespace)) {
      throw new Error(
        `[udf] namespace '${namespace}' 与现有函数同名：其中函数的裸 kind 解析将命中 namespace（force 可显式接管）`,
      );
    }
  }

  registerFunction(
    fn: UdfFunction,
    namespace?: string,
    schema?: UdfSchema,
    nameOverride?: string,
    options?: { force?: boolean },
  ): void {
    const name = nameOverride ?? fn.name;
    if (!name) {
      throw new Error('Function must have a name to register');
    }
    if (!options?.force) {
      this.assertNoNamespaceCollision(name, namespace ?? 'default');
    }
    this.functions.set(name, {
      fn,
      schema: normalizeUdfSchema({
        parameters: schema?.parameters ?? {},
        returns: schema?.returns ?? { type: 'null' },
        namespace: namespace ?? 'default',
        semantics: schema?.semantics,
        parametersSchema: schema?.parametersSchema,
        returnsSchema: schema?.returnsSchema,
        description: schema?.description,
        deprecated: schema?.deprecated,
      }),
    });
  }

  /** 批量注册工具定义（UdfPack / reference 域装载共用；namespace 缺省 'default'） */
  registerTools(defs: ContribToolDef[], namespace?: string): void {
    for (const def of defs) {
      this.registerFunction(
        def.fn,
        namespace,
        {
          description: def.description,
          parametersSchema: def.parametersSchema,
          returnsSchema: def.returnsSchema,
          semantics: def.semantics,
          idempotent: def.idempotent,
          deprecated: def.deprecated,
        },
        def.name,
      );
    }
  }

  /**
   * 位置参数前置校验（执行规范 §6.1）：对已求值、未绑定的位置参数检查必填项。
   * 返回错误清单（空数组 = 通过）。缺省参数在 funcBindParams 中回退，不算缺失。
   */
  /**
   * R1（ADR-011）：位置参数序列——规范表示直读（input schema 的
   * properties 键序 = 绑定序；required 数组 + default 决定必填）。
   * legacy 无 parametersSchema 的 schema 回退读扁平（required = 无 default）。
   */
  private positionalParams(name: string): {
    name: string;
    jsonType: string | null; // 简单类型（可矫正）；null = 复杂 schema（透传不矫正）
    description?: string;
    hasDefault: boolean;
    default: unknown;
    required: boolean; // required 且无 default
  }[] {
    const schema = this.udfFunctionSchema(name);
    if (!schema) return [];
    const ps = schema.parametersSchema;
    if (ps && typeof ps === 'object' && ps.properties) {
      const required = new Set((ps as { required?: string[] }).required ?? []);
      return Object.entries(ps.properties).map(([paramName, prop]) => {
        const hasDefault = prop !== null && typeof prop === 'object' && prop.default !== undefined;
        const jsonType = prop && typeof prop === 'object' && typeof prop.type === 'string' ? prop.type : null;
        return {
          name: paramName,
          jsonType,
          description: prop && typeof prop === 'object' ? prop.description : undefined,
          hasDefault,
          default: hasDefault ? (prop as { default: unknown }).default : undefined,
          required: required.has(paramName) && !hasDefault,
        };
      });
    }
    // legacy：仅扁平声明（规范化会合成 parametersSchema；此回退保护未规范化直调）
    return Object.entries(schema.parameters ?? {}).map(([paramName, param]) => ({
      name: paramName,
      jsonType: typeof param.type === 'string' ? param.type : null,
      description: param.description,
      hasDefault: param.default !== undefined,
      default: param.default,
      required: param.default === undefined,
    }));
  }

  validatePositionalArgs(name: string, args: unknown[]): string[] {
    if (!this.functions.has(name)) return [];
    const issues: string[] = [];
    this.positionalParams(name).forEach((param, i) => {
      const value = i < args.length ? args[i] : undefined;
      if (value === undefined || value === null) {
        // 缺必填位（R1）：不再静默跳过——契约 §5.2 要求列出参数名与位置
        if (param.required) {
          issues.push(`${param.name} is required (position ${i})`);
        }
        return; // 可选缺位由 funcBindParams 以默认值补齐
      }
    });
    return issues;
  }

  /**
   * 返回值契约校验（执行规范 §6.5）：按 returnsSchema 顶层断言
   * （type / required / properties 浅层类型）。返回错误清单（空数组 = 通过）。
   */
  validateResult(name: string, result: unknown): string[] {
    const schema = this.functions.get(name)?.schema;
    const rs = schema?.returnsSchema;
    if (!rs) return [];
    const issues: string[] = [];
    if (typeof rs.type === 'string' && rs.type !== 'any' && rs.type !== 'null' && !matchJsonType(result, rs.type)) {
      issues.push(`result type expected ${rs.type}, got ${describeJsonType(result)}`);
    }
    if (result !== null && typeof result === 'object' && !Array.isArray(result)) {
      const record = result as Record<string, unknown>;
      for (const key of rs.required ?? []) {
        if (record[key] === undefined) {
          issues.push(`result.${key} is required`);
        }
      }
      for (const [key, prop] of Object.entries(rs.properties ?? {})) {
        const value = record[key];
        if (value === undefined) continue;
        const propType = typeof prop?.type === 'string' ? prop.type : undefined;
        if (propType && propType !== 'any' && !matchJsonType(value, propType)) {
          issues.push(`result.${key} type expected ${propType}, got ${describeJsonType(value)}`);
        }
      }
    }
    return issues;
  }

  udfFunctionSchema(name: string): UdfSchema | undefined {
    return this.functions.get(name)?.schema;
  }

  funcBindParams(name: string, args: unknown[]): Record<string, unknown> {
    const params = this.positionalParams(name);
    const missing = params.filter(
      (param, i) => param.required && (i >= args.length || args[i] === undefined || args[i] === null),
    );
    if (missing.length > 0) {
      // 契约 §5.3：必填缺失 MUST NOT 静默填空（直调绕过 validate 时同样拦截）
      throw new Error(
        `INVALID_PARAM: ${missing.map((m) => `${m.name} is required (position ${params.indexOf(m)})`).join('; ')}`,
      );
    }
    const bound: Record<string, unknown> = {};
    params.forEach((param, i) => {
      const val = i < args.length ? args[i] : param.hasDefault ? param.default : null;
      const converter = param.jsonType ? jsonT2pyT(param.jsonType) : (v) => v;
      bound[param.name] = converter(val);
    });
    return bound;
  }

  /**
   * 命名形态绑定（调用形态第三种：对象 = $call + 具名实参）：按名字绑定，
   * 与位置语义共享 required/default/type 转换规则；未知参数名报错（手写图防笔误）。
   */
  bindNamedArgs(name: string, named: Record<string, unknown>): { kwargs: Record<string, unknown>; issues: string[] } {
    const schema = this.udfFunctionSchema(name);
    if (!schema?.parameters) {
      return { kwargs: { ...named }, issues: [] };
    }
    const issues: string[] = [];
    const known = new Set(Object.keys(schema.parameters));
    for (const key of Object.keys(named)) {
      if (!known.has(key)) {
        issues.push(`unknown argument '${key}'`);
      }
    }
    const kwargs: Record<string, unknown> = {};
    for (const [paramName, paramSchema] of Object.entries(schema.parameters)) {
      const provided = paramName in named;
      const raw = provided ? named[paramName] : undefined;
      if (!provided || raw === undefined || raw === null) {
        if (paramSchema.default === undefined) {
          issues.push(`${paramName} is required`);
        } else {
          kwargs[paramName] = paramSchema.default;
        }
        continue;
      }
      kwargs[paramName] = jsonT2pyT(paramSchema.type ?? 'null')(raw);
    }
    return { kwargs, issues };
  }

  async call(udfName: string, kwargs?: Record<string, unknown>, callCtx?: ToolCallContext): Promise<unknown> {
    const entry = this.functions.get(udfName);
    if (!entry) {
      throw new Error(`Function '${udfName}' is not registered in UdfRegistry`);
    }
    const result = entry.fn(kwargs ?? {}, callCtx && { ...callCtx, namespace: entry.schema.namespace ?? 'default' });
    return result instanceof Promise ? await result : result;
  }

  /** 扁平 schema 数组(旧接口，保持兼容) */
  udfFunctionSchemaTools(): unknown[] {
    const funcTools: unknown[] = [];
    for (const entry of this.functions.values()) {
      funcTools.push(entry.schema);
    }
    return funcTools;
  }

  /**
   * namespace 分组 + tools 格式，与 brdeapi.geetest.com/zen_custom_node_function.json 对齐。
   * 每个 namespace 对应侧边栏 group，每个 tool 对应 createJdmNode 的 kind。
   * type 恒为 'namespace'(集合容器档；契约字段保留供未来场景)。
   * ADR-009：pack 元数据（若有）随 namespace 透传，目录据此渲染 origin 徽标。
   */
  /** ADR-009：记录 pack 元数据（目录徽标/过滤数据源）；同 namespace 后写覆盖 */
  setPackMeta(namespace: string, meta: UdfPackMeta): void {
    this.packMetas.set(namespace, meta);
  }

  getPackMeta(namespace: string): UdfPackMeta | undefined {
    return this.packMetas.get(namespace);
  }

  udfFunctionSchemaNamespaces(): CustomNodeNamespace[] {
    const namespaces = new Map<string, CustomNodeNamespace>();
    for (const [name, entry] of this.functions.entries()) {
      const ns = entry.schema.namespace ?? 'default';
      let nsObj = namespaces.get(ns);
      if (!nsObj) {
        nsObj = {
          type: 'namespace',
          title: ns,
          name: ns,
          description: '',
          tools: [],
          ...(this.packMetas.has(ns) ? { meta: this.packMetas.get(ns) } : {}),
        };
        namespaces.set(ns, nsObj);
      }
      nsObj.tools.push({
        name,
        title: name,
        type: 'function',
        description: entry.schema.description ?? '',
        parameters: entry.schema.parametersSchema ?? {
          properties: {},
          title: name,
          type: 'object',
        },
        returns: entry.schema.returnsSchema ?? { type: 'null', title: '', properties: {} },
        namespace: ns,
        kind: ns,
        semantics: entry.schema.semantics ?? 'query',
        idempotent: entry.schema.idempotent,
        deprecated: entry.schema.deprecated,
      });
    }
    return [...namespaces.values()];
  }
}

const globalUdfRegistry = new UdfRegistry();

function registerUdf(name: string, namespace?: string, schema?: UdfSchema): (fn: UdfFunction) => UdfFunction {
  return (fn: UdfFunction) => {
    globalUdfRegistry.registerFunction(fn, namespace, schema, name);
    return fn;
  };
}

/**
 * ext 扩展文件专用注册器（ext 约定：文件名即 namespace，函数缺省注册到该 namespace）。
 * 用法：const registerUdf = createExtRegister(import.meta.url); 之后 registerUdf(name, schema)(fn)。
 * 需要显式指定 namespace 时使用全局 registerUdf(name, namespace, schema)。
 */
export function createExtRegister(importMetaUrl: string) {
  const namespace = decodeURIComponent(importMetaUrl.split('/').pop() ?? '').replace(/\.[^.]+$/, '');
  return (name: string, schema?: UdfSchema): ((fn: UdfFunction) => UdfFunction) => registerUdf(name, namespace, schema);
}

/** contrib 域单工具定义（defineContrib 数组项；字段与 UdfSchema 注册参数一致） */
export interface ContribToolDef {
  name: string;
  description?: string;
  /** 算子语义（Y1）：缺省 'query' */
  semantics?: UdfSemantics;
  /** act 语义幂等声明（Z1）：建议 act 工具显式声明 */
  idempotent?: boolean;
  parametersSchema?: UdfSchema['parametersSchema'];
  returnsSchema?: UdfSchema['returnsSchema'];
  /** 弃用标记（A4）：透传至 schema/目录/补全 */
  deprecated?: { since?: string; note?: string };
  /**
   * ADR-009：跨 namespace 函数名撞名时的显式接管声明——true 时免撞名失败，
   * 后注册者覆盖（与 registerUdf 的 force 同语义，报错信息会提示本出口）。
   */
  overwrite?: boolean;
  fn: UdfFunction;
}

/** contrib 域定义（defineContrib 的入参） */
export interface ContribDef {
  tools: ContribToolDef[];
}

/**
 * contrib 域单调用注册（第七十七批 ergonomics）：文件名即 namespace，tools 逐个挂载。
 * 返回传入的 tools（便于测试断言与再导出）。旧 createExtRegister/registerUdf 签名保留向后兼容。
 */
export function defineContrib(importMetaUrl: string, def: ContribDef): ContribToolDef[] {
  const namespace = decodeURIComponent(importMetaUrl.split('/').pop() ?? '').replace(/\.[^.]+$/, '');
  for (const tool of def.tools) {
    registerUdf(tool.name, namespace, {
      description: tool.description,
      parametersSchema: tool.parametersSchema,
      returnsSchema: tool.returnsSchema,
      semantics: tool.semantics,
      idempotent: tool.idempotent,
    })(tool.fn);
  }
  return def.tools;
}

/** 单工具声明助手：为字面量提供 ContribToolDef 类型检查与补全 */
export const defineTool = (tool: ContribToolDef): ContribToolDef => tool;

/**
 * 泛型变体：宿主为 fn 的 kwargs 声明类型，获得参数补全与静态检查
 * （schema 仍是运行时唯一权威——类型只是它的开发态影子）。
 * @example
 * defineTool<{ key: string }>({
 *   name: 'get',
 *   fn: async (kwargs) => pool.get(kwargs.key),  // kwargs: { key: string }
 * })
 */
export const defineToolFor = <TParams extends Record<string, unknown>>(
  tool: Omit<ContribToolDef, 'fn'> & { fn: (kwargs: TParams, call?: ToolCallContext) => unknown },
): ContribToolDef => tool as unknown as ContribToolDef;

/**
 * UdfPack：宿主业务函数包契约（verdict 等仓以纯数据 + 处理器形态注入）。
 * namespace 对应编辑器侧边栏 group 与 customNode 的 kind 域；注册是 deploy-time
 * 静态行为，租户差异在调用时经 ExecContext/端口解析，禁止 per-tenant 注册。
 */
export interface UdfPack {
  namespace: string;
  tools: ContribToolDef[];
  /** ADR-009：pack 元数据（目录徽标/过滤的数据基础）；缺省 = 无徽标（向后兼容） */
  meta?: UdfPackMeta;
}

/** ADR-009：pack 来源生态位（目录 origin 徽标的取值域） */
export type UdfPackOrigin = 'reference' | 'extension' | 'industry';

/**
 * ADR-009 pack 元数据——目录渲染与过滤的最小集。实施加强注记 2：元数据字段一旦
 * 发布即兼容性 surface，宁可后加不可先滥；禁止收描述类内容（description/title
 * 各有归属）。
 */
export interface UdfPackMeta {
  origin: UdfPackOrigin;
  /** 目录过期提示（目录可对比 registry 内版本与最新发布） */
  version: string;
  license?: 'oss' | 'proprietary';
}

/**
 * ADR-009 namespace 立法：保留前缀给 zen-udf 本体与参考域，宿主通用扩展与行业包
 * 禁用（精确名或点分前缀命中，如 'zen'/'zen.ext' 拒绝、'zenkit' 放行）。
 */
export const RESERVED_NAMESPACE_PREFIXES: readonly string[] = ['zen', 'core', 'reference', 'builtin'];

export const reservedNamespaceViolation = (namespace: string): string | null => {
  const hit = RESERVED_NAMESPACE_PREFIXES.find((r) => namespace === r || namespace.startsWith(`${r}.`));
  return hit ? `namespace '${namespace}' uses reserved prefix '${hit}' (ADR-009)` : null;
};

/**
 * act 幂等声明警告（Z1）：act 语义工具未声明 idempotent 时产生警告（不阻断注册）。
 * 警告与错误分离：errors 阻断，warnings 仅提示（verdict 登记页可见）。
 */
export function packWarnings(pack: UdfPack): string[] {
  const warnings: string[] = [];
  for (const tool of pack.tools) {
    if (tool.semantics === 'act' && tool.idempotent !== true) {
      warnings.push(
        `act tool '${tool.name}' has no idempotent declaration — replay/submission dedup relies on decisionId at the sink`,
      );
    }
  }
  return warnings;
}

export interface PackQualityIssue {
  check: string;
  tool?: string;
  severity: 'error' | 'warning';
  detail: string;
}

/**
 * 宿主包质量检查（validatePack 硬门禁之上的软层，C 项）：编辑器展示与执行规范
 * 约定的结构质量——description 非空、returnsSchema 存在（§6.5 前提）、
 * required ⊆ properties、timeout 属性形状（§6.2）、act 幂等声明（Z1，warning）。
 * 注册前的形状硬校验仍由 validatePack 独立承担；本函数供宿主 CI 与 verdict 登记页使用。
 */
export function packChecks(pack: UdfPack): PackQualityIssue[] {
  const issues: PackQualityIssue[] = [];
  if (!/^[a-z][a-z0-9_-]*$/.test(pack.namespace)) {
    issues.push({
      check: 'namespace-convention',
      severity: 'warning',
      detail: `namespace '${pack.namespace}' deviates from the lowercase kebab/snake convention`,
    });
  }
  for (const tool of pack.tools) {
    const at = (check: string, severity: 'error' | 'warning', detail: string): PackQualityIssue => ({
      check,
      tool: tool.name,
      severity,
      detail,
    });
    if (!tool.description || !tool.description.trim()) {
      issues.push(at('description-required', 'error', 'description is empty — the editor node panel renders it'));
    }
    if (!tool.returnsSchema) {
      issues.push(at('returns-schema-required', 'error', 'returnsSchema is required (§6.5 result contract premise)'));
    }
    const props = tool.parametersSchema?.properties;
    if (tool.parametersSchema?.required && props) {
      for (const key of tool.parametersSchema.required) {
        if (!(key in props)) {
          issues.push(at('required-mismatch', 'error', `required key '${key}' has no entry in properties`));
        }
      }
    }
    const timeoutProp = props?.timeout;
    if (timeoutProp && timeoutProp.type !== 'integer') {
      issues.push(
        at(
          'timeout-shape',
          'warning',
          `timeout property type '${String(timeoutProp.type)}' should be 'integer' (§6.2)`,
        ),
      );
    }
    if (tool.semantics === 'act' && tool.idempotent !== true) {
      issues.push(at('act-idempotent', 'warning', 'act tool without idempotent declaration (Z1)'));
    }
  }
  return issues;
}

/** 校验 UdfPack 形状，返回错误清单（空数组 = 通过）。createUdfRegistry 注册前自动调用 */
export function validatePack(pack: UdfPack): string[] {
  const errors: string[] = [];
  if (!pack.namespace || typeof pack.namespace !== 'string') {
    errors.push('namespace is required and must be a non-empty string');
  } else {
    const reserved = reservedNamespaceViolation(pack.namespace);
    if (reserved) {
      errors.push(reserved);
    }
  }
  if (pack.meta !== undefined) {
    const { meta } = pack;
    if (typeof meta !== 'object' || meta === null) {
      errors.push('meta must be an object');
    } else {
      if (!['reference', 'extension', 'industry'].includes(meta.origin)) {
        errors.push(`meta.origin must be one of reference/extension/industry (got '${meta.origin}')`);
      }
      if (!meta.version || typeof meta.version !== 'string') {
        errors.push('meta.version is required and must be a non-empty string');
      }
      if (meta.license !== undefined && !['oss', 'proprietary'].includes(meta.license)) {
        errors.push(`meta.license must be 'oss' or 'proprietary' (got '${meta.license}')`);
      }
    }
  }
  if (!Array.isArray(pack.tools) || pack.tools.length === 0) {
    errors.push('tools must be a non-empty array');
    return errors;
  }
  const seen = new Set<string>();
  for (const tool of pack.tools) {
    if (!tool || typeof tool.name !== 'string' || !tool.name) {
      errors.push('every tool requires a non-empty string name');
      continue;
    }
    if (typeof tool.fn !== 'function') {
      errors.push(`tool '${tool.name}' requires a function fn`);
    }
    if (tool.parametersSchema && typeof tool.parametersSchema !== 'object') {
      errors.push(`tool '${tool.name}' parametersSchema must be an object`);
    }
    if (tool.parametersSchema && !tool.parametersSchema.properties) {
      errors.push(`tool '${tool.name}' parametersSchema.properties is required`);
    }
    if (tool.semantics !== undefined && !UDF_SEMANTICS.includes(tool.semantics)) {
      errors.push(`tool '${tool.name}' semantics must be one of query/observe/act`);
    }
    if (seen.has(tool.name)) {
      errors.push(`duplicate tool name '${tool.name}' within pack`);
    }
    seen.add(tool.name);
  }
  return errors;
}

export interface CreateUdfRegistryOptions {
  /** 业务函数包（deploy-time 注入）；注册前逐个 validatePack，违例整体失败 */
  packs?: UdfPack[];
}

/**
 * 构建隔离的 UdfRegistry 实例（U6）：多运行时/多租户实例注入的推荐入口。
 * 参考函数域按需经 loadReferenceInto(registry) 装载（builtin: 'reference' 语义）。
 */
export function createUdfRegistry(options: CreateUdfRegistryOptions = {}): UdfRegistry {
  const registry = new UdfRegistry();
  // ADR-009 撞名检测（deploy 期 fail fast，报错列出冲突 namespace——实施加强注记 1）：
  // 跨 pack 的工具名重复即失败（分发按裸函数名，重复即覆盖歧义），除非工具显式
  // 声明 overwrite；pack namespace 重复为配置错误，一并失败。
  const nameOwners = new Map<string, string>();
  const seenPackNamespaces = new Set<string>();
  for (const pack of options.packs ?? []) {
    const errors = validatePack(pack);
    if (seenPackNamespaces.has(pack.namespace)) {
      errors.push(`duplicate pack namespace '${pack.namespace}'`);
    }
    for (const tool of pack.tools) {
      const owner = nameOwners.get(tool.name);
      if (owner !== undefined && owner !== pack.namespace && tool.overwrite !== true) {
        errors.push(
          `tool '${tool.name}' already registered by namespace '${owner}' (declare overwrite: true to take over)`,
        );
      }
    }
    if (errors.length > 0) {
      throw new Error(`[udf] invalid UdfPack '${pack.namespace}': ${errors.join('; ')}`);
    }
    seenPackNamespaces.add(pack.namespace);
    for (const tool of pack.tools) {
      if (!nameOwners.has(tool.name)) {
        nameOwners.set(tool.name, pack.namespace);
      }
    }
    for (const warning of packWarnings(pack)) {
      console.warn('[udf] pack "' + pack.namespace + '" warning: ' + warning);
    }
    registry.registerTools(pack.tools, pack.namespace);
    if (pack.meta) {
      registry.setPackMeta(pack.namespace, pack.meta);
    }
  }
  return registry;
}

export { UdfRegistry, globalUdfRegistry, registerUdf };
