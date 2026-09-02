import { VariableType } from '@gorules/zen-engine-wasm';
import { Spin, message, notification } from 'antd';
import json5 from 'json5';
import React, { useEffect } from 'react';

import { isWasmAvailable } from '../../../helpers/wasm';
import { copyToClipboard } from '../../../helpers/utility';
import {
  getRequestDefinitions,
  mergeRequestExampleDefaultsByDefinitions,
  normalizeRequestJsonKeys,
  normalizeRequestExampleDataByDefinitions,
  resolveRequestSchemaValue,
} from '../../../helpers/request-schema';
import { useTranslation } from '../../../locales';
import { NodeTypeKind, useDecisionGraphRaw, useDecisionGraphState } from '../context/dg-store.context';
import type { DecisionGraphType } from '../dg-types';
import { SimulatorEditor } from './simulator-editor';
import { SimulatorRequestToolbar } from './simulator-request-toolbar';
import { useRequestExamplePersistence } from './use-request-example-persistence';
import { useSimulatorRequestBinding } from './use-simulator-request-binding';
import { useSimulatorAutoSync } from './use-simulator-auto-sync';
import { useSimulatorRequestEditor } from './use-simulator-request-editor';

export type SimulatorRequestPanelProps = {
  defaultRequest?: string;
  onChange?: (contextJson: string) => void;
  hasInputNode?: boolean;
  loading?: boolean;
  onRun?: (payload: { graph: DecisionGraphType; context: unknown }) => void;
};

