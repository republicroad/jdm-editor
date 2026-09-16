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

/**
 * One edge component for the whole graph, so every path shares a style.
 * EdgeLabelRenderer puts the label in real DOM, so it takes a themed Badge.
 */
export function LabeledEdge({
  id,
  label,
  markerEnd,
  sourcePosition,
  sourceX,
  sourceY,
  targetPosition,
  targetX,
  targetY,
}: EdgeProps) {
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
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{ strokeWidth: 1 / zoom }}
        className="motion-reduce:animate-none!"
      />
      {label ? (
        <EdgeLabelRenderer>
          <Badge
            variant="outline"
            className="bg-background nodrag nopan absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {label}
          </Badge>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}