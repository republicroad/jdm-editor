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
  value: string | string[];
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
