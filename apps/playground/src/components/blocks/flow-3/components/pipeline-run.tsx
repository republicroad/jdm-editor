// @ts-nocheck
// Vendored from ReUI registry (upstream-pristine; excluded from type gate)
"use client"

/**
 * Nightly Ledger Sync: a DAG run read as marks and captions rather than
 * cards. Swap INITIAL_NODES and INITIAL_EDGES in data.tsx for your own run.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "#components/reui/badge.tsx"
import {
  addEdge,
  getOutgoers,
  getViewportForBounds,
  MarkerType,
  Panel,
  ReactFlowProvider,
  reconnectEdge,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  useStoreApi,
  type Connection,
  type Edge,
  type EdgeTypes,
  type FitViewOptions,
  type IsValidConnection,
  type NodeTypes,
  type OnBeforeDelete,
  type OnDelete,
  type OnMoveEnd,
  type Viewport,
} from "@xyflow/react"
import { toast } from "sonner"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "#components/ui/avatar.tsx"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "#components/ui/breadcrumb.tsx"
import { Button } from "#components/ui/button.tsx"
import { Progress } from "#components/ui/progress.tsx"
import { Separator } from "#components/ui/separator.tsx"
import { CanvasToolbar, type CanvasTool } from "./canvas-toolbar"
import {
  createResourceNode,
  createTaskNode,
  DEFAULT_REPLAY_MS,
  GATE_DOWNSTREAM_ID,
  GATE_ID,
  INITIAL_EDGES,
  INITIAL_NODES,
  PIPELINE,
  REPLAY_MS,
  RESOURCE_GLYPH,
  RUN_RESULT,
  STATUS_BADGE,
  STATUS_ICON,
  STATUS_LABEL,
  STATUS_ORDER,
  TOAST_SUCCESS_ICON,
  type GateNodeType,
  type MarkNodeType,
  type PipelineEdgeType,
  type PipelineNodeType,
  type RunState,
  type TaskStatus,
} from "./data"
import { useDeleteConfirmation } from "./delete-confirmation"
import { FlowCanvas } from "./flow-canvas"
import { FeedsEdge, FlowEdge } from "./flow-edge"
import { FlowKeys } from "./flow-keys"
import { clearToolbar, type KeepInView } from "./frame"
import { GateNode } from "./gate-node"
import { MarkNode } from "./mark-node"
import { NodeInspectorPanel, useIsBelowLg } from "./node-inspector"
import { ResourceNode } from "./resource-node"
import { RunActionsProvider, type TaskDraft } from "./run-actions"
import { RunControls } from "./run-controls"

// Module scope: a new nodeTypes or edgeTypes object per render remounts
// every node and edge on the canvas.
const nodeTypes = {
  mark: MarkNode,
  gate: GateNode,
  resource: ResourceNode,
} satisfies NodeTypes

const edgeTypes = {
  flow: FlowEdge,
  feeds: FeedsEdge,
} satisfies EdgeTypes

// A wide DAG on a narrow screen pans at a legible scale rather than shrinking
// to a thumbnail, so the floor matters more than showing every task at once.
const FIT_VIEW_OPTIONS = { padding: 0.12, minZoom: 0.75, maxZoom: 1 }

// The inspector floats over the end edge, so the graph reserves its width
// rather than framing behind it: 384px panel, 16px inset, 24px of air.
const PANEL_RESERVE = 424
const PANEL_FIT_OPTIONS = {
  minZoom: 0.75,
  maxZoom: 1,
  padding: {
    top: "24px",
    right: `${PANEL_RESERVE}px`,
    bottom: "24px",
    left: "24px",
  },
} satisfies FitViewOptions<PipelineNodeType>

// What every frame is built from: the zoom floor, the ceiling and the padding.
type Framing = Required<
  Pick<FitViewOptions<PipelineNodeType>, "minZoom" | "maxZoom" | "padding">
>

// The panel opens on load where the columns up to the gate still read beside
// it at full scale or near it; narrower, the run opens alone.
const OPEN_QUERY = "(min-width: 1200px)"

// The whole run takes the opening once it fits at this share of the scale the
// columns up to the gate would get; hiding a column is not worth more.
const WHOLE_CHAIN_SHARE = 0.9

// The air the opening leaves at the start edge, as the panel fit does.
const CANVAS_INSET = 24

// The kit's edge stroke is translucent, so a shared trunk darkened where two
// wires overlap; the same grey mixed into the page stays one solid color.
const EDGE_STROKE =
  "[--xy-edge-stroke:color-mix(in_oklab,var(--muted-foreground)_45%,var(--background))]"

// The pause before the first task, so pressing Run reads as a start rather
// than an instant jump.
const START_MS = 550

/** Writes a run state onto one task, keeping each node kind's own shape. */
function withRunState(
  node: PipelineNodeType,
  detail: string,
  status: TaskStatus
): PipelineNodeType {
  if (node.type === "mark") {
    return { ...node, data: { ...node.data, detail, status } }
  }

  if (node.type === "gate") {
    return { ...node, data: { ...node.data, detail, status } }
  }

  return node
}

