import { InfoCircleOutlined, PlayCircleOutlined, SaveOutlined } from '@ant-design/icons';
import { VariableType } from '@gorules/zen-engine-wasm';
import { Button, Spin, Tooltip, Typography, message, notification } from 'antd';
import json5 from 'json5';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  buildRequestExampleTemplateFromDefinitions,
  formatRequestExampleSourceName,
  getRequestDefinitions,
  getRequestExampleSources,
  mergeRequestExampleDataWithTemplate,
  normalizeRequestExampleDataByDefinitions,
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

  const { simulatorRequest, simulatorExampleBinding, inputNodeContent } = useDecisionGraphState(
    ({ simulatorRequest, simulatorExampleBinding, decisionGraph }) => {
    // 获取输入节点的内容
      const inputNode = decisionGraph?.nodes?.find((n) => n.type === 'inputNode');
      return {
        simulatorRequest,
        simulatorExampleBinding,
        inputNodeContent: inputNode?.content,
      };
    },
  );
  const requestSources = useMemo(
    () => getRequestExampleSources(inputNodeContent, { dataLabel: t('requestDataLabel') }),
    [inputNodeContent, t],
  );
  const defaultRequestSource = requestSources[0];
  const currentBindingIdentity = useMemo(
    () =>
      simulatorExampleBinding
        ? `${simulatorExampleBinding.nodeId}:${simulatorExampleBinding.sourceIndex}`
        : null,
    [simulatorExampleBinding],
  );

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
    if (!defaultRequestSource || userHasEdited) {
      return;
    }

    const formattedContent = JSON.stringify(defaultRequestSource.data, null, 2);
    if (formattedContent && formattedContent !== requestValue) {
      setRequestValue(formattedContent);
      onChange?.(formattedContent);

      if (import.meta.env.DEV) {
        console.log('[simulator-request] synced default request source', {
          source: defaultRequestSource,
          formattedContent,
        });
      }
    }
  }, [defaultRequestSource, onChange, requestValue, userHasEdited]);

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
  }) => {
    const { silentWhenUnbound = false, showSuccessMessage = true } = options ?? {};

    if (!simulatorExampleBinding) {
      if (!silentWhenUnbound) {
        message.warning(t('requestSelectDataSourceFirst'));
      }
      return null;
    }

    try {
      const parsed = (requestValue || '').trim().length === 0 ? {} : json5.parse(requestValue || '{}');

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        message.error(t('simulatorRequestMustBeObjectToSave'));
        return null;
      }

      const { decisionGraph } = stateStore.getState();
      const targetNode = decisionGraph.nodes.find((node) => node.id === simulatorExampleBinding.nodeId);

      if (!targetNode) {
        message.error(t('simulatorBoundRequestNodeNotFound'));
        return;
      }

      const requestDefinitions = getRequestDefinitions(targetNode.content);
      const requestTemplate = buildRequestExampleTemplateFromDefinitions(requestDefinitions);
      const preparedParsed = normalizeRequestExampleDataByDefinitions(
        mergeRequestExampleDataWithTemplate(requestTemplate, parsed as Record<string, unknown>),
        requestDefinitions,
      );
      const currentSources = getRequestExampleSources(targetNode.content, { dataLabel: t('requestDataLabel') });
      const nextSources = [...currentSources];

      while (nextSources.length <= simulatorExampleBinding.sourceIndex) {
        nextSources.push({
          id: crypto.randomUUID(),
          name: formatRequestExampleSourceName(nextSources.length, t('requestDataLabel')),
          data: {},
          source: 'schema.examples',
        });
      }

      nextSources[simulatorExampleBinding.sourceIndex] = {
        ...nextSources[simulatorExampleBinding.sourceIndex],
        id: nextSources[simulatorExampleBinding.sourceIndex]?.id ?? crypto.randomUUID(),
        name:
          simulatorExampleBinding.sourceName ??
          nextSources[simulatorExampleBinding.sourceIndex]?.name ??
          formatRequestExampleSourceName(simulatorExampleBinding.sourceIndex, t('requestDataLabel')),
        data: preparedParsed,
        source: 'schema.examples',
      };

      actions.updateNode(simulatorExampleBinding.nodeId, (draft) => {
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

      const formatted = JSON.stringify(preparedParsed, null, 2);
      setRequestValue(formatted);
      setUserHasEdited(true);
      onChange?.(formatted);
      actions.setSimulatorRequest(formatted);
      actions.setSimulatorExampleBinding({
        ...simulatorExampleBinding,
        sourceName: nextSources[simulatorExampleBinding.sourceIndex]?.name,
      });

      if (import.meta.env.DEV) {
        console.log('[simulator-request] saved simulator request to bound example source', {
          binding: simulatorExampleBinding,
          parsed,
          preparedParsed,
          nextSources,
          triggeredBy: showSuccessMessage ? 'manual-save' : 'run',
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
          binding: simulatorExampleBinding,
          requestValue,
          error,
          triggeredBy: showSuccessMessage ? 'manual-save' : 'run',
        });
      }

      message.error(t('requestSaveDataSourceFailed'));
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
                    const formatted = JSON.stringify(parsed, null, 2);
                    setRequestValue(formatted);
                    setUserHasEdited(true);
                    onChange?.(formatted);
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
                icon={<SaveOutlined />}
                disabled={!simulatorExampleBinding}
                onClick={() => {
                  persistRequestToExampleSource();
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
                    const persistedResult = persistRequestToExampleSource({
                      silentWhenUnbound: true,
                      showSuccessMessage: false,
                    });

                    if (import.meta.env.DEV) {
                      console.log('[simulator-request] run triggered with datasource sync', {
                        hasBinding: Boolean(simulatorExampleBinding),
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
            onChange={(text) => {
              setRequestValue(text);
              setUserHasEdited(true);
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
