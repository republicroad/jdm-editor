import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "grl:inline-flex grl:shrink-0 grl:items-center grl:justify-center grl:gap-2 grl:rounded-md grl:text-sm grl:font-medium grl:whitespace-nowrap grl:transition-all grl:outline-none grl:focus-visible:border-ring grl:focus-visible:ring-[3px] grl:focus-visible:ring-ring/50 grl:disabled:pointer-events-none grl:disabled:opacity-50 grl:aria-invalid:border-destructive grl:aria-invalid:ring-destructive/20 grl:dark:aria-invalid:ring-destructive/40 grl:[&_svg]:pointer-events-none grl:[&_svg]:shrink-0 grl:[&_svg:not([class*=size-])]:size-4",
  {
    variants: {
      variant: {
        default: "grl:bg-primary grl:text-primary-foreground grl:hover:bg-primary/90",
        destructive:
          "grl:bg-destructive grl:text-white grl:hover:bg-destructive/90 grl:focus-visible:ring-destructive/20 grl:dark:bg-destructive/60 grl:dark:focus-visible:ring-destructive/40",
        outline:
          "grl:border grl:bg-background grl:shadow-xs grl:hover:bg-accent grl:hover:text-accent-foreground grl:dark:border-input grl:dark:bg-input/30 grl:dark:hover:bg-input/50",
        secondary:
          "grl:bg-secondary grl:text-secondary-foreground grl:hover:bg-secondary/80",
        ghost:
          "grl:hover:bg-accent grl:hover:text-accent-foreground grl:dark:hover:bg-accent/50",
        link: "grl:text-primary grl:underline-offset-4 grl:hover:underline",
      },
      size: {
        default: "grl:h-9 grl:px-4 grl:py-2 grl:has-[>svg]:px-3",
        xs: "grl:h-6 grl:gap-1 grl:rounded-md grl:px-2 grl:text-xs grl:has-[>svg]:px-1.5 grl:[&_svg:not([class*=size-])]:size-3",
        sm: "grl:h-8 grl:gap-1.5 grl:rounded-md grl:px-3 grl:has-[>svg]:px-2.5",
        lg: "grl:h-10 grl:rounded-md grl:px-6 grl:has-[>svg]:px-4",
        icon: "grl:size-9",
        "icon-xs": "grl:size-6 grl:rounded-md grl:[&_svg:not([class*=size-])]:size-3",
        "icon-sm": "grl:size-8",
        "icon-lg": "grl:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
