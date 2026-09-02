import type { RequestDefinition, RequestJsonSchema } from './types';
import { isRecord } from './utils';

export const createSchemaProperty = (
  definition: Pick<RequestDefinition, 'type' | 'description' | 'format' | 'order' | 'defaultValue'>,
): RequestJsonSchema => {
  const schema: RequestJsonSchema = {};

  if (definition.type === 'datetime') {
    schema.type = 'string';
    schema.format = definition.format.trim() || 'date-time';
  } else {
    schema.type = definition.type;
  }

  if (definition.description.trim()) {
    schema.description = definition.description.trim();
  }

  if (definition.type === 'string' && definition.format.trim()) {
    schema.format = definition.format.trim();
  }

  if (definition.type === 'object') {
    schema.properties = schema.properties ?? {};
  }

  if (definition.type === 'array' && !schema.items) {
    schema.items = { type: 'string' };
  }

  if (definition.defaultValue !== undefined && definition.defaultValue.trim() !== '') {
    schema.default = definition.defaultValue;
  }

  schema['x-order'] = definition.order;

  return schema;
};

export const setSchemaPropertyByPath = (
  properties: Record<string, RequestJsonSchema>,
  key: string,
  definition: Pick<RequestDefinition, 'type' | 'description' | 'format' | 'order' | 'defaultValue'>,
) => {
  const segments = key
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return;
  }

  let cursor = properties;
  segments.forEach((segment, index) => {
    const isLeaf = index === segments.length - 1;
    const existing = isRecord(cursor[segment]) ? (cursor[segment] as RequestJsonSchema) : {};

    if (isLeaf) {
      const nextProperty = {
        ...existing,
        ...createSchemaProperty(definition),
      };

      if (definition.type === 'object') {
        nextProperty.properties = existing.properties && isRecord(existing.properties) ? existing.properties : {};
      }

      if (definition.type === 'array') {
        nextProperty.items = existing.items ?? {};
      }

      cursor[segment] = nextProperty;
      return;
    }

    cursor[segment] = {
      ...existing,
      type: 'object',
      properties: existing.properties && isRecord(existing.properties) ? existing.properties : {},
    };

    cursor = cursor[segment].properties as Record<string, RequestJsonSchema>;
  });
};
