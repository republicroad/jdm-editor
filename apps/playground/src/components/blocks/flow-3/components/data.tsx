// @ts-nocheck
// Vendored from ReUI registry (upstream-pristine; excluded from type gate)
import type { Alert } from "#components/reui/alert.tsx"
import type { BadgeProps } from "#components/reui/badge.tsx"
import type { Edge, Node } from "@xyflow/react"

import { GoogleCloud } from "#components/ui/svgs/googleCloud.tsx"
import { Paypal } from "#components/ui/svgs/paypal.tsx"
import { Prisma } from "#components/ui/svgs/prisma.tsx"
import { PrismaDark } from "#components/ui/svgs/prismaDark.tsx"
import { Redis } from "#components/ui/svgs/redis.tsx"
import { Slack } from "#components/ui/svgs/slack.tsx"
import { Stripe } from "#components/ui/svgs/stripe.tsx"
import { CheckIcon, ZapIcon, BookOpenIcon, ReceiptTextIcon, PlugZapIcon, ShieldCheckIcon, CodeIcon, ActivityIcon, XIcon, ClockIcon, PauseCircleIcon, MinusIcon } from "lucide-react"

// customize: the replay's pace, not the real clock. Each task runs roughly
// as long as its recorded duration, so the run varies the way work does.
/** Typed toast icons, so feedback carries semantic colour and not only text. */
export const TOAST_SUCCESS_ICON = (
  <CheckIcon className="text-success size-4" aria-hidden="true" />
)

export const REPLAY_MS: Record<string, number> = {
  nightly_schedule: 700,
  extract_stripe: 1400,
  extract_paypal: 1100,
  dedupe_payments: 1900,
  reconcile_ledger: 1600,
  build_invoices_daily: 1200,
  publish_mrr: 900,
  notify_finance: 800,
}

/** What a task added on the canvas takes, having no recorded run of its own. */
export const DEFAULT_REPLAY_MS = 1100

/** Whether the canvas is replaying the run, held, or showing the last one. */
export type RunState = "idle" | "running" | "paused"

/** The marks a task can wear. Keyed, so node data stays serializable and the
 *  inspector can offer the set as a choice. */
export type GlyphKey =
  | "stripe"
  | "paypal"
  | "redis"
  | "google"
  | "slack"
  | "schedule"
  | "ledger"
  | "invoice"
  | "connection"
  | "test"
  | "model"
  | "custom"

export const GLYPH_LABEL: Record<GlyphKey, string> = {
  stripe: "Stripe",
  paypal: "PayPal",
  redis: "Redis",
  google: "Google Cloud",
  slack: "Slack",
  schedule: "Schedule",
  ledger: "Ledger",
  invoice: "Invoice",
  connection: "Connection",
  test: "Test",
  model: "Model",
  custom: "Custom Code",
}

// customize: swap these for the services your own pipeline calls.
export const GLYPH: Record<GlyphKey, React.ReactNode> = {
  stripe: <Stripe />,
  paypal: <Paypal />,
  redis: <Redis />,
  google: <GoogleCloud />,
  slack: <Slack />,
  // The one mark with no colour of its own, so it ships as a pair.
  model: (
    <>
      <Prisma className="dark:hidden" />
      <PrismaDark className="hidden dark:block" />
    </>
  ),
  schedule: (
    <ZapIcon aria-hidden="true" />
  ),
  ledger: (
    <BookOpenIcon aria-hidden="true" />
  ),
  invoice: (
    <ReceiptTextIcon aria-hidden="true" />
  ),
  connection: (
    <PlugZapIcon aria-hidden="true" />
  ),
  test: (
    <ShieldCheckIcon aria-hidden="true" />
  ),
  custom: (
    <CodeIcon aria-hidden="true" />
  ),
}

/** The marks a task may choose; an attachment keeps its own three. */
export const TASK_GLYPHS: GlyphKey[] = [
  "stripe",
  "paypal",
  "redis",
  "google",
  "slack",
  "schedule",
  "ledger",
  "invoice",
  "custom",
]

export type TaskStatus =
  "succeeded" | "running" | "failed" | "queued" | "waiting" | "skipped"

export const STATUS_LABEL: Record<TaskStatus, string> = {
  succeeded: "Succeeded",
  running: "Running",
  failed: "Failed",
  queued: "Queued",
  waiting: "Waiting",
  skipped: "Skipped",
}

