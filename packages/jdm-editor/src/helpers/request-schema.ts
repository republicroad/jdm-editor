import json5 from 'json5';

const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export type RequestJsonSchema = {
  type?: string | string[];
  description?: string;
  format?: string;
  properties?: Record<string, RequestJsonSchema>;
  items?: RequestJsonSchema | RequestJsonSchema[];
  examples?: unknown[];
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
};

export type RequestExampleSource = {
  id: string;
  name: string;
  data: Record<string, unknown>;
  source: 'schema.examples' | 'content.inputs';
};

export const formatRequestExampleSourceName = (index: number, dataLabel = 'Data') => `${dataLabel} ${index + 1}`;

const cloneRequestExampleValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => cloneRequestExampleValue(item));
  }

  if (isRecord(value)) {
    return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, item]) => {
      acc[key] = cloneRequestExampleValue(item);
      return acc;
    }, {});
  }

  return value;
};

const normalizeSchemaType = (schema?: RequestJsonSchema | null): string | undefined => {
  if (!schema) {
    return undefined;
  }

  if (Array.isArray(schema.type)) {
    return schema.type.find((item) => item !== 'null') ?? schema.type[0];
  }

  return schema.type;
};

const normalizeLegacyType = (
  type?: string,
): {
  type: RequestDefinitionType;
  format: string;
} => {
  switch (type) {
    case 'bool':
    case 'boolean':
      return { type: 'boolean', format: '' };
    case 'number':
    case 'integer':
      return { type: 'number', format: '' };
    case 'array':
      return { type: 'array', format: '' };
    case 'object':
      return { type: 'object', format: '' };
    case 'datetime':
      return { type: 'datetime', format: 'date-time' };
    case 'string':
      return { type: 'string', format: '' };
    default:
      return { type: 'string', format: '' };
  }
};

const isDateLikeFormat = (format?: unknown) => {
  if (typeof format !== 'string') {
    return false;
  }

  return ['date-time', 'datetime', 'utc-millisec'].includes(format);
};

const defaultRequestDateTimeTimezone = '+08:00';

const normalizeRequestTimezoneOffset = (timezone?: string) => {
  if (!timezone) {
    return defaultRequestDateTimeTimezone;
  }

  if (timezone === 'Z') {
    return 'Z';
  }

  if (/^[+-]\d{2}:\d{2}$/.test(timezone)) {
    return timezone;
  }

  if (/^[+-]\d{4}$/.test(timezone)) {
    return `${timezone.slice(0, 3)}:${timezone.slice(3)}`;
  }

  return defaultRequestDateTimeTimezone;
};

export const normalizeRequestDateTimeValue = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  const normalizedMatch = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2}:\d{2})(\.\d+)?)?(?:\s*(Z|[+-]\d{2}:?\d{2}))?$/,
  );
  if (!normalizedMatch) {
    return trimmed;
  }

  const [, datePart, timePart = '00:00:00', fractionPart = '', timezonePart] = normalizedMatch;
  return `${datePart}T${timePart}${fractionPart}${normalizeRequestTimezoneOffset(timezonePart)}`;
};

const normalizeDefinitionType = (schema?: RequestJsonSchema | null): RequestDefinitionType => {
  if (!schema) {
    return 'string';
  }

  if (isRecord(schema.properties)) {
    return 'object';
  }

  const schemaType = normalizeSchemaType(schema);
  if (schemaType === 'string' && isDateLikeFormat(schema.format)) {
    return 'datetime';
  }

  switch (schemaType) {
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return 'array';
    case 'object':
      return 'object';
    default:
      return 'string';
  }
};

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

const buildDefinitionPath = (parentPath: string, name: string) => (parentPath ? `${parentPath}.${name}` : name);

const getPathSegments = (path: string) =>
  path
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);

const setPathValue = (source: Record<string, unknown>, path: string, value: unknown) => {
  const segments = getPathSegments(path);

  if (segments.length === 0) {
    return;
  }

  let cursor: Record<string, unknown> = source;
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      cursor[segment] = value;
      return;
    }

    if (!isRecord(cursor[segment])) {
      cursor[segment] = {};
    }

    cursor = cursor[segment] as Record<string, unknown>;
  });
};

