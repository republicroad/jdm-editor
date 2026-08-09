import { VariableType } from '@gorules/zen-engine-wasm';
import { Spin, message, notification } from 'antd';
import json5 from 'json5';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { isWasmAvailable } from '../../../helpers/wasm';
import { copyToClipboard } from '../../../helpers/utility';
import {
  getRequestDefinitions,
  getRequestExampleSources,
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
  const [requestValue, setRequestValue] = useState(defaultRequest);
  const [userHasEdited, setUserHasEdited] = useState(false);
  const [isApplyingExternalRequest, setIsApplyingExternalRequest] = useState(false);
  const switchAnimationTimerRef = useRef<number | null>(null);
  const previousBindingIdentityRef = useRef<string | null>(null);
  const previousSimulatorRequestRef = useRef<string | undefined>(undefined);
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
  const requestSources = useMemo(
    () => getRequestExampleSources(inputNodeContent, { dataLabel: t('requestDataLabel') }),
    [inputNodeContent, t],
  );
  const boundRequestSourceIndex = useMemo(() => {
    if (!simulatorExampleBinding || simulatorExampleBinding.nodeId !== inputNodeId) {
      return -1;
    }

    return requestSources[simulatorExampleBinding.sourceIndex] ? simulatorExampleBinding.sourceIndex : -1;
  }, [inputNodeId, requestSources, simulatorExampleBinding]);
  const defaultRequestSourceIndex =
    boundRequestSourceIndex >= 0 ? boundRequestSourceIndex : requestSources.length > 0 ? 0 : -1;
  const defaultRequestSource =
    defaultRequestSourceIndex >= 0 ? requestSources[defaultRequestSourceIndex] : undefined;
  const resolvedSimulatorExampleBinding = useMemo(() => {
    if (!inputNodeId || defaultRequestSourceIndex < 0 || !defaultRequestSource) {
      return null;
    }

    return {
      nodeId: inputNodeId,
      sourceIndex: defaultRequestSourceIndex,
      sourceName: defaultRequestSource.name,
    };
  }, [defaultRequestSource, defaultRequestSourceIndex, inputNodeId]);
  const currentBindingIdentity = useMemo(
    () =>
      simulatorExampleBinding
        ? `${simulatorExampleBinding.nodeId}:${simulatorExampleBinding.sourceIndex}`
        : null,
    [simulatorExampleBinding],
  );
  const requestDefinitions = useMemo(() => getRequestDefinitions(inputNodeContent), [inputNodeContent]);
  const sourceOptions = useMemo(
    () => requestSources.map((source, index) => ({ value: index, label: source.name })),
    [requestSources],
  );
  const bindingName = useMemo(
    () => (boundRequestSourceIndex >= 0 ? requestSources[boundRequestSourceIndex]?.name : undefined),
    [boundRequestSourceIndex, requestSources],
  );
  const shouldShowSimulatorSourceSelect =
    Boolean(bindingName) && Boolean(inputNodeId) && requestSources.length > 1;

  const handleSourceChange = (sourceIndex: number) => {
    const source = requestSources[sourceIndex];

    if (!inputNodeId || !source) {
      return;
    }

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
  useEffect(
    () => () => {
      if (switchAnimationTimerRef.current !== null) {
        window.clearTimeout(switchAnimationTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const previousBindingIdentity = previousBindingIdentityRef.current;
    const hasSwitchedExampleSource =
      currentBindingIdentity !== null && currentBindingIdentity !== previousBindingIdentity;
    previousBindingIdentityRef.current = currentBindingIdentity;

    if (!hasSwitchedExampleSource) {
      return;
    }

    if (switchAnimationTimerRef.current !== null) {
      window.clearTimeout(switchAnimationTimerRef.current);
    }

    setIsApplyingExternalRequest(true);
    switchAnimationTimerRef.current = window.setTimeout(() => {
      setIsApplyingExternalRequest(false);
      switchAnimationTimerRef.current = null;
    }, 320);
  }, [currentBindingIdentity]);

  useEffect(() => {
    if (simulatorRequest === undefined || simulatorRequest === previousSimulatorRequestRef.current) {
      return;
    }

    previousSimulatorRequestRef.current = simulatorRequest;
    setRequestValue(simulatorRequest);
    setUserHasEdited(true);
    onChange?.(simulatorRequest);

    if (import.meta.env.DEV) {
      console.log('[simulator-request] applied external simulatorRequest', {
        simulatorRequest,
      });
    }
  }, [onChange, simulatorRequest]);

  useEffect(() => {
    if (defaultRequest !== undefined && defaultRequest !== requestValue) {
      setRequestValue(defaultRequest);
    }
  }, [defaultRequest]);

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
        onSave={() => persistRequestToExampleSource({ validateDefinitionTypes: true })}
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
