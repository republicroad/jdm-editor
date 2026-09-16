// @ts-nocheck
// Vendored from ReUI registry (upstream-pristine; excluded from type gate)
import { Badge } from "#components/reui/badge.tsx"
import { IconTile } from "#components/reui/icon-tile.tsx"
import {
  Handle,
  NodeToolbar,
  Position,
  useConnection,
  useNodeConnections,
  type NodeProps,
} from "@xyflow/react"

import { cn } from "#lib/utils.ts"
import { Button } from "#components/ui/button.tsx"
import { ButtonGroup } from "#components/ui/button-group.tsx"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "#components/ui/context-menu.tsx"
import { Spinner } from "#components/ui/spinner.tsx"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "#components/ui/tooltip.tsx"
import {
  GLYPH,
  STATUS_BADGE,
  STATUS_ICON,
  STATUS_LABEL,
  STATUS_RING,
  STATUS_TONE,
  type MarkNodeType,
} from "./data"
import { useRunActions } from "./run-actions"
import { PencilIcon, RotateCcwIcon, MinusIcon, PlusIcon, CopyIcon, Trash2Icon } from "lucide-react"

/**
 * A task reads as a mark, not a card: the tile carries the glyph and the run
 * state, and the name sits under it where a diagram caption belongs.
 */
