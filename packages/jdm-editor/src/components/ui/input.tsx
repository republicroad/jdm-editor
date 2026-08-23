import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "grl:h-9 grl:w-full grl:min-w-0 grl:rounded-md grl:border grl:border-input grl:bg-transparent grl:px-3 grl:py-1 grl:text-base grl:shadow-xs grl:transition-[color,box-shadow] grl:outline-none grl:selection:bg-primary grl:selection:text-primary-foreground grl:file:inline-flex grl:file:h-7 grl:file:border-0 grl:file:bg-transparent grl:file:text-sm grl:file:font-medium grl:file:text-foreground grl:placeholder:text-muted-foreground grl:disabled:pointer-events-none grl:disabled:cursor-not-allowed grl:disabled:opacity-50 grl:md:text-sm grl:dark:bg-input/30",
        "grl:focus-visible:border-ring grl:focus-visible:ring-[3px] grl:focus-visible:ring-ring/50",
        "grl:aria-invalid:border-destructive grl:aria-invalid:ring-destructive/20 grl:dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
