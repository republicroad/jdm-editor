import json5 from 'json5';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { saveFile } from '../../../helpers/file-helpers';
import {
  type RequestContentLike,
  type RequestDefinition,
  type RequestExampleDrift,
  type RequestExampleSource,
  buildRequestExampleTemplateFromDefinitions,
  collectExampleDataPaths,
  computeExampleDrift,
  contractExamplesToSources,
  formatJsonDraft,
  formatRequestExampleSourceName,
  getPathValue,
  getRequestExampleDataDefinitionConflicts,
  hasExampleDrift,
  isRecord,
  mergeRequestExampleDefaultsByDefinitions,
  migrateRequestExampleDataByDefinitions,
  normalizeRequestExampleDataByDefinitions,
  readRequestInputContract,
  requestSchemaFingerprint,
  validateExampleDatasBySchema,
  writeRequestInputContract,
} from '../../../helpers/request-schema';
import type { TranslationKey } from '../../../theming/i18n';
import { type SimulatorExampleBinding } from '../context/dg-store.context';
import type { useDecisionGraphActions } from '../context/dg-store.context';
import type { ContractDriftEvent } from './fixtures-runner';

export type RequestExampleDriftState = {
  drift: RequestExampleDrift;
  /** 指纹 ≠ 当前 schema 指纹（含未锚定的 legacy 示例）——徽标判据 */
  schemaChanged: boolean;
  /** ajv 约束违例（required/min/max/enum/pattern，懒加载）——实时警告，不参与指纹戳记 */
  constraintIssues: string[];
};