/** Dependency order, so a replay never runs a task before its upstream. */
function runOrder(
  nodes: PipelineNodeType[],
  edges: PipelineEdgeType[]
): string[] {
  const tasks = nodes.filter(isRunTask).map((node) => node.id)
  const known = new Set(tasks)
  const waitingOn = new Map(tasks.map((id) => [id, 0]))
  const feeds = new Map(tasks.map((id) => [id, [] as string[]]))

  for (const edge of edges) {
    if (edge.type === "feeds") continue
    if (!known.has(edge.source) || !known.has(edge.target)) continue

    waitingOn.set(edge.target, (waitingOn.get(edge.target) ?? 0) + 1)
    feeds.get(edge.source)?.push(edge.target)
  }

  const ready = tasks.filter((id) => waitingOn.get(id) === 0)
  const order: string[] = []

  while (ready.length) {
    const id = ready.shift() as string

    order.push(id)
    for (const next of feeds.get(id) ?? []) {
      const left = (waitingOn.get(next) ?? 0) - 1

      waitingOn.set(next, left)
      if (left === 0) ready.push(next)
    }
  }

  // A cycle cannot be ordered, so the seeded order stands in.
  return order.length === tasks.length ? order : tasks
}

// The grid a new task snaps into. A row is taller than a mark (about 100px),
// so freeSlot never counts a slot as free while a card still covers it.
const COLUMN_PITCH = 240
const ROW_PITCH = 200
// A mark is w-36 and a resource w-32, so a new resource sits 8px in and its
// feed wire drops straight instead of jogging.
const ATTACH_INSET = 8

// Inserted ids are counted, never random, so a run reproduces exactly.
let seq = INITIAL_NODES.length

/** The first row at x from y downward that no node already sits on. */
function freeSlot(
  nodes: PipelineNodeType[],
  x: number,
  y: number
): { x: number; y: number } {
  const taken = nodes
    .filter((node) => Math.abs(node.position.x - x) < COLUMN_PITCH / 2)
    .map((node) => node.position.y)
  let row = y

  while (taken.some((top) => Math.abs(top - row) < ROW_PITCH / 2)) {
    row += ROW_PITCH
  }

  return { x, y: row }
}

// A wire the engine could never run is refused at the drop: a loop, a
// resource on a dependency port, a task on an attachment port, or a cycle.
function useValidConnection(
  nodesRef: React.RefObject<PipelineNodeType[]>,
  edgesRef: React.RefObject<PipelineEdgeType[]>
): IsValidConnection<Edge> {
  return useCallback(
    (connection) => {
      const { source, target, targetHandle } = connection

      if (!source || !target || source === target) return false

      const from = nodesRef.current.find((node) => node.id === source)
      const feeds = targetHandle === "feeds"

      if ((from?.type === "resource") !== feeds) return false
      if (feeds) return true

      // Walk downstream of the target; reaching the source would close a loop.
      const seen = new Set<string>()
      const stack = [target]

      while (stack.length) {
        const id = stack.pop() as string

        if (id === source) return false
        if (seen.has(id)) continue
        seen.add(id)

        const node = nodesRef.current.find((candidate) => candidate.id === id)

        if (node) {
          for (const next of getOutgoers(
            node,
            nodesRef.current,
            edgesRef.current
          )) {
            stack.push(next.id)
          }
        }
      }

      return true
    },
    [edgesRef, nodesRef]
  )
}

/** A resource has no run state, so the counts skip it. */
function isRunTask(
  node: PipelineNodeType
): node is MarkNodeType | GateNodeType {
  return node.type === "mark" || node.type === "gate"
}

export function PipelineRun({
  initialNodes = INITIAL_NODES,
  initialEdges = INITIAL_EDGES,
  replay = true,
}: {
  /** playground 试点：注入真实运行数据（trace→状态预计算）替代内置 mock */
  initialNodes?: PipelineNodeType[]
  initialEdges?: PipelineEdgeType[]
  /** false 时隐藏块内置的演示 Run 控件，保护注入的真实状态不被回放覆盖 */
  replay?: boolean
} = {}) {
  return (
    <ReactFlowProvider>
      <PipelineRunEditor initialNodes={initialNodes} initialEdges={initialEdges} replay={replay} />
    </ReactFlowProvider>
  )
}

