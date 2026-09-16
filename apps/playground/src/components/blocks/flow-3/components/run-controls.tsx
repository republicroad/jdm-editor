// @ts-nocheck
// Vendored from ReUI registry (upstream-pristine; excluded from type gate)
import { Button } from "#components/ui/button.tsx"
import { ButtonGroup } from "#components/ui/button-group.tsx"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#components/ui/dropdown-menu.tsx"
import type { RunState } from "./data"
import { XIcon, PlusIcon, PauseCircleIcon, PlayIcon, ChevronDownIcon, RotateCcwIcon, CircleDotIcon } from "lucide-react"

interface RunControlsProps {
  state: RunState
  hasFailed: boolean
  onAddTask: () => void
  onStart: () => void
  onPause: () => void
  onStop: () => void
  onRetryFailed: () => void
  onClearResults: () => void
}

/**
 * Add task hands its min-w-28 slot to Stop, so that swap never shifts the bar;
 * the caret carries Stop where the slot is hidden.
 */
export function RunControls({
  state,
  hasFailed,
  onAddTask,
  onStart,
  onPause,
  onStop,
  onRetryFailed,
  onClearResults,
}: RunControlsProps) {
  const active = state !== "idle"

  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="flex min-w-28 justify-end max-sm:hidden">
        {active ? (
          <Button variant="outline" onClick={onStop}>
            <XIcon aria-hidden="true" />
            Stop
          </Button>
        ) : (
          <Button variant="outline" onClick={onAddTask}>
            <PlusIcon aria-hidden="true" />
            Add task
          </Button>
        )}
      </div>
      {/* One outline weight in every state, so starting a run never swaps a fill;
          the split sizes to its word and stays pinned at its end edge. */}
      <ButtonGroup>
        <Button
          variant="outline"
          onClick={state === "running" ? onPause : onStart}
        >
          {state === "running" ? (
            <PauseCircleIcon aria-hidden="true" />
          ) : (
            <PlayIcon className="fill-current" aria-hidden="true" />
          )}
          {state === "running"
            ? "Pause"
            : state === "paused"
              ? "Resume"
              : "Run"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="icon" aria-label="Run options" />
            }
          >
            <ChevronDownIcon aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem disabled={active} onClick={onAddTask}>
              <PlusIcon aria-hidden="true" />
              Add task
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!active} onClick={onStop}>
              <XIcon aria-hidden="true" />
              Stop run
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!hasFailed} onClick={onRetryFailed}>
              <RotateCcwIcon aria-hidden="true" />
              Retry failed task
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={active} onClick={onClearResults}>
              {/* The idle mark, which is what every task wears afterwards. */}
              <CircleDotIcon aria-hidden="true" />
              Clear results
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
    </div>
  )
}