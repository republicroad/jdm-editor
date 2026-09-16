// @ts-nocheck
// Vendored from ReUI registry (upstream-pristine; excluded from type gate)
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "#components/ui/tooltip.tsx"
import { GLYPH, type ResourceNodeType } from "./data"
import { useRunActions } from "./run-actions"
import { PencilIcon, CopyIcon, Trash2Icon } from "lucide-react"

/**
 * What a task reads rather than what it runs: a connection, a test or a
 * model. The circle is what separates it from a task at a glance.
 */
export function ResourceNode({
  data,
  deletable,
  id,
  isConnectable,
  selected,
}: NodeProps<ResourceNodeType>) {
  const actions = useRunActions()

  return (
    <div
      // Config, not work: during a replay it steps back so the run reads first.
      data-dimmed={actions.active || undefined}
      onDoubleClick={() => actions.inspect(id)}
      className="flex w-32 flex-col items-center gap-2 transition-opacity duration-200 data-dimmed:opacity-35 motion-reduce:transition-none"
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
      <ContextMenu>
        <ContextMenuTrigger className="block">
          <div className="relative">
            <IconTile
              size="lg"
              radius="full"
              variant="outline"
              data-selected={selected || undefined}
              className={cn(
                "bg-card dark:bg-card data-selected:ring-primary/25 dark:data-selected:ring-primary/40 [--icon-tile-icon-size:--spacing(5)] data-selected:ring-[3px]",
                "in-[.react-flow__node:focus-visible]:ring-ring/50 in-[.react-flow__node:focus-visible]:ring-2"
              )}
            >
              {GLYPH[data.glyph]}
            </IconTile>
            <Handle
              id="out"
              type="source"
              position={Position.Top}
              isConnectable={isConnectable}
              className="-top-1!"
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={() => actions.inspect(id)}>
            <PencilIcon aria-hidden="true" />
            Open details
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
      <div className="flex w-full min-w-0 flex-col items-center text-center">
        <span className="w-full truncate text-sm">{data.title}</span>
        <span className="text-muted-foreground w-full truncate text-xs">
          {data.kind}
        </span>
      </div>
    </div>
  )
}