const getPathValue = (source: Record<string, unknown>, path: string): unknown => {
  const segments = getPathSegments(path);

  if (segments.length === 0) {
    return undefined;
  }

  let cursor: unknown = source;

  for (let index = 0; index < segments.length; index += 1) {
    if (!isRecord(cursor)) {
      return undefined;
    }

    const segment = segments[index];
    const nextValue = cursor[segment];

    if (index === segments.length - 1) {
      return nextValue;
    }

    cursor = nextValue;
  }

  return undefined;
};

const deletePathValue = (source: Record<string, unknown>, path: string) => {
  const segments = getPathSegments(path);

  if (segments.length === 0) {
    return;
  }

  const visit = (cursor: Record<string, unknown>, index: number): boolean => {
    const segment = segments[index];
    if (!hasOwn(cursor, segment)) {
      return Object.keys(cursor).length === 0;
    }

    if (index === segments.length - 1) {
      delete cursor[segment];
      return Object.keys(cursor).length === 0;
    }

    const nextValue = cursor[segment];
    if (!isRecord(nextValue)) {
      delete cursor[segment];
      return Object.keys(cursor).length === 0;
    }

    const shouldDeleteCurrent = visit(nextValue, index + 1);
    if (shouldDeleteCurrent) {
      delete cursor[segment];
    }

    return Object.keys(cursor).length === 0;
  };

  visit(source, 0);
};

const mergeRecordWithTargetPrecedence = (
  sourceValue: Record<string, unknown>,
  targetValue: Record<string, unknown>,
): Record<string, unknown> => {
  const merged = cloneRequestExampleValue(sourceValue) as Record<string, unknown>;

  Object.entries(targetValue).forEach(([key, value]) => {
    const sourceEntry = merged[key];
    if (isRecord(sourceEntry) && isRecord(value)) {
      merged[key] = mergeRecordWithTargetPrecedence(sourceEntry, value);
      return;
    }

    merged[key] = cloneRequestExampleValue(value);
  });

  return merged;
};

const setMergedPathValue = (source: Record<string, unknown>, path: string, value: unknown) => {
  const existingValue = getPathValue(source, path);

  if (isRecord(value) && isRecord(existingValue)) {
    setPathValue(source, path, mergeRecordWithTargetPrecedence(value, existingValue));
    return;
  }

  setPathValue(source, path, cloneRequestExampleValue(value));
};

const parseLegacyInputValue = (input: LegacyRequestInput) => {
  switch (input.type) {
    case 'bool':
    case 'boolean': {
      if (typeof input.value === 'string') {
        return input.value === 'true';
      }

      return Boolean(input.value);
    }
    case 'number':
    case 'integer': {
      const numericValue = Number(input.value);
      return Number.isFinite(numericValue) ? numericValue : input.value;
    }
    case 'array':
      if (Array.isArray(input.value)) {
        return input.value;
      }

      if (typeof input.value === 'string' && input.value.trim()) {
        try {
          const parsed = json5.parse(input.value);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }

      return [];
    case 'object':
      if (isRecord(input.value)) {
        return input.value;
      }

      if (typeof input.value === 'string' && input.value.trim()) {
        try {
          const parsed = json5.parse(input.value);
          return isRecord(parsed) ? parsed : {};
        } catch {
          return {};
        }
      }

      return {};
    case 'datetime':
      return normalizeRequestDateTimeValue(input.value ?? '');
    default:
      return input.value ?? '';
  }
};

export const stringifyRequestSchemaValue = (schema?: unknown): string => {
  if (!schema) {
    return '';
  }

  if (typeof schema === 'string') {
    return schema;
  }

  if (isRecord(schema)) {
    return JSON.stringify(schema, null, 2);
  }

  return '';
};

export const parseRequestSchemaValue = (schema?: unknown): RequestJsonSchema | null => {
  if (!schema) {
    return null;
  }

  if (typeof schema === 'string') {
    const trimmed = schema.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const parsed = json5.parse(trimmed);
      return isRecord(parsed) ? (parsed as RequestJsonSchema) : null;
    } catch {
      return null;
    }
  }

  return isRecord(schema) ? (schema as RequestJsonSchema) : null;
};

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

