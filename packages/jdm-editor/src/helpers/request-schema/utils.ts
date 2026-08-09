export const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

export const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const cloneRequestExampleValue = (value: unknown): unknown => {
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

export const buildDefinitionPath = (parentPath: string, name: string) => (parentPath ? `${parentPath}.${name}` : name);

const getPathSegments = (path: string) =>
  path
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);

export const setPathValue = (source: Record<string, unknown>, path: string, value: unknown) => {
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

export const getPathValue = (source: Record<string, unknown>, path: string): unknown => {
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

export const deletePathValue = (source: Record<string, unknown>, path: string) => {
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

export const setMergedPathValue = (source: Record<string, unknown>, path: string, value: unknown) => {
  const existingValue = getPathValue(source, path);

  if (isRecord(value) && isRecord(existingValue)) {
    setPathValue(source, path, mergeRecordWithTargetPrecedence(value, existingValue));
    return;
  }

  setPathValue(source, path, cloneRequestExampleValue(value));
};
