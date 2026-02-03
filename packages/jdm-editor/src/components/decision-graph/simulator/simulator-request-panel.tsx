import { InfoCircleOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { VariableType } from '@gorules/zen-engine-wasm';
import { Button, Tooltip, Typography, message, notification } from 'antd';
import json5 from 'json5';
import React, { useEffect, useState } from 'react';

import { useTranslation } from '../../../locales';
import { isWasmAvailable } from '../../../helpers/wasm';
import { copyToClipboard, fJson } from '../../../helpers/utility';
import { NodeTypeKind, useDecisionGraphRaw, useDecisionGraphState, useDecisionGraphActions } from '../context/dg-store.context';
import type { DecisionGraphType } from '../dg-types';
import { SimulatorEditor } from './simulator-editor';

const requestTooltip =
  'Your business context that enters through the Request node, starting the decision process. Supply JSON or JSON5 format.';

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
  const { stateStore, actions } = useDecisionGraphRaw();
  const graphActions = useDecisionGraphActions();
  
  const { simulatorRequest, inputNodeContent, inputNodeId } = useDecisionGraphState(({ simulatorRequest, decisionGraph }) => {
    // 获取输入节点的内容
    const inputNode = decisionGraph?.nodes?.find((n) => n.type === 'inputNode');
    return {
      simulatorRequest,
      inputNodeContent: inputNode?.content?.inputs,
      inputNodeId: inputNode?.id,
    };
  });

  useEffect(() => {
    if (simulatorRequest !== undefined && simulatorRequest !== requestValue) {
      setRequestValue(simulatorRequest);
      onChange?.(simulatorRequest);
    }
  }, [simulatorRequest]);

  useEffect(() => {
    if (defaultRequest !== undefined && defaultRequest !== requestValue) {
      setRequestValue(defaultRequest);
    }
  }, [defaultRequest]);

  // 监听输入节点内容变化，仅在用户未手动编辑时同步到simulator
  useEffect(() => {
    if (inputNodeContent !== undefined && !userHasEdited) {
      try {
        // 将输入节点的内容格式化为JSON字符串
        const formattedContent = fJson(inputNodeContent);
        if (formattedContent && formattedContent !== requestValue) {
          setRequestValue(formattedContent);
          onChange?.(formattedContent);
        }
      } catch (error) {
        console.warn('Failed to sync input node content to simulator:', error);
      }
    }
  }, [inputNodeContent, onChange, userHasEdited, requestValue]);

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

  return (
    <>
      <div className={'grl-dg__simulator__section__bar grl-dg__simulator__section__bar--request'}>
        <Tooltip title={t('requestDescription')}>
          <Typography.Text style={{ fontSize: 13, cursor: 'help' }}>
            Request
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
                    onRun?.({ graph: stateStore.getState().decisionGraph, context: parsed });
                  } catch {
                    notification.error({
                      message: 'Invalid format',
                      description: 'Unable to format request, invalid JSON format',
                      placement: 'top',
                    });
                  }
                }}
              >
                Run
              </Button>
            </Tooltip>
          )}
        </div>
      </div>
      <div className={'grl-dg__simulator__section__content'}>
        <SimulatorEditor
          value={requestValue}
          onChange={(text) => {
            setRequestValue(text);
            setUserHasEdited(true);
            onChange?.(text ?? '');
            
            // 同步到input节点
            if (inputNodeId && text) {
              try {
                // 解析JSON内容
                const parsedContent = json5.parse(text);

                // 将解析的内容转换为input节点所需的格式
                if (typeof parsedContent === 'object' && parsedContent !== null) {
                  const inputs = Object.entries(parsedContent).map(([key, value], index) => {
                    // 判断值的类型
                    let type: string;
                    let processedValue: any;

                    if (Array.isArray(value)) {
                      type = 'array';
                      processedValue = value; // 保持数组原样
                    } else if (typeof value === 'boolean') {
                      type = 'bool';
                      processedValue = value;
                    } else if (typeof value === 'number') {
                      type = 'number';
                      processedValue = value;
                    } else if (typeof value === 'object' && value !== null) {
                      type = 'object';
                      processedValue = value; // 保持对象原样
                    } else {
                      type = typeof value;
                      processedValue = value;
                    }

                    return {
                      id: `input_${index}`,
                      key,
                      value: processedValue,
                      type,
                    };
                  });

                  // 更新input节点的内容
                  graphActions.updateNode(inputNodeId, (draft) => {
                    if (!draft.content) {
                      draft.content = { inputs };
                    } else {
                      draft.content.inputs = inputs;
                    }
                    return draft;
                  });
                }
              } catch (error) {
                console.warn('Failed to sync simulator content to input node:', error);
              }
            }
          }}
        />
      </div>
    </>
  );
};