export function MarkNode({
  data,
  deletable,
  id,
  isConnectable,
  selected,
}: NodeProps<MarkNodeType>) {
  const actions = useRunActions()
  // A drop target has to be visible while a wire is being dragged, even on a
  // task that carries nothing yet.
  const connecting = useConnection((state) => state.inProgress)
  // Asked of the graph, not of a flag, so a wire drawn on the canvas lights
  // its own port.
  const attached = useNodeConnections({
    handleType: "target",
    handleId: "feeds",
  }).length
  const isTrigger = data.role === "trigger"
  const failed = data.status === "failed"
  const running = data.status === "running"
  // During a replay the untouched tasks step back, so the eye lands on the
  // one doing work rather than hunting for a changed badge.
  const dimmed = actions.active && data.status === "queued"

  return (
    <div
      data-dimmed={dimmed || undefined}
      onDoubleClick={() => actions.inspect(id)}
      className="flex w-36 flex-col items-center gap-2 transition-opacity duration-200 data-dimmed:opacity-35 motion-reduce:transition-none"
    >
      {/* The schedule opens the run, so it is the one mark you cannot copy or
          drop; the engine is told the same thing. */}
      <NodeToolbar isVisible={selected} position={Position.Top} offset={8}>
        <TooltipProvider delay={300}>
          {/* A double click on a button must not bubble up and open the panel. */}
          <ButtonGroup onDoubleClick={(event) => event.stopPropagation()}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Open ${data.title}`}
                    onClick={() => actions.inspect(id)}
                  />
                }
              >
                <PencilIcon aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>Open</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={actions.active}
                    aria-label={`Re-run ${data.title}`}
                    onClick={() => actions.retry(id)}
                  />
                }
              >
                <RotateCcwIcon aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>Re-run</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={actions.active}
                    aria-label={`Skip ${data.title}`}
                    onClick={() => actions.skip(id)}
                  />
                }
              >
                <MinusIcon aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>Skip</TooltipContent>
            </Tooltip>
            {isTrigger ? null : (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Add attachment to ${data.title}`}
                      onClick={() => actions.addAttachment(id)}
                    />
                  }
                >
                  <PlusIcon aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>Add attachment</TooltipContent>
              </Tooltip>
            )}
            {deletable ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Duplicate ${data.title}`}
                      onClick={() => actions.duplicate(id)}
                    />
                  }
                >
                  <CopyIcon aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>Duplicate</TooltipContent>
              </Tooltip>
            ) : null}
            {deletable ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Delete ${data.title}`}
                      onClick={() => actions.remove(id)}
                    />
                  }
                >
                  <Trash2Icon aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            ) : null}
          </ButtonGroup>
        </TooltipProvider>
      </NodeToolbar>
      <ContextMenu>
        <ContextMenuTrigger className="block">
          {/* The handles anchor to this box, so a wire meets the tile and not
              the caption below it. */}
          <div className="relative">
            {isTrigger ? null : (
              <Handle
                id="in"
                type="target"
                position={Position.Left}
                isConnectable={isConnectable}
                className="-left-1!"
              />
            )}
            <IconTile
              size="xl"
              variant="outline"
              data-selected={(selected && !running) || undefined}
              className={cn(
                "bg-card dark:bg-card data-selected:ring-primary/25 dark:data-selected:ring-primary/40 [--icon-tile-icon-size:--spacing(6)] data-selected:ring-[3px]",
                // The engine strips the node's own outline, so the mark draws one.
                "in-[.react-flow__node:focus-visible]:ring-ring/50 in-[.react-flow__node:focus-visible]:ring-2",
                STATUS_RING[data.status],
                // The live task wears a wide halo, so it reads before any
                // caption does; selection yields to it rather than flattening it.
                running && "ring-info/25 ring-[5px]"
              )}
            >
              {GLYPH[data.glyph]}
            </IconTile>
            {/* The band cuts the badge out of the tile edge; the card disc under
                the tint keeps the tile's own border from showing through it. */}
            <span className="bg-card absolute bottom-0 left-1/2 flex -translate-x-1/2 translate-y-1/2 rounded-full">
              <Badge
                variant={STATUS_BADGE[data.status]}
                radius="full"
                className="border-card border-2 px-0"
              >
                {/* A turning ring reads as work in flight; the badge already
                    names the state, so this one stays out of the a11y tree. */}
                {running ? (
                  <Spinner
                    className="size-3"
                    role="presentation"
                    aria-hidden="true"
                    aria-label={undefined}
                  />
                ) : (
                  STATUS_ICON[data.status]
                )}
                <span className="sr-only">{STATUS_LABEL[data.status]}</span>
              </Badge>
            </span>
            <Handle
              id="out"
              type="source"
              position={Position.Right}
              isConnectable={isConnectable}
              className="-right-1!"
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={() => actions.inspect(id)}>
            <PencilIcon aria-hidden="true" />
            Open details
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            disabled={actions.active}
            onClick={() => actions.retry(id)}
          >
            <RotateCcwIcon aria-hidden="true" />
            Re-run task
          </ContextMenuItem>
          <ContextMenuItem
            disabled={actions.active}
            onClick={() => actions.skip(id)}
          >
            <MinusIcon aria-hidden="true" />
            Skip task
          </ContextMenuItem>
          <ContextMenuSeparator />
          {isTrigger ? null : (
            <ContextMenuItem onClick={() => actions.addAttachment(id)}>
              <PlusIcon aria-hidden="true" />
              Add attachment
            </ContextMenuItem>
          )}
          {deletable ? (
            <ContextMenuItem onClick={() => actions.duplicate(id)}>
              <CopyIcon aria-hidden="true" />
              Duplicate
            </ContextMenuItem>
          ) : null}
          {deletable ? <ContextMenuSeparator /> : null}
          {deletable ? (
            <ContextMenuItem
              variant="destructive"
              onClick={() => actions.remove(id)}
            >
              <Trash2Icon aria-hidden="true" />
              Delete
            </ContextMenuItem>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>
      <div className="flex w-full min-w-0 flex-col items-center text-center">
        <span className="w-full truncate text-sm font-medium">
          {data.title}
        </span>
        <span
          className={cn(
            "w-full truncate text-xs tabular-nums",
            failed ? STATUS_TONE.failed : "text-muted-foreground"
          )}
        >
          {data.detail}
        </span>
      </div>
      {/* Anchored to the node, not the tile, so an attachment wire leaves
          under the caption rather than behind it. */}
      {isTrigger ? null : (
        <Handle
          id="feeds"
          type="target"
          position={Position.Bottom}
          isConnectable={isConnectable}
          className={cn(
            "-bottom-1!",
            attached || connecting ? "" : "pointer-events-none opacity-0"
          )}
        />
      )}
    </div>
  )
}