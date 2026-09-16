// @ts-nocheck
// Vendored from ReUI registry (upstream-pristine; excluded from type gate)
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "#components/reui/alert.tsx"
import { Badge } from "#components/reui/badge.tsx"
import { IconTile } from "#components/reui/icon-tile.tsx"
import { useReactFlow, type Edge } from "@xyflow/react"
import { toast } from "sonner"

import { cn } from "#lib/utils.ts"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "#components/ui/avatar.tsx"
import { Button } from "#components/ui/button.tsx"
import { Field, FieldGroup, FieldLabel } from "#components/ui/field.tsx"
import { Input } from "#components/ui/input.tsx"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#components/ui/select.tsx"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "#components/ui/sheet.tsx"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "#components/ui/tooltip.tsx"
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  createStep,
  KIND_LABEL,
  STATUS_BADGE,
  STATUS_ICON,
  STATUS_LABEL,
  STEP_CATEGORIES,
  STEP_OWNERS,
  TOAST_SUCCESS_ICON,
  WORKFLOW,
  type StepCategory,
  type StepNodeData,
  type StepNodeType,
} from "./data"
import { InfoIcon, XIcon, TriangleAlertIcon, PlusIcon } from "lucide-react"

type StepDraft = {
  title: string
  detail: string
  category: StepCategory
  ownerId: string
}

type InspectTarget = { nodeId: string; mode: "view" | "edit" } | null

type StepActionsApi = {
  inspect: (nodeId: string, mode: "view" | "edit", seed?: StepDraft) => void
  addStep: () => void
  addAfter: (nodeId: string) => void
  duplicate: (nodeId: string) => void
  remove: (nodeId: string) => void
  close: () => void
  save: () => void
  setDraft: React.Dispatch<React.SetStateAction<StepDraft>>
  target: InspectTarget
  draft: StepDraft
  data: StepNodeData | undefined
  locked: boolean
  wiring: { incoming: number; outgoing: number }
}

const StepActionsContext = createContext<StepActionsApi | null>(null)

/** Nodes reach their own actions through this; the editor owns the state. */
export function useStepActions() {
  const api = useContext(StepActionsContext)

  if (!api) {
    throw new Error("useStepActions must be used inside StepActionsProvider")
  }

  return api
}

// Inserted ids are counted, never random, so a run reproduces exactly.
let stepCount = 0

interface StepActionsProviderProps {
  locked: boolean
  /** Runs before an edit commits, so history records the graph it replaces. */
  onBeforeEdit: () => void
  /** Replays the last snapshot, so a toast can offer a real Undo. */
  onUndo: () => void
  nodes: StepNodeType[]
  edges: Edge[]
  setNodes: React.Dispatch<React.SetStateAction<StepNodeType[]>>
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
  children: React.ReactNode
}

