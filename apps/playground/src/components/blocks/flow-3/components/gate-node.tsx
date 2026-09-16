// @ts-nocheck
// Vendored from ReUI registry (upstream-pristine; excluded from type gate)
import { Badge } from "#components/reui/badge.tsx"
import { IconTile } from "#components/reui/icon-tile.tsx"
import { Handle, NodeToolbar, Position, type NodeProps } from "@xyflow/react"

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
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "#components/ui/item.tsx"
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
  type GateNodeType,
} from "./data"
import { useRunActions } from "./run-actions"
import { PencilIcon, RotateCcwIcon, MinusIcon, CopyIcon, Trash2Icon, CheckIcon } from "lucide-react"

/**
 * The one task a person has to answer, so it is the one node wide enough to
 * carry its own name and its own action. It offers what a task offers too.
 */
export function GateNode({
  data,
  deletable,
  id,
  isConnectable,
  selected,
}: NodeProps<GateNodeType>) {
  const actions = useRunActions()
  const waiting = data.status === "waiting"
  const running = data.status === "running"
  const dimmed = actions.active && data.status === "queued"

  return (
    <div
      data-dimmed={dimmed || undefined}
      onDoubleClick={() => actions.inspect(id)}
      className="relative transition-opacity duration-200 data-dimmed:opacity-35 motion-reduce:transition-none"
    >
      <NodeToolbar isVisible={selected} position={Position.Top} offset={8}>
        <TooltipProvider delay={300}>
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
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="-left-1!"
      />
      <ContextMenu>
        <ContextMenuTrigger className="block">
          <Item
            variant="outline"
            size="xs"
            data-selected={(selected && !running) || undefined}
            className={cn(
              // h-14 matches a task's tile whatever padding the style gives the
              // item, so a wire between the gate and a task runs dead straight.
              "bg-card data-selected:ring-primary/25 dark:data-selected:ring-primary/40 h-14 w-68 gap-2 data-selected:ring-[3px]",
              "in-[.react-flow__node:focus-visible]:ring-ring/50 in-[.react-flow__node:focus-visible]:ring-2",
              STATUS_RING[data.status],
              running && "ring-info/25 ring-[5px]"
            )}
          >
            <IconTile variant="outline">{GLYPH[data.glyph]}</IconTile>
            {/* gap-0 pins a row gap five of the styles otherwise widen. */}
            <ItemContent className="min-w-0 gap-0">
              <ItemTitle className="w-full text-sm font-medium">
                {/* ItemTitle is a flex row, which defeats line-clamp. */}
                <span className="truncate">{data.title}</span>
              </ItemTitle>
              <ItemDescription className="line-clamp-1 text-xs">
                {data.detail}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              {waiting ? (
                // nodrag and nopan on the button alone, so the card still moves.
                <Button
                  size="sm"
                  className="nodrag nopan"
                  onClick={actions.approve}
                >
                  Approve
                </Button>
              ) : (
                <Badge
                  variant={STATUS_BADGE[data.status]}
                  radius="full"
                  className="px-0"
                >
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
              )}
            </ItemActions>
          </Item>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={() => actions.inspect(id)}>
            <PencilIcon aria-hidden="true" />
            Open details
          </ContextMenuItem>
          {waiting ? (
            <ContextMenuItem onClick={actions.approve}>
              <CheckIcon aria-hidden="true" />
              Approve
            </ContextMenuItem>
          ) : null}
          <ContextMenuSeparator />
          <ContextMenuItem
            disabled={actions.active}
            onClick={() => actions.retry(id)}
          >
            <RotateCcwIcon aria-hidden="true" />
            Re-run gate
          </ContextMenuItem>
          <ContextMenuItem
            disabled={actions.active}
            onClick={() => actions.skip(id)}
          >
            <MinusIcon aria-hidden="true" />
            Skip gate
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => actions.duplicate(id)}>
            <CopyIcon aria-hidden="true" />
            Duplicate
          </ContextMenuItem>
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
      <Handle
        id="out"
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="-right-1!"
      />
    </div>
  )
}