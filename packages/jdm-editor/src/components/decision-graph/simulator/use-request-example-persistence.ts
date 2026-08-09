import { message } from 'antd';
import json5 from 'json5';

import {
  formatRequestExampleSourceName,
  getRequestDefinitions,
  getRequestExampleDataDefinitionConflicts,
  getRequestExampleSources,
  normalizeRequestExampleDataByDefinitions,
  resolveRequestSchemaValue,
  setRequestSchemaValue,
  updateRequestSchemaExamples,
} from '../../../helpers/request-schema';
import type { TranslationKey } from '../../../locales';
import { type SimulatorExampleBinding, useDecisionGraphRaw } from '../context/dg-store.context';

export type RequestExampleBinding = NonNullable<SimulatorExampleBinding>;

export type UseRequestExamplePersistenceParams = {
  t: (key: TranslationKey) => string;
  requestValue: string | undefined;
  resolvedSimulatorExampleBinding: RequestExampleBinding | null;
  onRequestValueChange: (nextValue: string) => void;
  onMarkEdited: () => void;
  onExternalChange?: (nextValue: string) => void;
};

export type PersistRequestToExampleSourceOptions = {
  silentWhenUnbound?: boolean;
  showSuccessMessage?: boolean;
  requestValueOverride?: string;
  silentOnError?: boolean;
  validateDefinitionTypes?: boolean;
  triggeredBy?: 'manual-save';
};

export const useRequestExamplePersistence = ({
  t,
  requestValue,
  resolvedSimulatorExampleBinding,
  onRequestValueChange,
  onMarkEdited,
  onExternalChange,
}: UseRequestExamplePersistenceParams) => {
  const { stateStore, actions } = useDecisionGraphRaw();

  const savePreparedRequestToExampleSource = ({
    activeExampleBinding,
    preparedParsed,
    triggeredBy,
    showSuccessMessage = true,
  }: {
    activeExampleBinding: RequestExampleBinding;
    preparedParsed: Record<string, unknown>;
    triggeredBy: 'manual-save';
    showSuccessMessage?: boolean;
  }) => {
    const { decisionGraph } = stateStore.getState();
    const targetNode = decisionGraph.nodes.find((node) => node.id === activeExampleBinding.nodeId);

    if (!targetNode) {
      message.error(t('simulatorBoundRequestNodeNotFound'));
      return null;
    }

    const currentSources = getRequestExampleSources(targetNode.content, { dataLabel: t('requestDataLabel') });
    const currentBoundSource = currentSources[activeExampleBinding.sourceIndex];
    const formatted = JSON.stringify(preparedParsed, null, 2);

    if (currentBoundSource && JSON.stringify(currentBoundSource.data) === JSON.stringify(preparedParsed)) {
      if (import.meta.env.DEV) {
        console.log('[simulator-request] skipped saving unchanged example source', {
          binding: activeExampleBinding,
          triggeredBy,
        });
      }

      if (showSuccessMessage) {
        message.success(t('requestDataSourceSaved'));
      }

      return {
        context: preparedParsed,
        formatted,
      };
    }

    const nextSources = [...currentSources];

    while (nextSources.length <= activeExampleBinding.sourceIndex) {
      nextSources.push({
        id: crypto.randomUUID(),
        name: formatRequestExampleSourceName(nextSources.length, t('requestDataLabel')),
        data: {},
        source: 'schema.examples',
      });
    }

    nextSources[activeExampleBinding.sourceIndex] = {
      ...nextSources[activeExampleBinding.sourceIndex],
      id: nextSources[activeExampleBinding.sourceIndex]?.id ?? crypto.randomUUID(),
      name:
        activeExampleBinding.sourceName ??
        nextSources[activeExampleBinding.sourceIndex]?.name ??
        formatRequestExampleSourceName(activeExampleBinding.sourceIndex, t('requestDataLabel')),
      data: preparedParsed,
      source: 'schema.examples',
    };

    actions.updateNode(activeExampleBinding.nodeId, (draft) => {
      draft.content ??= {};
      if (draft.type === 'inputNode') {
        const currentSchema = resolveRequestSchemaValue(draft.content, { includeExamples: true });
        setRequestSchemaValue(
          draft.content as Record<string, any>,
          updateRequestSchemaExamples(currentSchema, nextSources.map((source) => source.data)),
        );
      } else {
        draft.content.schema = updateRequestSchemaExamples(
          draft.content?.schema,
          nextSources.map((source) => source.data),
        );
      }
      return draft;
    });

    onRequestValueChange(formatted);
    onMarkEdited();
    onExternalChange?.(formatted);
    actions.setSimulatorRequest(formatted);
    actions.setSimulatorExampleBinding({
      ...activeExampleBinding,
      sourceName: nextSources[activeExampleBinding.sourceIndex]?.name,
    });

    if (import.meta.env.DEV) {
      console.log('[simulator-request] saved simulator request to bound example source', {
        binding: activeExampleBinding,
        preparedParsed,
        currentBoundSource,
        nextSources,
        triggeredBy,
      });
    }

    if (showSuccessMessage) {
      message.success(t('requestDataSourceSaved'));
    }

    return {
      context: preparedParsed,
      formatted,
    };
  };

  const persistRequestToExampleSource = (options?: PersistRequestToExampleSourceOptions) => {
    const {
      silentWhenUnbound = false,
      showSuccessMessage = true,
      requestValueOverride,
      silentOnError = false,
      validateDefinitionTypes = false,
      triggeredBy = 'manual-save',
    } = options ?? {};

    const activeExampleBinding = resolvedSimulatorExampleBinding;

    if (!activeExampleBinding) {
      if (!silentWhenUnbound) {
        message.warning(t('requestSelectDataSourceFirst'));
      }
      return null;
    }

    try {
      const sourceRequestValue = requestValueOverride ?? requestValue;
      const parsed =
        (sourceRequestValue || '').trim().length === 0 ? {} : json5.parse(sourceRequestValue || '{}');

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        if (!silentOnError) {
          message.error(t('simulatorRequestMustBeObjectToSave'));
        }
        return null;
      }

      const { decisionGraph } = stateStore.getState();
      const targetNode = decisionGraph.nodes.find((node) => node.id === activeExampleBinding.nodeId);

      if (!targetNode) {
        if (!silentOnError) {
          message.error(t('simulatorBoundRequestNodeNotFound'));
        }
        return null;
      }

      const requestDefinitions = getRequestDefinitions(targetNode.content);
      const parsedRecord = parsed as Record<string, unknown>;
      const definitionTypeConflicts = validateDefinitionTypes
        ? getRequestExampleDataDefinitionConflicts(parsedRecord, requestDefinitions)
        : [];

      if (definitionTypeConflicts.length > 0) {
        if (!silentOnError) {
          message.warning(t('requestDataTypeMismatchWarning'));
        }
        return null;
      }

      const preparedParsed = normalizeRequestExampleDataByDefinitions(parsedRecord, requestDefinitions);

      return savePreparedRequestToExampleSource({
        activeExampleBinding,
        preparedParsed,
        triggeredBy,
        showSuccessMessage,
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[simulator-request] failed to save simulator request to example source', {
          binding: activeExampleBinding,
          requestValue,
          error,
          triggeredBy,
        });
      }

      if (!silentOnError) {
        message.error(t('requestSaveDataSourceFailed'));
      }
      return null;
    }
  };

  return {
    persistRequestToExampleSource,
  };
};