function PipelineRunEditor({
  initialNodes,
  initialEdges,
  replay,
}: {
  initialNodes: PipelineNodeType[]
  initialEdges: PipelineEdgeType[]
  replay: boolean
}) {
  const [nodes, setNodes, onNodesChange] =
    useNodesState<PipelineNodeType>(initialNodes)
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<PipelineEdgeType>(initialEdges)
  const {
    deleteElements,
    getInternalNode,
    getNodes,
    getNodesBounds,
    setViewport,
  } = useReactFlow<PipelineNodeType, PipelineEdgeType>()
  const store = useStoreApi<PipelineNodeType, PipelineEdgeType>()
  const toolbarRef = useRef<HTMLDivElement>(null)
  const measured = useNodesInitialized()
  const { onBeforeDelete, dialog } = useDeleteConfirmation()
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  // Holds the graph a mutation replaced, so every Undo restores it exactly.
  const undoRef = useRef<{
    nodes: PipelineNodeType[]
    edges: PipelineEdgeType[]
  } | null>(null)

  // Returns the graph it captured, so a toast holds its own snapshot and a later
  // edit cannot make an older Undo restore the wrong one.
  const snapshot = useCallback(() => {
    const taken = { nodes: nodesRef.current, edges: edgesRef.current }

    undoRef.current = taken

    return taken
  }, [])

  // Toast copy names the node the way the canvas does, by id lookup, so a
  // renamed task never reports its old caption.
  const titleOf = useCallback(
    (nodeId: string) =>
      nodesRef.current.find((node) => node.id === nodeId)?.data.title ?? "Task",
    []
  )

  const restore = useCallback(
    (
      previous: { nodes: PipelineNodeType[]; edges: PipelineEdgeType[] } | null
    ) => {
      if (!previous) return

      setNodes(previous.nodes)
      setEdges(previous.edges)
    },
    [setEdges, setNodes]
  )
  // The cursor and the graph the ticker reads, so the interval never restarts
  // just because a status moved.
  const queueRef = useRef<string[]>([])
  // Tasks a person re-ran or released, mapped to what they end up saying:
  // these resolve clear instead of replaying the recorded outcome.
  const forcedRef = useRef<Map<string, string>>(new Map())

  // Approving the gate releases every task wired behind it, whatever the
  // buyer rewired, so the header counts move with the canvas.
  const approve = useCallback(() => {
    const taken = snapshot()
    const released = edgesRef.current
      .filter((edge) => edge.type !== "feeds" && edge.source === GATE_ID)
      .map((edge) => edge.target)
      .filter((id) => {
        const node = nodesRef.current.find((candidate) => candidate.id === id)

        return node && isRunTask(node) && node.data.status !== "succeeded"
      })

    setNodes((current) =>
      current.map((node): PipelineNodeType => {
        if (node.type === "gate" && node.id === GATE_ID) {
          return withRunState(
            node,
            `Approved by ${PIPELINE.owner.name}`,
            "succeeded"
          )
        }

        return released.includes(node.id)
          ? withRunState(node, "Released by Approval", "queued")
          : node
      })
    )
    toast.success("Gate approved", {
      description: released.length
        ? `${released.length} ${released.length === 1 ? "task" : "tasks"} released.`
        : "No task was waiting on it.",
      icon: TOAST_SUCCESS_ICON,
      action: { label: "Undo", onClick: () => restore(taken) },
      duration: 8000,
    })
    // The released tasks run on the approval, so clearing the gate visibly
    // moves the run on rather than parking work nobody will start.
    for (const id of released) forcedRef.current.set(id, "Sent after Approval")
    queueRef.current = released
    if (released.length) setRunState("running")
  }, [restore, setNodes, snapshot])

  const isValidConnection = useValidConnection(nodesRef, edgesRef)
  const [runState, setRunState] = useState<RunState>("idle")
  const [inspected, setInspected] = useState<string | null>(null)
  // Closing keeps the task, so the card is what slides off the canvas rather
  // than an empty box the panel emptied a frame earlier.
  const [inspectorOpen, setInspectorOpen] = useState(false)
  // Set only by the automatic open on load, cleared by any open a person makes.
  const [openedOnLoad, setOpenedOnLoad] = useState(false)
  // Opens in Pan, so a first drag explores the run and never nudges a task.
  const [tool, setTool] = useState<CanvasTool>("hand")
  // Pan holds every task still, so a drag anywhere moves the view, never the graph.
  const editable = tool === "select"
  const [draft, setDraft] = useState<TaskDraft>({
    title: "",
    glyph: "custom",
    params: [],
  })
  // A task added off the current fold would read as nothing happening, so the
  // next commit brings it into view.
  const revealRef = useRef<string | null>(null)
  // The opening frame happens once; panning afterwards is the user's.
  const framedRef = useRef(false)
  // Only a docked panel steals canvas width; below lg it is a sheet or not
  // drawn at all, so a narrowed window frames the run at full width.
  const belowLg = useIsBelowLg()
  const docked = inspectorOpen && inspected !== null && !belowLg
  // Every fit reserves the docked panel's width; a frozen or reduced motion
  // page gets the frame without the glide.
  const fitOptions = useMemo(
    () => (docked ? PANEL_FIT_OPTIONS : FIT_VIEW_OPTIONS),
    [docked]
  )
  const glide = () =>
    document.documentElement.dataset.demo === "frozen" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 300

  // Absolute positions, so a card inside a group frames where it is drawn.
  const framedNodes = useCallback(
    () =>
      getNodes()
        .filter(
          (node) =>
            !node.hidden && node.measured?.width && node.measured?.height
        )
        .map((node) => ({
          ...node,
          position:
            getInternalNode(node.id)?.internals.positionAbsolute ??
            node.position,
        })),
    [getInternalNode, getNodes]
  )

  // Every frame ends here: the shortest move that keeps cards out of the
  // toolbar's corner, landed on whole pixels so no wire ends on a half.
  const place = useCallback(
    (viewport: Viewport, duration: number, keep?: KeepInView) => {
      const { width, height } = store.getState()
      const bar = toolbarRef.current
      // Offsets are canvas-local and ignore any CSS scale on the page.
      const next = bar
        ? clearToolbar(
            viewport,
            framedNodes(),
            {
              width,
              height,
              toolbar: {
                left: bar.offsetLeft,
                right: bar.offsetLeft + bar.offsetWidth,
                top: bar.offsetTop,
                bottom: bar.offsetTop + bar.offsetHeight,
              },
            },
            keep
          )
        : viewport

      void setViewport(
        { ...next, x: Math.round(next.x), y: Math.round(next.y) },
        { duration }
      )
    },
    [framedNodes, setViewport, store]
  )

  // The engine's fit; a target card is centred in what its reserve leaves and
  // stays whole in view.
  const frame = useCallback(
    (
      options: Framing,
      duration: number,
      target?: { id: string; reserve: number; centre: boolean }
    ) => {
      const { width, height } = store.getState()
      const nodes = framedNodes()
      const focus = target && nodes.find((node) => node.id === target.id)

      if (!nodes.length) return

      const fitted = getViewportForBounds(
        getNodesBounds(focus && target?.centre ? [focus] : nodes),
        width,
        height,
        options.minZoom,
        options.maxZoom,
        options.padding
      )
      // Padding only keeps a minimum gap, so a focus is centred by hand in the
      // canvas its reserve leaves free.
      const end = width - (target?.reserve ?? 0)
      const viewport =
        focus && target?.centre
          ? {
              ...fitted,
              x:
                end / 2 -
                (focus.position.x + (focus.measured?.width ?? 0) / 2) *
                  fitted.zoom,
            }
          : fitted

      place(
        viewport,
        duration,
        focus && target ? { id: target.id, end } : undefined
      )
    },
    [framedNodes, getNodesBounds, place, store]
  )

  // Beside the docked panel the run opens on the columns up to the gate, the
  // panel edge on the next column, so its wires stay in view and it slides under whole.
  const frameOpening = useCallback(
    (duration: number) => {
      const { width, height } = store.getState()
      const nodes = framedNodes()

      if (!window.matchMedia(OPEN_QUERY).matches || !nodes.length) {
        frame(FIT_VIEW_OPTIONS, duration)
        return
      }

      const panel = width - PANEL_RESERVE + CANVAS_INSET
      const chain = getNodesBounds(nodes)
      const gate = getNodesBounds([GATE_ID])
      const past = nodes
        .map((node) => node.position.x)
        .filter((left) => left >= gate.x + gate.width)
      const tall = (height - CANVAS_INSET * 2) / chain.height
      const whole = Math.min(
        1,
        (width - CANVAS_INSET - PANEL_RESERVE) / chain.width,
        tall
      )
      const next = Math.min(...past)
      const zoom = Math.min(1, (panel - CANVAS_INSET) / (next - chain.x), tall)

      if (!past.length || whole >= zoom * WHOLE_CHAIN_SHARE) {
        frame(PANEL_FIT_OPTIONS, duration)
        return
      }

      place(
        {
          x: panel - next * zoom,
          y: height / 2 - (chain.y + chain.height / 2) * zoom,
          zoom,
        },
        duration,
        { id: GATE_ID, end: panel }
      )
    },
    [frame, framedNodes, getNodesBounds, place, store]
  )

  useEffect(() => {
    nodesRef.current = nodes
    edgesRef.current = edges
  }, [edges, nodes])

  const setStatus = useCallback(
    (nodeId: string, status: TaskStatus, detail: string) => {
      setNodes((current) =>
        current.map((node): PipelineNodeType =>
          node.id === nodeId ? withRunState(node, detail, status) : node
        )
      )
    },
    [setNodes]
  )

  // Resolve whatever is running, then start the next task whose upstream has
  // all succeeded. A failure stops its own branch, never the parallel ones.
  const tick = useCallback(() => {
    const current = nodesRef.current
    const running = current.find(
      (node) => isRunTask(node) && node.data.status === "running"
    )
    const settled = new Map<string, TaskStatus>()
    let waitingOnPerson = false

    for (const node of current) {
      if (isRunTask(node)) settled.set(node.id, node.data.status)
    }

    if (running) {
      // An explicit re-run or an approval is the buyer overriding the
      // recording, so it resolves clear rather than replaying the failure.
      const forced = forcedRef.current.get(running.id)
      const result = forced
        ? { detail: forced, status: "succeeded" as TaskStatus }
        : (RUN_RESULT[running.id] ?? {
            detail: "Succeeded",
            status: "succeeded" as TaskStatus,
          })

      forcedRef.current.delete(running.id)
      settled.set(running.id, result.status)
      setStatus(running.id, result.status, result.detail)

      // A gate hands the run to a person, so the replay stops and waits.
      waitingOnPerson = result.status === "waiting"
    }

    // A skipped task is passed over, not waited on, or Skip would move nothing.
    const passed = (status?: TaskStatus) =>
      status === "succeeded" || status === "skipped"
    const ready = (id: string) =>
      edgesRef.current
        .filter((edge) => edge.type !== "feeds" && edge.target === id)
        .every((edge) => passed(settled.get(edge.source)))

    // Whatever is left queued sits behind something that never succeeded, so
    // it says so rather than implying a run is still coming for it.
    const halt = () => {
      setNodes((nodes) =>
        nodes.map((node): PipelineNodeType =>
          isRunTask(node) && node.data.status === "queued" && !ready(node.id)
            ? withRunState(node, "Blocked upstream", "queued")
            : node
        )
      )
      setRunState("idle")
    }

    if (waitingOnPerson) {
      halt()
      return
    }

    const next = queueRef.current.find(
      (id) => id !== running?.id && settled.get(id) === "queued" && ready(id)
    )

    if (!next) {
      halt()
      return
    }

    setStatus(next, "running", "Running")
  }, [setNodes, setStatus])

  const runningNode = nodes.find(
    (node) => isRunTask(node) && node.data.status === "running"
  )
  const runningId = runningNode?.id
  const stepMs = runningNode
    ? (REPLAY_MS[runningNode.id] ?? DEFAULT_REPLAY_MS)
    : START_MS

  useEffect(() => {
    if (document.documentElement.dataset.demo === "frozen") return
    if (runState !== "running") return

    const timer = setTimeout(tick, stepMs)

    return () => clearTimeout(timer)
    // runningId re-arms the timer each step: two tasks in a row can share a
    // duration, and without it the effect would never schedule the next one.
  }, [runState, runningId, stepMs, tick])

  // Starting over clears the last run, so a replay never inherits its result.
  const startRun = useCallback(() => {
    if (runState === "paused") {
      setRunState("running")
      return
    }

    queueRef.current = runOrder(nodesRef.current, edges)
    setNodes((current) =>
      current.map((node): PipelineNodeType =>
        isRunTask(node) ? withRunState(node, "Queued", "queued") : node
      )
    )
    setRunState("running")
  }, [edges, runState, setNodes])

  const stopRun = useCallback(() => {
    setRunState("idle")
    setNodes((current) =>
      current.map((node): PipelineNodeType =>
        isRunTask(node) && node.data.status === "running"
          ? withRunState(node, "Stopped", "skipped")
          : node
      )
    )
  }, [setNodes])

  useEffect(() => {
    const id = revealRef.current

    if (!id) return

    const node = nodes.find((candidate) => candidate.id === id)

    // A task deleted before it was measured leaves nothing to reveal.
    if (!node) {
      revealRef.current = null
      return
    }
    // The frame reads card sizes, so it waits until the new task is measured.
    if (!node.measured) return

    revealRef.current = null
    // Re-frame the whole graph rather than the one node, so the new task
    // arrives in context and never under the docked panel.
    frame(fitOptions, glide(), {
      id,
      reserve: fitOptions === PANEL_FIT_OPTIONS ? PANEL_RESERVE : 0,
      centre: false,
    })
  }, [fitOptions, frame, nodes])

  // Only the live wire marches; every wire keeps one solid color, so the run
  // reads from the dash and the dimmed tasks. A dependency shows which way it runs.
  const liveEdges = useMemo(
    () =>
      edges.map((edge) => {
        const live =
          edge.type !== "feeds" &&
          !!runningNode &&
          edge.target === runningNode.id

        return {
          ...edge,
          animated: live,
          markerEnd:
            edge.type === "feeds"
              ? undefined
              : { type: MarkerType.ArrowClosed, width: 12, height: 12 },
        }
      }),
    [edges, runningNode]
  )

  useEffect(() => {
    if (inspected && !nodes.some((node) => node.id === inspected)) {
      setInspected(null)
      setInspectorOpen(false)
    }
  }, [inspected, nodes])

  const inspectedNode = nodes.find((node) => node.id === inspected)
  const inspectedData = !inspectedNode
    ? undefined
    : isRunTask(inspectedNode)
      ? inspectedNode.data
      : {
          ...inspectedNode.data,
          detail: inspectedNode.data.kind,
          status: "queued" as const,
          params: [],
        }

  // Named by the task on the other end, so a wire is recognisable once it is
  // off the canvas and inside a list.
  const wiring = useMemo(() => {
    const endOf = (id: string, caption?: string) => {
      const node = nodes.find((candidate) => candidate.id === id)
      const task = node && isRunTask(node) ? node : undefined

      return {
        nodeId: id,
        name: node?.data.title ?? id,
        glyph: node?.data.glyph ?? ("custom" as const),
        status: task?.data.status,
        summary:
          caption ??
          task?.data.detail ??
          (node?.type === "resource" ? node.data.kind : id),
        canOpen: !!task,
      }
    }

    return {
      inputs: edges
        .filter((edge) => edge.type !== "feeds" && edge.target === inspected)
        .map((edge) => ({
          edgeId: edge.id,
          ...endOf(edge.source, edge.data?.caption),
        })),
      outputs: edges
        .filter((edge) => edge.type !== "feeds" && edge.source === inspected)
        .map((edge) => ({
          edgeId: edge.id,
          ...endOf(edge.target, edge.data?.caption),
        })),
      attachments: edges
        .filter((edge) => edge.type === "feeds" && edge.target === inspected)
        .map((edge) => ({
          edgeId: edge.id,
          ...endOf(edge.source, edge.data?.caption),
        })),
      readers: edges
        .filter((edge) => edge.type === "feeds" && edge.source === inspected)
        .map((edge) => ({
          edgeId: edge.id,
          ...endOf(edge.target, edge.data?.caption),
        })),
      tasks: nodes
        .filter((node) => isRunTask(node) && node.id !== inspected)
        .map((node) => ({
          id: node.id,
          title: node.data.title,
          glyph: node.data.glyph,
        })),
      resources: nodes
        .filter((node) => node.type === "resource")
        .map((node) => ({
          id: node.id,
          title: node.data.title,
          glyph: node.data.glyph,
        })),
    }
  }, [edges, inspected, nodes])

  const failedId = nodes.find(
    (node) => isRunTask(node) && node.data.status === "failed"
  )?.id

  // The reason anyone opens a run viewer, so it is one click from the toolbar.
  // The task centres in whatever canvas a docked panel leaves free.
  const focusFailed = useCallback(() => {
    if (!failedId) return

    frame({ minZoom: 0.25, maxZoom: 1, padding: "24px" }, glide(), {
      id: failedId,
      reserve: docked ? PANEL_RESERVE : 0,
      centre: true,
    })
  }, [docked, failedId, frame])

  const fitAll = useCallback(
    () => frame(fitOptions, glide()),
    [fitOptions, frame]
  )

  // A wire dropped onto the bottom port is an attachment; anywhere else it is
  // a dependency, so the drop decides the edge's own type.
  const onConnect = useCallback(
    (connection: Connection) => {
      const feeds = connection.targetHandle === "feeds"

      setEdges((current) =>
        addEdge(
          {
            ...connection,
            type: feeds ? "feeds" : "flow",
          },
          current
        )
      )
    },
    [setEdges]
  )

  // An edge end can be dragged onto another task, so wiring stays editable.
  const onReconnect = useCallback(
    (oldEdge: PipelineEdgeType, connection: Connection) =>
      setEdges((current) =>
        reconnectEdge(
          // The port it lands on decides what the wire is, as at first draw.
          {
            ...oldEdge,
            type: connection.targetHandle === "feeds" ? "feeds" : "flow",
          },
          connection,
          current
        )
      ),
    [setEdges]
  )

  // The draft is seeded on open, so typing never fights the canvas. A
  // resource has a kind where a task has a service.
  const inspect = useCallback((nodeId: string) => {
    const node = nodesRef.current.find((candidate) => candidate.id === nodeId)

    if (!node) return

    setDraft(
      node.type === "resource"
        ? {
            title: node.data.title,
            glyph: node.data.glyph,
            params: [],
            kind: node.data.kind,
          }
        : {
            title: node.data.title,
            glyph: node.data.glyph,
            params: node.data.params,
          }
    )
    setInspected(nodeId)
    setInspectorOpen(true)
    setOpenedOnLoad(false)
  }, [])

  const save = useCallback(() => {
    if (!inspected) return

    const taken = snapshot()
    const name = draft.title || titleOf(inspected)

    setNodes((current) =>
      current.map((node): PipelineNodeType => {
        if (node.id !== inspected) return node

        if (node.type === "resource") {
          const kind = draft.kind ?? node.data.kind

          return {
            ...node,
            data: { title: draft.title, kind, glyph: RESOURCE_GLYPH[kind] },
          }
        }

        const data = {
          title: draft.title,
          glyph: draft.glyph,
          params: draft.params,
        }

        return node.type === "mark"
          ? { ...node, data: { ...node.data, ...data } }
          : { ...node, data: { ...node.data, ...data } }
      })
    )
    setInspectorOpen(false)
    toast.success("Task updated", {
      description: name,
      icon: TOAST_SUCCESS_ICON,
      action: { label: "Undo", onClick: () => restore(taken) },
      duration: 8000,
    })
  }, [draft, inspected, restore, setNodes, snapshot, titleOf])

  // A screen wide enough to read the run beside the docked panel (OPEN_QUERY)
  // opens, in place, on the one node a person has to answer.
  useEffect(() => {
    if (!window.matchMedia(OPEN_QUERY).matches) return

    inspect(GATE_ID)
    setOpenedOnLoad(true)
  }, [inspect])

  // Framing needs measured nodes and has to clear the panel and the toolbar,
  // so it waits for dimensions and runs once: every later frame is the user's.
  useEffect(() => {
    if (!measured || framedRef.current) return

    framedRef.current = true
    frameOpening(0)
  }, [frameOpening, measured])

  // Fit centres the graph on half pixels, which smears every 1px wire; each
  // move lands on whole pixels so hairlines stay as crisp as borders.
  const snapViewport = useCallback<OnMoveEnd>(
    (_, viewport) => {
      const x = Math.round(viewport.x)
      const y = Math.round(viewport.y)

      if (x !== viewport.x || y !== viewport.y) {
        void setViewport({ x, y, zoom: viewport.zoom })
      }
    },
    [setViewport]
  )

  const unlink = useCallback(
    (edgeId: string) => {
      setEdges((current) => current.filter((edge) => edge.id !== edgeId))
    },
    [setEdges]
  )

  // The far end moves; the end the panel is open on stays. A wire that would
  // duplicate one already there, or loop back on itself, is left as it was.
  const relink = useCallback(
    (edgeId: string, endId: string) => {
      setEdges((current) => {
        const edge = current.find((candidate) => candidate.id === edgeId)

        if (!edge || endId === inspected) return current

        const next =
          edge.target === inspected
            ? { ...edge, source: endId }
            : { ...edge, target: endId }
        const taken = current.some(
          (candidate) =>
            candidate.id !== edgeId &&
            candidate.type === next.type &&
            candidate.source === next.source &&
            candidate.target === next.target
        )

        return taken
          ? current
          : current.map((candidate) =>
              candidate.id === edgeId ? next : candidate
            )
      })
    },
    [inspected, setEdges]
  )

  // Re-running one task is the replay with a queue of one, so a single step
  // resolves exactly as it would inside a full run.
  const retry = useCallback(
    (nodeId: string) => {
      forcedRef.current.set(nodeId, "Succeeded on retry")
      queueRef.current = [nodeId]
      setStatus(nodeId, "queued", "Queued")
      setRunState("running")
      toast.success("Task retried", {
        description: titleOf(nodeId),
        icon: TOAST_SUCCESS_ICON,
      })
    },
    [setStatus, titleOf]
  )

  const skip = useCallback(
    (nodeId: string) => {
      const taken = snapshot()
      setStatus(nodeId, "skipped", "Skipped")
      toast.success("Task skipped", {
        description: titleOf(nodeId),
        icon: TOAST_SUCCESS_ICON,
        action: { label: "Undo", onClick: () => restore(taken) },
        duration: 8000,
      })
    },
    [restore, setStatus, snapshot, titleOf]
  )

  // Puts the canvas back to a graph nobody has run yet, which is the state a
  // buyer wants while they are still wiring it up.
  const clearResults = useCallback(() => {
    setNodes((current) =>
      current.map((node): PipelineNodeType => {
        if (!isRunTask(node)) return node

        // The gate is the one step a person answers, so a clear returns it to
        // waiting rather than deleting the only interaction on the canvas.
        return node.id === GATE_ID
          ? withRunState(node, "Awaiting Approval", "waiting")
          : withRunState(node, "Not run yet", "queued")
      })
    )
  }, [setNodes])

  // The id and the slot are settled before the updaters run: a state updater
  // must be pure, and a counter bumped inside one runs twice.
  const addAfter = useCallback(
    (nodeId: string) => {
      const parent = nodesRef.current.find((node) => node.id === nodeId)

      if (!parent) {
        return
      }

      seq += 1
      const id = `task_${seq}`
      // Drop into the first free slot of the next column, so a new task
      // never lands on one already there.
      const x = parent.position.x + COLUMN_PITCH
      const occupied = nodesRef.current.filter(
        (node) => Math.abs(node.position.x - x) < COLUMN_PITCH / 2
      )
      const y = occupied.length
        ? Math.max(...occupied.map((node) => node.position.y)) + ROW_PITCH
        : parent.position.y

      revealRef.current = id
      const task = createTaskNode(id, { x, y })

      setNodes((current) => [...current, task])
      setEdges((current) => [
        ...current,
        {
          id: `${nodeId}->${id}`,
          source: nodeId,
          target: id,
          sourceHandle: "out",
          targetHandle: "in",
          type: "flow",
        },
      ])
      toast.success("Task created", {
        description: `${task.data.title} after ${parent.data.title}.`,
        icon: TOAST_SUCCESS_ICON,
      })
    },
    [setEdges, setNodes]
  )

  const addTask = useCallback(() => {
    const order = runOrder(nodesRef.current, edges)
    const selected = nodesRef.current.find(
      (node) => node.selected && isRunTask(node)
    )

    addAfter(selected?.id ?? order[order.length - 1])
  }, [addAfter, edges])

  const duplicate = useCallback(
    (nodeId: string) => {
      const source = nodesRef.current.find((node) => node.id === nodeId)

      if (!source) return

      seq += 1
      const id = `${source.type === "resource" ? "res" : "task"}_${seq}`
      const position = freeSlot(
        nodesRef.current,
        source.position.x,
        source.position.y + ROW_PITCH
      )

      revealRef.current = id
      setNodes((current) => [
        ...current,
        source.type === "resource"
          ? {
              ...source,
              id,
              selected: false,
              position,
              data: { ...source.data, title: `${source.data.title}_copy` },
            }
          : source.type === "gate"
            ? {
                ...source,
                id,
                selected: false,
                deletable: true,
                position,
                data: {
                  ...source.data,
                  detail: "Not run yet",
                  status: "waiting" as const,
                  title: `${source.data.title}_copy`,
                },
              }
            : {
                ...source,
                id,
                selected: false,
                position,
                data: {
                  ...source.data,
                  detail: "Not run yet",
                  status: "queued" as const,
                  title: `${source.data.title}_copy`,
                },
              },
      ])
      toast.success(
        source.type === "resource" ? "Resource duplicated" : "Task duplicated",
        { description: source.data.title, icon: TOAST_SUCCESS_ICON }
      )
    },
    [setNodes]
  )

  // A resource arrives already wired, since one that reads nothing is noise.
  const addAttachment = useCallback(
    (nodeId: string) => {
      const parent = nodesRef.current.find((node) => node.id === nodeId)

      if (!parent) return

      seq += 1
      const id = `res_${seq}`
      const position = freeSlot(
        nodesRef.current,
        parent.position.x + ATTACH_INSET,
        parent.position.y + ROW_PITCH
      )

      revealRef.current = id
      setNodes((current) => [
        ...current,
        createResourceNode(id, position, "Connection"),
      ])
      setEdges((current) => [
        ...current,
        {
          id: `${id}-feeds-${nodeId}`,
          source: id,
          sourceHandle: "out",
          target: nodeId,
          targetHandle: "feeds",
          type: "feeds",
        },
      ])
      toast.success("Resource attached", {
        description: `Connection under ${parent.data.title}.`,
        icon: TOAST_SUCCESS_ICON,
      })
    },
    [setEdges, setNodes]
  )

  // The prompt settles before the engine removes anything, so the snapshot it
  // takes still holds every node the confirmed delete is about to take.
  const confirmDelete = useCallback<
    OnBeforeDelete<PipelineNodeType, PipelineEdgeType>
  >(
    async (elements) => {
      const allowed = await onBeforeDelete(elements)

      if (allowed) {
        snapshot()
      }

      return allowed
    },
    [onBeforeDelete, snapshot]
  )

  // Runs after the engine removed them, so the count it reports is what left.
  const announceDelete = useCallback<
    OnDelete<PipelineNodeType, PipelineEdgeType>
  >(
    ({ nodes: removed }) => {
      if (removed.length === 0) return

      const taken = undoRef.current

      toast.success(removed.length > 1 ? "Tasks deleted" : "Task deleted", {
        description:
          removed.length > 1
            ? `${removed.length} nodes left the run.`
            : removed[0].data.title,
        icon: TOAST_SUCCESS_ICON,
        action: { label: "Undo", onClick: () => restore(taken) },
        duration: 8000,
      })
    },
    [restore]
  )

  // One removal path, so the engine drops the wires with the task and the
  // trigger's deletable flag is honoured however the delete was fired.
  const remove = useCallback(
    (nodeId: string) => {
      void deleteElements({ nodes: [{ id: nodeId }] })
    },
    [deleteElements]
  )

  // Counts come from the nodes themselves, so they cannot drift from the canvas.
  const runTasks = useMemo(() => nodes.filter(isRunTask), [nodes])
  const settled = runTasks.filter(
    (node) => node.data.status !== "queued" && node.data.status !== "running"
  ).length

  const counts = useMemo(() => {
    const tally = new Map<string, number>()

    for (const node of nodes.filter(isRunTask)) {
      tally.set(node.data.status, (tally.get(node.data.status) ?? 0) + 1)
    }

    return STATUS_ORDER.filter((status) => tally.has(status)).map((status) => ({
      status,
      count: tally.get(status) ?? 0,
    }))
  }, [nodes])

  return (
    <RunActionsProvider
      active={runState !== "idle"}
      approve={approve}
      inspect={inspect}
      open={inspectorOpen && inspected !== null}
      openedOnLoad={openedOnLoad}
      close={() => setInspectorOpen(false)}
      save={save}
      unlink={unlink}
      relink={relink}
      setDraft={setDraft}
      target={inspected ? { nodeId: inspected } : null}
      draft={draft}
      data={inspectedData}
      wiring={wiring}
      retry={retry}
      skip={skip}
      duplicate={duplicate}
      remove={remove}
      addAttachment={addAttachment}
    >
      <div className="bg-background flex h-svh w-full flex-col">
        {/* Three zones: what this is, how the run is going, what you can do.
            Each keeps its own width, so the middle stays optically centred. */}
        <header className="grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b px-4">
          <div className="flex min-w-0 items-center gap-2">
            {/* The trail stops at the parent; the title is its own heading, so it keeps
                text-sm in every style, where some styles shrink the crumb list. */}
            <Breadcrumb className="max-sm:hidden">
              <BreadcrumbList className="flex-nowrap">
                <BreadcrumbItem>
                  {/* customize: point at your pipeline list route. */}
                  <BreadcrumbLink href="#">{PIPELINE.section}</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </BreadcrumbList>
            </Breadcrumb>
            <h1 className="min-w-0 truncate text-sm font-semibold">
              {PIPELINE.name}
            </h1>
            <Separator
              orientation="vertical"
              className="h-4 data-vertical:self-center max-xl:hidden"
            />
            {/* Collapses with sr-only below xl, where the centre zone needs the width. */}
            <p className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs max-xl:sr-only">
              <span className="shrink-0 font-mono">{PIPELINE.run}</span>
              <span
                aria-hidden="true"
                className="bg-muted-foreground/40 size-1 shrink-0 rounded-full"
              />
              <span className="flex shrink-0 items-center gap-1.5">
                {/* The avatar and time say who and when; the sentence is read aloud. */}
                <span className="sr-only">
                  {`Started ${PIPELINE.started}, owned by ${PIPELINE.owner.name}`}
                </span>
                <Avatar aria-hidden="true" className="size-4">
                  <AvatarImage src={PIPELINE.owner.avatar} alt="" />
                  <AvatarFallback className="text-[8px]">
                    {PIPELINE.owner.initials}
                  </AvatarFallback>
                </Avatar>
                <span aria-hidden="true" className="tabular-nums">
                  {PIPELINE.started}
                </span>
              </span>
            </p>
          </div>
          {/* A fixed slot keeps the controls still as a replay runs; the sentence
              beside it is the one a screen reader hears change. */}
          <p role="status" aria-live="polite" className="sr-only">
            {runState === "idle"
              ? `Run idle, ${settled} of ${runTasks.length} tasks settled`
              : `${runningNode?.data.title ?? "Holding"}, ${settled} of ${runTasks.length} tasks settled`}
          </p>
          <div className="w-72 items-center justify-center gap-2 max-lg:sr-only lg:flex">
            {runState === "idle" ? (
              <>
                {counts.map(({ status, count }, index) => (
                  <Badge key={status} variant={STATUS_BADGE[status]}>
                    {STATUS_ICON[status]}
                    <span className={index ? "sr-only" : undefined}>
                      {STATUS_LABEL[status]}
                    </span>
                    <span className="tabular-nums">{count}</span>
                  </Badge>
                ))}
              </>
            ) : (
              <>
                <span className="text-muted-foreground w-28 truncate text-end text-xs">
                  {runningNode?.data.title ?? "Holding"}
                </span>
                <Progress
                  value={settled}
                  max={runTasks.length}
                  aria-label="Run progress"
                  className="w-20"
                />
                <span className="text-muted-foreground text-xs tabular-nums">
                  {settled} of {runTasks.length}
                </span>
              </>
            )}
          </div>
          {/* Pinned to the last column: the middle zone leaves the grid below
              lg, and auto placement would slide these into its slot. */}
          <div className="col-start-3 flex items-center justify-end gap-2">
            <FlowKeys />
            {replay && (
              <RunControls
                state={runState}
                hasFailed={!!failedId}
                onAddTask={addTask}
                onStart={startRun}
                onPause={() => setRunState("paused")}
                onStop={stopRun}
                onRetryFailed={() => failedId && retry(failedId)}
                onClearResults={clearResults}
              />
            )}
          </div>
        </header>
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <FlowCanvas<PipelineNodeType, PipelineEdgeType>
            className={EDGE_STROKE}
            showMiniMap={false}
            fitViewOptions={fitOptions}
            nodes={nodes}
            edges={liveEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onMoveEnd={snapViewport}
            reconnectRadius={16}
            isValidConnection={isValidConnection}
            onBeforeDelete={confirmDelete}
            onDelete={announceDelete}
            nodesDraggable={editable}
            nodesConnectable={editable}
            edgesReconnectable={editable}
          >
            {/* Bottom left keeps these clear of the floating inspector. The
                engine's panel margin is unlayered, so this has to win. */}
            <Panel ref={toolbarRef} position="bottom-left" className="m-6!">
              <CanvasToolbar
                tool={tool}
                onToolChange={setTool}
                onFitView={fitAll}
                onFocusFailed={focusFailed}
                hasFailed={!!failedId}
              />
            </Panel>
          </FlowCanvas>
          <NodeInspectorPanel />
          {dialog}
        </div>
      </div>
    </RunActionsProvider>
  )
}