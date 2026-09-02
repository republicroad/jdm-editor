import json5 from 'json5';
import type { editor } from 'monaco-editor';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { saveFile } from '../../../helpers/file-helpers';
import {
  type RequestContentLike,
  type RequestDefinition,
  type RequestExampleSource,
  buildRequestExampleTemplateFromDefinitions,
  collectExampleDataPaths,
  formatJsonDraft,
  formatRequestExampleSourceName,
  getPathValue,
  getRequestExampleDataDefinitionConflicts,
  getRequestExampleSources,
  isRecord,
  mergeRequestExampleDefaultsByDefinitions,
  normalizeRequestExampleDataByDefinitions,
  updateRequestSchemaExamples,
} from '../../../helpers/request-schema';
import type { TranslationKey } from '../../../theming/i18n';
import type { useDecisionGraphActions } from '../context/dg-store.context';
import { type SimulatorExampleBinding } from '../context/dg-store.context';

type UseRequestExamplesEditingParams = {
  id: string;
  content: RequestContentLike | undefined;
  t: (key: TranslationKey) => string;
  graphActions: ReturnType<typeof useDecisionGraphActions>;
  panels?: Array<{ id: string }>;
  activeGraphTabId?: string;
  simulatorExampleBinding: SimulatorExampleBinding | undefined;
  nodeName?: string;
  sourceSchemaValue: unknown;
  updateNodeSchema: (nextSchema: string) => void;
  definitionDrafts: RequestDefinition[];
};

export const useRequestExamplesEditing = ({
  id,
  content,
  t,
  graphActions,
  panels,
  activeGraphTabId,
  simulatorExampleBinding,
  nodeName,
  sourceSchemaValue,
  updateNodeSchema,
  definitionDrafts,
}: UseRequestExamplesEditingParams) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exampleJsonEditorRef = useRef<editor.IStandaloneCodeEditor | undefined>(undefined);
  const activeExampleSourceIdRef = useRef<string | null>(null);
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [editingSourceIndex, setEditingSourceIndex] = useState<number | null>(null);
  const [exampleJsonDrafts, setExampleJsonDrafts] = useState<Record<string, string>>({});
  const [exampleJsonDirtyBySourceId, setExampleJsonDirtyBySourceId] = useState<Record<string, boolean>>({});
  const [descriptionDrafts, setDescriptionDrafts] = useState<Record<string, string>>({});

  const exampleSources = useMemo(
    () => getRequestExampleSources(content, { dataLabel: t('request.dataLabel') }),
    [content, t],
  );
  const getExampleSourceName = (index: number) => formatRequestExampleSourceName(index, t('request.dataLabel'));
  const activeSource = exampleSources[activeSourceIndex] ?? null;
  const normalizeExampleData = useCallback(
    (data?: Record<string, unknown>, definitions = definitionDrafts) =>
      normalizeRequestExampleDataByDefinitions(isRecord(data) ? data : {}, definitions),
    [definitionDrafts],
  );
  const getPreparedExampleData = useCallback(
    (data?: Record<string, unknown>) =>
      normalizeRequestExampleDataByDefinitions(
        mergeRequestExampleDefaultsByDefinitions(isRecord(data) ? data : {}, definitionDrafts),
        definitionDrafts,
      ),
    [definitionDrafts],
  );
  const mergedExampleData = useMemo(
    () => (activeSource ? mergeRequestExampleDefaultsByDefinitions(activeSource.data, definitionDrafts) : null),
    [activeSource, definitionDrafts],
  );
  const activeExampleJsonDraft = useMemo(() => {
    if (!activeSource) {
      return '';
    }

    return exampleJsonDrafts[activeSource.id] ?? formatJsonDraft(mergedExampleData);
  }, [activeSource, exampleJsonDrafts, mergedExampleData]);
  const activeDescriptionDraft = useMemo(() => {
    if (!activeSource) {
      return '';
    }

    return descriptionDrafts[activeSource.id] ?? activeSource.description ?? '';
  }, [activeSource, descriptionDrafts]);
  const exampleFieldSummary = useMemo(() => {
    if (!activeSource || !mergedExampleData) {
      return null;
    }

    const validDefinitions = definitionDrafts.filter((definition) => definition.name.trim() && definition.path.trim());
    const conflicts = getRequestExampleDataDefinitionConflicts(mergedExampleData, validDefinitions);
    const missing = validDefinitions.filter(
      (definition) => getPathValue(mergedExampleData, definition.path.trim()) === undefined,
    );
    const dataPaths = collectExampleDataPaths(mergedExampleData);
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
  }, [activeSource, definitionDrafts, mergedExampleData]);
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

        const nextDraft = formatJsonDraft(mergeRequestExampleDefaultsByDefinitions(source.data, definitionDrafts));
        if (previousState[source.id] === nextDraft) {
          return previousState;
        }

        return {
          ...previousState,
          [source.id]: nextDraft,
        };
      });
    });
  }, [definitionDrafts, exampleJsonDirtyBySourceId, exampleSources]);

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

  useEffect(() => {
    activeExampleSourceIdRef.current = activeSource?.id ?? null;
  }, [activeSource]);

  const openSimulatorPanel = useCallback(() => {
    const simulatorPanel = panels?.find((panel) => panel.id === 'simulator');
    if (simulatorPanel) {
      graphActions.setActivePanel(simulatorPanel.id);
    }
  }, [panels, graphActions]);

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
      toast.warning(t('request.jsonInvalidError'));
      return;
    }

    if (!isRecord(parsedValue)) {
      toast.warning(t('request.jsonObjectError'));
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
        toast.error(t('request.uploadJsonObjectRequired'));
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

      toast.success(t('request.uploadJsonSuccess'));
    } catch (error: any) {
      console.warn('[request-node] failed to upload json', {
        nodeId: id,
        error,
      });
      toast.error(error?.message || t('request.uploadJsonFailed'));
    }
  };

  const handleDownloadJson = useCallback(() => {
    if (!activeSource) {
      toast.warning(t('request.downloadJsonNoData'));
      return;
    }

    const payload = JSON.stringify(getPreparedExampleData(activeSource.data), null, 2);
    saveFile(getSafeJsonFileName(activeSource.name), new Blob([payload], { type: 'application/json' }));
  }, [activeSource, getPreparedExampleData, getSafeJsonFileName, t]);

  return {
    exampleSources,
    activeSourceIndex,
    setActiveSourceIndex,
    editingSourceIndex,
    setEditingSourceIndex,
    activeSource,
    activeExampleJsonDraft,
    activeDescriptionDraft,
    exampleFieldSummary,
    fileInputRef,
    exampleJsonEditorRef,
    addExampleSource,
    removeExampleSource,
    persistExamples,
    handleExampleJsonChange,
    commitExampleJson,
    handleDescriptionChange,
    commitDescription,
    handleUploadJson,
    handleDownloadJson,
    openSimulatorPanel,
    syncExampleToSimulator,
  };
};
