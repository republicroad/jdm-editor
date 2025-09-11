import { InfoCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { VariableType } from '@gorules/zen-engine-wasm';
import { Button, Tooltip, Typography, notification } from 'antd';
import json5 from 'json5';
import React, { useEffect, useState } from 'react';

import { isWasmAvailable } from '../../../helpers/wasm';
import { fJson } from '../../../helpers/utility';
import { NodeTypeKind, useDecisionGraphRaw, useDecisionGraphState } from '../context/dg-store.context';
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
  const [requestValue, setRequestValue] = useState(defaultRequest);
  const { stateStore, actions } = useDecisionGraphRaw();
  
  const { simulatorRequest, inputNodeContent } = useDecisionGraphState(({ simulatorRequest, decisionGraph }) => {
    // 获取输入节点的内容
    const inputNode = decisionGraph?.nodes?.find((n) => n.type === 'inputNode');
    return {
      simulatorRequest,
      inputNodeContent: inputNode?.content?.inputs,
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

  // 监听输入节点内容变化，同步到simulator
  useEffect(() => {
    if (inputNodeContent !== undefined) {
      try {
        // 将输入节点的内容格式化为JSON字符串
        const formattedContent = fJson(inputNodeContent);
        if (formattedContent && formattedContent !== requestValue && formattedContent !== simulatorRequest) {
          setRequestValue(formattedContent);
          onChange?.(formattedContent);
        }
      } catch (error) {
        console.warn('Failed to sync input node content to simulator:', error);
      }
    }
  }, [inputNodeContent, onChange, requestValue, simulatorRequest]);

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
        <Tooltip title={requestTooltip}>
          <Typography.Text style={{ fontSize: 13, cursor: 'help' }}>
            Request
            <InfoCircleOutlined style={{ fontSize: 10, marginLeft: 4, opacity: 0.5, verticalAlign: 'text-top' }} />
          </Typography.Text>
        </Tooltip>
        <div className={'grl-dg__simulator__section__bar__actions'}>
          {onRun && (
            <Tooltip
              title={
                !hasInputNode
                  ? 'Request node is required to run the graph. Drag-and-drop it from the Components panel.'
                  : undefined
              }
            >
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
            onChange?.(text ?? '');
          }}
        />
      </div>
    </>
  );
};
