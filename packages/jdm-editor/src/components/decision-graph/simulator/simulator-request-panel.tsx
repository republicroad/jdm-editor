import { PlayCircleOutlined } from '@/icons';
import InformationIcon from '@/reui/icons/animated/outline/information';
import { VariableType } from '@gorules/zen-engine-wasm';
import { Button, Tooltip, Typography } from '../../primitives';
import { toast } from 'sonner';
import json5 from 'json5';
import React, { useEffect, useState } from 'react';

import { isWasmAvailable } from '../../../helpers/wasm';
import { NodeTypeKind, useDecisionGraphRaw } from '../context/dg-store.context';
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
      <div className='flex h-9 select-none items-center justify-between gap-1 border-b border-b-[var(--border)] px-2'>
        <Tooltip title={requestTooltip}>
          <Typography.Text
            style={{ fontSize: 13, cursor: 'help' }}
            className='[&>svg]:inline'
          >
            Request
            <InformationIcon className='size-2.5 ml-1 opacity-50 align-super' />
          </Typography.Text>
        </Tooltip>
        <div className={'flex items-center gap-2'}>
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
                    toast.error('Invalid format', {
                      description: 'Unable to format request, invalid JSON format',
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
      <div className={'min-h-0 flex-1 overflow-y-auto'}>
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
