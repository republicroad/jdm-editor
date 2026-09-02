import { useEffect, useMemo, useRef, useState } from 'react';

import {
  type RequestContentLike,
  type RequestDefinition,
  type RequestDefinitionType,
  buildRequestSchemaFromDefinitions,
  getRequestDefinitions,
  normalizeRequestDefinitionOrders,
  normalizeRequestFieldKey,
  parseRequestSchemaValue,
  stringifyRequestSchemaValue,
} from '../../../helpers/request-schema';
import type { TranslationKey } from '../../../theming/i18n';

const definitionRootKey = '__root__';

const buildDefinitionPath = (parentPath: string | null | undefined, name: string) =>
  parentPath ? `${parentPath}.${name}` : name;

const buildDefinitionDraftPath = (parentPath: string | null | undefined, id: string) =>
  parentPath ? `${parentPath}.__draft_${id}` : `__draft_${id}`;

const createDefinitionDraft = (parentPath?: string | null, depth = 0, name = ''): RequestDefinition => {
  const id = crypto.randomUUID();
  const trimmedName = name.trim();

  return {
    id,
    path: trimmedName ? buildDefinitionPath(parentPath, trimmedName) : buildDefinitionDraftPath(parentPath, id),
    name,
    type: 'string',
    description: '',
    format: '',
    order: 0,
    depth,
    parentPath: parentPath ?? null,
    source: 'schema.properties',
  };
};

const createRequestDefinitionSyncSignature = (
  definitions: Array<
    Pick<RequestDefinition, 'path' | 'name' | 'type' | 'description' | 'format' | 'parentPath' | 'depth'>
  >,
) =>
  JSON.stringify(
    definitions
      .filter((definition) => definition.name.trim())
      .map((definition) => ({
        path: definition.path,
        name: definition.name,
        type: definition.type,
        description: definition.description,
        format: definition.format,
        parentPath: definition.parentPath,
        depth: definition.depth,
      })),
  );

const mergePersistedDefinitionsWithLocalDraftOrder = (
  previousDefinitions: RequestDefinition[],
  persistedDefinitions: RequestDefinition[],
) => {
  const persistedByPath = new Map(persistedDefinitions.map((definition) => [definition.path, definition]));
  const availablePaths = new Set(persistedDefinitions.map((definition) => definition.path));
  const mergedDefinitions: RequestDefinition[] = [];

  previousDefinitions.forEach((definition) => {
    if (!definition.name.trim()) {
      if (definition.parentPath === null || availablePaths.has(definition.parentPath)) {
        mergedDefinitions.push(definition);
      }

      return;
    }

    const persistedDefinition = persistedByPath.get(definition.path);
    if (!persistedDefinition) {
      return;
    }

    persistedByPath.delete(definition.path);
    mergedDefinitions.push({
      ...persistedDefinition,
      id: definition.id,
    });
  });

  mergedDefinitions.push(...persistedByPath.values());
  return mergedDefinitions;
};

type UseRequestDefinitionsEditingParams = {
  id: string;
  content: RequestContentLike | undefined;
  t: (key: TranslationKey) => string;
  sourceSchemaValue: unknown;
  updateNodeSchema: (nextSchema: string) => void;
};