type UseRequestExamplesEditingParams = {
  id: string;
  content: RequestContentLike | undefined;
  t: (key: TranslationKey) => string;
  graphActions: ReturnType<typeof useDecisionGraphActions>;
  panels?: Array<{ id: string }>;
  activeGraphTabId?: string;
  simulatorExampleBinding: SimulatorExampleBinding | undefined;
  nodeName?: string;
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
  definitionDrafts,
}: UseRequestExamplesEditingParams) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeExampleSourceIdRef = useRef<string | null>(null);
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [editingSourceIndex, setEditingSourceIndex] = useState<number | null>(null);
  const [exampleJsonDrafts, setExampleJsonDrafts] = useState<Record<string, string>>({});
  const [exampleJsonDirtyBySourceId, setExampleJsonDirtyBySourceId] = useState<Record<string, boolean>>({});
  const [descriptionDrafts, setDescriptionDrafts] = useState<Record<string, string>>({});

  const inputContract = useMemo(
    () => readRequestInputContract(content).contract,
    [content?.schema, content?.schemaUI, content?.inputs, content?.inputContract],
  );
  const currentSchemaFingerprint = useMemo(
    () => requestSchemaFingerprint(inputContract.schema),
    [inputContract.schema],
  );
  const exampleSources = useMemo(
    () => contractExamplesToSources(inputContract, { dataLabel: t('request.dataLabel') }),
    [inputContract, t],
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
  /** ajv 约束违例（ADR-013 OQ2）：懒加载异步批量校验，schema/example 变更后重算 */
  const [constraintIssuesBySourceId, setConstraintIssuesBySourceId] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let cancelled = false;

    validateExampleDatasBySchema(
      inputContract.examples.map((example) => example.data),
      inputContract.schema,
    ).then((results) => {
      if (cancelled) {
        return;
      }

      const next: Record<string, string[]> = {};
      inputContract.examples.forEach((example, index) => {
        next[example.id] = results[index] ?? [];
      });
      setConstraintIssuesBySourceId(next);
    });

    return () => {
      cancelled = true;
    };
  }, [inputContract]);

  /** 每 example 漂移状态（ADR-013 §2：逐 example 重校验 + 三类清单 + 指纹锚徽标） */
  const exampleDriftStates = useMemo(() => {
    const states: Record<string, RequestExampleDriftState> = {};

    inputContract.examples.forEach((example, index) => {
      states[example.id] = {
        drift: computeExampleDrift(exampleSources[index]?.data ?? example.data, definitionDrafts),
        schemaChanged: example.schemaFingerprint !== currentSchemaFingerprint,
        constraintIssues: constraintIssuesBySourceId[example.id] ?? [],
      };
    });

    return states;
  }, [constraintIssuesBySourceId, currentSchemaFingerprint, definitionDrafts, exampleSources, inputContract.examples]);
  const hasAnyDriftedExample = useMemo(
    () =>
      inputContract.examples.some((example) => {
        const state = exampleDriftStates[example.id];
        return Boolean(
          state && (state.schemaChanged || hasExampleDrift(state.drift) || state.constraintIssues.length > 0),
        );
      }),
    [exampleDriftStates, inputContract.examples],
  );

  // ── 漂移事件外发（ADR-013 批次三 M2：数据装配归 kernel，宿主经 onContractEvent 消费）──
  // effect 内读最新值用 ref，避免把高频 memo/草稿拉进依赖环
  const contractRef = useRef(inputContract);
  const definitionDraftsRef = useRef(definitionDrafts);
  const constraintIssuesRef = useRef(constraintIssuesBySourceId);
  const emitDriftEvent = useCallback(
    (kind: ContractDriftEvent['kind'], exampleNames: string[], counts?: ContractDriftEvent['counts']) => {
      graphActions.emitContractEvent({
        at: new Date().toISOString(),
        nodeId: id,
        ...(nodeName?.trim() ? { nodeName } : {}),
        kind,
        exampleNames,
        ...(counts ? { counts } : {}),
      });
    },
    [graphActions, id, nodeName],
  );
  const driftCountsOf = useCallback(
    (data: Record<string, unknown>, sourceId?: string): NonNullable<ContractDriftEvent['counts']> => {
      const drift = computeExampleDrift(data, definitionDraftsRef.current);
      return {
        missing: drift.missing.length,
        extra: drift.extra.length,
        conflicts: drift.conflicts.length,
        constraints: (constraintIssuesRef.current[sourceId ?? ''] ?? []).length,
      };
    },
    [],
  );

  useEffect(() => {
    contractRef.current = inputContract;
  }, [inputContract]);

  useEffect(() => {
    definitionDraftsRef.current = definitionDrafts;
  }, [definitionDrafts]);

  useEffect(() => {
    constraintIssuesRef.current = constraintIssuesBySourceId;
  }, [constraintIssuesBySourceId]);

  // drift-detected：schema 指纹变更时，已锚定示例转入漂移 → 每次提交至多一条
  const prevSchemaFingerprintRef = useRef<string | null>(null);
  useEffect(() => {
    const previous = prevSchemaFingerprintRef.current;
    prevSchemaFingerprintRef.current = currentSchemaFingerprint;

    if (!previous || previous === currentSchemaFingerprint) {
      return;
    }

    const drifted = contractRef.current.examples.filter(
      (example) =>
        typeof example.schemaFingerprint === 'string' && example.schemaFingerprint !== currentSchemaFingerprint,
    );

    if (drifted.length === 0) {
      return;
    }

    const counts = drifted.reduce(
      (acc, example) => {
        const per = driftCountsOf(example.data, example.id);
        return {
          missing: acc.missing + per.missing,
          extra: acc.extra + per.extra,
          conflicts: acc.conflicts + per.conflicts,
          constraints: acc.constraints + per.constraints,
        };
      },
      { missing: 0, extra: 0, conflicts: 0, constraints: 0 },
    );

    emitDriftEvent(
      'drift-detected',
      drifted.map((example) => example.name),
      counts,
    );
  }, [currentSchemaFingerprint, driftCountsOf, emitDriftEvent]);
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

  /**
   * 契约写路径（单漏斗）：draft 内新读契约 → 以 nextSources 重建 examples；
   * 干净 example 戳当前 schema 指纹（漂移徽标熄灭），有漂移的保留原锚。
   */
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
    const nextExamples = normalizedNextSources.map((source, index) => {
      const isClean = !hasExampleDrift(computeExampleDrift(source.data, definitionDrafts));
      const storedExample = inputContract.examples[index];

      return {
        id: source.id || storedExample?.id || crypto.randomUUID(),
        name: source.name,
        description: source.description,
        data: source.data,
        schemaFingerprint: isClean ? currentSchemaFingerprint : storedExample?.schemaFingerprint,
      };
    });

    graphActions.updateNode(id, (draft) => {
      draft.content ??= {};
      const contentRecord = draft.content as RequestContentLike & Record<string, any>;
      const { contract: freshContract } = readRequestInputContract(contentRecord);
      writeRequestInputContract(contentRecord, { ...freshContract, examples: nextExamples });
      return draft;
    });

    const safeIndex = Math.max(0, Math.min(nextActiveIndex, normalizedNextSources.length - 1));
    setActiveSourceIndex(safeIndex);
    const shouldSyncToSimulator = options?.syncToSimulator ?? true;

    if (shouldSyncToSimulator) {
      syncExampleToSimulator(normalizedNextSources[safeIndex], safeIndex);
    }
  };

  /** 安全迁移（ADR-013 §2）：缺值补默认、多余移除、datetime 归一；类型冲突保留待用户决策 */
  const migrateExample = (index: number) => {
    const source = exampleSources[index];
    if (!source) {
      return;
    }

    const before = driftCountsOf(source.data, source.id);
    const { data } = migrateRequestExampleDataByDefinitions(source.data, definitionDrafts);
    emitDriftEvent('drift-migrated', [source.name], before);
    persistExamples(
      exampleSources.map((item, currentIndex) => (currentIndex === index ? { ...item, data } : item)),
      index,
      { syncToSimulator: false },
    );
  };

  const migrateAllExamples = () => {
    if (exampleSources.length === 0) {
      return;
    }

    const driftedNames: string[] = [];
    const counts = exampleSources.reduce(
      (acc, source) => {
        const per = driftCountsOf(source.data, source.id);
        if (per.missing + per.extra + per.conflicts + per.constraints > 0) {
          driftedNames.push(source.name);
        }
        return {
          missing: acc.missing + per.missing,
          extra: acc.extra + per.extra,
          conflicts: acc.conflicts + per.conflicts,
          constraints: acc.constraints + per.constraints,
        };
      },
      { missing: 0, extra: 0, conflicts: 0, constraints: 0 },
    );

    if (driftedNames.length > 0) {
      emitDriftEvent('drift-migrated', driftedNames, counts);
    }

    persistExamples(
      exampleSources.map((source) => ({
        ...source,
        data: migrateRequestExampleDataByDefinitions(source.data, definitionDrafts).data,
      })),
      activeSourceIndex,
      { syncToSimulator: false },
    );
  };

  /** 确认有效：数据与当前 schema 相容，重新持久化以补戳指纹锚（干净示例全部熄灭徽标） */
  const confirmExampleValid = (index: number) => {
    const source = exampleSources[index];
    if (!source) {
      return;
    }

    emitDriftEvent('drift-confirmed', [source.name]);
    persistExamples(exampleSources, index, { syncToSimulator: false });
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
            data: parsedValue as Record<string, unknown>,
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
    inputContract,
    currentSchemaFingerprint,
    exampleSources,
    exampleDriftStates,
    hasAnyDriftedExample,
    activeSourceIndex,
    setActiveSourceIndex,
    editingSourceIndex,
    setEditingSourceIndex,
    activeSource,
    activeExampleJsonDraft,
    activeDescriptionDraft,
    exampleFieldSummary,
    fileInputRef,
    addExampleSource,
    removeExampleSource,
    persistExamples,
    migrateExample,
    migrateAllExamples,
    confirmExampleValid,
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
