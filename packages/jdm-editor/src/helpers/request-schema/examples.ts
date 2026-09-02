import { legacyInputsToExampleObject } from './legacy';
import { normalizeRequestDateTimeValue, requestDateTimePattern } from './normalize';
import { getRequestSchemaSourceValue, parseRequestSchemaValue, stringifyRequestSchemaValue } from './schema-value';
import type {
  RequestContentLike,
  RequestDefinition,
  RequestDefinitionSyncConflict,
  RequestDefinitionType,
  RequestExampleMeta,
  RequestExampleSource,
  RequestJsonSchema,
} from './types';
import {
  cloneRequestExampleValue,
  deletePathValue,
  getPathValue,
  isRecord,
  setMergedPathValue,
  setPathValue,
} from './utils';

export const formatRequestExampleSourceName = (index: number, dataLabel = 'Data') => `${dataLabel} ${index + 1}`;

export const formatJsonDraft = (value: unknown) => {
  if (value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value, null, 2);
};

export const collectExampleDataPaths = (value: unknown, prefix = '', paths: string[] = []): string[] => {
  if (!isRecord(value)) {
    return paths;
  }

  Object.entries(value).forEach(([key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isRecord(item)) {
      collectExampleDataPaths(item, path, paths);
    } else {
      paths.push(path);
    }
  });

  return paths;
};

