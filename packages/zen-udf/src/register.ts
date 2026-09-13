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
}

/** 自定义节点命名空间(namespace/tools 格式)，对应侧边栏 group */
export interface CustomNodeNamespace {
  /** 恒为 'namespace'(集合容器档；契约字段保留供未来场景) */
  type: 'namespace';
  title: string;
  name: string;
  description?: string;
  tools: CustomFunctionTool[];
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
}

interface UdfEntry {
  fn: UdfFunction;
  schema: UdfSchema;
}

/** 可注册的 UDF 函数签名(动态注册表，运行时统一以单个 kwargs 对象调用) */
type UdfFunction = (kwargs: Record<string, unknown>) => unknown;

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
        },
        def.name,
      );
    }
  }

  /**
   * 位置参数前置校验（执行规范 §6.1）：对已求值、未绑定的位置参数检查必填项。
   * 返回错误清单（空数组 = 通过）。缺省参数在 funcBindParams 中回退，不算缺失。
   */
  validatePositionalArgs(name: string, args: unknown[]): string[] {
    const schema = this.functions.get(name)?.schema;
    if (!schema?.parameters) return [];
    const issues: string[] = [];
    Object.entries(schema.parameters).forEach(([paramName, paramSchema], i) => {
      if (i >= args.length) return; // 越界位置由 funcBindParams 以默认值补齐
      if (paramSchema.default !== undefined) return; // 有默认值 = 非必填
      const value = args[i];
      if (value === undefined || value === null) {
        issues.push(`${paramName} is required (position ${i})`);
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
    const schema = this.udfFunctionSchema(name);
    if (!schema?.parameters) {
      return {};
    }
    const paramEntries = Object.entries(schema.parameters);
    const bound: Record<string, unknown> = {};
    paramEntries.forEach(([paramName, paramSchema], i) => {
      const val = i < args.length ? args[i] : (paramSchema.default ?? null);
      const converter = jsonT2pyT(paramSchema.type ?? 'null');
      bound[paramName] = converter(val);
    });
    return bound;
  }

  async call(udfName: string, ...args: unknown[]): Promise<unknown> {
    const entry = this.functions.get(udfName);
    if (!entry) {
      throw new Error(`Function '${udfName}' is not registered in UdfRegistry`);
    }
    const kwargs = (args[0] as Record<string, unknown> | undefined) ?? {};
    const result = entry.fn(kwargs);
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
   */
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
 * UdfPack：宿主业务函数包契约（verdict 等仓以纯数据 + 处理器形态注入）。
 * namespace 对应编辑器侧边栏 group 与 customNode 的 kind 域；注册是 deploy-time
 * 静态行为，租户差异在调用时经 ExecContext/端口解析，禁止 per-tenant 注册。
 */
export interface UdfPack {
  namespace: string;
  tools: ContribToolDef[];
}

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

/** 校验 UdfPack 形状，返回错误清单（空数组 = 通过）。createUdfRegistry 注册前自动调用 */
export function validatePack(pack: UdfPack): string[] {
  const errors: string[] = [];
  if (!pack.namespace || typeof pack.namespace !== 'string') {
    errors.push('namespace is required and must be a non-empty string');
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
  for (const pack of options.packs ?? []) {
    const errors = validatePack(pack);
    if (errors.length > 0) {
      throw new Error(`[udf] invalid UdfPack '${pack.namespace}': ${errors.join('; ')}`);
    }
    for (const warning of packWarnings(pack)) {
      console.warn('[udf] pack "' + pack.namespace + '" warning: ' + warning);
    }
    registry.registerTools(pack.tools, pack.namespace);
  }
  return registry;
}

export { UdfRegistry, globalUdfRegistry, registerUdf };
