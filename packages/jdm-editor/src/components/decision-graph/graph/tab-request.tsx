import {
  CloudDownloadOutlined,
  CloudUploadOutlined,
  FormatPainterOutlined,
  ImportOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  PlusCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { Button, Space, Tabs, Tooltip, message, theme } from 'antd';
import type { DragDropManager } from 'dnd-core';
import json5 from 'json5';
import type { editor } from 'monaco-editor';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { saveFile } from '../../../helpers/file-helpers';
import '../../../helpers/monaco';
import {
  type RequestDefinition,
  type RequestDefinitionType,
  type RequestExampleSource,
  buildRequestExampleTemplateFromDefinitions,
  buildRequestSchemaFromDefinitions,
  collectExampleDataPaths,
  formatJsonDraft,
  formatRequestExampleSourceName,
  getPathValue,
  getRequestDefinitions,
  getRequestExampleDataDefinitionConflicts,
  getRequestExampleSources,
  getRequestSchemaSourceValue,
  hasOwn,
  isRecord,
  normalizeRequestDefinitionOrders,
  normalizeRequestExampleDataByDefinitions,
  normalizeRequestFieldKey,
  parseRequestSchemaValue,
  resolveRequestSchemaValue,
  setRequestSchemaValue,
  stringifyRequestSchemaValue,
  updateRequestSchemaExamples,
} from '../../../helpers/request-schema';
import { useTranslation } from '../../../locales';
import { useDecisionGraphActions, useDecisionGraphState } from '../context/dg-store.context';
import { RequestDefinitions } from './request-definitions';
import { RequestExamples } from './request-examples';
import { RequestSchemaEditor } from './request-schema-editor';
import './tab-request.scss';

export type TabRequestProps = {
  id: string;
  manager?: DragDropManager;
  menuList?: any[];
  type?: string;
};

enum RequestTabKey {
  Definitions = 'definitions',
  Examples = 'examples',
  Schema = 'schema',
}

const definitionRootKey = '__root__';

const editorOptions: editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  contextmenu: false,
  fontSize: 13,
  fontFamily: 'var(--mono-font-family)',
  tabSize: 2,
  minimap: { enabled: false },
  overviewRulerBorder: false,
  scrollbar: {
    verticalSliderSize: 4,
    verticalScrollbarSize: 4,
    horizontalScrollbarSize: 4,
    horizontalSliderSize: 4,
  },
};

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

