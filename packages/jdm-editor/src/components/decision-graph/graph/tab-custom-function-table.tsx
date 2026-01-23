import { PlayCircleOutlined } from '@ant-design/icons';
import type { DragDropManager } from 'dnd-core';
import React, { useMemo } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { P, match } from 'ts-pattern';
import type { z } from 'zod';
import { Button, theme } from 'antd';

import type { GetNodeDataResult } from '../../../helpers/node-data';
import { getNodeData } from '../../../helpers/node-data';
import type { customNodeSchema } from '../../../helpers/schema';
import { get, smartSplit } from '../../../helpers/utility';
import { isWasmAvailable } from '../../../helpers/wasm';
import { CustomFunction } from '../../custom-function-table';
import type { ExpressionPermission } from '../../custom-function-table/context/expression-store.context';
import { useDecisionGraphActions, useDecisionGraphState } from '../context/dg-store.context';
import type { NodeExpressionData } from '../nodes/specifications/custom-function.specification';
import type { SimulationTrace, SimulationTraceDataExpression } from '../simulator/simulation.types';
import { InputDataPreview, OutputDataPreview } from './input-data-preview';

export type TabExpressionProps = {
  id: string;
  manager?: DragDropManager;
  userId?: string;
  projectId?: string | null;
  menuList?: any;
  customFunctions?: any;
  onRunNode?: () => void;
  runLoading?: boolean;
};

export const CustomFunctionTable: React.FC<TabExpressionProps> = ({ id, manager, userId, projectId, menuList, customFunctions, onRunNode, runLoading }) => {
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
            (result.snapshot?.nodes?.find((n) => n.id === id)?.content as z.infer<typeof customNodeSchema>['content']) ?? null,
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
      return { trace: nodeTrace, snapshot: nodeSnapshot.config };
    }

    const $data = Object.fromEntries(Object.entries(nodeTrace.traceData || {}).map(([k, v]) => [k, safeJson(v.result)]));
    const extendedInputData: GetNodeDataResult = {
      ...inputData,
      $: $data,
    };

    if (content?.config?.inputField) {
      extendedInputData.data = get(extendedInputData.data, content.config.inputField, {});
    }

    return { trace: nodeTrace, inputData: extendedInputData, snapshot: nodeSnapshot.config };
  }, [nodeTrace, nodeSnapshot, inputData]);

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
          <div style={{ flex: 1, overflow: 'auto' }}>
            <CustomFunction
              value={content?.config.expressions as any}
              disabled={disabled}
              permission={(viewConfig?.enabled ? viewConfig?.permissions?.[id] : 'edit:full') as ExpressionPermission}
              manager={manager}
              menuList={menuList}
              customFunctions={customFunctions}
              debug={debug as any}
              onChange={(val:any) => {
                graphActions.updateNode(id, (draft) => {
                  draft.content.config.expressions = val;

                  // 同时更新expr_asts数组格式
                  draft.content.config.expr_asts = val.map((expr: any) => {
                    if (expr.type === 'function' && expr.value) {
                      // 对于函数类型，将;;分割的字符串转换为数组
                      const valueArray = smartSplit(expr.value);
                      return {
                        id: expr.id,
                        key: expr.key,
                        value: valueArray
                      };
                    } else {
                      // 对于非函数类型，将value按;;分割成数组，或直接使用单个值
                      const valueArray = expr.value ? smartSplit(expr.value) : [expr.value || ''];
                      return {
                        id: expr.id,
                        key: expr.key,
                        value: valueArray
                      };
                    }
                  });

                  draft.content.config.meta = {
                    user: userId,
                    proj: projectId
                  };
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

