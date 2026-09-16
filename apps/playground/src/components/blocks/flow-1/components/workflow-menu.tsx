// @ts-nocheck
// Vendored from ReUI registry (upstream-pristine; excluded from type gate)
import { Button } from "#components/ui/button.tsx"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#components/ui/dropdown-menu.tsx"
import { WORKFLOW } from "./data"
import { MoreHorizontalIcon, Grid2x2Icon, RotateCcwIcon, SquareDashedMousePointerIcon, CopyIcon } from "lucide-react"

interface WorkflowMenuProps {
  snapToGrid: boolean
  onSnapToGridChange: (snapToGrid: boolean) => void
  onResetLayout: () => void
  onSelectAll: () => void
  onCopyJson: () => void
  locked: boolean
  /** Where focus lands when a header action disables itself. */
  triggerRef?: React.Ref<HTMLButtonElement>
}

export function WorkflowMenu({
  snapToGrid,
  onSnapToGridChange,
  onResetLayout,
  onSelectAll,
  onCopyJson,
  locked,
  triggerRef,
}: WorkflowMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            ref={triggerRef}
            variant="outline"
            size="icon"
            aria-label="Workflow actions"
          />
        }
      >
        <MoreHorizontalIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Canvas</DropdownMenuLabel>
          {/* The menu outlives the click so the grid can be tried twice. */}
          <DropdownMenuCheckboxItem
            checked={snapToGrid}
            closeOnClick={false}
            onCheckedChange={onSnapToGridChange}
          >
            <Grid2x2Icon aria-hidden="true" />
            Snap to grid
          </DropdownMenuCheckboxItem>
          <DropdownMenuItem disabled={locked} onClick={onResetLayout}>
            <RotateCcwIcon aria-hidden="true" />
            Reset layout
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{WORKFLOW.id}</DropdownMenuLabel>
          <DropdownMenuItem disabled={locked} onClick={onSelectAll}>
            <SquareDashedMousePointerIcon aria-hidden="true" />
            Select all steps
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCopyJson}>
            <CopyIcon aria-hidden="true" />
            Copy as JSON
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}