const parseRequestDefinitionDefaultValue = (defaultValue: string | undefined, type: RequestDefinitionType): unknown => {
  if (defaultValue === undefined || !defaultValue.trim()) {
    return undefined;
  }

  const trimmedDefaultValue = defaultValue.trim();

  switch (type) {
    case 'number': {
      const parsedNumber = Number(trimmedDefaultValue);
      return Number.isFinite(parsedNumber) ? parsedNumber : trimmedDefaultValue;
    }
    case 'boolean':
      return trimmedDefaultValue.toLowerCase() === 'true';
    case 'array':
    case 'object': {
      try {
        return JSON.parse(trimmedDefaultValue);
      } catch {
        return trimmedDefaultValue;
      }
    }
    default:
      return trimmedDefaultValue;
  }
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
  definitions: Array<Pick<RequestDefinition, 'name' | 'path' | 'type' | 'defaultValue'>>,
): Record<string, unknown> => {
  const template: Record<string, unknown> = {};
  const orderedDefinitions = [...definitions]
    .filter((definition) => definition.name.trim() && definition.path.trim())
    .sort((left, right) => left.path.split('.').length - right.path.split('.').length);

  orderedDefinitions.forEach((definition) => {
    const definitionDefault = parseRequestDefinitionDefaultValue(definition.defaultValue, definition.type);
    setPathValue(
      template,
      definition.path,
      definitionDefault === undefined ? getDefaultExampleValueByDefinitionType(definition.type) : definitionDefault,
    );
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

const isSkeletonLikeRequestValue = (value: unknown): boolean => {
  if (value === '' || value === 0 || value === false) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (isRecord(value)) {
    const entries = Object.values(value);
    return entries.length === 0 || entries.every((entry) => isSkeletonLikeRequestValue(entry));
  }

  return false;
};

const isRequestValueCompatibleWithDefinition = (
  value: unknown,
  definition: Pick<RequestDefinition, 'type'>,
): boolean => {
  switch (definition.type) {
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return isRecord(value);
    case 'datetime':
      return typeof value === 'string' && requestDateTimePattern.test(value.trim());
    default:
      return typeof value === 'string';
  }
};

export const getRequestExampleDataDefinitionConflicts = (
  data: Record<string, unknown>,
  definitions: Array<Pick<RequestDefinition, 'name' | 'path' | 'type'>>,
): RequestDefinitionSyncConflict[] =>
  definitions
    .filter((definition) => definition.name.trim() && definition.path.trim())
    .flatMap((definition) => {
      const currentValue = getPathValue(data, definition.path.trim());
      if (currentValue === undefined || isRequestValueCompatibleWithDefinition(currentValue, definition)) {
        return [];
      }

      return [
        {
          path: definition.path,
          nextType: definition.type,
          value: cloneRequestExampleValue(currentValue),
        },
      ];
    });

export const prepareRequestExampleDataDefinitionSync = (
  data: Record<string, unknown>,
  definitions: Array<Pick<RequestDefinition, 'name' | 'path' | 'type'>>,
  options?: {
    forceResetConflicts?: boolean;
  },
): {
  data: Record<string, unknown>;
  conflicts: RequestDefinitionSyncConflict[];
} => {
  const validDefinitions = definitions.filter((definition) => definition.name.trim() && definition.path.trim());

  if (validDefinitions.length === 0) {
    return {
      data: cloneRequestExampleValue(data) as Record<string, unknown>,
      conflicts: [],
    };
  }

  const forceResetConflicts = options?.forceResetConflicts ?? false;
  const syncedData = buildRequestExampleTemplateFromDefinitions(validDefinitions);
  const conflicts: RequestDefinitionSyncConflict[] = [];

  validDefinitions
    .slice()
    .sort((left, right) => left.path.split('.').length - right.path.split('.').length)
    .forEach((definition) => {
      const definitionPath = definition.path.trim();
      if (!definitionPath) {
        return;
      }

      const currentValue = getPathValue(data, definitionPath);
      if (currentValue === undefined) {
        return;
      }

      const isCompatible = isRequestValueCompatibleWithDefinition(currentValue, definition);
      if (!isCompatible) {
        if (!isSkeletonLikeRequestValue(currentValue) && !forceResetConflicts) {
          conflicts.push({
            path: definitionPath,
            nextType: definition.type,
            value: cloneRequestExampleValue(currentValue),
          });
          return;
        }

        return;
      }

      if (definition.type === 'object') {
        const hasNestedDefinitions = validDefinitions.some(
          (item) => item.path !== definitionPath && item.path.startsWith(`${definitionPath}.`),
        );

        if (!hasNestedDefinitions && isRecord(currentValue)) {
          setPathValue(syncedData, definitionPath, cloneRequestExampleValue(currentValue));
        }

        return;
      }

      if (definition.type === 'datetime') {
        setPathValue(syncedData, definitionPath, normalizeRequestDateTimeValue(currentValue));
        return;
      }

      setPathValue(syncedData, definitionPath, cloneRequestExampleValue(currentValue));
    });

  return {
    data: normalizeRequestExampleDataByDefinitions(syncedData, validDefinitions),
    conflicts,
  };
};

export const syncRequestExampleDataToDefinitions = (
  data: Record<string, unknown>,
  definitions: Array<Pick<RequestDefinition, 'name' | 'path' | 'type'>>,
): Record<string, unknown> => {
  return prepareRequestExampleDataDefinitionSync(data, definitions, { forceResetConflicts: true }).data;
};

export const mergeRequestExampleDefaultsByDefinitions = (
  data: Record<string, unknown>,
  definitions: Array<Pick<RequestDefinition, 'name' | 'path' | 'type' | 'defaultValue'>>,
): Record<string, unknown> => {
  const mergedData = cloneRequestExampleValue(data) as Record<string, unknown>;

  definitions
    .filter((definition) => definition.name.trim() && definition.path.trim())
    .forEach((definition) => {
      const definitionDefault = parseRequestDefinitionDefaultValue(definition.defaultValue, definition.type);
      if (definitionDefault === undefined) {
        return;
      }

      const definitionPath = definition.path.trim();
      const currentValue = getPathValue(mergedData, definitionPath);
      if (currentValue !== undefined && !isSkeletonLikeRequestValue(currentValue)) {
        return;
      }

      setPathValue(mergedData, definitionPath, cloneRequestExampleValue(definitionDefault));
    });

  return mergedData;
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

export const getRequestExampleSources = (
  content?: RequestContentLike | null,
  options?: {
    dataLabel?: string;
  },
): RequestExampleSource[] => {
  const schema = parseRequestSchemaValue(getRequestSchemaSourceValue(content));
  const dataLabel = options?.dataLabel ?? 'Data';
  const schemaExamples = Array.isArray(schema?.examples) ? schema.examples : [];
  const schemaExamplesMeta = Array.isArray(schema?.['x-examples-meta']) ? schema['x-examples-meta'] : [];

  if (schemaExamples.length > 0) {
    return schemaExamples.map((example, index) => {
      const meta = schemaExamplesMeta[index];
      return {
        id: `schema-example-${index}`,
        name: meta?.name?.trim() || formatRequestExampleSourceName(index, dataLabel),
        description: meta?.description?.trim(),
        data: isRecord(example) ? { ...example } : { value: example },
        source: 'schema.examples',
      };
    });
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

export const updateRequestSchemaExamples = (
  schemaValue: unknown,
  examples: Array<Record<string, unknown>>,
  examplesMeta?: RequestExampleMeta[],
): string => {
  const currentSchema = parseRequestSchemaValue(schemaValue) ?? {};
  const nextSchema: RequestJsonSchema = {
    ...currentSchema,
    type: 'object',
    examples: examples.map((example) => ({ ...example })),
  };

  if (examplesMeta && examplesMeta.length > 0) {
    const hasContent = examplesMeta.some((meta) => meta?.name?.trim() || meta?.description?.trim());
    if (hasContent) {
      nextSchema['x-examples-meta'] = examplesMeta.map((meta) => ({
        name: meta?.name?.trim(),
        description: meta?.description?.trim(),
      }));
    }
  }

  return stringifyRequestSchemaValue(nextSchema);
};
