// @ts-nocheck
// Vendored from ReUI registry (upstream-pristine; excluded from type gate)
import type { BadgeProps } from "#components/reui/badge.tsx"
import type { Edge, Node } from "@xyflow/react"
import { CheckIcon, TriangleAlertIcon, WebhookIcon, GitBranchIcon, DatabaseIcon, MailIcon, ClockIcon, ZapIcon, CircleCheckIcon, CircleXIcon, LoaderCircleIcon, MinusIcon, CircleDotIcon } from "lucide-react"

/** Typed toast icons, so feedback carries semantic colour and not only text. */
export const TOAST_SUCCESS_ICON = (
  <CheckIcon className="text-success size-4" aria-hidden="true" />
)

export const TOAST_ERROR_ICON = (
  <TriangleAlertIcon className="text-destructive size-4" aria-hidden="true" />
)

export type StepKind = "trigger" | "condition" | "action"

export type StepCategory =
  "webhook" | "condition" | "data" | "email" | "delay" | "action"

export const CATEGORY_LABEL: Record<StepCategory, string> = {
  webhook: "Webhook",
  condition: "Condition",
  data: "Data",
  email: "Email",
  delay: "Delay",
  action: "Action",
}

/** One glyph per category, so picking a category is what sets the tile. */
export const CATEGORY_ICON: Record<StepCategory, React.ReactNode> = {
  webhook: (
    <WebhookIcon aria-hidden="true" />
  ),
  condition: (
    <GitBranchIcon aria-hidden="true" />
  ),
  data: (
    <DatabaseIcon aria-hidden="true" />
  ),
  email: (
    <MailIcon aria-hidden="true" />
  ),
  delay: (
    <ClockIcon aria-hidden="true" />
  ),
  action: (
    <ZapIcon aria-hidden="true" />
  ),
}

export const STEP_CATEGORIES = Object.keys(CATEGORY_LABEL) as StepCategory[]

export type StepStatus = "succeeded" | "failed" | "running" | "skipped" | "idle"

export type StepOwner = {
  id: string
  name: string
  initials: string
  avatar: string
}

export type StepNodeData = {
  kind: StepKind
  category: StepCategory
  title: string
  detail: string
  /** How this step ended on the last run. */
  status: StepStatus
  duration: string
  owner: StepOwner
}

export const KIND_LABEL: Record<StepKind, string> = {
  trigger: "Trigger",
  condition: "Condition",
  action: "Action",
}

export const STATUS_LABEL: Record<StepStatus, string> = {
  succeeded: "Success",
  failed: "Failed",
  running: "Running",
  skipped: "Skipped",
  idle: "Idle",
}

/** Semantic badge per status; the panel and the node read the same fact. */
export const STATUS_BADGE: Record<StepStatus, BadgeProps["variant"]> = {
  succeeded: "success-light",
  failed: "destructive-light",
  running: "info-light",
  skipped: "outline",
  idle: "outline",
}

/** Shape carries the status too, so it never rests on colour alone. */
export const STATUS_ICON: Record<StepStatus, React.ReactNode> = {
  succeeded: (
    <CircleCheckIcon aria-hidden="true" />
  ),
  failed: (
    <CircleXIcon aria-hidden="true" />
  ),
  running: (
    <LoaderCircleIcon aria-hidden="true" />
  ),
  skipped: (
    <MinusIcon aria-hidden="true" />
  ),
  idle: (
    <CircleDotIcon aria-hidden="true" />
  ),
}

const INES: StepOwner = {
  id: "ines",
  name: "Ines Marchetti",
  initials: "IM",
  avatar:
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80",
}

const TOMAS: StepOwner = {
  id: "tomas",
  name: "Tomas Lindqvist",
  initials: "TL",
  avatar:
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&dpr=2&q=80",
}

const HANNA: StepOwner = {
  id: "hanna",
  name: "Hanna Berg",
  initials: "HB",
  avatar:
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=96&h=96&dpr=2&q=80",
}