export const TabRequest: React.FC<TabRequestProps> = ({ id, type }) => {
  const { t } = useTranslation();
  const graphActions = useDecisionGraphActions();
  const { token } = theme.useToken();
  const schemaEditorRef = useRef<editor.IStandaloneCodeEditor>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exampleJsonEditorRef = useRef<editor.IStandaloneCodeEditor>();
  const commitExampleJsonRef = useRef<() => void>(() => {});
  const activeExampleSourceIdRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<RequestTabKey>(RequestTabKey.Definitions);
  const [jsonToJsonSchemaOpen, setJsonToJsonSchemaOpen] = useState(false);
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [editingSourceIndex, setEditingSourceIndex] = useState<number | null>(null);
  const [collapsedDefinitionPaths, setCollapsedDefinitionPaths] = useState<Record<string, true>>({});
  const [exampleJsonDrafts, setExampleJsonDrafts] = useState<Record<string, string>>({});
  const [exampleJsonDirtyBySourceId, setExampleJsonDirtyBySourceId] = useState<Record<string, boolean>>({});
  const [descriptionDrafts, setDescriptionDrafts] = useState<Record<string, string>>({});

  const {
    disabled: disabledRaw,
    content,
    nodeName,
    panels,
    activePanel,
    activeGraphTabId,
    simulatorExampleBinding,
  } = useDecisionGraphState(({ disabled, decisionGraph, panels, activePanel, activeTab, simulatorExampleBinding }) => ({
    disabled,
    content: (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content,
    nodeName: (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.name ?? t('request'),
    panels,
    activePanel,
    activeGraphTabId: activeTab,
    simulatorExampleBinding,
  }));
  const disabled = disabledRaw ?? false;

  const sourceSchemaValue = useMemo(
    () => getRequestSchemaSourceValue(content),
    [content?.schema, content?.schemaUI, content?.inputs],
  );
  const sourceSchemaObject = useMemo(() => parseRequestSchemaValue(sourceSchemaValue), [sourceSchemaValue]);
  const schemaObject = useMemo(
    () => resolveRequestSchemaValue(content, { includeExamples: true }),
    [content?.schema, content?.schemaUI, content?.inputs],
  );
  const schemaText = useMemo(() => stringifyRequestSchemaValue(schemaObject), [schemaObject]);
  const persistedSchemaText = useMemo(
    () => stringifyRequestSchemaValue(sourceSchemaValue) || schemaText,
    [sourceSchemaValue, schemaText],
  );
  const persistedDefinitions = useMemo(
    () => getRequestDefinitions(content),
    [content?.schema, content?.schemaUI, content?.inputs],
  );
  const exampleSources = useMemo(
    () => getRequestExampleSources(content, { dataLabel: t('requestDataLabel') }),
    [content, t],
  );
  const [definitionDrafts, setDefinitionDrafts] = useState<RequestDefinition[]>(persistedDefinitions);
  const definitionDraftsRef = useRef<RequestDefinition[]>(definitionDrafts);
  const [schemaDraft, setSchemaDraft] = useState(persistedSchemaText);
  const [isSchemaDraftDirty, setIsSchemaDraftDirty] = useState(false);
  const schemaDraftRef = useRef(schemaDraft);
  const persistedSchemaTextRef = useRef(persistedSchemaText);
  const pendingExternalSchemaDraftValueRef = useRef<string | null>(null);
  const initializedSchemaSyncNodeIdsRef = useRef<Set<string>>(new Set());
  const persistedDefinitionSignature = useMemo(
    () => createRequestDefinitionSyncSignature(persistedDefinitions),
    [persistedDefinitions],
  );
  const pendingDefinitionSyncSignatureRef = useRef<string | null>(null);
  const contentSchemaRef = useRef(sourceSchemaValue);
  const previousNodeIdRef = useRef(id);
  const pendingSchemaCommitRef = useRef<string | null>(null);

  const applyExternalSchemaDraft = (nextValue: string, options?: { dirty?: boolean }) => {
    pendingExternalSchemaDraftValueRef.current = nextValue;
    schemaDraftRef.current = nextValue;
    setSchemaDraft(nextValue);

    if (options?.dirty !== undefined) {
      setIsSchemaDraftDirty(options.dirty);
    }
  };

  useEffect(() => {
    schemaDraftRef.current = schemaDraft;
  }, [schemaDraft]);

  useEffect(() => {
    definitionDraftsRef.current = definitionDrafts;
  }, [definitionDrafts]);

  useEffect(() => {
    persistedSchemaTextRef.current = persistedSchemaText;
  }, [persistedSchemaText]);

  useEffect(() => {
    contentSchemaRef.current = sourceSchemaValue;
  }, [sourceSchemaValue]);

  useEffect(() => {
    if (previousNodeIdRef.current === id) {
      return;
    }

    previousNodeIdRef.current = id;
    pendingSchemaCommitRef.current = null;
    pendingDefinitionSyncSignatureRef.current = null;
    applyExternalSchemaDraft(persistedSchemaText, { dirty: false });
  }, [id, persistedSchemaText]);

  useEffect(() => {
    if (isSchemaDraftDirty) {
      return;
    }

    if (pendingSchemaCommitRef.current !== null) {
      if (persistedSchemaText !== pendingSchemaCommitRef.current) {
        return;
      }

      pendingSchemaCommitRef.current = null;
    }

    if (schemaDraftRef.current === persistedSchemaText) {
      return;
    }

    applyExternalSchemaDraft(persistedSchemaText);
  }, [isSchemaDraftDirty, persistedSchemaText]);

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
      { value: 'string', label: t('requestTypeString') },
      { value: 'number', label: t('requestTypeNumber') },
      { value: 'array', label: t('requestTypeArray') },
      { value: 'object', label: t('requestTypeObject') },
      { value: 'datetime', label: t('requestTypeDatetime') },
      { value: 'boolean', label: t('requestTypeBoolean') },
    ],
    [t],
  );
  const getExampleSourceName = (index: number) => formatRequestExampleSourceName(index, t('requestDataLabel'));
  const activeSource = exampleSources[activeSourceIndex] ?? null;
  const normalizeExampleData = useCallback(
    (data?: Record<string, unknown>, definitions = definitionDrafts) =>
      normalizeRequestExampleDataByDefinitions(isRecord(data) ? data : {}, definitions),
    [definitionDrafts],
  );
  const getPreparedExampleData = useCallback(
    (data?: Record<string, unknown>) => normalizeExampleData(data),
    [normalizeExampleData],
  );
  const activeExampleJsonDraft = useMemo(() => {
    if (!activeSource) {
      return '';
    }

    return exampleJsonDrafts[activeSource.id] ?? formatJsonDraft(activeSource.data);
  }, [activeSource, exampleJsonDrafts]);
  const activeDescriptionDraft = useMemo(() => {
    if (!activeSource) {
      return '';
    }

    return descriptionDrafts[activeSource.id] ?? activeSource.description ?? '';
  }, [activeSource, descriptionDrafts]);
  const exampleFieldSummary = useMemo(() => {
    if (!activeSource) {
      return null;
    }

    const validDefinitions = definitionDrafts.filter((definition) => definition.name.trim() && definition.path.trim());
    const conflicts = getRequestExampleDataDefinitionConflicts(activeSource.data, validDefinitions);
    const missing = validDefinitions.filter(
      (definition) => getPathValue(activeSource.data, definition.path.trim()) === undefined,
    );
    const dataPaths = collectExampleDataPaths(activeSource.data);
    const definitionPaths = validDefinitions.map((definition) => definition.path.trim());
    const extra = dataPaths.filter(
      (dataPath) =>
        !definitionPaths.some(
          (definitionPath) => dataPath === definitionPath || dataPath.startsWith(`${definitionPath}.`),
        ),
    );

    return {
      definitions: validDefinitions,
      conflicts,
      missing,
      extra,
    };
  }, [activeSource, definitionDrafts]);
  const exampleSourcesSyncSignature = useMemo(
    () => JSON.stringify(exampleSources.map((source) => ({ name: source.name, data: source.data }))),
    [exampleSources],
  );
  const previousExampleSourcesSyncSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (activeSourceIndex <= Math.max(exampleSources.length - 1, 0)) {
      return;
    }

    setActiveSourceIndex(Math.max(exampleSources.length - 1, 0));
  }, [activeSourceIndex, exampleSources.length]);

  useEffect(() => {
    if (exampleSources.length > 0 || simulatorExampleBinding?.nodeId !== id) {
      return;
    }

    graphActions.setSimulatorExampleBinding(null);
  }, [exampleSources.length, graphActions, id, simulatorExampleBinding]);

  useEffect(() => {
    const previousSignature = previousExampleSourcesSyncSignatureRef.current;
    previousExampleSourcesSyncSignatureRef.current = exampleSourcesSyncSignature;

    if (previousSignature === null || previousSignature === exampleSourcesSyncSignature) {
      return;
    }

    const isCurrentRequestActive = activeGraphTabId === id;
    const isSimulatorBoundToCurrentRequest = simulatorExampleBinding?.nodeId === id;

    if (!isCurrentRequestActive && !isSimulatorBoundToCurrentRequest) {
      return;
    }

    if (exampleSources.length === 0) {
      if (activeSourceIndex !== 0) {
        setActiveSourceIndex(0);
      }

      graphActions.setSimulatorRequest('');
      graphActions.setSimulatorExampleBinding(null);
      return;
    }

    const preferredSourceIndex = isSimulatorBoundToCurrentRequest
      ? simulatorExampleBinding.sourceIndex
      : activeSourceIndex;
    const safeSourceIndex = Math.max(0, Math.min(preferredSourceIndex, exampleSources.length - 1));
    const nextSource = exampleSources[safeSourceIndex];

    if (!nextSource) {
      return;
    }

    if (activeSourceIndex !== safeSourceIndex) {
      setActiveSourceIndex(safeSourceIndex);
    }

    const preparedExampleData = getPreparedExampleData(nextSource.data);
    const nextRequest = JSON.stringify(preparedExampleData, null, 2);

    graphActions.setSimulatorRequest(nextRequest);
    graphActions.setSimulatorExampleBinding({
      nodeId: id,
      sourceIndex: safeSourceIndex,
      sourceName: nextSource.name,
    });
  }, [
    activeGraphTabId,
    activeSourceIndex,
    exampleSources,
    exampleSources.length,
    exampleSourcesSyncSignature,
    getPreparedExampleData,
    graphActions,
    id,
    simulatorExampleBinding,
  ]);

  useEffect(() => {
    exampleSources.forEach((source) => {
      setExampleJsonDrafts((previousState) => {
        const isDirty = exampleJsonDirtyBySourceId[source.id] === true;
        if (isDirty) {
          return previousState;
        }

        const nextDraft = formatJsonDraft(source.data);
        if (previousState[source.id] === nextDraft) {
          return previousState;
        }

        return {
          ...previousState,
          [source.id]: nextDraft,
        };
      });
    });
  }, [exampleSources, exampleJsonDirtyBySourceId]);

  useEffect(() => {
    if (simulatorExampleBinding?.nodeId !== id) {
      return;
    }

    if (simulatorExampleBinding.sourceIndex < 0 || simulatorExampleBinding.sourceIndex >= exampleSources.length) {
      return;
    }

    if (simulatorExampleBinding.sourceIndex === activeSourceIndex) {
      return;
    }

    setActiveSourceIndex(simulatorExampleBinding.sourceIndex);
  }, [activeSourceIndex, exampleSources.length, id, simulatorExampleBinding]);

  useEffect(() => {
    if (activeGraphTabId !== id || !activeSource) {
      return;
    }

    if (
      simulatorExampleBinding?.nodeId === id &&
      simulatorExampleBinding.sourceIndex !== activeSourceIndex &&
      simulatorExampleBinding.sourceIndex >= 0 &&
      simulatorExampleBinding.sourceIndex < exampleSources.length
    ) {
      return;
    }

    const hasMatchedBinding =
      simulatorExampleBinding?.nodeId === id &&
      simulatorExampleBinding.sourceIndex === activeSourceIndex &&
      simulatorExampleBinding.sourceName === activeSource.name;

    if (hasMatchedBinding) {
      return;
    }

    graphActions.setSimulatorExampleBinding({
      nodeId: id,
      sourceIndex: activeSourceIndex,
      sourceName: activeSource.name,
    });
  }, [
    activeGraphTabId,
    activeSource,
    activeSourceIndex,
    exampleSources.length,
    graphActions,
    id,
    simulatorExampleBinding,
  ]);

  const openSimulatorPanel = useCallback(() => {
    const simulatorPanel = panels?.find((panel) => panel.id === 'simulator');
    if (simulatorPanel) {
      graphActions.setActivePanel(simulatorPanel.id);
    }
  }, [panels, graphActions]);

  const updateNodeSchema = (nextSchema: string) => {
    graphActions.updateNode(id, (draft) => {
      draft.content ??= {};
      if (type === 'input') {
        setRequestSchemaValue(draft.content as Record<string, any>, nextSchema);
      } else {
        draft.content.schema = nextSchema;
      }
      return draft;
    });
  };

  useEffect(() => {
    if (initializedSchemaSyncNodeIdsRef.current.has(id)) {
      return;
    }

    const sourceSchemaObj = parseRequestSchemaValue(sourceSchemaValue);
    const hasPersistedSchemaProperties = Boolean(
      sourceSchemaObj && hasOwn(sourceSchemaObj, 'properties') && isRecord(sourceSchemaObj.properties),
    );
    const hasLegacyInputs = (content?.inputs ?? []).length > 0;
    const nextSchemaText = schemaText.trim();

    if (hasPersistedSchemaProperties) {
      initializedSchemaSyncNodeIdsRef.current.add(id);
      return;
    }

    if (!hasLegacyInputs || !nextSchemaText) {
      return;
    }

    initializedSchemaSyncNodeIdsRef.current.add(id);
    pendingSchemaCommitRef.current = nextSchemaText;
    applyExternalSchemaDraft(nextSchemaText, { dirty: false });
    updateNodeSchema(nextSchemaText);

    if (import.meta.env.DEV) {
      console.log('[request-tab] initialized schema from legacy inputs', {
        nodeId: id,
        hasLegacyInputs,
        nextSchemaText,
      });
    }
  }, [content?.inputs, id, schemaText, sourceSchemaValue]);

  const commitSchemaDraft = () => {
    const nextSchemaDraft = schemaDraftRef.current;
    const trimmedSchemaDraft = nextSchemaDraft.trim();

    if (!trimmedSchemaDraft) {
      pendingSchemaCommitRef.current = null;

      if (stringifyRequestSchemaValue(contentSchemaRef.current).trim()) {
        pendingSchemaCommitRef.current = '';
        updateNodeSchema('');
      }

      applyExternalSchemaDraft('', { dirty: false });
      return;
    }

    if (!parseRequestSchemaValue(nextSchemaDraft)) {
      return;
    }

    if (nextSchemaDraft === persistedSchemaTextRef.current) {
      pendingSchemaCommitRef.current = null;
      setIsSchemaDraftDirty(false);
      return;
    }

    pendingSchemaCommitRef.current = nextSchemaDraft;
    updateNodeSchema(nextSchemaDraft);
    setIsSchemaDraftDirty(false);
  };

  const handleSchemaDraftChange = (nextValue: string) => {
    if (
      pendingExternalSchemaDraftValueRef.current !== null &&
      nextValue === pendingExternalSchemaDraftValueRef.current
    ) {
      pendingExternalSchemaDraftValueRef.current = null;
      schemaDraftRef.current = nextValue;
      setSchemaDraft(nextValue);
      return;
    }

    pendingExternalSchemaDraftValueRef.current = null;
    pendingSchemaCommitRef.current = null;
    schemaDraftRef.current = nextValue;
    setSchemaDraft(nextValue);
    setIsSchemaDraftDirty(true);
  };

  const handleConvertToJsonSchemaSuccess = ({ schema, model }: { schema: string; model: string }) => {
    localStorage.setItem(`${id}-request-model`, model);

    const currentSchema = parseRequestSchemaValue(sourceSchemaValue);
    const convertedSchema = parseRequestSchemaValue(schema);
    const nextSchemaObject =
      convertedSchema && currentSchema?.examples
        ? {
            ...convertedSchema,
            examples: currentSchema.examples,
          }
        : convertedSchema;
    const nextSchemaText = nextSchemaObject ? stringifyRequestSchemaValue(nextSchemaObject) : schema;

    pendingSchemaCommitRef.current = nextSchemaText;
    applyExternalSchemaDraft(nextSchemaText, { dirty: false });
    updateNodeSchema(nextSchemaText);
  };

  const syncExampleToSimulator = (source?: RequestExampleSource | null, sourceIndex = activeSourceIndex) => {
    if (!source) {
      graphActions.setSimulatorRequest('');
      graphActions.setSimulatorExampleBinding(null);
      return;
    }

    const preparedExampleData = getPreparedExampleData(source.data);
    const nextRequest = JSON.stringify(preparedExampleData, null, 2);
    graphActions.setSimulatorRequest(nextRequest);
    graphActions.setSimulatorExampleBinding({
      nodeId: id,
      sourceIndex,
      sourceName: source.name,
    });
  };

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

  const persistExamples = (
    nextSources: RequestExampleSource[],
    nextActiveIndex = activeSourceIndex,
    options?: {
      syncToSimulator?: boolean;
    },
  ) => {
    const normalizedNextSources = nextSources.map((source) => ({
      ...source,
      data: normalizeExampleData(source.data),
    }));
    const examplesMeta = normalizedNextSources.map((source) => ({
      name: source.name,
      description: source.description,
    }));
    const nextSchema = updateRequestSchemaExamples(
      sourceSchemaValue,
      normalizedNextSources.map((source) => source.data),
      examplesMeta,
    );
    updateNodeSchema(nextSchema);

    const safeIndex = Math.max(0, Math.min(nextActiveIndex, normalizedNextSources.length - 1));
    setActiveSourceIndex(safeIndex);
    const shouldSyncToSimulator = options?.syncToSimulator ?? true;

    if (shouldSyncToSimulator) {
      syncExampleToSimulator(normalizedNextSources[safeIndex], safeIndex);
    }
  };

  const handleExampleJsonChange = (nextValue: string) => {
    const activeSourceId = activeExampleSourceIdRef.current ?? activeSource?.id;
    if (!activeSourceId) {
      return;
    }

    setExampleJsonDrafts((previousState) => ({
      ...previousState,
      [activeSourceId]: nextValue,
    }));
    setExampleJsonDirtyBySourceId((previousState) => ({
      ...previousState,
      [activeSourceId]: true,
    }));
  };

  const commitExampleJson = () => {
    const activeSourceId = activeExampleSourceIdRef.current ?? activeSource?.id;
    if (!activeSourceId) {
      return;
    }

    const activeSourceById = exampleSources.find((source) => source.id === activeSourceId);
    const nextDraft = exampleJsonDrafts[activeSourceId] ?? (activeSourceById && formatJsonDraft(activeSourceById.data));

    if (!nextDraft || nextDraft.trim() === '') {
      return;
    }

    let parsedValue: unknown;
    try {
      parsedValue = json5.parse(nextDraft);
    } catch {
      message.warning(t('requestJsonInvalidError'));
      return;
    }

    if (!isRecord(parsedValue)) {
      message.warning(t('requestJsonObjectError'));
      return;
    }

    const nextSourceIndex = exampleSources.findIndex((source) => source.id === activeSourceId);
    const nextSources = exampleSources.map((source) =>
      source.id === activeSourceId
        ? {
            ...source,
            data: parsedValue,
          }
        : source,
    );

    persistExamples(nextSources, nextSourceIndex, { syncToSimulator: false });
    setExampleJsonDrafts((previousState) => ({
      ...previousState,
      [activeSourceId]: formatJsonDraft(parsedValue),
    }));
    setExampleJsonDirtyBySourceId((previousState) => ({
      ...previousState,
      [activeSourceId]: false,
    }));
  };

  const handleDescriptionChange = (nextValue: string) => {
    const activeSourceId = activeExampleSourceIdRef.current ?? activeSource?.id;
    if (!activeSourceId) {
      return;
    }

    setDescriptionDrafts((previousState) => ({
      ...previousState,
      [activeSourceId]: nextValue,
    }));
  };

  const commitDescription = () => {
    const activeSourceId = activeExampleSourceIdRef.current ?? activeSource?.id;
    if (!activeSourceId) {
      return;
    }

    const activeSourceById = exampleSources.find((source) => source.id === activeSourceId);
    const nextDraft = descriptionDrafts[activeSourceId] ?? activeSourceById?.description ?? '';
    const currentDescription = activeSourceById?.description ?? '';

    if (nextDraft === currentDescription) {
      return;
    }

    const nextSourceIndex = exampleSources.findIndex((source) => source.id === activeSourceId);
    const nextSources = exampleSources.map((source) =>
      source.id === activeSourceId
        ? {
            ...source,
            description: nextDraft.trim() || undefined,
          }
        : source,
    );

    persistExamples(nextSources, nextSourceIndex, { syncToSimulator: false });
  };

  useEffect(() => {
    commitExampleJsonRef.current = commitExampleJson;
  });

  useEffect(() => {
    activeExampleSourceIdRef.current = activeSource?.id ?? null;
  }, [activeSource]);

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

  const addExampleSource = useCallback(() => {
    const baseExampleSources = exampleSources;
    const nextSources = [
      ...baseExampleSources,
      {
        id: crypto.randomUUID(),
        name: getExampleSourceName(baseExampleSources.length),
        data: normalizeRequestExampleDataByDefinitions(
          buildRequestExampleTemplateFromDefinitions(definitionDrafts),
          definitionDrafts,
        ),
        source: 'schema.examples' as const,
      },
    ];

    persistExamples(nextSources, nextSources.length - 1);
  }, [exampleSources, definitionDrafts, persistExamples, t]);

  const removeExampleSource = (index: number) => {
    const baseExampleSources = exampleSources;
    const nextSources = baseExampleSources.filter((_, currentIndex) => currentIndex !== index);
    persistExamples(nextSources, Math.max(index - 1, 0));
  };

  const getSafeJsonFileName = useCallback(
    (name?: string) => {
      const trimmed = (name ?? '').trim();
      const baseName = trimmed.length > 0 ? trimmed : nodeName || t('request');
      const normalized = baseName
        .replace(/\.json$/i, '')
        .replace(/[\\/:*?"<>|]/g, '-')
        .trim();

      return `${normalized || t('request')}.json`;
    },
    [nodeName, t],
  );

  const handleUploadJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = json5.parse(text);

      if (!isRecord(parsed)) {
        message.error(t('requestUploadJsonObjectRequired'));
        return;
      }

      const nextSourceName = file.name.replace(/\.json$/i, '') || getExampleSourceName(exampleSources.length);
      const nextSourceData = parsed as Record<string, unknown>;

      if (exampleSources.length === 0) {
        persistExamples(
          [
            {
              id: crypto.randomUUID(),
              name: nextSourceName,
              data: nextSourceData,
              source: 'schema.examples',
            },
          ],
          0,
        );
      } else {
        persistExamples(
          exampleSources.map((source, index) =>
            index === activeSourceIndex
              ? {
                  ...source,
                  name: nextSourceName,
                  data: nextSourceData,
                  source: 'schema.examples',
                }
              : source,
          ),
          activeSourceIndex,
        );
      }

      message.success(t('requestUploadJsonSuccess'));
    } catch (error: any) {
      console.warn('[request-node] failed to upload json', {
        nodeId: id,
        error,
      });
      message.error(error?.message || t('requestUploadJsonFailed'));
    }
  };

  const handleDownloadJson = useCallback(() => {
    if (!activeSource) {
      message.warning(t('requestDownloadJsonNoData'));
      return;
    }

    const payload = JSON.stringify(normalizeExampleData(activeSource.data), null, 2);
    saveFile(getSafeJsonFileName(activeSource.name), new Blob([payload], { type: 'application/json' }));
  }, [activeSource, getSafeJsonFileName, t]);

  const renderTabBarExtraContent = () => {
    if (activeTab === RequestTabKey.Examples) {
      return (
        <Space size='small' style={{ marginRight: 8 }}>
          <Button type='text' size='small' disabled={disabled} icon={<PlusOutlined />} onClick={addExampleSource}>
            {t('requestAddDataSource')}
          </Button>
          <Tooltip title={t('requestUploadJsonTooltip')}>
            <Button
              type='text'
              size='small'
              disabled={disabled}
              icon={<CloudUploadOutlined />}
              onClick={() => fileInputRef.current?.click()}
            >
              {t('uploadJson')}
            </Button>
          </Tooltip>
          <Tooltip title={t('requestDownloadJsonTooltip')}>
            <Button
              type='text'
              size='small'
              disabled={!activeSource}
              icon={<CloudDownloadOutlined />}
              onClick={handleDownloadJson}
            >
              {t('downloadJson')}
            </Button>
          </Tooltip>
          <Tooltip title={t('requestSimulateTooltip')} placement='bottomRight'>
            <Button
              type='text'
              size='small'
              icon={<PlayCircleOutlined />}
              disabled={disabled || activePanel === 'simulator'}
              onClick={openSimulatorPanel}
            />
          </Tooltip>
        </Space>
      );
    }

    if (activeTab === RequestTabKey.Schema) {
      return (
        <Space size='small' style={{ marginRight: 8 }}>
          <Tooltip title={t('requestFormatSchema')} placement='bottomRight'>
            <Button
              type='text'
              size='small'
              shape='circle'
              icon={<FormatPainterOutlined />}
              onClick={() => schemaEditorRef.current?.getAction?.('editor.action.formatDocument')?.run?.()}
              disabled={disabled}
            />
          </Tooltip>
          <Tooltip title={t('convertToJsonSchema')} placement='bottomRight'>
            <Button
              type='text'
              size='small'
              shape='circle'
              icon={<ImportOutlined />}
              onClick={() => setJsonToJsonSchemaOpen(true)}
              disabled={disabled}
            />
          </Tooltip>
        </Space>
      );
    }

    return null;
  };

  const themedEditorOptions = useMemo(
    () => ({
      ...editorOptions,
      theme: token.mode === 'dark' ? 'vs-dark' : 'light',
    }),
    [token.mode],
  );

  return (
    <div
      className='grl-node-content'
      data-theme={token.mode}
      style={
        {
          'height': '100%',
          '--color-text': token.colorTextBase,
          '--color-background-elevated': token.colorBgElevated,
          '--color-border': token.colorBorder,
          '--color-border-secondary': token.colorBorderSecondary,
          '--color-fill-secondary': token.colorFillSecondary,
          '--color-fill-tertiary': token.colorFillTertiary,
          '--color-primary-bg': token.colorPrimaryBg,
          '--color-primary-border': token.colorPrimaryBorder,
          '--color-primary-text': token.colorPrimaryText,
        } as React.CSSProperties
      }
    >
      <div className='grl-node-content-main grl-request-tab'>
        <div className='grl-node-content-side'>
          <div className='grl-node-content-side__panel'>
            <div className='grl-node-content-side__header'>
              <Tabs
                rootClassName='grl-inline-tabs'
                size='small'
                style={{ width: '100%' }}
                activeKey={activeTab}
                onChange={(nextKey) => {
                  setActiveTab(nextKey as RequestTabKey);
                }}
                items={[
                  { key: RequestTabKey.Definitions, label: t('requestDefinitionsTab') },
                  { key: RequestTabKey.Examples, label: t('requestExamplesTab') },
                  {
                    key: RequestTabKey.Schema,
                    label: (
                      <span>
                        {t('schema')}
                        <Tooltip title={t('requestSchemaPriorityTooltip')}>
                          <InfoCircleOutlined
                            style={{ fontSize: 10, marginLeft: 4, opacity: 0.5, verticalAlign: 'text-top' }}
                          />
                        </Tooltip>
                      </span>
                    ),
                  },
                ]}
                tabBarExtraContent={renderTabBarExtraContent()}
              />
              <input
                hidden
                accept='application/json'
                type='file'
                ref={fileInputRef}
                onChange={handleUploadJson}
                onClick={(event) => {
                  (event.target as HTMLInputElement).value = '';
                }}
              />
            </div>
            <div className='grl-node-content-side__body'>
              {activeTab === RequestTabKey.Definitions && (
                <RequestDefinitions
                  rootDefinitions={rootDefinitions}
                  childrenMap={definitionChildrenMap}
                  collapsedPaths={collapsedDefinitionPaths}
                  disabled={disabled}
                  definitionTypeOptions={definitionTypeOptions}
                  onAdd={addDefinition}
                  onUpdateName={updateDefinitionName}
                  onUpdateType={updateDefinitionType}
                  onUpdateDescription={updateDefinitionDescription}
                  onUpdateDefaultValue={updateDefinitionDefaultValue}
                  onAddChild={addChildDefinition}
                  onRemove={removeDefinition}
                  onToggleCollapse={toggleDefinitionCollapsed}
                  getDefinitionIndex={getDefinitionIndex}
                />
              )}

              {activeTab === RequestTabKey.Examples && (
                <RequestExamples
                  sources={exampleSources}
                  activeSourceIndex={activeSourceIndex}
                  editingSourceIndex={editingSourceIndex}
                  activeSource={activeSource}
                  activeDescriptionDraft={activeDescriptionDraft}
                  activeJsonDraft={activeExampleJsonDraft}
                  disabled={disabled}
                  definitionDrafts={definitionDrafts}
                  onSourceSelect={(index) => {
                    setActiveSourceIndex(index);
                    syncExampleToSimulator(exampleSources[index], index);
                  }}
                  onSourceAdd={addExampleSource}
                  onSourceRemove={removeExampleSource}
                  onSourceRename={(index, name) => {
                    const trimmedName = name.trim();
                    if (trimmedName) {
                      persistExamples(
                        exampleSources.map((item, currentIndex) =>
                          currentIndex === index ? { ...item, name: trimmedName } : item,
                        ),
                        index,
                        { syncToSimulator: false },
                      );
                    }
                  }}
                  onEnterEditing={(index) => setEditingSourceIndex(index)}
                  onSourceRenameExit={() => setEditingSourceIndex(null)}
                  onDescriptionChange={handleDescriptionChange}
                  onDescriptionCommit={commitDescription}
                  onJsonChange={handleExampleJsonChange}
                  onJsonCommit={commitExampleJson}
                  onFormat={() => exampleJsonEditorRef.current?.getAction?.('editor.action.formatDocument')?.run?.()}
                  jsonEditorRef={exampleJsonEditorRef}
                  summary={exampleFieldSummary}
                  getDefinitionTypeLabel={getDefinitionTypeLabel}
                  editorOptions={themedEditorOptions}
                />
              )}

              {activeTab === RequestTabKey.Schema && (
                <RequestSchemaEditor
                  schemaDraft={schemaDraft}
                  disabled={disabled}
                  onSchemaChange={handleSchemaDraftChange}
                  onSchemaCommit={commitSchemaDraft}
                  onFormat={() => schemaEditorRef.current?.getAction?.('editor.action.formatDocument')?.run?.()}
                  jsonToJsonSchemaOpen={jsonToJsonSchemaOpen}
                  onOpenConvert={() => setJsonToJsonSchemaOpen(true)}
                  onConvertSuccess={handleConvertToJsonSchemaSuccess}
                  onDismissConvert={() => setJsonToJsonSchemaOpen(false)}
                  editorRef={schemaEditorRef}
                  editorOptions={themedEditorOptions}
                  nodeId={id}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
