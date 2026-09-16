// @ts-nocheck
// Vendored from ReUI registry (upstream-pristine; excluded from type gate)
import { useCallback, useEffect, useRef, useState } from "react"
import type { OnBeforeDelete } from "@xyflow/react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "#components/ui/alert-dialog.tsx"

import type { PipelineEdgeType, PipelineNodeType } from "./data"

type Prompt = { open: boolean; title: string; nodes: number; wires: number }

const EMPTY: Prompt = { open: false, title: "", nodes: 0, wires: 0 }

/**
 * Every removal reaches the engine through one call, so gating that call gates
 * the toolbar, the context menu and the Backspace key together.
 */
export function useDeleteConfirmation() {
  const [prompt, setPrompt] = useState<Prompt>(EMPTY)
  const settleRef = useRef<((confirmed: boolean) => void) | null>(null)

  // Only clears `open`, so the copy survives the closing transition instead of
  // blanking mid fade. The latch makes a second call a no op.
  const settle = useCallback((confirmed: boolean) => {
    const resolve = settleRef.current

    if (!resolve) return

    settleRef.current = null
    setPrompt((current) => ({ ...current, open: false }))
    resolve(confirmed)
  }, [])

  useEffect(() => () => settle(false), [settle])

  const onBeforeDelete = useCallback<
    OnBeforeDelete<PipelineNodeType, PipelineEdgeType>
  >(
    ({ nodes, edges }) =>
      new Promise((resolve) => {
        // A wire is redrawn by dragging a port, so it goes without asking.
        if (nodes.length === 0) {
          resolve(true)
          return
        }

        settleRef.current?.(false)
        settleRef.current = resolve
        setPrompt({
          open: true,
          title: nodes[0].data.title,
          nodes: nodes.length,
          wires: edges.length,
        })
      }),
    []
  )

  const many = prompt.nodes > 1
  const subject = many ? `${prompt.nodes} nodes` : prompt.title || "This node"
  const dialog = (
    <AlertDialog
      open={prompt.open}
      onOpenChange={(open) => !open && settle(false)}
    >
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {many ? "Delete Nodes?" : "Delete Node?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {subject} and {prompt.wires} {prompt.wires === 1 ? "wire" : "wires"}{" "}
            are removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => settle(true)}>
            {many ? "Delete Nodes" : "Delete Node"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { onBeforeDelete, dialog }
}