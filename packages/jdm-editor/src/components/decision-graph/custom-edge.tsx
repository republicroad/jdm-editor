import { DeleteOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import clsx from 'clsx';
import React from 'react';
import type { EdgeProps } from 'reactflow';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from 'reactflow';
import { P, match } from 'ts-pattern';

import { useDecisionGraphActions, useDecisionGraphState, useEdgeDiff } from './context/dg-store.context';
import type { SimulationTraceDataSwitch } from './simulator/simulation.types';

export const CustomEdge: React.FC<EdgeProps> = (props) => {
  const graphActions = useDecisionGraphActions();
  const { id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {} } = props;
  const sourceHandle = (props as any).sourceHandle;

  const { isHovered, disabled, isOnSuccessPath, isOnErrorPath } = useDecisionGraphState(({ hoveredEdgeId, disabled, simulate }) => {
    // 判断这条边是否在成功执行路径上
    let isOnSuccessPath = false;
    // 判断这条边是否指向失败节点
    let isOnErrorPath = false;

    const errorNodeId = simulate?.error?.data?.nodeId;
    const trace = simulate?.result?.trace;

    if (trace) {
      const sourceTrace = trace[source];
      const targetTrace = trace[target];

      // 判断是否指向失败节点
      if (errorNodeId === target && sourceTrace) {
        // 对于 Switch 节点，检查 sourceHandle 是否匹配执行的分支
        const switchTraceData = sourceTrace.traceData as SimulationTraceDataSwitch | null;
        if (switchTraceData?.statements && sourceHandle) {
          isOnErrorPath = switchTraceData.statements.some(
            (s) => s.id === sourceHandle
          );
        } else {
          isOnErrorPath = true;
        }
      }
      // 判断成功路径
      else if (sourceTrace && targetTrace) {
        // 对于 Switch 节点，检查 sourceHandle 是否匹配执行的分支
        const switchTraceData = sourceTrace.traceData as SimulationTraceDataSwitch | null;
        if (switchTraceData?.statements && sourceHandle) {
          isOnSuccessPath = switchTraceData.statements.some(
            (s) => s.id === sourceHandle
          );
        } else {
          // 非 Switch 节点，只要源和目标都在 trace 中就算成功路径
          isOnSuccessPath = true;
        }
      }
    }

    return { isHovered: hoveredEdgeId === id, disabled, isOnSuccessPath, isOnErrorPath };
  });

  const { diff } = useEdgeDiff(id);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // 防止 NaN 值传递到 SVG
  const safeLabelX = isNaN(labelX) ? 0 : labelX;
  const safeLabelY = isNaN(labelY) ? 0 : labelY;

  // 根据状态计算线条颜色
  const strokeColor = match([diff, isOnErrorPath, isOnSuccessPath])
    .with([{ status: 'added' }, P._, P._], () => 'var(--grl-color-success-border)')
    .with([{ status: 'removed' }, P._, P._], () => 'var(--grl-color-error)')
    .with([P._, true, P._], () => 'var(--grl-color-error)')  // 失败路径 → 红色
    .with([P._, P._, true], () => 'var(--node-color-green)') // 成功路径 → 绿色
    .otherwise(() => '#b1b1b7');

  // 生成 marker ID（移除特殊字符）
  const markerId = `edge-marker-${id}`;

  return (
    <>
      <defs>
        <marker
          id={markerId}
          markerWidth="12.5"
          markerHeight="12.5"
          viewBox="-10 -10 20 20"
          markerUnits="strokeWidth"
          orient="auto-start-reverse"
          refX="0"
          refY="0"
        >
          <polyline
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1"
            fill={strokeColor}
            points="-5,-4 0,0 -5,4 -5,-4"
          />
        </marker>
      </defs>
      <BaseEdge
        path={edgePath}
        markerEnd={`url(#${markerId})`}
        style={{
          ...(style || {}),
          strokeWidth: 1.5,
          stroke: strokeColor,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className={'nodrag nopan edge-renderer'}
          style={{
            transform: `translate(-50%, -50%) translate(${safeLabelX}px,${safeLabelY}px)`,
          }}
        >
          {!disabled && (
            <Button
              type='primary'
              shape='round'
              icon={<DeleteOutlined />}
              danger
              className={clsx('grl-edge-delete-button')}
              data-visible={isHovered}
              onClick={() => graphActions.removeEdges([id])}
            />
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export const edgeFunction = (outer: any) => (props: any) => <CustomEdge {...props} {...outer} />;