/** The mark's own border, so state reads before any label does. */
export const STATUS_RING: Record<TaskStatus, string> = {
  succeeded: "border-success",
  running: "border-info",
  failed: "border-destructive",
  queued: "border-border",
  waiting: "border-warning",
  skipped: "border-border",
}

// One map for every status chip, on a node or in the chrome: a state with a
// tone takes its tinted variant, and a state with none stays an outline.
export const STATUS_BADGE: Record<TaskStatus, BadgeProps["variant"]> = {
  succeeded: "success-light",
  running: "info-light",
  failed: "destructive-light",
  queued: "outline",
  waiting: "warning-light",
  skipped: "outline",
}

/** The panel's result strip, which reports the same state in words. */
export const STATUS_ALERT: Record<
  TaskStatus,
  React.ComponentProps<typeof Alert>["variant"]
> = {
  succeeded: "success",
  running: "info",
  failed: "destructive",
  queued: "default",
  waiting: "warning",
  skipped: "default",
}

/** Inline tone wherever a status is written as words rather than a chip. */
export const STATUS_TONE: Record<TaskStatus, string> = {
  succeeded: "text-success",
  running: "text-info",
  failed: "text-destructive",
  queued: "text-muted-foreground",
  waiting: "text-warning",
  skipped: "text-muted-foreground",
}

/** Shape carries the state too, so it never rests on colour alone. */
export const STATUS_ICON: Record<TaskStatus, React.ReactNode> = {
  succeeded: (
    <CheckIcon aria-hidden="true" />
  ),
  running: (
    <ActivityIcon aria-hidden="true" />
  ),
  failed: (
    <XIcon aria-hidden="true" />
  ),
  queued: (
    <ClockIcon aria-hidden="true" />
  ),
  waiting: (
    <PauseCircleIcon aria-hidden="true" />
  ),
  skipped: (
    <MinusIcon aria-hidden="true" />
  ),
}

/** The order the header counts read in, worst first. */
export const STATUS_ORDER: TaskStatus[] = [
  "failed",
  "running",
  "waiting",
  "queued",
  "succeeded",
  "skipped",
]

/** A setting the task reads; the kind picks the control the panel draws. */
export type TaskParam = {
  key: string
  value: string
  kind: "text" | "number" | "toggle"
}

export type MarkNodeData = {
  /** A trigger opens the run, so it takes no upstream and no attachment. */
  role: "trigger" | "task"
  title: string
  detail: string
  status: TaskStatus
  glyph: GlyphKey
  params: TaskParam[]
}

export type MarkNodeType = Node<MarkNodeData, "mark">

export type GateNodeData = {
  title: string
  detail: string
  status: TaskStatus
  glyph: GlyphKey
  params: TaskParam[]
}

export type GateNodeType = Node<GateNodeData, "gate">

/** What a task reads a resource for; each kind wears its own glyph. */
export const RESOURCE_KINDS = ["Connection", "Test", "Model"] as const
export type ResourceKind = (typeof RESOURCE_KINDS)[number]

export const RESOURCE_GLYPH: Record<ResourceKind, GlyphKey> = {
  Connection: "connection",
  Test: "test",
  Model: "model",
}

export type ResourceNodeData = {
  title: string
  kind: ResourceKind
  glyph: GlyphKey
}

export type ResourceNodeType = Node<ResourceNodeData, "resource">

export type PipelineNodeType = MarkNodeType | GateNodeType | ResourceNodeType

export type PipelineEdgeData = {
  /** What moved down this wire, or what the attachment is. */
  caption?: string
}

export type PipelineEdgeType = Edge<PipelineEdgeData, "flow" | "feeds">

export const PIPELINE = {
  name: "Nightly Ledger Sync",
  section: "Pipelines",
  run: "run_3f9a1c",
  started: "02:00 UTC",
  owner: {
    name: "Tomas Lindqvist",
    initials: "TL",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&dpr=2&q=80",
  },
}

// Mirrors the CanvasToolbar keydown handler and the canvas deleteKeyCode;
// "shift" prints the platform's own glyph.
export const SHORTCUTS: { label: string; keys: string[] }[] = [
  { label: "Select", keys: ["V"] },
  { label: "Pan", keys: ["H"] },
  { label: "Zoom in", keys: ["+"] },
  { label: "Zoom out", keys: ["-"] },
  { label: "Zoom to fit", keys: ["shift", "1"] },
  { label: "Actual size", keys: ["shift", "0"] },
  { label: "Focus failed task", keys: ["F"] },
  { label: "Delete task", keys: ["Backspace"] },
]

