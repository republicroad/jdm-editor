// @ts-nocheck
// Vendored from ReUI registry (upstream-pristine; excluded from type gate)
import { useSyncExternalStore } from "react"
import { Alert, AlertTitle } from "#components/reui/alert.tsx"
import { Badge } from "#components/reui/badge.tsx"

import { cn } from "#lib/utils.ts"
import { Button } from "#components/ui/button.tsx"
import { Card, CardTitle } from "#components/ui/card.tsx"
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
import { Switch } from "#components/ui/switch.tsx"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "#components/ui/tabs.tsx"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "#components/ui/tooltip.tsx"
import {
  GLYPH,
  GLYPH_LABEL,
  RESOURCE_KINDS,
  STATUS_ALERT,
  STATUS_BADGE,
  STATUS_ICON,
  STATUS_LABEL,
  TASK_GLYPHS,
  type GlyphKey,
  type ResourceKind,
  type TaskParam,
} from "./data"
import {
  useRunActions,
  type TaskDraft,
  type Wire,
  type WireEnd,
} from "./run-actions"
import { InfoIcon, XIcon } from "lucide-react"

// The eyebrow the reference panel sets over each group, at the smallest size
// the type scale has; the count sits opposite it as a bare numeral.
const GROUP_LABEL =
  "text-muted-foreground text-xs font-medium tracking-wide uppercase"

// The tree takes the canvas's own line vocabulary, so a wire in the panel
// reads as the same wire that is drawn on the canvas.
const PORT = "border-muted-foreground/45 size-2 shrink-0 rounded-full border"

// A full radius on a six pixel box clamps to a true six pixel arc; every line
// stops two pixels short of a port, and the lower port sits clear of its select.
const STEM =
  "before:border-muted-foreground/45 before:absolute before:start-1 before:-top-2.5 before:bottom-1/2 before:w-1.5 before:rounded-bl-full before:border-s before:border-b after:bg-muted-foreground/45 after:absolute after:start-2.5 after:bottom-1/2 after:h-px after:w-1"

/** The service's own mark at icon size, with no container around it. */
function Mark({ glyph }: { glyph: GlyphKey }) {
  return (
    <span className="flex shrink-0 items-center [&>svg]:size-4">
      {GLYPH[glyph]}
    </span>
  )
}

