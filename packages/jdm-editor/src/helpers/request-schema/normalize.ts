import type { RequestDefinitionType, RequestJsonSchema } from './types';
import { isRecord } from './utils';

const invisibleFormatCharacters = /[\u00ad\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g;

export const normalizeRequestFieldKey = (key: string) => key.replace(invisibleFormatCharacters, '').trim();

export const normalizeRequestJsonKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(normalizeRequestJsonKeys);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.entries(value).reduce<Record<string, unknown>>((normalizedValue, [key, item]) => {
    normalizedValue[normalizeRequestFieldKey(key)] = normalizeRequestJsonKeys(item);
    return normalizedValue;
  }, {});
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

const isDateLikeFormat = (format?: unknown) => {
  if (typeof format !== 'string') {
    return false;
  }

  return ['date-time', 'datetime', 'utc-millisec'].includes(format);
};

export const normalizeDefinitionType = (schema?: RequestJsonSchema | null): RequestDefinitionType => {
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

const defaultRequestDateTimeTimezone = '+08:00';
export const requestDateTimePattern =
  /^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2}:\d{2})(\.\d+)?)?(?:\s*(Z|[+-]\d{2}:?\d{2}))?$/;

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

  const normalizedMatch = trimmed.match(requestDateTimePattern);
  if (!normalizedMatch) {
    return trimmed;
  }

  const [, datePart, timePart = '00:00:00', fractionPart = '', timezonePart] = normalizedMatch;
  return `${datePart}T${timePart}${fractionPart}${normalizeRequestTimezoneOffset(timezonePart)}`;
};
