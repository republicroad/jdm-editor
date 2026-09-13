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
}

interface UdfEntry {
  fn: UdfFunction;
  schema: UdfSchema;
}

/** 可注册的 UDF 函数签名(动态注册表，运行时统一以单个 kwargs 对象调用) */
type UdfFunction = (kwargs: Record<string, unknown>) => unknown;

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

class UDFManager {
  private functions = new Map<string, UdfEntry>();

  /** 平台硬化：函数名与 namespace 名同名校验——裸 kind 解析中 namespace 优先，同名会使其中一方 kind 不可达 */
  private warnNamespaceCollision(name: string, namespace: string): void {
    const existingNamespaces = new Set<string>();
    for (const entry of this.functions.values()) {
      existingNamespaces.add(entry.schema.namespace ?? 'default');
    }
    if (name === namespace) {
      console.warn(
        `[udf] 函数 '${name}' 与其自身 namespace 同名：锁定 kind 与容器 kind 撞名，专用 spec 需以 override 函数名接管`,
      );
    } else if (existingNamespaces.has(name)) {
      console.warn(`[udf] 函数 '${name}' 与现有 namespace 同名：裸 kind 解析时 namespace 优先，该函数锁定 kind 不可达`);
    } else if ([...this.functions.keys()].some((fnName) => fnName === namespace)) {
      console.warn(
        `[udf] namespace '${namespace}' 与现有函数同名：其中函数的裸 kind 解析将命中 namespace（scoped 优先）`,
      );
    }
  }

  registerFunction(fn: UdfFunction, namespace?: string, schema?: UdfSchema, nameOverride?: string): void {
    const name = nameOverride ?? fn.name;
    if (!name) {
      throw new Error('Function must have a name to register');
    }
    this.warnNamespaceCollision(name, namespace ?? 'default');
    this.functions.set(name, {
      fn,
      schema: normalizeUdfSchema({
        parameters: schema?.parameters ?? {},
        returns: schema?.returns ?? { type: 'null' },
        namespace: namespace ?? 'default',
        parametersSchema: schema?.parametersSchema,
        returnsSchema: schema?.returnsSchema,
        description: schema?.description,
      }),
    });
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
      throw new Error(`Function '${udfName}' is not registered in UDFManager`);
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
      });
    }
    return [...namespaces.values()];
  }
}

const udfManager = new UDFManager();

function registerUdf(name: string, namespace?: string, schema?: UdfSchema): (fn: UdfFunction) => UdfFunction {
  return (fn: UdfFunction) => {
    udfManager.registerFunction(fn, namespace, schema, name);
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
    })(tool.fn);
  }
  return def.tools;
}

/** 单工具声明助手：为字面量提供 ContribToolDef 类型检查与补全 */
export const defineTool = (tool: ContribToolDef): ContribToolDef => tool;

export { UDFManager, udfManager, registerUdf };
