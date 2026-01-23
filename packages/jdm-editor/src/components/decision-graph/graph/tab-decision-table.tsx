import { PlayCircleOutlined } from '@ant-design/icons';
import type { DragDropManager } from 'dnd-core';
import React, { useMemo } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { P, match } from 'ts-pattern';
import { Button, theme } from 'antd';

import { getNodeData } from '../../../helpers/node-data';
import { get } from '../../../helpers/utility';
import { isWasmAvailable } from '../../../helpers/wasm';
import type { DecisionTableType } from '../../decision-table';
import { DecisionTable } from '../../decision-table';
import type { DecisionTablePermission } from '../../decision-table/context/dt-store.context';
import { useDecisionGraphActions, useDecisionGraphState } from '../context/dg-store.context';
import type { NodeDecisionTableData } from '../nodes/specifications/decision-table.specification';
import type { SimulationTrace, SimulationTraceDataTable } from '../simulator/simulation.types';
import { InputDataPreview, OutputDataPreview } from './input-data-preview';

export type TabDecisionTableProps = {
  id: string;
  manager?: DragDropManager;
  onRunNode?: () => void;
  runLoading?: boolean;
};

export const TabDecisionTable: React.FC<TabDecisionTableProps> = ({ id, manager, onRunNode, runLoading }) => {
  const { token } = theme.useToken();
  const graphActions = useDecisionGraphActions();
  const { nodeName, nodeTrace, inputData, nodeSnapshot, viewConfig } = useDecisionGraphState(
    ({ simulate, decisionGraph, viewConfig }) => ({
      nodeName: decisionGraph.nodes.find((n) => n.id === id)?.name,
      nodeTrace: match(simulate)
        .with({ result: P.nonNullable }, ({ result }) => (result.trace?.[id] as SimulationTrace<SimulationTraceDataTable>) ?? null)
        .otherwise(() => null),
      inputData: match(simulate)
        .with({ result: P.nonNullable }, ({ result }) =>
          result.trace?.[id] ? getNodeData(id, { trace: result.trace, decisionGraph }) : null
        )
        .otherwise(() => null),
      nodeSnapshot: match(simulate)
        .with(
          { result: P.nonNullable },
          ({ result }) => (result.snapshot?.nodes?.find((n) => n.id === id)?.content as DecisionTableType) ?? null,
        )
        .otherwise(() => null),
      viewConfig,
    }),
  );

  const { disabled, content } = useDecisionGraphState(({ disabled, decisionGraph }) => ({
    disabled,
    content: (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content as NodeDecisionTableData,
  }));

  const debug = useMemo(() => {
    if (!nodeTrace || !inputData) {
      return undefined;
    }

    // 如果 nodeSnapshot 缺失，使用当前节点内容作为降级，并转换类型
    const fallbackSnapshot = nodeSnapshot || (content ? {
      ...content,
      inputField: content.inputField || undefined, // 将 null 转换为 undefined
    } as DecisionTableType : null);
    if (!fallbackSnapshot) {
      return undefined;
    }

    if (!isWasmAvailable()) {
      return { trace: nodeTrace, snapshot: fallbackSnapshot };
    }

    const extendedInputData = { ...inputData };
    if (content?.inputField) {
      extendedInputData.data = get(extendedInputData.data, content.inputField, {});
    }

    return { trace: nodeTrace, inputData: extendedInputData, snapshot: fallbackSnapshot };
  }, [nodeTrace, nodeSnapshot, inputData, content]);

  return (
    <PanelGroup direction="horizontal" style={{ height: '100%' }}>
      {/* 左侧：输入数据预览 */}
      <Panel defaultSize={25} minSize={15} maxSize={40}>
        <InputDataPreview data={inputData?.data} />
      </Panel>

      <PanelResizeHandle style={{ width: 4, backgroundColor: token.colorBorder }} />

      {/* 中间：编辑区 + 运行按钮 */}
      <Panel defaultSize={50} minSize={30}>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* 顶部工具栏 */}
          {onRunNode && (
            <div
              style={{
                padding: '8px 12px',
                borderBottom: `1px solid ${token.colorBorder}`,
                backgroundColor: token.colorBgContainer,
              }}
            >
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={runLoading}
                onClick={onRunNode}
                size="small"
              >
                运行到此节点
              </Button>
            </div>
          )}

          {/* 编辑区 */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <DecisionTable
              id={id}
              name={nodeName}
              tableHeight={'100%'}
              value={content as any}
              manager={manager}
              disabled={disabled}
              permission={viewConfig?.enabled ? (viewConfig?.permissions?.[id] as DecisionTablePermission) : 'edit:full'}
              debug={debug}
              onChange={(val) => {
                graphActions.updateNode(id, (draft) => {
                  Object.assign(draft.content, val);
                  return draft;
                });
              }}
            />
          </div>
        </div>
      </Panel>

      <PanelResizeHandle style={{ width: 4, backgroundColor: token.colorBorder }} />

      {/* 右侧：输出数据预览 */}
      <Panel defaultSize={25} minSize={15} maxSize={40}>
        <OutputDataPreview data={nodeTrace?.output} />
      </Panel>
    </PanelGroup>
  );
};
