import { InfoCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { VariableType } from '@gorules/zen-engine-wasm';
import { Button, Modal, Spin, Tooltip, Typography, message, notification } from 'antd';
import json5 from 'json5';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  formatRequestExampleSourceName,
  getRequestDefinitions,
  getRequestExampleSources,
  normalizeRequestJsonKeys,
  normalizeRequestExampleDataByDefinitions,
  parseRequestSchemaValue,
  prepareRequestExampleDataDefinitionSync,
  updateRequestSchemaExamples,
  type RequestDefinitionSyncConflict,
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
  const requestDefinitions = useMemo(() => getRequestDefinitions(inputNodeContent), [inputNodeContent]);
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
  const getDefinitionTypeLabel = (type: RequestDefinitionSyncConflict['nextType']) => {
    switch (type) {
      case 'number':
        return t('requestTypeNumber');
      case 'boolean':
        return t('requestTypeBoolean');
      case 'array':
        return t('requestTypeArray');
      case 'object':
        return t('requestTypeObject');
      case 'datetime':
        return t('requestTypeDatetime');
      default:
        return t('requestTypeString');
    }
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

  const persistRequestToExampleSource = (options?: {
    silentWhenUnbound?: boolean;
    showSuccessMessage?: boolean;
    syncDefinitions?: 'always' | 'if-empty' | 'never';
    forceResetTypeConflicts?: boolean;
    allowTypeConflictConfirm?: boolean;
    requestValueOverride?: string;
    silentOnError?: boolean;
    triggeredBy?: 'manual-save' | 'run' | 'format' | 'blur';
  }) => {
    const {
      silentWhenUnbound = false,
      showSuccessMessage = true,
      syncDefinitions = 'always',
      forceResetTypeConflicts = false,
      allowTypeConflictConfirm = true,
      requestValueOverride,
      silentOnError = false,
      triggeredBy = showSuccessMessage ? 'manual-save' : 'run',
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
        return;
      }

      const requestDefinitions = getRequestDefinitions(targetNode.content);
      const currentSources = getRequestExampleSources(targetNode.content, { dataLabel: t('requestDataLabel') });
      const currentBoundSource = currentSources[activeExampleBinding.sourceIndex];
      const parsedRecord = parsed as Record<string, unknown>;
      const shouldSyncDefinitions =
        syncDefinitions === 'always' ||
        (syncDefinitions === 'if-empty' && Object.keys(parsedRecord).length === 0);
      const syncResult = shouldSyncDefinitions
        ? prepareRequestExampleDataDefinitionSync(parsedRecord, requestDefinitions, {
            forceResetConflicts: forceResetTypeConflicts,
          })
        : null;

      if (syncResult && syncResult.conflicts.length > 0) {
        if (allowTypeConflictConfirm) {
          Modal.confirm({
            title: t('requestDefinitionSyncTypeChangeConfirmTitle'),
            content: (
              <div>
                <Typography.Paragraph style={{ marginBottom: 8 }}>
                  {t('requestDefinitionSyncTypeChangeConfirmDescription')}
                </Typography.Paragraph>
                <div>
                  {syncResult.conflicts.map((conflict) => (
                    <Typography.Text key={`${conflict.path}-${conflict.nextType}`} style={{ display: 'block' }}>
                      {`${conflict.path} -> ${getDefinitionTypeLabel(conflict.nextType)}`}
                    </Typography.Text>
                  ))}
                </div>
              </div>
            ),
            okText: t('confirm'),
            cancelText: t('cancel'),
            onOk: () => {
              persistRequestToExampleSource({
                ...options,
                forceResetTypeConflicts: true,
                allowTypeConflictConfirm: false,
              });
            },
          });
        }

        return null;
      }

      const preparedParsed = syncResult
        ? syncResult.data
        : normalizeRequestExampleDataByDefinitions(parsedRecord, requestDefinitions);
      const preparedBoundSourceData = currentBoundSource
        ? normalizeRequestExampleDataByDefinitions(currentBoundSource.data, requestDefinitions)
        : null;
      const formatted = JSON.stringify(preparedParsed, null, 2);

      if (preparedBoundSourceData && JSON.stringify(preparedBoundSourceData) === JSON.stringify(preparedParsed)) {
        if (import.meta.env.DEV) {
          console.log('[simulator-request] skipped saving unchanged example source', {
            binding: activeExampleBinding,
            triggeredBy,
          });
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
        draft.content.schema = updateRequestSchemaExamples(
          draft.content?.schema,
          nextSources.map((source) => source.data),
        );
        if (draft.type === 'inputNode') {
          delete (draft.content as { inputs?: unknown }).inputs;
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
          parsed,
          preparedParsed,
          shouldSyncDefinitions,
          forceResetTypeConflicts,
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
          <Typography.Text style={{ fontSize: 13, cursor: 'help' }}>
            {t('request')}
            <InfoCircleOutlined style={{ fontSize: 10, marginLeft: 4, opacity: 0.5, verticalAlign: 'text-top' }} />
          </Typography.Text>
        </Tooltip>
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
              <Button
                size={'small'}
                type={'default'}
                style={{"marginRight":"8px"}}
                onClick={() => {
                  try {
                    const parsed = json5.parse(requestValue || '');
                    const normalizedParsed = normalizeRequestJsonKeys(parsed);
                    const formatted = JSON.stringify(normalizedParsed, null, 2);
                    setRequestValue(formatted);
                    setUserHasEdited(true);
                    actions.setSimulatorRequest(formatted);
                    onChange?.(formatted);
                    if (
                      resolvedSimulatorExampleBinding &&
                      normalizedParsed &&
                      typeof normalizedParsed === 'object' &&
                      !Array.isArray(normalizedParsed)
                    ) {
                      persistRequestToExampleSource({
                        silentWhenUnbound: true,
                        showSuccessMessage: false,
                        syncDefinitions: 'never',
                        requestValueOverride: formatted,
                        triggeredBy: 'format',
                      });
                    }
                    message.success(t('formatSuccess'));
                  } catch {
                    message.error(t('formatFailed'));
                  }
                }}
              >
                {t('format')}
              </Button>
              <Button
                size={'small'}
                type={'default'}
                style={{"marginRight":"8px"}}
                disabled={!resolvedSimulatorExampleBinding || requestDefinitions.length === 0}
                onClick={() => {
                  persistRequestToExampleSource({
                    syncDefinitions: 'always',
                  });
                }}
              >
                {t('requestSaveDataSource')}
              </Button>
              <Button
                size={'small'}
                type={'default'}
                style={{"marginRight":"8px"}}
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
              >
                {t('copyJson')}
              </Button>
              <Button
                size={'small'}
                type={'primary'}
                loading={loading}
                icon={<PlayCircleOutlined />}
                disabled={!hasInputNode}
                onClick={() => {
                  try {
                    const parsed = (requestValue || '').trim().length === 0 ? null : json5.parse(requestValue || '');
                    const hasRequestDefinitions = getRequestDefinitions(inputNodeContent).length > 0;
                    const hasRequestSchema = Boolean(parseRequestSchemaValue(inputNodeContent?.schema));

                    if ((hasRequestDefinitions || hasRequestSchema) && parsed === null) {
                      message.warning(t('requestDataRequiredBeforeRun'));
                      return;
                    }

                    const persistedResult = persistRequestToExampleSource({
                      silentWhenUnbound: true,
                      showSuccessMessage: false,
                      syncDefinitions: 'if-empty',
                      triggeredBy: 'run',
                    });

                    if (import.meta.env.DEV) {
                      console.log('[simulator-request] run triggered with datasource sync', {
                        hasBinding: Boolean(resolvedSimulatorExampleBinding),
                        persisted: Boolean(persistedResult),
                        context: persistedResult?.context ?? parsed,
                      });
                    }

                    onRun?.({
                      graph: stateStore.getState().decisionGraph,
                      context: persistedResult?.context ?? parsed,
                    });
                  } catch {
                    notification.error({
                      message: t('requestInvalidFormatTitle'),
                      description: t('requestInvalidFormatDescription'),
                      placement: 'top',
                    });
                  }
                }}
              >
                {t('run')}
              </Button>
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
            onBlur={() => {
              persistRequestToExampleSource({
                silentWhenUnbound: true,
                showSuccessMessage: false,
                syncDefinitions: 'never',
                silentOnError: true,
                triggeredBy: 'blur',
              });
            }}
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