/** The approval gate, which is the one node the shell can advance. */
export const GATE_ID = "publish_mrr"

/** Held by the gate, so approving it is what releases this task. */
export const GATE_DOWNSTREAM_ID = "notify_finance"

// customize: replace with your own pipeline tasks.
export const INITIAL_NODES: PipelineNodeType[] = [
  {
    id: "nightly_schedule",
    type: "mark",
    // The schedule starts the run, so no path can drop it.
    deletable: false,
    position: { x: 0, y: 196 },
    data: {
      role: "trigger",
      title: "Nightly",
      detail: PIPELINE.started,
      status: "succeeded",
      glyph: "schedule",
      params: [
        { key: "cron", value: "0 2 * * *", kind: "text" },
        { key: "timezone", value: "UTC", kind: "text" },
      ],
    },
  },
  {
    id: "extract_stripe",
    type: "mark",
    position: { x: 164, y: 40 },
    data: {
      role: "task",
      title: "extract_stripe",
      detail: "2m 10s",
      status: "succeeded",
      glyph: "stripe",
      params: [
        { key: "lookback_days", value: "1", kind: "number" },
        { key: "page_size", value: "500", kind: "number" },
        { key: "include_refunds", value: "true", kind: "toggle" },
      ],
    },
  },
  {
    id: "extract_paypal",
    type: "mark",
    position: { x: 164, y: 352 },
    data: {
      role: "task",
      title: "extract_paypal",
      detail: "1m 48s",
      status: "succeeded",
      glyph: "paypal",
      params: [
        { key: "lookback_days", value: "1", kind: "number" },
        { key: "page_size", value: "250", kind: "number" },
        { key: "sandbox", value: "false", kind: "toggle" },
      ],
    },
  },
  {
    id: "dedupe_payments",
    type: "mark",
    position: { x: 328, y: 196 },
    data: {
      role: "task",
      title: "dedupe_payments",
      detail: "3m 12s",
      status: "succeeded",
      glyph: "redis",
      params: [
        { key: "match_window_hours", value: "24", kind: "number" },
        { key: "strict_currency", value: "true", kind: "toggle" },
      ],
    },
  },
  {
    id: "reconcile_ledger",
    type: "mark",
    position: { x: 600, y: 40 },
    data: {
      role: "task",
      title: "reconcile_ledger",
      detail: "Duplicate charge id",
      status: "failed",
      glyph: "ledger",
      params: [
        { key: "tolerance", value: "0.01", kind: "number" },
        { key: "halt_on_mismatch", value: "true", kind: "toggle" },
      ],
    },
  },
  {
    id: "build_invoices_daily",
    type: "mark",
    position: { x: 840, y: 40 },
    data: {
      role: "task",
      title: "build_invoices",
      detail: "Blocked upstream",
      status: "queued",
      glyph: "invoice",
      params: [
        { key: "batch_size", value: "1000", kind: "number" },
        { key: "dry_run", value: "false", kind: "toggle" },
      ],
    },
  },
  {
    id: GATE_ID,
    type: "gate",
    deletable: false,
    position: { x: 536, y: 352 },
    data: {
      title: "publish_mrr",
      detail: "Awaiting Approval",
      status: "waiting",
      glyph: "google",
      params: [
        { key: "currency", value: "USD", kind: "text" },
        { key: "approver", value: "finance-lead", kind: "text" },
      ],
    },
  },
  {
    id: GATE_DOWNSTREAM_ID,
    type: "mark",
    position: { x: 840, y: 352 },
    data: {
      role: "task",
      title: "notify_finance",
      detail: "Holds for Approval",
      status: "waiting",
      glyph: "slack",
      params: [
        { key: "channel", value: "#finance-ops", kind: "text" },
        { key: "mention_on_failure", value: "true", kind: "toggle" },
      ],
    },
  },
  {
    id: "conn_stripe",
    type: "resource",
    position: { x: 172, y: 204 },
    data: {
      title: "stripe_prod",
      kind: "Connection",
      glyph: "connection",
    },
  },
  {
    id: "conn_paypal",
    type: "resource",
    position: { x: 172, y: 516 },
    data: {
      title: "paypal_eu",
      kind: "Connection",
      glyph: "connection",
    },
  },
  {
    id: "check_charge_id",
    type: "resource",
    position: { x: 336, y: 360 },
    data: {
      title: "unique_charge",
      kind: "Test",
      glyph: "test",
    },
  },
  {
    id: "model_ledger_v3",
    type: "resource",
    position: { x: 608, y: 204 },
    data: {
      title: "ledger_v3",
      kind: "Model",
      glyph: "model",
    },
  },
]

