import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  cn(
    // Base
    "inline-flex items-center justify-center gap-2",
    "whitespace-nowrap rounded-md text-sm font-medium",
    // Transition
    "transition-colors",
    // Focus
    "focus-visible:outline-none focus-visible:ring-1",
    "focus-visible:ring-ring",
    // Disabled
    "disabled:pointer-events-none disabled:opacity-50",
    // Icon sizing
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
  ),
  {
    variants: {
      variant: {
        default: cn(
          // Background
          "bg-primary text-primary-foreground",
          // Shadow
          "shadow",
          // Hover
          "hover:bg-primary/90"
        ),
        destructive: cn(
          // Background
          "bg-destructive text-destructive-foreground",
          // Shadow
          "shadow-sm",
          // Hover
          "hover:bg-destructive/90"
        ),
        outline: cn(
          // Border
          "border border-input",
          // Background
          "bg-background",
          // Shadow
          "shadow-sm",
          // Hover
          "hover:bg-accent hover:text-accent-foreground"
        ),
        secondary: cn(
          // Background
          "bg-secondary text-secondary-foreground",
          // Shadow
          "shadow-sm",
          // Hover
          "hover:bg-secondary/80"
        ),
        ghost: cn(
          // Hover
          "hover:bg-accent hover:text-accent-foreground"
        ),
        link: cn(
          // Text
          "text-primary underline-offset-4",
          // Hover
          "hover:underline"
        ),
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        xl: "h-12 rounded-lg px-10 text-base font-semibold",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
