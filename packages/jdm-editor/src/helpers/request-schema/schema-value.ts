import json5 from 'json5';

import { buildRequestSchemaFromLegacyInputs } from './legacy';
import type { RequestContentLike, RequestJsonSchema } from './types';
import { isRecord } from './utils';

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

export const isLegacyRequestSchemaContent = (content?: RequestContentLike | null): boolean =>
  content?.schemaUI !== undefined || (content?.inputs ?? []).length > 0;

export const getRequestSchemaStorageField = (content?: RequestContentLike | null): 'schema' | 'schemaUI' =>
  isLegacyRequestSchemaContent(content) ? 'schemaUI' : 'schema';

export const getRequestSchemaSourceValue = (content?: RequestContentLike | null): unknown => {
  if (!content) {
    return undefined;
  }

  if (content.schemaUI !== undefined) {
    return content.schemaUI;
  }

  if ((content.inputs ?? []).length > 0) {
    return undefined;
  }

  return content.schema;
};

export const setRequestSchemaValue = (content: RequestContentLike & Record<string, any>, schemaValue: unknown) => {
  const storageField = getRequestSchemaStorageField(content);
  content[storageField] = schemaValue;

  if (storageField === 'schemaUI') {
    delete content.schema;
  } else {
    delete content.schemaUI;
  }

  delete content.inputs;
};

export const resolveRequestSchemaValue = (
  content?: RequestContentLike | null,
  options?: {
    includeExamples?: boolean;
  },
): RequestJsonSchema | null => {
  const parsedSchema = parseRequestSchemaValue(getRequestSchemaSourceValue(content));
  const hasSchemaProperties = Boolean(parsedSchema && isRecord(parsedSchema.properties));
  const hasSchemaUI = content?.schemaUI !== undefined;

  if (parsedSchema && (hasSchemaProperties || hasSchemaUI || (content?.inputs ?? []).length === 0)) {
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

export const normalizeRequestContentSchemaStorage = <T extends RequestContentLike & Record<string, any>>(
  content: T,
): T => {
  if (!isLegacyRequestSchemaContent(content)) {
    if (content.schemaUI !== undefined) {
      const nextContent = { ...content };
      delete nextContent.schemaUI;
      return nextContent;
    }

    return content;
  }

  const nextContent = { ...content };
  const nextSchema = stringifyResolvedRequestSchemaValue(content, { includeExamples: true });
  nextContent.schemaUI = nextSchema;
  delete nextContent.schema;
  delete nextContent.inputs;

  return nextContent;
};

export const normalizeDecisionGraphRequestSchemaStorage = <T extends { nodes?: any[] }>(graph: T): T => {
  if (!Array.isArray(graph?.nodes)) {
    return graph;
  }

  let hasChanges = false;
  const nextNodes = graph.nodes.map((node) => {
    if (node?.type !== 'inputNode' || !isRecord(node?.content)) {
      return node;
    }

    const nextContent = normalizeRequestContentSchemaStorage(node.content);
    if (nextContent === node.content) {
      return node;
    }

    hasChanges = true;
    return {
      ...node,
      content: nextContent,
    };
  });

  return hasChanges
    ? {
        ...graph,
        nodes: nextNodes,
      }
    : graph;
};
