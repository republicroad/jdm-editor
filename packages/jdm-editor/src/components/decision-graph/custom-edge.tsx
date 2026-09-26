import { DeleteOutlined, PlusOutlined } from '#icons';
import type { EdgeProps } from '@xyflow/react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import clsx from 'clsx';
import React from 'react';
import { match } from 'ts-pattern';

import { nodeSchema } from '../../helpers/schema';
import { Button } from '../primitives';
import { useDecisionGraphActions, useDecisionGraphState, useEdgeDiff } from './context/dg-store.context';
import { nodeSpecification } from './nodes/specifications/specifications';

type PickerItem = {
  /** 内置节点 type；customNode 时恒为 'customNode' 并附加 component */
  type: string;
  component?: string;
  label: React.ReactNode;
  icon: React.ReactNode;
};

type AnySpec = {
  type?: string;
  kind?: string;
  generateNode?: (o: { index: number }) => { name: string; config?: unknown };
};

/** WS1-R3：连接线"+"选型插入（flow-1 connector 模式）——规范清单 = 内置 + 自定义组件 */
const usePickerItems = (): PickerItem[] => {
  const components = useDecisionGraphState(({ components }) => components);
  const allSpecs = [
    ...(Object.values(nodeSpecification) as unknown as AnySpec[]),
    ...((components ?? []) as unknown as AnySpec[]),
  ];
  return allSpecs.map((spec) => ({
    type: spec.kind ? 'customNode' : (spec.type ?? 'customNode'),
    component: spec.kind,
    label: spec.kind
      ? ((spec as { displayName?: React.ReactNode }).displayName ?? spec.kind)
      : ((spec as { displayName?: React.ReactNode }).displayName ?? ''),
    icon: (spec as { icon?: React.ReactNode }).icon,
  }));
};

export const CustomEdge: React.FC<EdgeProps & { sourceHandle?: string | null; targetHandle?: string | null }> = (
  props,
) => {
  const graphActions = useDecisionGraphActions();
  const {
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
  } = props;
  const { isHovered, disabled, decisionGraph, components } = useDecisionGraphState(
    ({ hoveredEdgeId, disabled, decisionGraph, components }) => ({
      isHovered: hoveredEdgeId === id,
      disabled,
      decisionGraph,
      components,
    }),
  );

  const { diff } = useEdgeDiff(id);
  const [picking, setPicking] = React.useState(false);
  const pickerItems = usePickerItems();

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const insertBetween = async (item: PickerItem) => {
    setPicking(false);
    const existingCount = (decisionGraph?.nodes ?? []).filter((n) =>
      item.type === 'customNode' ? n.content?.kind === item.component : n.type === item.type,
    ).length;
    const allSpecs = [...Object.values(nodeSpecification), ...(components as unknown as AnySpec[])] as AnySpec[];
    const spec =
      item.type === 'customNode'
        ? allSpecs.find((s) => s.kind === item.component)
        : allSpecs.find((s) => s.type === item.type);
    if (!spec?.generateNode) return;
    const partialNode = spec.generateNode({ index: existingCount + 1 });

    const position = { x: labelX - 110, y: labelY - 20 };
    const newNode =
      item.type === 'customNode'
        ? {
            id: crypto.randomUUID(),
            type: 'customNode',
            name: partialNode.name,
            position,
            content: { kind: item.component, config: partialNode?.config },
          }
        : { id: crypto.randomUUID(), type: item.type, position, ...partialNode };

    const parsed = nodeSchema.safeParse(newNode);
    if (!parsed.success) return;

    // 插入并重连：source→new→target，移除原边
    graphActions.addNodes([parsed.data]);
    graphActions.addEdges([
      {
        id: crypto.randomUUID(),
        sourceId: source,
        sourceHandle: sourceHandle ?? undefined,
        targetId: newNode.id,
        type: 'edge',
      },
      {
        id: crypto.randomUUID(),
        sourceId: newNode.id,
        targetId: target,
        targetHandle: targetHandle ?? undefined,
        type: 'edge',
      },
    ]);
    graphActions.removeEdges([id]);
  };

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...(style || {}),
          stroke: match(diff)
            .with({ status: 'added' }, () => 'var(--seal-color-success)')
            .with({ status: 'removed' }, () => 'var(--destructive)')
            .otherwise(() => undefined),
        }}
      />
      <EdgeLabelRenderer>
        <div
          className={
            'nodrag nopan absolute z-[1000] flex items-center justify-center gap-1 text-xs pointer-events-auto'
          }
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
        >
          {!disabled && picking && (
            <>
              <div className='fixed inset-0 -z-10' onClick={() => setPicking(false)} />
              <div
                className='absolute bottom-full mb-1 max-h-44 w-48 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--seal-color-bg-container)] p-1 shadow-md'
                data-slot='edge-node-picker'
              >
                {pickerItems.map((item) => (
                  <button
                    key={`${item.type}:${item.component ?? ''}`}
                    type='button'
                    className='flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-xs hover:bg-[var(--accent)]'
                    onClick={() => void insertBetween(item)}
                  >
                    <span className='flex h-4 w-4 items-center justify-center'>{item.icon}</span>
                    <span className='truncate'>{item.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {!disabled && (
            <Button
              type='primary'
              shape='round'
              icon={<PlusOutlined />}
              className='seal-edge-add-button'
              data-visible={isHovered || picking}
              onClick={() => setPicking((p) => !p)}
            />
          )}
          {!disabled && (
            <Button
              type='primary'
              shape='round'
              icon={<DeleteOutlined />}
              danger
              className={clsx('seal-edge-delete-button')}
              data-visible={isHovered && !picking}
              onClick={() => graphActions.removeEdges([id])}
            />
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export const edgeFunction = (outer: any) => (props: any) => <CustomEdge {...props} {...outer} />;