export const SimulatorRequestPanel: React.FC<SimulatorRequestPanelProps> = ({
  onChange,
  hasInputNode,
  loading,
  onRun,
  defaultRequest,
}) => {
  const { t } = useTranslation();
  const { stateStore, actions } = useDecisionGraphRaw();

  const { simulatorRequest, simulatorExampleBinding, inputNodeContent, inputNodeId } = useDecisionGraphState(
    ({ simulatorRequest, simulatorExampleBinding, decisionGraph }) => {
    // 获取输入节点的内容
      const inputNode = decisionGraph?.nodes?.find((n) => n.type === 'inputNode');
      return {
        simulatorRequest,
        simulatorExampleBinding,
        inputNodeContent: inputNode?.content,
        inputNodeId: inputNode?.id,
      };
    },
  );
  const {
    requestSources,
    boundRequestSourceIndex,
    defaultRequestSourceIndex,
    defaultRequestSource,
    resolvedSimulatorExampleBinding,
    currentBindingIdentity,
    requestDefinitions,
    sourceOptions,
    bindingName,
    shouldShowSimulatorSourceSelect,
  } = useSimulatorRequestBinding({
    inputNodeContent,
    inputNodeId,
    simulatorExampleBinding,
    dataLabel: t('requestDataLabel'),
  });
  const {
    requestValue,
    setRequestValue,
    userHasEdited,
    setUserHasEdited,
    isApplyingExternalRequest,
  } = useSimulatorRequestEditor({
    defaultRequest,
    simulatorRequest,
    currentBindingIdentity,
    onExternalChange: onChange,
  });

  const handleSourceChange = (sourceIndex: number) => {
    const source = requestSources[sourceIndex];

    if (!inputNodeId || !source) {
      return;
    }

    // 源切换前冲刷未落盘的编辑（以旧 binding 立即持久化，防串源写入）
    flushPendingAutoSync();

    const mergedData = mergeRequestExampleDefaultsByDefinitions(source.data, requestDefinitions);
    const normalizedData = normalizeRequestExampleDataByDefinitions(mergedData, requestDefinitions);
    const formattedRequest = JSON.stringify(normalizedData, null, 2);

    actions.setSimulatorRequest(formattedRequest);
    actions.setSimulatorExampleBinding({
      nodeId: inputNodeId,
      sourceIndex,
      sourceName: source.name,
    });
  };

  useEffect(() => {
    if (!defaultRequestSource) {
      return;
    }

    if (
      inputNodeId &&
      defaultRequestSourceIndex >= 0 &&
      resolvedSimulatorExampleBinding &&
      (simulatorExampleBinding?.nodeId !== inputNodeId ||
        simulatorExampleBinding.sourceIndex !== defaultRequestSourceIndex ||
        simulatorExampleBinding.sourceName !== defaultRequestSource.name)
    ) {
      actions.setSimulatorExampleBinding(resolvedSimulatorExampleBinding);
    }

    if (userHasEdited) {
      return;
    }

    const mergedDefaultData = mergeRequestExampleDefaultsByDefinitions(defaultRequestSource.data, requestDefinitions);
    const formattedContent = JSON.stringify(
      normalizeRequestExampleDataByDefinitions(mergedDefaultData, requestDefinitions),
      null,
      2,
    );
    if (formattedContent && formattedContent !== requestValue) {
      setRequestValue(formattedContent);
      actions.setSimulatorRequest(formattedContent);
      onChange?.(formattedContent);

      if (import.meta.env.DEV) {
        console.log('[simulator-request] synced default request source', {
          source: defaultRequestSource,
          binding: simulatorExampleBinding,
          sourceIndex: defaultRequestSourceIndex,
          formattedContent,
        });
      }
    }
  }, [
    actions,
    defaultRequestSource,
    defaultRequestSourceIndex,
    inputNodeId,
    onChange,
    requestDefinitions,
    requestValue,
    resolvedSimulatorExampleBinding,
    simulatorExampleBinding,
    userHasEdited,
  ]);

  useEffect(() => {
    if (!isWasmAvailable()) {
      return;
    }

    const { decisionGraph } = stateStore.getState();
    const requestNode = decisionGraph.nodes.find((n) => n.type === 'inputNode');
    if (!requestNode) {
      return;
    }

    try {
      const value = requestValue ? json5.parse(requestValue) : 'Any';
      actions.setNodeType(requestNode.id, NodeTypeKind.InferredOutput, new VariableType(value));
    } catch {
      // Skip
    }
  }, [requestValue]);

  const { persistRequestToExampleSource } = useRequestExamplePersistence({
    t,
    requestValue,
    resolvedSimulatorExampleBinding,
    onRequestValueChange: setRequestValue,
    onMarkEdited: () => setUserHasEdited(true),
    onExternalChange: onChange,
  });

  // 反向同步：request 子tab 编辑 schema.examples 后推送至 simulator 编辑器
  // （守卫：与本面板最近一次推送相同则跳过，防回灌）
  const requestSourcesSignature = JSON.stringify(requestSources.map((source) => source.data));

  const { flush: flushPendingAutoSync } = useSimulatorAutoSync({
    enabled: Boolean(hasInputNode && resolvedSimulatorExampleBinding),
    requestValue,
    requestSourcesSignature,
    boundRequestSourceIndex,
    onSyncToSchema: () => {
      persistRequestToExampleSource({
        validateDefinitionTypes: false,
        silentWhenUnbound: true,
        showSuccessMessage: false,
        silentOnError: true,
        triggeredBy: 'auto-sync',
      });
    },
    onPushToEditor: () => {
      if (boundRequestSourceIndex < 0 || !requestSources[boundRequestSourceIndex]) {
        return;
      }

      const mergedData = mergeRequestExampleDefaultsByDefinitions(
        requestSources[boundRequestSourceIndex].data,
        requestDefinitions,
      );
      const normalizedData = normalizeRequestExampleDataByDefinitions(mergedData, requestDefinitions);
      actions.setSimulatorRequest(JSON.stringify(normalizedData, null, 2));
    },
  });

  const handleFormat = () => {
    try {
      const parsed = json5.parse(requestValue || '');
      const normalizedParsed = normalizeRequestJsonKeys(parsed);
      const formatted = JSON.stringify(normalizedParsed, null, 2);
      setRequestValue(formatted);
      setUserHasEdited(true);
      actions.setSimulatorRequest(formatted);
      onChange?.(formatted);
      message.success(t('formatSuccess'));
    } catch {
      message.error(t('formatFailed'));
    }
  };

  const handleCopy = async () => {
    try {
      if (!requestValue || requestValue.trim().length === 0) {
        message.warning(t('nothingToCopy'));
        return;
      }

      const parsed = json5.parse(requestValue);
      const jsonString = JSON.stringify(parsed);

      await copyToClipboard(jsonString);
      message.success(t('copiedToClipboard'));
    } catch {
      message.error(t('copyFailedInvalidJson'));
    }
  };

  const handleRun = () => {
    if (!onRun) {
      return;
    }

    try {
      const parsed = (requestValue || '').trim().length === 0 ? null : json5.parse(requestValue || '');
      const hasRequestDefinitions = getRequestDefinitions(inputNodeContent).length > 0;
      const hasRequestSchema = Boolean(resolveRequestSchemaValue(inputNodeContent));

      if ((hasRequestDefinitions || hasRequestSchema) && parsed === null) {
        message.warning(t('requestDataRequiredBeforeRun'));
        return;
      }

      onRun({
        graph: stateStore.getState().decisionGraph,
        context: parsed,
      });
    } catch {
      notification.error({
        message: t('requestInvalidFormatTitle'),
        description: t('requestInvalidFormatDescription'),
        placement: 'top',
      });
    }
  };

  return (
    <>
      <SimulatorRequestToolbar
        t={t}
        shouldShowSimulatorSourceSelect={shouldShowSimulatorSourceSelect}
        boundRequestSourceIndex={boundRequestSourceIndex}
        sourceOptions={sourceOptions}
        bindingName={bindingName}
        hasInputNode={hasInputNode}
        loading={loading}
        onSourceChange={handleSourceChange}
        onFormat={handleFormat}
        onCopy={handleCopy}
        onRun={onRun ? handleRun : undefined}
      />
      <div className={'grl-dg__simulator__section__content grl-dg__simulator__section__content--request'}>
        <div
          className={`grl-dg__simulator__request-editor ${
            isApplyingExternalRequest ? 'grl-dg__simulator__request-editor--switching' : ''
          }`}
        >
          <SimulatorEditor
            value={requestValue}
            onChange={(text) => {
              setRequestValue(text);
              setUserHasEdited(true);
              actions.setSimulatorRequest(text ?? '');
              onChange?.(text ?? '');
            }}
          />
        </div>
        {isApplyingExternalRequest && (
          <div className='grl-dg__simulator__request-switching'>
            <Spin size='small' />
          </div>
        )}
      </div>
    </>
  );
};
