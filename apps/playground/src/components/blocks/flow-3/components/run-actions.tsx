// @ts-nocheck
// Vendored from ReUI registry (upstream-pristine; excluded from type gate)
import { createContext, useContext, useMemo } from "react"

import type { GlyphKey, ResourceKind, TaskParam, TaskStatus } from "./data"

export type TaskDraft = {
  title: string
  glyph: GlyphKey
  params: TaskParam[]
  /** Set only for a resource, whose kind is the one thing it configures. */
  kind?: ResourceKind
}

export type InspectTarget = { nodeId: string } | null

/** One end of a wire: what sits on the other side, and what it handed over. */
export type Wire = {
  edgeId: string
  nodeId: string
  name: string
  glyph: GlyphKey
  /** A resource has no run state, so an attachment carries none. */
  status?: TaskStatus
  /** The payload when the wire recorded one, else the far end's own result. */
  summary: string
  /** Only a run task opens in this panel; a resource has nothing to edit. */
  canOpen: boolean
}

/** Something a wire could be pointed at instead. */
export type WireEnd = { id: string; title: string; glyph: GlyphKey }

export type Wiring = {
  inputs: Wire[]
  outputs: Wire[]
  attachments: Wire[]
  /** For a resource: the tasks that read it. */
  readers: Wire[]
  /** Every other run task, so an input or output can be re-pointed. */
  tasks: WireEnd[]
  /** Every connection, test and model on the canvas. */
  resources: WireEnd[]
}

type RunActionsApi = {
  /** True while a replay is under way, which is what dims the untouched. */
  active: boolean
  /** The panel keeps its task after a close, so the card slides out, not a box. */
  open: boolean
  /** The open panel is the one the run opened on load, not one a person chose. */
  openedOnLoad: boolean
  /** Advances the waiting gate and releases the task it was holding. */
  approve: () => void
  /** Re-runs this one task and resolves it like the replay would. */
  retry: (nodeId: string) => void
  /** Marks a task skipped so a held run can move past it. */
  skip: (nodeId: string) => void
  duplicate: (nodeId: string) => void
  remove: (nodeId: string) => void
  /** Drops a new connection under a task, already wired to its bottom port. */
  addAttachment: (nodeId: string) => void
  /** Opens the inspector on one task. */
  inspect: (nodeId: string) => void
  close: () => void
  /** Commits the draft onto the node. */
  save: () => void
  /** Drops one wire, whichever end the inspector was showing. */
  unlink: (edgeId: string) => void
  /** Points the far end of a wire at another task or resource. */
  relink: (edgeId: string, endId: string) => void
  setDraft: React.Dispatch<React.SetStateAction<TaskDraft>>
  target: InspectTarget
  draft: TaskDraft
  data:
    | {
        title: string
        detail: string
        status: TaskStatus
        glyph: GlyphKey
        params: TaskParam[]
        kind?: ResourceKind
      }
    | undefined
  wiring: Wiring
}

const RunActionsContext = createContext<RunActionsApi | null>(null)

/** Nodes reach the run's actions here; the shell owns the state. */
export function useRunActions() {
  const api = useContext(RunActionsContext)

  if (!api) {
    throw new Error("useRunActions must be used inside RunActionsProvider")
  }

  return api
}

export function RunActionsProvider({
  children,
  ...api
}: RunActionsApi & { children: React.ReactNode }) {
  // A fresh object here would re-render every node on any shell render.
  const value = useMemo(
    () => api,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      api.active,
      api.open,
      api.openedOnLoad,
      api.approve,
      api.retry,
      api.skip,
      api.duplicate,
      api.remove,
      api.addAttachment,
      api.inspect,
      api.close,
      api.save,
      api.unlink,
      api.relink,
      api.setDraft,
      api.target,
      api.draft,
      api.data,
      api.wiring,
    ]
  )

  return (
    <RunActionsContext.Provider value={value}>
      {children}
    </RunActionsContext.Provider>
  )
}