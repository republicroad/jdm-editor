import { buildLegacyInputProperties } from './legacy';
import { normalizeDefinitionType, normalizeRequestFieldKey } from './normalize';
import { setSchemaPropertyByPath } from './schema-property';
import { getRequestSchemaSourceValue, parseRequestSchemaValue, stringifyRequestSchemaValue } from './schema-value';
import type { RequestContentLike, RequestDefinition, RequestJsonSchema } from './types';
import { buildDefinitionPath, hasOwn, isRecord } from './utils';

const getSchemaPropertyOrder = (schema: RequestJsonSchema | undefined, fallbackOrder: number) => {
  const schemaOrder = schema?.['x-order'];
  return typeof schemaOrder === 'number' && Number.isFinite(schemaOrder) ? schemaOrder : fallbackOrder;
};

const getSortedSchemaPropertyEntries = (properties: Record<string, RequestJsonSchema>) =>
  Object.entries(properties)
    .map(([key, propertySchema], index) => ({
      key,
      propertySchema,
      index,
      order: getSchemaPropertyOrder(propertySchema, index),
    }))
    .sort((left, right) => left.order - right.order || left.index - right.index);

const flattenSchemaProperties = (
  properties: Record<string, RequestJsonSchema>,
  parentPath = '',
  depth = 0,
): RequestDefinition[] => {
  const definitions: RequestDefinition[] = [];

  getSortedSchemaPropertyEntries(properties).forEach(({ key, propertySchema, order }) => {
    const fieldPath = buildDefinitionPath(parentPath, key);

    definitions.push({
      id: `schema-property-${fieldPath}`,
      path: fieldPath,
      name: key,
      type: normalizeDefinitionType(propertySchema),
      description: String(propertySchema?.description ?? ''),
      format: String(propertySchema?.format ?? ''),
      order,
      depth,
      parentPath: parentPath || null,
      source: 'schema.properties',
      defaultValue: propertySchema?.default !== undefined ? String(propertySchema.default) : undefined,
    });

    if (isRecord(propertySchema?.properties)) {
      definitions.push(...flattenSchemaProperties(propertySchema.properties, fieldPath, depth + 1));
    }
  });

  return definitions;
};

export const normalizeRequestDefinitionOrders = <T extends Pick<RequestDefinition, 'order' | 'parentPath'>>(
  definitions: T[],
): T[] => {
  const siblingOrderMap = new Map<string, number>();

  return definitions.map((definition) => {
    const siblingKey = definition.parentPath ?? '__root__';
    const nextOrder = siblingOrderMap.get(siblingKey) ?? 0;
    siblingOrderMap.set(siblingKey, nextOrder + 1);

    return {
      ...definition,
      order: nextOrder,
    };
  });
};

export const getRequestDefinitions = (content?: RequestContentLike | null): RequestDefinition[] => {
  const schema = parseRequestSchemaValue(getRequestSchemaSourceValue(content));
  if (schema && hasOwn(schema, 'properties') && isRecord(schema.properties)) {
    return normalizeRequestDefinitionOrders(flattenSchemaProperties(schema.properties));
  }

  const legacyProperties = buildLegacyInputProperties(content?.inputs);

  if (Object.keys(legacyProperties).length === 0) {
    return [];
  }

  return normalizeRequestDefinitionOrders(
    flattenSchemaProperties(legacyProperties).map((definition) => ({
      ...definition,
      source: 'content.inputs',
    })),
  );
};

export const buildRequestSchemaFromDefinitions = (
  schemaValue: unknown,
  definitions: Array<
    Pick<RequestDefinition, 'name' | 'path' | 'type' | 'description' | 'format' | 'order' | 'parentPath'>
  >,
): string => {
  const currentSchema = parseRequestSchemaValue(schemaValue) ?? {};
  const nextProperties: Record<string, RequestJsonSchema> = {};
  const normalizedDefinitions = normalizeRequestDefinitionOrders(definitions);

  normalizedDefinitions.forEach((definition) => {
    if (!normalizeRequestFieldKey(definition.name)) {
      return;
    }

    const key = definition.path.split('.').map(normalizeRequestFieldKey).filter(Boolean).join('.');
    if (!key) {
      return;
    }

    setSchemaPropertyByPath(nextProperties, key, definition);
  });

  const nextSchema: RequestJsonSchema = {
    ...currentSchema,
    type: 'object',
    properties: nextProperties,
  };

  return stringifyRequestSchemaValue(nextSchema);
};
