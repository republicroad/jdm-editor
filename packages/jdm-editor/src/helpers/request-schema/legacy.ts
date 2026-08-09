import json5 from 'json5';

import { normalizeDefinitionType, normalizeRequestDateTimeValue } from './normalize';
import { createSchemaProperty } from './schema-property';
import type { LegacyRequestInput, RequestDefinitionType, RequestJsonSchema } from './types';
import { isRecord, setPathValue } from './utils';

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

export const parseLegacyInputValue = (input: LegacyRequestInput) => {
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

export const buildLegacyInputProperties = (inputs?: LegacyRequestInput[]): Record<string, RequestJsonSchema> => {
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

export const buildRequestSchemaFromLegacyInputs = (
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
