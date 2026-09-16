// @ts-nocheck
// Vendored from ReUI registry (upstream-pristine; excluded from type gate)
import { Badge } from "#components/reui/badge.tsx"
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useStore,
  type EdgeProps,
} from "@xyflow/react"

import type { PipelineEdgeType } from "./data"

/** A dependency: what one task handed the next, and how much of it. */
export function FlowEdge(props: EdgeProps<PipelineEdgeType>) {
  return <PipelineEdge {...props} />
}

/** An attachment the task reads. Dashed, so it never reads as the run path. */
export function FeedsEdge(props: EdgeProps<PipelineEdgeType>) {
  return <PipelineEdge {...props} dashed />
}

function PipelineEdge({
  dashed,
  data,
  id,
  markerEnd,
  style,
  sourcePosition,
  sourceX,
  sourceY,
  targetPosition,
  targetX,
  targetY,
}: EdgeProps<PipelineEdgeType> & { dashed?: boolean }) {
  // Strokes scale with the viewport, so dividing by zoom holds every line at 1px.
  const zoom = useStore((state) => state.transform[2])
  // A 1px line centred on a whole pixel smears across two, so every point lands on
  // a half pixel at this zoom; the viewport itself snaps to whole pixels.
  const crisp = (value: number) => (Math.round(value * zoom - 0.5) + 0.5) / zoom
  const source = { x: crisp(sourceX), y: crisp(sourceY) }
  const target = { x: crisp(targetX), y: crisp(targetY) }
  const [path, labelX, labelY] = getSmoothStepPath({
    borderRadius: 12,
    centerX: crisp((source.x + target.x) / 2),
    centerY: crisp((source.y + target.y) / 2),
    sourcePosition,
    sourceX: source.x,
    sourceY: source.y,
    targetPosition,
    targetX: target.x,
    targetY: target.y,
  })

  return (
    <>
      {/* The engine's dash loop ignores reduced motion, so it is stopped here. */}
      {/* A dotted attachment cannot be mistaken for the live wire's marching
          dash; its dots are screen pixels, so they stay sharp at any zoom. */}
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{ ...style, strokeWidth: 1 / zoom }}
        strokeDasharray={dashed ? `${2 / zoom} ${4 / zoom}` : undefined}
        className="motion-reduce:animate-none!"
      />
      {data?.caption ? (
        <EdgeLabelRenderer>
          <div
            className="absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            <Badge variant="outline" className="bg-background tabular-nums">
              {data.caption}
            </Badge>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}