import { DeleteOutlined } from '@/icons';
import type { EdgeProps } from '@xyflow/react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import { Button } from '../primitives';
import clsx from 'clsx';
import React from 'react';
import { match } from 'ts-pattern';

import { useDecisionGraphActions, useDecisionGraphState, useEdgeDiff } from './context/dg-store.context';

export const CustomEdge: React.FC<EdgeProps> = (props) => {
  const graphActions = useDecisionGraphActions();
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, markerEnd } = props;
  const { isHovered, disabled } = useDecisionGraphState(({ hoveredEdgeId, disabled }) => ({
    isHovered: hoveredEdgeId === id,
    disabled,
  }));

  const { diff } = useEdgeDiff(id);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...(style || {}),
          stroke: match(diff)
            .with({ status: 'added' }, () => 'var(--grl-color-success)')
            .with({ status: 'removed' }, () => 'var(--destructive)')
            .otherwise(() => undefined),
        }}
      />
      <EdgeLabelRenderer>
        <div
          className={'nodrag nopan absolute z-[1000] flex items-center justify-center text-xs pointer-events-auto'}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
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