const inferSchemaFromLegacyValue = (value: unknown): RequestJsonSchema => {
  if (Array.isArray(value)) {
    const sampleItem = value.find((item) => item !== undefined && item !== null);

    return {
      type: 'array',
      items: sampleItem === undefined ? { type: 'string' } : inferSchemaFromLegacyValue(sampleItem),
    };
  }

  if (isRecord(value)) {
    return {
      type: 'object',
      properties: Object.entries(value).reduce<Record<string, RequestJsonSchema>>((acc, [key, itemValue]) => {
        acc[key] = inferSchemaFromLegacyValue(itemValue);
        return acc;
      }, {}),
    };
  }

  switch (typeof value) {
    case 'number':
      return { type: 'number' };
    case 'boolean':
      return { type: 'boolean' };
    default:
      return { type: 'string' };
  }
};

const buildLegacyInputSchemaProperty = (input: LegacyRequestInput): RequestJsonSchema => {
  const normalizedType = normalizeLegacyType(input.type);
  const parsedValue = parseLegacyInputValue(input);
  const inferredValueSchema = inferSchemaFromLegacyValue(parsedValue);
  const hasExplicitType = typeof input.type === 'string' && input.type.trim().length > 0;
  const resolvedType = hasExplicitType ? normalizedType.type : normalizeDefinitionType(inferredValueSchema);
  const schemaProperty = createSchemaProperty({
    type: resolvedType,
    description: String(input.description ?? input.desc ?? ''),
    format: resolvedType === 'datetime' ? normalizedType.format : '',
    order: 0,
  });

  if (resolvedType === 'object') {
    schemaProperty.properties = isRecord(inferredValueSchema.properties)
      ? inferredValueSchema.properties
      : (schemaProperty.properties ?? {});
  }

  if (resolvedType === 'array') {
    schemaProperty.items = inferredValueSchema.items ?? schemaProperty.items ?? { type: 'string' };
  }

  return schemaProperty;
};

