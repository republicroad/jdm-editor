import { PlayCircleOutlined } from '@ant-design/icons';
import type { DragDropManager } from 'dnd-core';
import React, { useMemo } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { P, match } from 'ts-pattern';
import type { z } from 'zod';
import { Button, message, theme } from 'antd';

import type { GetNodeDataResult } from '../../../helpers/node-data';
import { getNodeData } from '../../../helpers/node-data';
import type { expressionNodeSchema } from '../../../helpers/schema';
import { get } from '../../../helpers/utility';
import { isWasmAvailable } from '../../../helpers/wasm';
import { Expression } from '../../expression';
import type { ExpressionPermission } from '../../expression/context/expression-store.context';
import { useDecisionGraphActions, useDecisionGraphState } from '../context/dg-store.context';
import type { NodeExpressionData } from '../nodes/specifications/expression.specification';
import type { SimulationTrace, SimulationTraceDataExpression } from '../simulator/simulation.types';
import { InputDataPreview, OutputDataPreview } from './input-data-preview';

export type TabExpressionProps = {
  id: string;
  manager?: DragDropManager;
  onRunNode?: () => void;
  runLoading?: boolean;
};

export const TabExpression: React.FC<TabExpressionProps> = ({ id, manager, onRunNode, runLoading }) => {
  const { token } = theme.useToken();
  const graphActions = useDecisionGraphActions();
  const { disabled, content } = useDecisionGraphState(({ disabled, decisionGraph }) => ({
    disabled,
    content: (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content as NodeExpressionData,
  }));

  const { nodeTrace, inputData, nodeSnapshot, viewConfig } = useDecisionGraphState(
    ({ simulate, decisionGraph, viewConfig }) => ({
      nodeTrace: match(simulate)
        .with(
          { result: P.nonNullable },
          ({ result }) => (result.trace?.[id] as SimulationTrace<SimulationTraceDataExpression>) ?? null,
        )
        .otherwise(() => null),
      inputData: match(simulate)
        .with({ result: P.nonNullable }, ({ result }) =>
          result.trace?.[id] ? getNodeData(id, { trace: result.trace, decisionGraph }) : null
        )
        .otherwise(() => null),
      nodeSnapshot: match(simulate)
        .with(
          { result: P.nonNullable },
          ({ result }) =>
            (result.snapshot?.nodes?.find((n) => n.id === id)?.content as z.infer<typeof expressionNodeSchema>['content']) ?? null,
        )
        .otherwise(() => null),
      viewConfig,
    }),
  );

  const debug = useMemo(() => {
    if (!nodeTrace || !inputData || !nodeSnapshot) {
      return undefined;
    }

    if (!isWasmAvailable()) {
      return { trace: nodeTrace, snapshot: nodeSnapshot };
    }

    const $data = Object.fromEntries(Object.entries(nodeTrace.traceData).map(([k, v]) => [k, safeJson(v.result)]));
    const extendedInputData: GetNodeDataResult = {
      ...inputData,
      $: $data,
    };

    if (content?.inputField) {
      extendedInputData.data = get(extendedInputData.data, content.inputField, {});
    }

    return { trace: nodeTrace, inputData: extendedInputData, snapshot: nodeSnapshot };
  }, [nodeTrace, nodeSnapshot, inputData]);

  // 字段点击处理
  const handleFieldClick = (fieldPath: string) => {
    console.log('Field clicked:', fieldPath);
    message.success(`已选择字段: ${fieldPath}`);
    // TODO: 需要访问编辑器实例来插入字段
  };

  // 字段拖拽开始处理
  const handleFieldDragStart = (fieldPath: string, e: React.DragEvent) => {
    console.log('Drag start:', fieldPath);
  };

  return (
    <PanelGroup direction="horizontal" style={{ height: '100%' }}>
      {/* 左侧：输入数据预览 */}
      <Panel defaultSize={25} minSize={15} maxSize={40}>
        <InputDataPreview
          data={inputData?.data}
          onFieldClick={handleFieldClick}
          onFieldDragStart={handleFieldDragStart}
        />
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
          <div style={{ flex: 1, overflow: 'auto' }}>
            <Expression
              value={content?.expressions}
              disabled={disabled}
              permission={(viewConfig?.enabled ? viewConfig?.permissions?.[id] : 'edit:full') as ExpressionPermission}
              manager={manager}
              debug={debug}
              onChange={(val) => {
                graphActions.updateNode(id, (draft) => {
                  draft.content.expressions = val;
                  return draft;
                });
              }}
            />
          </div>
        </div>
      </Panel>

      <PanelResizeHandle style={{ width: 4, backgroundColor: token.colorBorder }} />

      {/* 右侧：输出数据预览（预留） */}
      <Panel defaultSize={25} minSize={15} maxSize={40}>
        <OutputDataPreview data={nodeTrace?.output} />
      </Panel>
    </PanelGroup>
  );
};

const safeJson = (data: string): unknown => {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};
