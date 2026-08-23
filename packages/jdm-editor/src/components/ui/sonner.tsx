"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="grl:toaster grl:group"
      icons={{
        success: <CircleCheckIcon className="grl:size-4" />,
        info: <InfoIcon className="grl:size-4" />,
        warning: <TriangleAlertIcon className="grl:size-4" />,
        error: <OctagonXIcon className="grl:size-4" />,
        loading: <Loader2Icon className="grl:size-4 grl:animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