/** The people a step can be handed to; the edit form picks from these. */
export const STEP_OWNERS: StepOwner[] = [INES, TOMAS, HANNA]

export type StepNodeType = Node<StepNodeData, "step">

export const WORKFLOW = {
  id: "wf_8k2m4p",
  name: "Lead Routing",
  lastRun: "run_3f9a1c",
  section: "Workflows",
  edited: "2h ago",
  editor: INES,
}

// Mirrors the CanvasToolbar keydown handler and the canvas deleteKeyCode;
// "mod" and "shift" print the platform's own glyph.
export const SHORTCUTS: { label: string; keys: string[] }[] = [
  { label: "Select", keys: ["V"] },
  { label: "Pan", keys: ["H"] },
  { label: "Zoom in", keys: ["+"] },
  { label: "Zoom out", keys: ["-"] },
  { label: "Zoom to fit", keys: ["shift", "1"] },
  { label: "Actual size", keys: ["shift", "0"] },
  { label: "Undo", keys: ["mod", "Z"] },
  { label: "Redo", keys: ["mod", "shift", "Z"] },
  { label: "Delete step", keys: ["Backspace"] },
]

// customize: replace with your own automation steps.
export const INITIAL_NODES: StepNodeType[] = [
  {
    id: "trigger",
    type: "step",
    // The engine checks this before anything else, so no path drops the entry
    // point: not the toolbar, not Backspace, not Select all steps.
    deletable: false,
    position: { x: 0, y: 160 },
    data: {
      kind: "trigger",
      title: "Form submitted",
      detail: "Webhook: demo.request",
      category: "webhook",
      status: "succeeded",
      duration: "0.2s",
      owner: INES,
    },
  },
  {
    id: "filter",
    type: "step",
    position: { x: 300, y: 160 },
    data: {
      kind: "condition",
      title: "Plan is Enterprise",
      detail: "company.size > 200",
      category: "condition",
      status: "succeeded",
      duration: "0.1s",
      owner: INES,
    },
  },
  {
    id: "enrich",
    type: "step",
    position: { x: 600, y: 40 },
    data: {
      kind: "action",
      title: "Enrich company",
      detail: "Clearbit lookup",
      category: "data",
      status: "failed",
      duration: "8.0s",
      owner: TOMAS,
    },
  },
  {
    id: "notify",
    type: "step",
    position: { x: 600, y: 280 },
    data: {
      kind: "action",
      title: "Notify sales",
      detail: "Slack #inbound-leads",
      category: "email",
      status: "skipped",
      duration: "Not run",
      owner: HANNA,
    },
  },
  {
    id: "deal",
    type: "step",
    position: { x: 900, y: 40 },
    data: {
      kind: "action",
      title: "Create deal",
      detail: "HubSpot pipeline: Inbound",
      category: "action",
      status: "idle",
      duration: "Not run",
      owner: TOMAS,
    },
  },
]

// New steps land as a plain action; the buyer swaps the kind and icon here.
export function createStep(
  id: string,
  position: { x: number; y: number }
): StepNodeType {
  return {
    id,
    type: "step",
    position,
    className: "group/node",
    data: {
      kind: "action",
      title: "New step",
      detail: "Not configured yet",
      category: "action",
      status: "idle",
      duration: "Not run",
      owner: INES,
    },
  }
}

// Every edge takes the "labeled" type so one path style covers the graph. The
// animated ones trace the enterprise route, the branch nobody has to inspect.
export const INITIAL_EDGES: Edge[] = [
  {
    id: "trigger-filter",
    source: "trigger",
    target: "filter",
    type: "labeled",
    animated: true,
  },
  {
    id: "filter-enrich",
    source: "filter",
    target: "enrich",
    type: "labeled",
    animated: true,
    label: "Yes",
  },
  {
    id: "filter-notify",
    source: "filter",
    target: "notify",
    type: "labeled",
    label: "No",
  },
  {
    id: "enrich-deal",
    source: "enrich",
    target: "deal",
    type: "labeled",
    animated: true,
  },
]