/** A group heading: the eyebrow, its empty state if any, and a hint opposite. */
function GroupLabel({
  id,
  label,
  hint,
  empty,
}: {
  id: string
  label: string
  hint: string
  empty?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 id={id} className={GROUP_LABEL}>
        {label}
      </h3>
      <div className="flex items-center gap-1">
        {empty ? <Badge variant="outline">{empty}</Badge> : null}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground"
                aria-label={`About ${label.toLowerCase()}`}
              />
            }
          >
            <InfoIcon aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent side="left">{hint}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

/** One setting in the form's own format; a toggle keeps its inline row. */
function ParamRow({
  param,
  onChange,
}: {
  param: TaskParam
  onChange: (value: string) => void
}) {
  const id = `param-${param.key}`

  if (param.kind === "toggle") {
    return (
      <Field orientation="horizontal">
        <FieldLabel htmlFor={id}>{param.key}</FieldLabel>
        <Switch
          id={id}
          size="sm"
          checked={param.value === "true"}
          onCheckedChange={(checked) => onChange(String(checked))}
        />
      </Field>
    )
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>{param.key}</FieldLabel>
      <Input
        id={id}
        type={param.kind === "number" ? "number" : "text"}
        inputMode={param.kind === "number" ? "decimal" : undefined}
        className={param.kind === "number" ? "tabular-nums" : undefined}
        value={param.value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

/** One wire: a port, what came down it, and the far end it can be moved to. */
function WireRow({
  wire,
  ends,
  onRelink,
  onRemove,
}: {
  wire: Wire
  ends: WireEnd[]
  onRelink: (endId: string) => void
  onRemove: () => void
}) {
  return (
    <div className="group/wire flex flex-col gap-1.5">
      {/* The row holds the chip's height whatever the button's is, so the
          stem below always starts the same two pixels under the port. */}
      <div className="flex h-5 min-w-0 items-center gap-2">
        <span aria-hidden="true" className={PORT} />
        <Badge
          variant={wire.status ? STATUS_BADGE[wire.status] : "outline"}
          className="min-w-0 tabular-nums"
        >
          <span className="truncate">{wire.summary}</span>
        </Badge>
        {/* The cut sits where nothing needs the room and shows on hover or
            focus; a touch screen has no hover, so there it stays visible. */}
        <Button
          variant="ghost"
          size="icon-xs"
          className="ms-auto opacity-0 transition-opacity group-hover/wire:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none pointer-coarse:opacity-100"
          aria-label={`Disconnect ${wire.name}`}
          onClick={onRemove}
        >
          <XIcon aria-hidden="true" />
        </Button>
      </div>
      {/* The stem drops from the port to the row's midline, turns on a curve
          and lands on the far end's own port, just ahead of its select. */}
      <div className={cn("relative ps-7", STEM)}>
        <span
          aria-hidden="true"
          className={cn(PORT, "absolute start-4 top-1/2 -translate-y-1/2")}
        />
        <Select
          value={wire.nodeId}
          onValueChange={(value) => value && onRelink(value)}
        >
          <SelectTrigger
            size="sm"
            className="w-full"
            aria-label={`Wired to ${wire.name}`}
          >
            <SelectValue>
              <span className="inline-flex min-w-0 items-center gap-2 align-middle">
                <Mark glyph={wire.glyph} />
                <span className="truncate">{wire.name}</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start" alignItemWithTrigger={false}>
            {ends.map((end) => (
              <SelectItem key={end.id} value={end.id}>
                <span className="inline-flex items-center gap-2 align-middle">
                  <Mark glyph={end.glyph} />
                  <span>{end.title}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

/** A wire group: its eyebrow and count, then a tree of what is wired. */
function WireGroup({
  id,
  label,
  hint,
  wires,
  ends,
  onRelink,
  onRemove,
}: {
  id: string
  label: string
  hint: string
  wires: Wire[]
  ends: WireEnd[]
  onRelink: (edgeId: string, endId: string) => void
  onRemove: (edgeId: string) => void
}) {
  const headingId = `wiring-${id}`

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <GroupLabel
        id={headingId}
        label={label}
        hint={hint}
        empty={wires.length ? undefined : "Nothing wired"}
      />
      {wires.map((wire) => (
        <WireRow
          key={wire.edgeId}
          wire={wire}
          ends={ends}
          onRelink={(endId) => onRelink(wire.edgeId, endId)}
          onRemove={() => onRemove(wire.edgeId)}
        />
      ))}
    </section>
  )
}

function NodePanel() {
  const { close, data, draft, relink, save, setDraft, target, unlink, wiring } =
    useRunActions()

  if (!target || !data) {
    return null
  }

  // Nothing to commit reads as nothing to press, so Save waits for an edit.
  const dirty = isDirty(draft, data)
  const setParam = (key: string, value: string) =>
    setDraft((current) => ({
      ...current,
      params: current.params.map((param) =>
        param.key === key ? { ...param, value } : param
      ),
    }))

  return (
    <TooltipProvider delay={300}>
      <Card className="h-full gap-0 py-0">
        {/* One row, padded by the panel rather than the Card's header slot, so
          every style keeps the same title band above the tabs. */}
        <header className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
          <CardTitle className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold">
            <Mark glyph={draft.glyph} />
            <span className="truncate">{draft.title}</span>
            {/* A resource has no run state to report. */}
            {draft.kind ? null : (
              <Badge variant={STATUS_BADGE[data.status]}>
                {STATUS_ICON[data.status]}
                {STATUS_LABEL[data.status]}
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon-sm"
            className="-me-1.5"
            aria-label={dirty ? "Discard changes" : "Close task details"}
            onClick={close}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </header>
        {/* The Tabs root ships a gap of its own, which would open a seam
          between the rule under the triggers and the panel below it. */}
        <Tabs
          defaultValue="settings"
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <TabsList
            variant="line"
            className="h-auto w-full shrink-0 justify-start gap-5 border-b px-4 py-0"
          >
            <TabsTrigger
              value="settings"
              className="h-full flex-none px-0 py-2 after:-bottom-px!"
            >
              Settings
            </TabsTrigger>
            <TabsTrigger
              value="wiring"
              className="h-full flex-none px-0 py-2 after:-bottom-px!"
            >
              Wiring
            </TabsTrigger>
          </TabsList>
          {/* One scroll body owns the gutter for both panels, as the sibling flow
            panels do, so a switch of tab never moves the fields. */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
            <TabsContent value="settings" className="flex flex-1 flex-col">
              {/* The status note lives in the group, so it keeps the field gap when
              the form scrolls and pins to the bottom when it does not. */}
              <FieldGroup className="flex-1">
                <Field>
                  <FieldLabel htmlFor="task-title">Title</FieldLabel>
                  <Input
                    id="task-title"
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                </Field>
                {draft.kind ? (
                  <Field>
                    <FieldLabel htmlFor="resource-kind">Kind</FieldLabel>
                    <Select
                      value={draft.kind}
                      onValueChange={(value) =>
                        value &&
                        setDraft((current) => ({
                          ...current,
                          kind: value as ResourceKind,
                        }))
                      }
                    >
                      <SelectTrigger id="resource-kind" className="w-full">
                        <SelectValue>{draft.kind}</SelectValue>
                      </SelectTrigger>
                      <SelectContent align="start" alignItemWithTrigger={false}>
                        {RESOURCE_KINDS.map((kind) => (
                          <SelectItem key={kind} value={kind}>
                            {kind}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                ) : (
                  <Field>
                    <FieldLabel htmlFor="task-glyph">Service</FieldLabel>
                    <Select
                      value={draft.glyph}
                      onValueChange={(value) =>
                        value &&
                        setDraft((current) => ({
                          ...current,
                          glyph: value as GlyphKey,
                        }))
                      }
                    >
                      <SelectTrigger id="task-glyph" className="w-full">
                        <SelectValue>
                          <span className="inline-flex items-center gap-2 align-middle">
                            <Mark glyph={draft.glyph} />
                            {GLYPH_LABEL[draft.glyph]}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent align="start" alignItemWithTrigger={false}>
                        {TASK_GLYPHS.map((key) => (
                          <SelectItem key={key} value={key}>
                            <span className="inline-flex items-center gap-2 align-middle">
                              <Mark glyph={key} />
                              {GLYPH_LABEL[key]}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                {draft.params.map((param) => (
                  <ParamRow
                    key={param.key}
                    param={param}
                    onChange={(value) => setParam(param.key, value)}
                  />
                ))}
                {/* The run writes this one, so it reports rather than edits, and it
                carries the state's own tone instead of a label and a value. */}
                {draft.kind ? null : (
                  <Alert
                    className="mt-auto"
                    variant={STATUS_ALERT[data.status]}
                  >
                    {STATUS_ICON[data.status]}
                    <AlertTitle>{data.detail}</AlertTitle>
                  </Alert>
                )}
              </FieldGroup>
            </TabsContent>
            <TabsContent value="wiring" className="flex flex-col gap-4">
              {draft.kind ? (
                <WireGroup
                  id="readers"
                  label="Read by"
                  hint="Tasks that read this on every run."
                  wires={wiring.readers}
                  ends={wiring.tasks}
                  onRelink={relink}
                  onRemove={unlink}
                />
              ) : null}
              {draft.kind ? null : (
                <WireGroup
                  id="inputs"
                  hint="Tasks that must finish before this one runs."
                  label="Inputs"
                  wires={wiring.inputs}
                  ends={wiring.tasks}
                  onRelink={relink}
                  onRemove={unlink}
                />
              )}
              {draft.kind ? null : (
                <WireGroup
                  id="outputs"
                  hint="Tasks that wait on this one to finish."
                  label="Outputs"
                  wires={wiring.outputs}
                  ends={wiring.tasks}
                  onRelink={relink}
                  onRemove={unlink}
                />
              )}
              {draft.kind ? null : (
                <WireGroup
                  id="attachments"
                  hint="Connections, tests and models this task reads."
                  label="Attachments"
                  wires={wiring.attachments}
                  ends={wiring.resources}
                  onRelink={relink}
                  onRemove={unlink}
                />
              )}
            </TabsContent>
          </div>
        </Tabs>
        {/* Paired actions match the two sibling flow panels. */}
        <footer className="shrink-0 border-t p-4">
          <div className="grid w-full grid-cols-2 gap-3">
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button disabled={!dirty} onClick={save}>
              Save task
            </Button>
          </div>
        </footer>
      </Card>
    </TooltipProvider>
  )
}

// Below lg the panel rides an overlay sheet; at lg+ it floats over the canvas.
// A 384px panel beside the canvas needs about 1024px before both read well.
const LG_QUERY = "(max-width: 1023px)"

function subscribeBelowLg(onChange: () => void) {
  const query = window.matchMedia(LG_QUERY)

  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

/**
 * The server has no viewport, so this starts on the dock and the first client
 * pass swaps a phone to the sheet; the canvas reads it to know it is docked.
 */
export function useIsBelowLg() {
  return useSyncExternalStore(
    subscribeBelowLg,
    () => window.matchMedia(LG_QUERY).matches,
    () => false
  )
}

/** True once the draft says something the task does not. */
function isDirty(
  draft: TaskDraft,
  data: NonNullable<ReturnType<typeof useRunActions>["data"]>
) {
  return (
    draft.title !== data.title ||
    draft.glyph !== data.glyph ||
    draft.kind !== data.kind ||
    draft.params.some(
      (param, index) => param.value !== data.params[index]?.value
    )
  )
}

export function NodeInspectorPanel() {
  const { close, data, draft, open, openedOnLoad } = useRunActions()
  const belowLg = useIsBelowLg()
  // The panel the run opens on load appears in place, and while untouched it
  // stays a dock instead of becoming a sheet over a narrowed window.
  const quiet = openedOnLoad && (!data || !isDirty(draft, data))
  const panel = <NodePanel />

  return (
    <>
      {/* Floats inset over the canvas rather than resizing it, so only a
          transform moves. Closed, it clears its inset as well as its width. */}
      {belowLg ? null : (
        <div
          role="complementary"
          aria-label="Task details"
          aria-hidden={!open}
          inert={!open}
          data-instant={(open && openedOnLoad) || undefined}
          className={cn(
            "absolute inset-y-4 end-4 z-10 w-96 transition-[translate] duration-300 ease-in-out data-instant:transition-none motion-reduce:transition-none",
            open ? "translate-x-0" : "translate-x-[calc(100%+1rem)]"
          )}
        >
          {panel}
        </div>
      )}

      {/* Mounted closed so the first open still plays the sheet transition.
          The gutter matches the dock's inset, so the card reads the same. */}
      <Sheet
        open={belowLg && open && !quiet}
        onOpenChange={(next) => !next && close()}
      >
        <SheetContent
          side="right"
          initialFocus={false}
          showCloseButton={false}
          className="w-full p-0 sm:max-w-104"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Task Details</SheetTitle>
            <SheetDescription>
              View or edit this pipeline task.
            </SheetDescription>
          </SheetHeader>
          <div className="h-full p-4">{panel}</div>
        </SheetContent>
      </Sheet>
    </>
  )
}