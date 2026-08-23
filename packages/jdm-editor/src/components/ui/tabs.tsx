"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "grl:group/tabs grl:flex grl:gap-2 grl:data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "grl:group/tabs-list grl:inline-flex grl:w-fit grl:items-center grl:justify-center grl:rounded-lg grl:p-[3px] grl:text-muted-foreground grl:group-data-[orientation=horizontal]/tabs:h-9 grl:group-data-[orientation=vertical]/tabs:h-fit grl:group-data-[orientation=vertical]/tabs:flex-col grl:data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "grl:bg-muted",
        line: "grl:gap-1 grl:bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "grl:relative grl:inline-flex grl:h-[calc(100%-1px)] grl:flex-1 grl:items-center grl:justify-center grl:gap-1.5 grl:rounded-md grl:border grl:border-transparent grl:px-2 grl:py-1 grl:text-sm grl:font-medium grl:whitespace-nowrap grl:text-foreground/60 grl:transition-all grl:group-data-[orientation=vertical]/tabs:w-full grl:group-data-[orientation=vertical]/tabs:justify-start grl:hover:text-foreground grl:focus-visible:border-ring grl:focus-visible:ring-[3px] grl:focus-visible:ring-ring/50 grl:focus-visible:outline-1 grl:focus-visible:outline-ring grl:disabled:pointer-events-none grl:disabled:opacity-50 grl:group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm grl:group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none grl:dark:text-muted-foreground grl:dark:hover:text-foreground grl:[&_svg]:pointer-events-none grl:[&_svg]:shrink-0 grl:[&_svg:not([class*=size-])]:size-4",
        "grl:group-data-[variant=line]/tabs-list:bg-transparent grl:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent grl:dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent grl:dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
        "grl:data-[state=active]:bg-background grl:data-[state=active]:text-foreground grl:dark:data-[state=active]:border-input grl:dark:data-[state=active]:bg-input/30 grl:dark:data-[state=active]:text-foreground",
        "grl:after:absolute grl:after:bg-foreground grl:after:opacity-0 grl:after:transition-opacity grl:group-data-[orientation=horizontal]/tabs:after:inset-x-0 grl:group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] grl:group-data-[orientation=horizontal]/tabs:after:h-0.5 grl:group-data-[orientation=vertical]/tabs:after:inset-y-0 grl:group-data-[orientation=vertical]/tabs:after:-right-1 grl:group-data-[orientation=vertical]/tabs:after:w-0.5 grl:group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("grl:flex-1 grl:outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