export function StepActionsProvider({
  locked,
  onBeforeEdit,
  onUndo,
  nodes,
  edges,
  setNodes,
  setEdges,
  children,
}: StepActionsProviderProps) {
  const { deleteElements } = useReactFlow()
  const [target, setTarget] = useState<InspectTarget>(null)
  const [draft, setDraft] = useState<StepDraft>({
    title: "",
    detail: "",
    category: "action",
    ownerId: STEP_OWNERS[0].id,
  })

  // A step created this tick is not in state yet, so its values come in
  // through seed rather than a lookup that would return nothing.
  function inspect(nodeId: string, mode: "view" | "edit", seed?: StepDraft) {
    const data = nodes.find((node) => node.id === nodeId)?.data

    setDraft(
      seed ?? {
        title: data?.title ?? "",
        detail: data?.detail ?? "",
        category: data?.category ?? "action",
        ownerId: data?.owner.id ?? STEP_OWNERS[0].id,
      }
    )
    setTarget({ nodeId, mode: locked ? "view" : mode })
  }

  function connect(sourceId: string, targetId: string) {
    setEdges((current) => [
      ...current,
      {
        id: `${sourceId}-${targetId}`,
        source: sourceId,
        target: targetId,
        type: "labeled",
      },
    ])
  }

  // A locked canvas is read only, whichever surface asks for the edit.
  function addAfter(nodeId: string) {
    if (locked) {
      return
    }

    const source = nodes.find((node) => node.id === nodeId)

    if (!source) {
      return
    }

    onBeforeEdit()
    stepCount += 1
    const stepId = `${nodeId}_step_${stepCount}`
    const step = createStep(stepId, {
      x: source.position.x + 300,
      y: source.position.y + 96,
    })

    setNodes((current) => [...current, step])
    connect(nodeId, stepId)
    inspect(stepId, "edit", {
      title: step.data.title,
      detail: step.data.detail,
      category: step.data.category,
      ownerId: step.data.owner.id,
    })
    // The new step is on screen with its form open, so the toast confirms the
    // wiring the insert also made rather than offering an Undo.
    toast.success("Step created", {
      description: `${step.data.title} after ${source.data.title}.`,
      icon: TOAST_SUCCESS_ICON,
    })
  }

  // Lands a lane below everything so it never covers existing work, and opens
  // straight into edit because a new step has nothing worth reading yet.
  function addStep() {
    if (locked) {
      return
    }

    const lowest = nodes.reduce((y, node) => Math.max(y, node.position.y), 0)

    onBeforeEdit()
    stepCount += 1
    const stepId = `step_${stepCount}`
    const step = createStep(stepId, { x: 0, y: lowest + 140 })

    setNodes((current) => [...current, step])
    inspect(stepId, "edit", {
      title: step.data.title,
      detail: step.data.detail,
      category: step.data.category,
      ownerId: step.data.owner.id,
    })
    toast.success("Step created", {
      description: step.data.title,
      icon: TOAST_SUCCESS_ICON,
    })
  }

  function duplicate(nodeId: string) {
    if (locked) {
      return
    }

    const source = nodes.find((node) => node.id === nodeId)

    if (!source) {
      return
    }

    onBeforeEdit()
    stepCount += 1
    const copyId = `${nodeId}_copy_${stepCount}`

    setNodes((current) => [
      ...current,
      {
        ...source,
        id: copyId,
        position: { x: source.position.x, y: source.position.y + 96 },
        selected: false,
      },
    ])
    // A floating copy is a dead end, so it arrives wired to its source.
    connect(nodeId, copyId)
    toast.success("Step duplicated", {
      description: source.data.title,
      icon: TOAST_SUCCESS_ICON,
    })
  }

  // The one removal path in the block. It clears the connected edges itself
  // and runs the confirmation the canvas installs.
  function remove(nodeId: string) {
    if (locked) {
      return
    }

    void deleteElements({ nodes: [{ id: nodeId }] })
  }

  function save() {
    if (!target || locked) {
      return
    }

    const current = nodes.find((node) => node.id === target.nodeId)?.data
    // An unchanged save only closes the form, so it records no edit.
    const changed =
      !current ||
      current.title !== draft.title ||
      current.detail !== draft.detail ||
      current.category !== draft.category ||
      current.owner.id !== draft.ownerId

    if (!changed) {
      setTarget({ nodeId: target.nodeId, mode: "view" })
      return
    }

    onBeforeEdit()

    const owner =
      STEP_OWNERS.find((person) => person.id === draft.ownerId) ??
      STEP_OWNERS[0]

    setNodes((current) =>
      current.map((node) =>
        node.id === target.nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                title: draft.title,
                detail: draft.detail,
                category: draft.category,
                owner,
              },
            }
          : node
      )
    )
    setTarget({ nodeId: target.nodeId, mode: "view" })
    toast.success("Step updated", {
      description: draft.title,
      icon: TOAST_SUCCESS_ICON,
      action: { label: "Undo", onClick: onUndo },
      duration: 8000,
    })
  }

  // A step can leave by a route the panel never hears about, so the panel
  // checks the graph rather than trusting its own close handler.
  useEffect(() => {
    if (target && !nodes.some((node) => node.id === target.nodeId)) {
      setTarget(null)
    }
  }, [nodes, target])

  const data = target
    ? nodes.find((node) => node.id === target.nodeId)?.data
    : undefined
  const wiring = {
    incoming: target
      ? edges.filter((edge) => edge.target === target.nodeId).length
      : 0,
    outgoing: target
      ? edges.filter((edge) => edge.source === target.nodeId).length
      : 0,
  }

  return (
    <StepActionsContext.Provider
      value={{
        inspect,
        addStep,
        addAfter,
        duplicate,
        remove,
        close: () => setTarget(null),
        save,
        setDraft,
        target: target && locked ? { ...target, mode: "view" } : target,
        draft,
        data,
        locked,
        wiring,
      }}
    >
      {children}
    </StepActionsContext.Provider>
  )
}

