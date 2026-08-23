"use client"

import * as React from "react"
import { CircleIcon } from "lucide-react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grl:grid grl:gap-3", className)}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "grl:aspect-square grl:size-4 grl:shrink-0 grl:rounded-full grl:border grl:border-input grl:text-primary grl:shadow-xs grl:transition-[color,box-shadow] grl:outline-none grl:focus-visible:border-ring grl:focus-visible:ring-[3px] grl:focus-visible:ring-ring/50 grl:disabled:cursor-not-allowed grl:disabled:opacity-50 grl:aria-invalid:border-destructive grl:aria-invalid:ring-destructive/20 grl:dark:bg-input/30 grl:dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="grl:relative grl:flex grl:items-center grl:justify-center"
      >
        <CircleIcon className="grl:absolute grl:top-1/2 grl:left-1/2 grl:size-2 grl:-translate-x-1/2 grl:-translate-y-1/2 grl:fill-primary" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
