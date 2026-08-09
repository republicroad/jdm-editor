import { CopyOutlined, FormatPainterOutlined, InfoCircleOutlined, LinkOutlined, PlayCircleOutlined, SaveOutlined } from '@ant-design/icons';
import { VariableType } from '@gorules/zen-engine-wasm';
import { Button, Select, Spin, Tooltip, Typography, message, notification } from 'antd';
import json5 from 'json5';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  formatRequestExampleSourceName,
  getRequestDefinitions,
  getRequestExampleDataDefinitionConflicts,
  getRequestExampleSources,
  normalizeRequestJsonKeys,
  normalizeRequestExampleDataByDefinitions,
  resolveRequestSchemaValue,
  setRequestSchemaValue,
  updateRequestSchemaExamples,
} from '../../../helpers/request-schema';
import { useTranslation } from '../../../locales';
import { isWasmAvailable } from '../../../helpers/wasm';
import { copyToClipboard } from '../../../helpers/utility';
import { NodeTypeKind, useDecisionGraphRaw, useDecisionGraphState } from '../context/dg-store.context';
import type { DecisionGraphType } from '../dg-types';
import { SimulatorEditor } from './simulator-editor';

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

    const normalizedData = normalizeRequestExampleDataByDefinitions(source.data, requestDefinitions);
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

    const formattedContent = JSON.stringify(defaultRequestSource.data, null, 2);
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

  const savePreparedRequestToExampleSource = ({
    activeExampleBinding,
    preparedParsed,
    triggeredBy,
    showSuccessMessage = true,
  }: {
    activeExampleBinding: NonNullable<typeof resolvedSimulatorExampleBinding>;
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

    setRequestValue(formatted);
    setUserHasEdited(true);
    onChange?.(formatted);
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

  const persistRequestToExampleSource = (options?: {
    silentWhenUnbound?: boolean;
    showSuccessMessage?: boolean;
    requestValueOverride?: string;
    silentOnError?: boolean;
    validateDefinitionTypes?: boolean;
    triggeredBy?: 'manual-save';
  }) => {
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

  return (
    <>
      <div className={'grl-dg__simulator__section__bar grl-dg__simulator__section__bar--request'}>
        <Tooltip title={t('requestDescription')}>
          <Typography.Text
            style={{ fontSize: 13, cursor: 'help', flexShrink: 1, minWidth: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
          >
            {t('request')}
            <InfoCircleOutlined style={{ fontSize: 10, marginLeft: 4, opacity: 0.5, verticalAlign: 'text-top' }} />
          </Typography.Text>
        </Tooltip>
        {shouldShowSimulatorSourceSelect && (
          <Tooltip title={t('requestCurrentDataSourceLabel')}>
            <div className={'grl-dg__simulator__section__bar__source-select'}>
              <LinkOutlined style={{ fontSize: 12, color: 'var(--grl-color-text-secondary)' }} />
              <Select
                size='small'
                variant='filled'
                value={boundRequestSourceIndex}
                options={sourceOptions}
                popupMatchSelectWidth={false}
                popupClassName={'grl-dg__simulator__section__bar__source-select-popup'}
                className={'grl-dg__simulator__section__bar__source-select__control'}
                onChange={handleSourceChange}
              />
            </div>
          </Tooltip>
        )}
        {bindingName && !shouldShowSimulatorSourceSelect && (
          <Typography.Text className={'grl-dg__simulator__section__bar__source-select__label'} type='secondary'>
            <Tooltip title={t('requestCurrentDataSourceLabel')}>
              <LinkOutlined style={{ fontSize: 12, color: 'var(--grl-color-text-secondary)' }} />
            </Tooltip>{' '}
            {bindingName}
          </Typography.Text>
        )}
        <div className={'grl-dg__simulator__section__bar__actions'}>
          {/* {inputNodeContent && userHasEdited && (
            <Tooltip title={t('resyncInputNodeContent')}>
              <Button
                size={'small'}
                type={'text'}
                icon={<ReloadOutlined />}
                onClick={() => {
                  try {
                    const formattedContent = fJson(inputNodeContent);
                    if (formattedContent) {
                      setRequestValue(formattedContent);
                      setUserHasEdited(false);
                      onChange?.(formattedContent);
                    }
                  } catch (error) {
                    console.warn('Failed to sync input node content:', error);
                  }
                }}
              />
            </Tooltip>
          )} */}
          {onRun && (
            <Tooltip
              title={
                !hasInputNode
                  ? t('requestNodeRequired')
                  : undefined
              }
            >
              <Tooltip title={t('format')}>
                <Button
                  size={'small'}
                  type={'text'}
                  shape={'circle'}
                  icon={<FormatPainterOutlined />}
                  onClick={() => {
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
                  }}
                />
              </Tooltip>
              <Tooltip title={t('requestSaveDataSource')}>
                <Button
                  size={'small'}
                  type={'text'}
                  shape={'circle'}
                  icon={<SaveOutlined />}
                  disabled={!hasInputNode}
                  onClick={() => {
                    persistRequestToExampleSource({
                      validateDefinitionTypes: true,
                    });
                  }}
                />
              </Tooltip>
              <Tooltip title={t('copyJson')}>
                <Button
                  size={'small'}
                  type={'text'}
                  shape={'circle'}
                  icon={<CopyOutlined />}
                  onClick={async () => {
                    try {
                      if (!requestValue || requestValue.trim().length === 0) {
                        message.warning(t('nothingToCopy'));
                        return;
                      }

                      // 验证并复制JSON（不格式化，保持原样）
                      const parsed = json5.parse(requestValue);
                      const jsonString = JSON.stringify(parsed);

                      // 复制到剪贴板
                      await copyToClipboard(jsonString);
                      message.success(t('copiedToClipboard'));
                    } catch {
                      message.error(t('copyFailedInvalidJson'));
                    }
                  }}
                />
              </Tooltip>
              <Tooltip title={t('run')}>
                <Button
                  size={'small'}
                  type={'primary'}
                  shape={'circle'}
                  loading={loading}
                  icon={<PlayCircleOutlined />}
                  disabled={!hasInputNode}
                  onClick={() => {
                    try {
                      const parsed = (requestValue || '').trim().length === 0 ? null : json5.parse(requestValue || '');
                      const hasRequestDefinitions = getRequestDefinitions(inputNodeContent).length > 0;
                      const hasRequestSchema = Boolean(resolveRequestSchemaValue(inputNodeContent));

                      if ((hasRequestDefinitions || hasRequestSchema) && parsed === null) {
                        message.warning(t('requestDataRequiredBeforeRun'));
                        return;
                      }

                      onRun?.({
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
                  }}
                />
              </Tooltip>
            </Tooltip>
          )}
        </div>
      </div>
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
