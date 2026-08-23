import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "grl:peer grl:group/switch grl:inline-flex grl:shrink-0 grl:items-center grl:rounded-full grl:border grl:border-transparent grl:shadow-xs grl:transition-all grl:outline-none grl:focus-visible:border-ring grl:focus-visible:ring-[3px] grl:focus-visible:ring-ring/50 grl:disabled:cursor-not-allowed grl:disabled:opacity-50 grl:data-[size=default]:h-[1.15rem] grl:data-[size=default]:w-8 grl:data-[size=sm]:h-3.5 grl:data-[size=sm]:w-6 grl:data-[state=checked]:bg-primary grl:data-[state=unchecked]:bg-input grl:dark:data-[state=unchecked]:bg-input/80",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "grl:pointer-events-none grl:block grl:rounded-full grl:bg-background grl:ring-0 grl:transition-transform grl:group-data-[size=default]/switch:size-4 grl:group-data-[size=sm]/switch:size-3 grl:data-[state=checked]:translate-x-[calc(100%-2px)] grl:data-[state=unchecked]:translate-x-0 grl:dark:data-[state=checked]:bg-primary-foreground grl:dark:data-[state=unchecked]:bg-foreground"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
