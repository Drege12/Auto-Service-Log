import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-black bg-primary text-primary-foreground",
    secondary: "border-black bg-secondary text-secondary-foreground",
    destructive: "border-black bg-[hsl(var(--color-destructive))] text-[hsl(var(--color-destructive-foreground))]",
    outline: "border-black text-foreground",
    success: "border-black bg-[hsl(var(--color-success))] text-[hsl(var(--color-success-foreground))]",
    warning: "border-black bg-[hsl(var(--color-warning))] text-[hsl(var(--color-warning-foreground))]",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center border-2 px-3 py-1 text-sm font-bold uppercase tracking-wider shadow-brutal-sm",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
