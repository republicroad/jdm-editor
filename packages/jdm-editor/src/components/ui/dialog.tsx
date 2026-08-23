"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "grl:fixed grl:inset-0 grl:z-50 grl:bg-black/50 grl:data-[state=closed]:animate-out grl:data-[state=closed]:fade-out-0 grl:data-[state=open]:animate-in grl:data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "grl:fixed grl:top-[50%] grl:left-[50%] grl:z-50 grl:grid grl:w-full grl:max-w-[calc(100%-2rem)] grl:translate-x-[-50%] grl:translate-y-[-50%] grl:gap-4 grl:rounded-lg grl:border grl:bg-background grl:p-6 grl:shadow-lg grl:duration-200 grl:outline-none grl:data-[state=closed]:animate-out grl:data-[state=closed]:fade-out-0 grl:data-[state=closed]:zoom-out-95 grl:data-[state=open]:animate-in grl:data-[state=open]:fade-in-0 grl:data-[state=open]:zoom-in-95 grl:sm:max-w-lg",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="grl:absolute grl:top-4 grl:right-4 grl:rounded-xs grl:opacity-70 grl:ring-offset-background grl:transition-opacity grl:hover:opacity-100 grl:focus:ring-2 grl:focus:ring-ring grl:focus:ring-offset-2 grl:focus:outline-hidden grl:disabled:pointer-events-none grl:data-[state=open]:bg-accent grl:data-[state=open]:text-muted-foreground grl:[&_svg]:pointer-events-none grl:[&_svg]:shrink-0 grl:[&_svg:not([class*=size-])]:size-4"
          >
            <XIcon />
            <span className="grl:sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("grl:flex grl:flex-col grl:gap-2 grl:text-center grl:sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "grl:flex grl:flex-col-reverse grl:gap-2 grl:sm:flex-row grl:sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("grl:text-lg grl:leading-none grl:font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("grl:text-sm grl:text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
