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

export interface CustomNodeNamespace {
  /** 恒为 'namespace'(集合容器档；契约字段保留供未来场景) */
  type?: 'namespace';
  title: string;
  name: string;
  description?: string;
  tools: CustomFunctionTool[];
}

export type CustomNodeExpression = {
  id: string;
  key: string;
  /**
   * 调用形态三模（JSON-RPC 式类型判别）：
   * - 数组（默认）= 位置调用 [fn, arg1, ..., argn]
   * - 字符串 = legacy `;;` 拼接（旧图兼容）
   * - 对象 = 命名调用 { $call: fn, ...具名实参 }（实参值为 zen 表达式或字面量）
   */
  value: string | string[] | Record<string, unknown>;
};

export type CustomNodeConfig = {
  /** 锁定节点 UI 标记：true 表示此节点有专属页面设计（数据侧显式声明，缺省=通用锁定表格 UI） */
  locked?: true;
  inputField?: string | null;
  outputPath?: string | null;
  passThrough?: boolean;
  expressions: CustomNodeExpression[];
  __meta__?: Record<string, unknown>;
};
