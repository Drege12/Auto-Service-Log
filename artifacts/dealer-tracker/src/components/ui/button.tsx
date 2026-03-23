import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "destructive" | "ghost" | "status";
  statusColor?: "pass" | "fail" | "pending" | "na";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", statusColor, ...props }, ref) => {
    
    const baseStyles = "inline-flex items-center justify-center whitespace-nowrap font-bold transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 tap-target border-2 border-black";
    
    const variants = {
      default: "bg-primary text-primary-foreground shadow-brutal hover-brutal active-brutal",
      outline: "bg-background text-foreground shadow-brutal hover-brutal active-brutal",
      destructive: "bg-[hsl(var(--color-destructive))] text-[hsl(var(--color-destructive-foreground))] shadow-brutal hover-brutal active-brutal",
      ghost: "border-transparent hover:bg-secondary",
      status: "shadow-brutal-sm active-brutal",
    };

    const statusColors = {
      pass: "bg-[hsl(var(--color-success))] text-[hsl(var(--color-success-foreground))]",
      fail: "bg-[hsl(var(--color-destructive))] text-[hsl(var(--color-destructive-foreground))]",
      pending: "bg-[hsl(var(--color-warning))] text-[hsl(var(--color-warning-foreground))]",
      na: "bg-secondary text-secondary-foreground",
    };

    const sizes = {
      default: "h-12 px-6 py-2 text-lg",
      sm: "h-10 px-4 text-base",
      lg: "h-16 px-8 text-xl",
      icon: "h-12 w-12",
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          variant === "status" && statusColor && statusColors[statusColor],
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export function buttonVariants({ variant = "default", size = "default" }: { variant?: string; size?: string } = {}) {
  const baseStyles = "inline-flex items-center justify-center whitespace-nowrap font-bold transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 tap-target border-2 border-black";
  const variantMap: Record<string, string> = {
    default: "bg-primary text-primary-foreground shadow-brutal hover-brutal active-brutal",
    outline: "bg-background text-foreground shadow-brutal hover-brutal active-brutal",
    destructive: "bg-[hsl(var(--color-destructive))] text-[hsl(var(--color-destructive-foreground))] shadow-brutal hover-brutal active-brutal",
    ghost: "border-transparent hover:bg-secondary",
  };
  const sizeMap: Record<string, string> = {
    default: "h-12 px-6 py-2 text-lg",
    sm: "h-10 px-4 text-base",
    lg: "h-16 px-8 text-xl",
    icon: "h-12 w-12",
  };
  return cn(baseStyles, variantMap[variant] ?? variantMap.default, sizeMap[size] ?? sizeMap.default);
}

export { Button }