const setSchemaPropertySchemaByPath = (
  properties: Record<string, RequestJsonSchema>,
  key: string,
  schemaProperty: RequestJsonSchema,
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
      const nextProperty: RequestJsonSchema = {
        ...existing,
        ...schemaProperty,
      };

      if (isRecord(existing.properties) || isRecord(schemaProperty.properties)) {
        nextProperty.properties = {
          ...(isRecord(existing.properties) ? existing.properties : {}),
          ...(isRecord(schemaProperty.properties) ? schemaProperty.properties : {}),
        };
      }

      if (schemaProperty.items !== undefined || existing.items !== undefined) {
        nextProperty.items = schemaProperty.items ?? existing.items;
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

const buildLegacyInputProperties = (inputs?: LegacyRequestInput[]): Record<string, RequestJsonSchema> => {
  const legacyProperties: Record<string, RequestJsonSchema> = {};

  (inputs ?? []).forEach((input) => {
    const key = String(input.key ?? '').trim();
    if (!key) {
      return;
    }

    setSchemaPropertySchemaByPath(legacyProperties, key, buildLegacyInputSchemaProperty(input));
  });

  return legacyProperties;
};

export const getRequestDefinitions = (content?: RequestContentLike | null): RequestDefinition[] => {
  const schema = parseRequestSchemaValue(content?.schema);
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

export const legacyInputsToExampleObject = (inputs?: LegacyRequestInput[]): Record<string, unknown> => {
  const example: Record<string, unknown> = {};

  (inputs ?? []).forEach((input) => {
    const key = String(input.key ?? '').trim();
    if (!key) {
      return;
    }

    setPathValue(example, key, parseLegacyInputValue(input));
  });

  return example;
};

const getDefaultExampleValueByDefinitionType = (type: RequestDefinitionType): unknown => {
  const padNumber = (value: number) => String(value).padStart(2, '0');
  const getDefaultDateTimeValue = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = padNumber(now.getMonth() + 1);
    const day = padNumber(now.getDate());
    const timezoneOffsetMinutes = -now.getTimezoneOffset();
    const timezoneSign = timezoneOffsetMinutes >= 0 ? '+' : '-';
    const absoluteOffsetMinutes = Math.abs(timezoneOffsetMinutes);
    const offsetHours = padNumber(Math.floor(absoluteOffsetMinutes / 60));
    const offsetMinutes = padNumber(absoluteOffsetMinutes % 60);

    return `${year}-${month}-${day}T00:00:00${timezoneSign}${offsetHours}:${offsetMinutes}`;
  };

  switch (type) {
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object':
      return {};
    case 'datetime':
      return getDefaultDateTimeValue();
    default:
      return '';
  }
};

export const buildRequestExampleTemplateFromDefinitions = (
  definitions: Array<Pick<RequestDefinition, 'name' | 'path' | 'type'>>,
): Record<string, unknown> => {
  const template: Record<string, unknown> = {};
  const orderedDefinitions = [...definitions]
    .filter((definition) => definition.name.trim() && definition.path.trim())
    .sort((left, right) => left.path.split('.').length - right.path.split('.').length);

  orderedDefinitions.forEach((definition) => {
    setPathValue(template, definition.path, getDefaultExampleValueByDefinitionType(definition.type));
  });

  return template;
};

const mergeRequestExampleValueWithTemplate = (templateValue: unknown, dataValue: unknown): unknown => {
  if (isRecord(templateValue)) {
    if (!isRecord(dataValue)) {
      return dataValue === undefined ? cloneRequestExampleValue(templateValue) : cloneRequestExampleValue(dataValue);
    }

    const mergedObject: Record<string, unknown> = {};

    Object.keys(templateValue).forEach((key) => {
      mergedObject[key] = mergeRequestExampleValueWithTemplate(templateValue[key], dataValue[key]);
    });

    Object.keys(dataValue).forEach((key) => {
      if (!(key in mergedObject)) {
        mergedObject[key] = cloneRequestExampleValue(dataValue[key]);
      }
    });

    return mergedObject;
  }

  if (dataValue !== undefined) {
    return cloneRequestExampleValue(dataValue);
  }

  return cloneRequestExampleValue(templateValue);
};

export const mergeRequestExampleDataWithTemplate = (
  template: Record<string, unknown>,
  data?: Record<string, unknown>,
): Record<string, unknown> => {
  const normalizedData = isRecord(data) ? data : {};
  return mergeRequestExampleValueWithTemplate(template, normalizedData) as Record<string, unknown>;
};

export const normalizeRequestExampleDataByDefinitions = (
  data: Record<string, unknown>,
  definitions: Array<Pick<RequestDefinition, 'path' | 'type'>>,
): Record<string, unknown> => {
  const normalizedData = cloneRequestExampleValue(data) as Record<string, unknown>;

  definitions.forEach((definition) => {
    if (definition.type !== 'datetime') {
      return;
    }

    const definitionPath = definition.path.trim();
    if (!definitionPath) {
      return;
    }

    const currentValue = getPathValue(normalizedData, definitionPath);
    if (currentValue === undefined) {
      return;
    }

    setPathValue(normalizedData, definitionPath, normalizeRequestDateTimeValue(currentValue));
  });

  return normalizedData;
};

export const syncRequestExampleDataWithDefinitionChanges = (
  data: Record<string, unknown>,
  previousDefinitions: Array<Pick<RequestDefinition, 'id' | 'path'>>,
  nextDefinitions: Array<Pick<RequestDefinition, 'id' | 'path'>>,
): Record<string, unknown> => {
  const syncedData = cloneRequestExampleValue(data) as Record<string, unknown>;
  const nextDefinitionById = new Map(nextDefinitions.map((definition) => [definition.id, definition]));

  const removedPaths = previousDefinitions
    .filter((definition) => !nextDefinitionById.has(definition.id))
    .map((definition) => definition.path)
    .sort((left, right) => right.split('.').length - left.split('.').length);

  removedPaths.forEach((path) => deletePathValue(syncedData, path));

  const renamedPaths = previousDefinitions
    .flatMap((definition) => {
      const nextDefinition = nextDefinitionById.get(definition.id);
      if (!nextDefinition || nextDefinition.path === definition.path) {
        return [];
      }

      return [
        {
          from: definition.path,
          to: nextDefinition.path,
        },
      ];
    })
    .sort((left, right) => right.from.split('.').length - left.from.split('.').length);

  renamedPaths.forEach(({ from, to }) => {
    const value = getPathValue(syncedData, from);
    if (value === undefined) {
      return;
    }

    deletePathValue(syncedData, from);
    setMergedPathValue(syncedData, to, value);
  });

  return syncedData;
};

const buildRequestSchemaFromLegacyInputs = (
  inputs?: LegacyRequestInput[],
  options?: {
    includeExamples?: boolean;
  },
): RequestJsonSchema | null => {
  const legacyProperties = buildLegacyInputProperties(inputs);

  if (Object.keys(legacyProperties).length === 0) {
    return null;
  }

  const nextSchema: RequestJsonSchema = {
    type: 'object',
    properties: legacyProperties,
  };

  if (options?.includeExamples) {
    nextSchema.examples = [legacyInputsToExampleObject(inputs)];
  }

  return nextSchema;
};

export const resolveRequestSchemaValue = (
  content?: RequestContentLike | null,
  options?: {
    includeExamples?: boolean;
  },
): RequestJsonSchema | null => {
  const parsedSchema = parseRequestSchemaValue(content?.schema);
  const hasSchemaProperties = Boolean(parsedSchema && isRecord(parsedSchema.properties));

  if (parsedSchema && (hasSchemaProperties || (content?.inputs ?? []).length === 0)) {
    return parsedSchema;
  }

  return buildRequestSchemaFromLegacyInputs(content?.inputs, options) ?? parsedSchema;
};

export const stringifyResolvedRequestSchemaValue = (
  content?: RequestContentLike | null,
  options?: {
    includeExamples?: boolean;
  },
): string => stringifyRequestSchemaValue(resolveRequestSchemaValue(content, options));

export const getRequestExampleSources = (
  content?: RequestContentLike | null,
  options?: {
    dataLabel?: string;
  },
): RequestExampleSource[] => {
  const schema = parseRequestSchemaValue(content?.schema);
  const dataLabel = options?.dataLabel ?? 'Data';
  const schemaExamples = Array.isArray(schema?.examples) ? schema.examples : [];

  if (schemaExamples.length > 0) {
    return schemaExamples.map((example, index) => ({
      id: `schema-example-${index}`,
      name: formatRequestExampleSourceName(index, dataLabel),
      data: isRecord(example) ? { ...example } : { value: example },
      source: 'schema.examples',
    }));
  }

  if ((content?.inputs ?? []).length > 0) {
    return [
      {
        id: 'schema-example-0',
        name: formatRequestExampleSourceName(0, dataLabel),
        data: legacyInputsToExampleObject(content?.inputs),
        source: 'schema.examples',
      },
    ];
  }

  return [];
};

const createSchemaProperty = (
  definition: Pick<RequestDefinition, 'type' | 'description' | 'format' | 'order'>,
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

  schema['x-order'] = definition.order;

  return schema;
};

const setSchemaPropertyByPath = (
  properties: Record<string, RequestJsonSchema>,
  key: string,
  definition: Pick<RequestDefinition, 'type' | 'description' | 'format' | 'order'>,
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

export const buildRequestSchemaFromDefinitions = (
  schemaValue: unknown,
  definitions: Array<Pick<RequestDefinition, 'name' | 'path' | 'type' | 'description' | 'format' | 'order' | 'parentPath'>>,
): string => {
  const currentSchema = parseRequestSchemaValue(schemaValue) ?? {};
  const nextProperties: Record<string, RequestJsonSchema> = {};
  const normalizedDefinitions = normalizeRequestDefinitionOrders(definitions);

  normalizedDefinitions.forEach((definition) => {
    if (!definition.name.trim()) {
      return;
    }

    const key = definition.path.trim();
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

export const updateRequestSchemaExamples = (
  schemaValue: unknown,
  examples: Array<Record<string, unknown>>,
): string => {
  const currentSchema = parseRequestSchemaValue(schemaValue) ?? {};
  const nextSchema: RequestJsonSchema = {
    ...currentSchema,
    type: 'object',
    examples: examples.map((example) => ({ ...example })),
  };

  return stringifyRequestSchemaValue(nextSchema);
};
