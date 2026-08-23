import * as React from "react"
import { CheckIcon } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "grl:peer grl:size-4 grl:shrink-0 grl:rounded-[4px] grl:border grl:border-input grl:shadow-xs grl:transition-shadow grl:outline-none grl:focus-visible:border-ring grl:focus-visible:ring-[3px] grl:focus-visible:ring-ring/50 grl:disabled:cursor-not-allowed grl:disabled:opacity-50 grl:aria-invalid:border-destructive grl:aria-invalid:ring-destructive/20 grl:data-[state=checked]:border-primary grl:data-[state=checked]:bg-primary grl:data-[state=checked]:text-primary-foreground grl:dark:bg-input/30 grl:dark:aria-invalid:ring-destructive/40 grl:dark:data-[state=checked]:bg-primary",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grl:grid grl:place-content-center grl:text-current grl:transition-none"
      >
        <CheckIcon className="grl:size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
