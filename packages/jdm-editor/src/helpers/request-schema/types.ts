export type RequestJsonSchema = {
  'type'?: string | string[];
  'description'?: string;
  'format'?: string;
  'properties'?: Record<string, RequestJsonSchema>;
  'items'?: RequestJsonSchema | RequestJsonSchema[];
  'examples'?: unknown[];
  'x-examples-meta'?: RequestExampleMeta[];
  'x-order'?: number;
  [key: string]: unknown;
};

export type LegacyRequestInput = {
  id?: string;
  key?: string;
  type?: string;
  value?: unknown;
  desc?: unknown;
  description?: unknown;
};

export type RequestContentLike = {
  schema?: unknown;
  schemaUI?: unknown;
  inputs?: LegacyRequestInput[];
  /** InputContract（ADR-013）规范存储；legacy schema/examples 为读取回退 */
  inputContract?: InputContract;
};

/** InputContract 示例——完整输入实例 + 漂移检测指纹锚（ADR-013 §1） */
export type InputContractExample = {
  id: string;
  name: string;
  description?: string;
  /** 完整输入实例——simulator 直接消费 */
  data: Record<string, unknown>;
  /** 上次确认合法时的 schema 指纹（canonical stringify → FNV-1a） */
  schemaFingerprint?: string;
};

/** 输入节点唯一事实源：结构（JSON Schema）+ 具名示例集 */
export type InputContract = {
  contractVersion: number;
  /** 结构事实源（不含内嵌 examples / x-examples-meta） */
  schema: RequestJsonSchema;
  examples: InputContractExample[];
};

export type RequestDefinitionType = 'number' | 'string' | 'array' | 'object' | 'datetime' | 'boolean';

export type RequestDefinition = {
  id: string;
  path: string;
  name: string;
  type: RequestDefinitionType;
  description: string;
  format: string;
  order: number;
  depth: number;
  parentPath: string | null;
  source: 'schema.properties' | 'content.inputs';
  defaultValue?: string;
};

export type RequestExampleMeta = {
  name?: string;
  description?: string;
};

export type RequestExampleSource = {
  id: string;
  name: string;
  description?: string;
  data: Record<string, unknown>;
  source: 'schema.examples' | 'content.inputs';
};

export type RequestDefinitionSyncConflict = {
  path: string;
  nextType: RequestDefinitionType;
  value: unknown;
};