/** One portrait plus a name, the shape every owner row in the panel takes. */
function OwnerLine({
  name,
  initials,
  avatar,
}: {
  name: string
  initials: string
  avatar: string
}) {
  return (
    <span className="inline-flex items-center gap-2 align-middle">
      <Avatar className="size-5">
        <AvatarImage src={avatar} alt={name} />
        <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
      </Avatar>
      {name}
    </span>
  )
}

/** The glyph beside its name, the shape both the trigger and the list take. */
function CategoryLine({ category }: { category: StepCategory }) {
  return (
    <span className="inline-flex items-center gap-2 align-middle">
      {CATEGORY_ICON[category]}
      {CATEGORY_LABEL[category]}
    </span>
  )
}

/** Guidance sits behind an icon, so each field stays a label and a control. */
function FieldHint({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-foreground -my-1"
            aria-label={label}
          />
        }
      >
        <InfoIcon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-56">
        {children}
      </TooltipContent>
    </Tooltip>
  )
}

/** Label left, value right: a narrow panel reads far better than stacked rows. */
function FactRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <dt className="text-muted-foreground min-w-0">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words tabular-nums">
        {value}
      </dd>
    </div>
  )
}

/** The panel contents, shared by the dock and the sheet below lg. */
function StepPanel() {
  const {
    close,
    data,
    draft,
    inspect,
    locked,
    save,
    setDraft,
    target,
    wiring,
  } = useStepActions()
  const editing = target?.mode === "edit"
  const selectedOwner =
    STEP_OWNERS.find((person) => person.id === draft.ownerId) ?? STEP_OWNERS[0]
  const unreachable =
    Boolean(data) && data?.kind !== "trigger" && wiring.incoming === 0

  return (
    <div className="bg-card flex h-full flex-col">
      <header className="flex shrink-0 items-start gap-3 border-b px-4 py-3">
        <IconTile size="sm">
          {CATEGORY_ICON[data?.category ?? "action"]}
        </IconTile>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="truncate text-sm font-semibold">
            {data?.title ?? draft.title}
          </h2>
          <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
            <Badge variant="outline">
              {KIND_LABEL[data?.kind ?? "action"]}
            </Badge>
            <span
              aria-hidden="true"
              className="bg-muted-foreground/40 size-1 shrink-0 rounded-full"
            />
            <span className="truncate">{target?.nodeId}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="-me-1.5 -mt-1"
          aria-label="Close step details"
          onClick={close}
        >
          <XIcon aria-hidden="true" />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        {unreachable ? (
          <Alert variant="warning">
            <TriangleAlertIcon aria-hidden="true" />
            <AlertTitle>Nothing Routes Here</AlertTitle>
            <AlertDescription>
              Connect a step into this one or the run never reaches it.
            </AlertDescription>
          </Alert>
        ) : null}
        {editing ? (
          <TooltipProvider delay={300}>
            <FieldGroup>
              <Field>
                <div className="flex items-center gap-1.5">
                  <FieldLabel htmlFor="step-title">Title</FieldLabel>
                  <FieldHint label="About the title">
                    Shown on the node. Two or three words read best.
                  </FieldHint>
                </div>
                <Input
                  id="step-title"
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field>
                <div className="flex items-center gap-1.5">
                  <FieldLabel htmlFor="step-detail">Detail</FieldLabel>
                  <FieldHint label="About the detail">
                    The second line on the node. Usually the service it calls or
                    the condition it tests.
                  </FieldHint>
                </div>
                <Input
                  id="step-detail"
                  value={draft.detail}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      detail: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field>
                <div className="flex items-center gap-1.5">
                  <FieldLabel htmlFor="step-category">Category</FieldLabel>
                  <FieldHint label="About the category">
                    Sets the glyph on the node, so a run reads by shape before
                    anyone reads the words.
                  </FieldHint>
                </div>
                <Select
                  value={draft.category}
                  onValueChange={(value) =>
                    value &&
                    setDraft((current) => ({
                      ...current,
                      category: value as StepCategory,
                    }))
                  }
                >
                  <SelectTrigger id="step-category" className="w-full">
                    <SelectValue>
                      <CategoryLine category={draft.category} />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent align="start" alignItemWithTrigger={false}>
                    {STEP_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        <CategoryLine category={category} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <div className="flex items-center gap-1.5">
                  <FieldLabel htmlFor="step-owner">Owner</FieldLabel>
                  <FieldHint label="About the owner">
                    Whoever gets paged when this step fails on a live run.
                  </FieldHint>
                </div>
                <Select
                  value={draft.ownerId}
                  onValueChange={(value) =>
                    value &&
                    setDraft((current) => ({ ...current, ownerId: value }))
                  }
                >
                  {/* The trigger renders the same row as the options, so the
                      picked person keeps their portrait. */}
                  <SelectTrigger id="step-owner" className="w-full">
                    <SelectValue>
                      <OwnerLine {...selectedOwner} />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent align="start" alignItemWithTrigger={false}>
                    {STEP_OWNERS.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        <OwnerLine {...person} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </TooltipProvider>
        ) : (
          <>
            <section
              className="flex flex-col gap-3"
              aria-labelledby="step-facts"
            >
              <h3 id="step-facts" className="text-sm font-semibold">
                Step
              </h3>
              <dl className="flex flex-col gap-3">
                <FactRow label="Detail" value={data?.detail} />
                <FactRow
                  label="Category"
                  value={data ? CATEGORY_LABEL[data.category] : null}
                />
                <FactRow
                  label="Owner"
                  value={data ? <OwnerLine {...data.owner} /> : null}
                />
                <FactRow label="Incoming" value={wiring.incoming} />
                <FactRow label="Outgoing" value={wiring.outgoing} />
              </dl>
            </section>
            <section
              className="flex flex-col gap-3"
              aria-labelledby="run-facts"
            >
              <h3 id="run-facts" className="text-sm font-semibold">
                Last Run
              </h3>
              <dl className="flex flex-col gap-3">
                <FactRow
                  label="Status"
                  value={
                    data ? (
                      <Badge variant={STATUS_BADGE[data.status]}>
                        {STATUS_ICON[data.status]}
                        {STATUS_LABEL[data.status]}
                      </Badge>
                    ) : null
                  }
                />
                <FactRow label="Duration" value={data?.duration} />
                <FactRow label="Run" value={WORKFLOW.lastRun} />
              </dl>
            </section>
          </>
        )}
      </div>
      <footer className="shrink-0 border-t p-4">
        {editing ? (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button onClick={save}>Save step</Button>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            disabled={locked}
            onClick={() => target && inspect(target.nodeId, "edit")}
          >
            Edit step
          </Button>
        )}
      </footer>
    </div>
  )
}

/** The header's create action, a consumer so it can reach the provider. */
export function AddStepButton() {
  const { addStep, locked } = useStepActions()

  return (
    <Button variant="outline" disabled={locked} onClick={addStep}>
      <PlusIcon aria-hidden="true" />
      Add step
    </Button>
  )
}

// Below lg the panel rides an overlay sheet; at lg+ it is an in-flow dock.
// A 384px panel beside the canvas needs about 1024px before both read well.
const LG_QUERY = "(max-width: 1023px)"

function subscribeBelowLg(onChange: () => void) {
  const query = window.matchMedia(LG_QUERY)

  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

/**
 * Read straight from matchMedia, so a phone's first paint already gets the
 * sheet instead of flashing the desktop dock for a frame.
 */
function useIsBelowLg() {
  return useSyncExternalStore(
    subscribeBelowLg,
    () => window.matchMedia(LG_QUERY).matches,
    () => false
  )
}

export function StepInspectorPanel() {
  const { close, target } = useStepActions()
  const belowLg = useIsBelowLg()
  const open = target !== null
  const panel = <StepPanel />

  return (
    <>
      {/* Floats over the canvas instead of resizing it, so the graph never
          reflows and only a transform moves. */}
      {belowLg ? null : (
        <div
          role="complementary"
          aria-label="Step details"
          aria-hidden={!open}
          inert={!open}
          className={cn(
            "absolute inset-y-0 end-0 z-10 w-96 border-s transition-[translate] duration-300 ease-in-out motion-reduce:transition-none",
            open ? "translate-x-0" : "translate-x-full"
          )}
        >
          {panel}
        </div>
      )}

      {/* Mounted closed so the first open still plays the sheet transition. */}
      <Sheet open={belowLg && open} onOpenChange={(next) => !next && close()}>
        <SheetContent
          side="right"
          initialFocus={false}
          showCloseButton={false}
          className="w-full p-0 sm:max-w-96"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Step Details</SheetTitle>
            <SheetDescription>
              View or edit this workflow step.
            </SheetDescription>
          </SheetHeader>
          {panel}
        </SheetContent>
      </Sheet>
    </>
  )
}