import { ComponentProps } from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-95",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:from-primary/95 hover:to-primary/85 border border-primary/20",
        destructive:
          "bg-gradient-to-r from-destructive to-destructive/90 text-white shadow-lg shadow-destructive/25 hover:shadow-xl hover:shadow-destructive/30 hover:from-destructive/95 hover:to-destructive/85 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 border border-destructive/20",
        outline:
          "border-2 bg-background/60 backdrop-blur-sm shadow-md hover:bg-accent hover:text-accent-foreground hover:border-primary/40 dark:bg-input/20 dark:border-input dark:hover:bg-input/40",
        secondary:
          "bg-gradient-to-r from-secondary to-secondary/90 text-secondary-foreground shadow-lg shadow-secondary/20 hover:shadow-xl hover:shadow-secondary/25 hover:from-secondary/95 hover:to-secondary/85 border border-secondary/20",
        ghost:
          "hover:bg-accent/80 hover:text-accent-foreground dark:hover:bg-accent/40 backdrop-blur-sm",
        link: "text-primary underline-offset-4 hover:underline font-medium",
      },
      size: {
        default: "h-10 px-5 py-2.5 has-[>svg]:px-4",
        sm: "h-9 rounded-lg gap-1.5 px-4 has-[>svg]:px-3",
        lg: "h-11 rounded-lg px-7 has-[>svg]:px-5 text-base",
        icon: "size-10",
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
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