export const useRequestDefinitionsEditing = ({
  id,
  content,
  t,
  sourceSchemaValue,
  updateNodeSchema,
}: UseRequestDefinitionsEditingParams) => {
  const persistedDefinitions = useMemo(
    () => getRequestDefinitions(content),
    [content?.schema, content?.schemaUI, content?.inputs],
  );
  const [definitionDrafts, setDefinitionDrafts] = useState<RequestDefinition[]>(persistedDefinitions);
  const definitionDraftsRef = useRef<RequestDefinition[]>(definitionDrafts);
  const [collapsedDefinitionPaths, setCollapsedDefinitionPaths] = useState<Record<string, true>>({});
  const persistedDefinitionSignature = useMemo(
    () => createRequestDefinitionSyncSignature(persistedDefinitions),
    [persistedDefinitions],
  );
  const pendingDefinitionSyncSignatureRef = useRef<string | null>(null);
  const previousNodeIdRef = useRef(id);

  useEffect(() => {
    definitionDraftsRef.current = definitionDrafts;
  }, [definitionDrafts]);

  useEffect(() => {
    if (previousNodeIdRef.current === id) {
      return;
    }

    previousNodeIdRef.current = id;
    pendingDefinitionSyncSignatureRef.current = null;
  }, [id]);

  useEffect(() => {
    setDefinitionDrafts((previousDefinitions) => {
      const isLocalDefinitionSync =
        pendingDefinitionSyncSignatureRef.current !== null &&
        pendingDefinitionSyncSignatureRef.current === persistedDefinitionSignature;
      pendingDefinitionSyncSignatureRef.current = null;

      if (isLocalDefinitionSync) {
        const mergedDefinitions = mergePersistedDefinitionsWithLocalDraftOrder(
          previousDefinitions,
          persistedDefinitions,
        );

        return mergedDefinitions;
      }

      const pendingDefinitions = previousDefinitions.filter((definition) => !definition.name.trim());
      if (pendingDefinitions.length === 0) {
        return persistedDefinitions;
      }

      const availablePaths = new Set(persistedDefinitions.map((definition) => definition.path));
      const safePendingDefinitions = pendingDefinitions.filter(
        (definition) => definition.parentPath === null || availablePaths.has(definition.parentPath),
      );

      return [...persistedDefinitions, ...safePendingDefinitions];
    });
  }, [id, persistedDefinitionSignature, persistedDefinitions]);

  const definitionChildrenMap = useMemo(() => {
    const map = new Map<string, RequestDefinition[]>();
    definitionDrafts.forEach((definition) => {
      const key = definition.parentPath ?? definitionRootKey;
      const current = map.get(key) ?? [];
      current.push(definition);
      map.set(key, current);
    });

    return map;
  }, [definitionDrafts]);

  const rootDefinitions = useMemo(() => definitionChildrenMap.get(definitionRootKey) ?? [], [definitionChildrenMap]);

  const definitionTypeOptions = useMemo<Array<{ value: RequestDefinitionType; label: string }>>(
    () => [
      { value: 'string', label: t('request.typeString') },
      { value: 'number', label: t('request.typeNumber') },
      { value: 'array', label: t('request.typeArray') },
      { value: 'object', label: t('request.typeObject') },
      { value: 'datetime', label: t('request.typeDatetime') },
      { value: 'boolean', label: t('request.typeBoolean') },
    ],
    [t],
  );

  const persistDefinitions = (nextDefinitions: RequestDefinition[]) => {
    const normalizedDefinitions = normalizeRequestDefinitionOrders(nextDefinitions);
    const hasValidDefinitions = normalizedDefinitions.some(
      (definition) => definition.name.trim() && definition.path.trim(),
    );
    pendingDefinitionSyncSignatureRef.current = createRequestDefinitionSyncSignature(normalizedDefinitions);
    setDefinitionDrafts(normalizedDefinitions);

    if (!hasValidDefinitions) {
      const currentSchema = parseRequestSchemaValue(sourceSchemaValue);
      const nextSchemaObject =
        currentSchema && Array.isArray(currentSchema.examples)
          ? {
              ...currentSchema,
              type: 'object',
              properties: {},
            }
          : null;

      updateNodeSchema(nextSchemaObject ? stringifyRequestSchemaValue(nextSchemaObject) : '');
      return;
    }

    updateNodeSchema(buildRequestSchemaFromDefinitions(sourceSchemaValue, normalizedDefinitions));
  };

  const getBranchEndIndex = <T extends { path: string }>(items: T[], path: string) => {
    const prefix = `${path}.`;
    let endIndex = items.findIndex((item) => item.path === path);
    if (endIndex < 0) {
      return items.length;
    }

    endIndex += 1;
    while (endIndex < items.length && items[endIndex].path.startsWith(prefix)) {
      endIndex += 1;
    }

    return endIndex;
  };

  const updateDefinitionDescription = (index: number, description: string) => {
    persistDefinitions(
      definitionDrafts.map((definition, currentIndex) =>
        currentIndex === index
          ? {
              ...definition,
              description,
            }
          : definition,
      ),
    );
  };

  const updateDefinitionDefaultValue = (index: number, defaultValue: string) => {
    persistDefinitions(
      definitionDrafts.map((definition, currentIndex) =>
        currentIndex === index
          ? {
              ...definition,
              defaultValue: defaultValue.trim() || undefined,
            }
          : definition,
      ),
    );
  };

  const updateDefinitionName = (index: number, name: string) => {
    const target = definitionDrafts[index];
    if (!target) {
      return;
    }

    const normalizedName = normalizeRequestFieldKey(name);
    const hasChildDefinitions = definitionDrafts.some((definition) => definition.parentPath === target.path);
    if (hasChildDefinitions && !normalizedName) {
      return;
    }

    const nextPath = normalizedName
      ? buildDefinitionPath(target.parentPath, normalizedName)
      : buildDefinitionDraftPath(target.parentPath, target.id);
    const nextDefinitions = definitionDrafts.map((definition) => {
      if (definition.path !== target.path && !definition.path.startsWith(`${target.path}.`)) {
        return definition;
      }

      if (definition.path === target.path) {
        return {
          ...definition,
          name: normalizedName,
          path: nextPath,
        };
      }

      const suffix = definition.path.slice(target.path.length);
      const descendantPath = nextPath ? `${nextPath}${suffix}` : suffix.replace(/^\./, '');
      const segments = descendantPath.split('.').filter(Boolean);
      const nextName = definition.name.trim() ? (segments[segments.length - 1] ?? definition.name) : definition.name;

      return {
        ...definition,
        path: descendantPath,
        name: nextName,
        parentPath: segments.length > 1 ? segments.slice(0, -1).join('.') : null,
        depth: Math.max(segments.length - 1, 0),
      };
    });

    persistDefinitions(nextDefinitions);
  };

  const updateDefinitionType = (index: number, nextType: RequestDefinitionType) => {
    const target = definitionDrafts[index];
    if (!target) {
      return;
    }

    const nextFormat =
      nextType === 'datetime'
        ? target.format || 'date-time'
        : nextType === 'string'
          ? target.type === 'datetime'
            ? ''
            : target.format
          : '';
    const nextDefinitions = definitionDrafts
      .filter((definition, currentIndex) => {
        if (currentIndex === index) {
          return true;
        }

        if (nextType === 'object') {
          return true;
        }

        return !definition.path.startsWith(`${target.path}.`);
      })
      .map((definition, currentIndex) =>
        currentIndex === index
          ? {
              ...definition,
              type: nextType,
              format: nextFormat,
            }
          : definition,
      );

    persistDefinitions(nextDefinitions);
  };

  const removeDefinition = (index: number) => {
    const target = definitionDrafts[index];
    if (!target) {
      return;
    }

    persistDefinitions(
      definitionDrafts.filter(
        (definition) => definition.path !== target.path && !definition.path.startsWith(`${target.path}.`),
      ),
    );
  };

  const addDefinition = () => {
    persistDefinitions([...definitionDrafts, createDefinitionDraft(null, 0, '')]);
  };

  const addChildDefinition = (index: number) => {
    const parent = definitionDrafts[index];
    if (!parent || parent.type !== 'object' || !parent.path.trim()) {
      return;
    }

    const insertAt = getBranchEndIndex(definitionDrafts, parent.path);
    const nextDefinitions = [...definitionDrafts];
    nextDefinitions.splice(insertAt, 0, createDefinitionDraft(parent.path, parent.depth + 1, ''));
    persistDefinitions(nextDefinitions);
  };

  const toggleDefinitionCollapsed = (path: string) => {
    setCollapsedDefinitionPaths((previousState) => {
      const nextState = { ...previousState };

      if (nextState[path]) {
        delete nextState[path];
      } else {
        nextState[path] = true;
      }

      return nextState;
    });
  };

  const getDefinitionIndex = (definitionId: string) =>
    definitionDrafts.findIndex((definition) => definition.id === definitionId);

  const getDefinitionTypeLabel = (defType: RequestDefinitionType) =>
    definitionTypeOptions.find((option) => option.value === defType)?.label ?? defType;

  return {
    definitionDrafts,
    definitionChildrenMap,
    rootDefinitions,
    definitionTypeOptions,
    collapsedDefinitionPaths,
    toggleDefinitionCollapsed,
    addDefinition,
    addChildDefinition,
    removeDefinition,
    updateDefinitionName,
    updateDefinitionType,
    updateDefinitionDescription,
    updateDefinitionDefaultValue,
    getDefinitionIndex,
    getDefinitionTypeLabel,
  };
};
