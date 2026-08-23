import * as React from "react"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import { Select as SelectPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "grl:flex grl:w-fit grl:items-center grl:justify-between grl:gap-2 grl:rounded-md grl:border grl:border-input grl:bg-transparent grl:px-3 grl:py-2 grl:text-sm grl:whitespace-nowrap grl:shadow-xs grl:transition-[color,box-shadow] grl:outline-none grl:focus-visible:border-ring grl:focus-visible:ring-[3px] grl:focus-visible:ring-ring/50 grl:disabled:cursor-not-allowed grl:disabled:opacity-50 grl:aria-invalid:border-destructive grl:aria-invalid:ring-destructive/20 grl:data-[placeholder]:text-muted-foreground grl:data-[size=default]:h-9 grl:data-[size=sm]:h-8 grl:*:data-[slot=select-value]:line-clamp-1 grl:*:data-[slot=select-value]:flex grl:*:data-[slot=select-value]:items-center grl:*:data-[slot=select-value]:gap-2 grl:dark:bg-input/30 grl:dark:hover:bg-input/50 grl:dark:aria-invalid:ring-destructive/40 grl:[&_svg]:pointer-events-none grl:[&_svg]:shrink-0 grl:[&_svg:not([class*=size-])]:size-4 grl:[&_svg:not([class*=text-])]:text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="grl:size-4 grl:opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = "item-aligned",
  align = "center",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          "grl:relative grl:z-50 grl:max-h-(--radix-select-content-available-height) grl:min-w-[8rem] grl:origin-(--radix-select-content-transform-origin) grl:overflow-x-hidden grl:overflow-y-auto grl:rounded-md grl:border grl:bg-popover grl:text-popover-foreground grl:shadow-md grl:data-[side=bottom]:slide-in-from-top-2 grl:data-[side=left]:slide-in-from-right-2 grl:data-[side=right]:slide-in-from-left-2 grl:data-[side=top]:slide-in-from-bottom-2 grl:data-[state=closed]:animate-out grl:data-[state=closed]:fade-out-0 grl:data-[state=closed]:zoom-out-95 grl:data-[state=open]:animate-in grl:data-[state=open]:fade-in-0 grl:data-[state=open]:zoom-in-95",
          position === "popper" &&
            "grl:data-[side=bottom]:translate-y-1 grl:data-[side=left]:-translate-x-1 grl:data-[side=right]:translate-x-1 grl:data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        align={align}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "grl:p-1",
            position === "popper" &&
              "grl:h-[var(--radix-select-trigger-height)] grl:w-full grl:min-w-[var(--radix-select-trigger-width)] grl:scroll-my-1"
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("grl:px-2 grl:py-1.5 grl:text-xs grl:text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "grl:relative grl:flex grl:w-full grl:cursor-default grl:items-center grl:gap-2 grl:rounded-sm grl:py-1.5 grl:pr-8 grl:pl-2 grl:text-sm grl:outline-hidden grl:select-none grl:focus:bg-accent grl:focus:text-accent-foreground grl:data-[disabled]:pointer-events-none grl:data-[disabled]:opacity-50 grl:[&_svg]:pointer-events-none grl:[&_svg]:shrink-0 grl:[&_svg:not([class*=size-])]:size-4 grl:[&_svg:not([class*=text-])]:text-muted-foreground grl:*:[span]:last:flex grl:*:[span]:last:items-center grl:*:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <span
        data-slot="select-item-indicator"
        className="grl:absolute grl:right-2 grl:flex grl:size-3.5 grl:items-center grl:justify-center"
      >
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="grl:size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("grl:pointer-events-none grl:-mx-1 grl:my-1 grl:h-px grl:bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "grl:flex grl:cursor-default grl:items-center grl:justify-center grl:py-1",
        className
      )}
      {...props}
    >
      <ChevronUpIcon className="grl:size-4" />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "grl:flex grl:cursor-default grl:items-center grl:justify-center grl:py-1",
        className
      )}
      {...props}
    >
      <ChevronDownIcon className="grl:size-4" />
    </SelectPrimitive.ScrollDownButton>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
