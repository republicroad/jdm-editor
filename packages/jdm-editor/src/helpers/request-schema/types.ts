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