// A flow wire runs left to right and says what it moved; a feeds wire hangs
// under its task and names the attachment.
export const INITIAL_EDGES: PipelineEdgeType[] = [
  {
    id: "schedule-stripe",
    source: "nightly_schedule",
    target: "extract_stripe",
    sourceHandle: "out",
    targetHandle: "in",
    type: "flow",
  },
  {
    id: "schedule-paypal",
    source: "nightly_schedule",
    target: "extract_paypal",
    sourceHandle: "out",
    targetHandle: "in",
    type: "flow",
  },
  {
    id: "stripe-dedupe",
    source: "extract_stripe",
    target: "dedupe_payments",
    sourceHandle: "out",
    targetHandle: "in",
    type: "flow",
    data: { caption: "1.2M rows" },
  },
  {
    id: "paypal-dedupe",
    source: "extract_paypal",
    target: "dedupe_payments",
    sourceHandle: "out",
    targetHandle: "in",
    type: "flow",
    data: { caption: "384k rows" },
  },
  {
    id: "dedupe-reconcile",
    source: "dedupe_payments",
    target: "reconcile_ledger",
    sourceHandle: "out",
    targetHandle: "in",
    type: "flow",
    data: { caption: "1.5M rows" },
  },
  {
    id: "reconcile-invoices",
    source: "reconcile_ledger",
    target: "build_invoices_daily",
    sourceHandle: "out",
    targetHandle: "in",
    type: "flow",
  },
  // The gate hangs off the branch that finished, which is what makes the
  // approval a real decision rather than one blocked behind the failure.
  {
    id: "dedupe-mrr",
    source: "dedupe_payments",
    target: GATE_ID,
    sourceHandle: "out",
    targetHandle: "in",
    type: "flow",
  },
  {
    id: "mrr-notify",
    source: GATE_ID,
    target: GATE_DOWNSTREAM_ID,
    sourceHandle: "out",
    targetHandle: "in",
    type: "flow",
  },
  {
    id: "stripe-conn",
    source: "conn_stripe",
    target: "extract_stripe",
    sourceHandle: "out",
    targetHandle: "feeds",
    type: "feeds",
  },
  {
    id: "paypal-conn",
    source: "conn_paypal",
    target: "extract_paypal",
    sourceHandle: "out",
    targetHandle: "feeds",
    type: "feeds",
  },
  {
    id: "dedupe-check",
    source: "check_charge_id",
    target: "dedupe_payments",
    sourceHandle: "out",
    targetHandle: "feeds",
    type: "feeds",
  },
  {
    id: "reconcile-model",
    source: "model_ledger_v3",
    target: "reconcile_ledger",
    sourceHandle: "out",
    targetHandle: "feeds",
    type: "feeds",
  },
]

// A task added on the canvas starts unrun and unconfigured.
export function createTaskNode(
  id: string,
  position: { x: number; y: number }
): MarkNodeType {
  return {
    id,
    type: "mark",
    position,
    data: {
      role: "task",
      title: "new_task",
      detail: "Not run yet",
      status: "queued",
      glyph: "custom",
      params: [],
    },
  }
}

/** An attachment added from a task, wired to that task's bottom port. */
export function createResourceNode(
  id: string,
  position: { x: number; y: number },
  kind: ResourceKind
): ResourceNodeType {
  return {
    id,
    type: "resource",
    position,
    data: {
      title: `new_${kind.toLowerCase()}`,
      kind,
      glyph: RESOURCE_GLYPH[kind],
    },
  }
}

/** What the seeded run proved about each task, replayed when Run is pressed. */
export const RUN_RESULT: Record<
  string,
  { detail: string; status: TaskStatus }
> = {}

for (const node of INITIAL_NODES) {
  if (node.type === "mark" || node.type === "gate") {
    RUN_RESULT[node.id] = { detail: node.data.detail, status: node.data.status }
  }
}