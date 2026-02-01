import { ComponentProps } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from './utils'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-lg border px-2.5 py-1 text-xs font-semibold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-all duration-200 overflow-hidden backdrop-blur-sm',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md shadow-primary/20 [a&]:hover:shadow-lg [a&]:hover:shadow-primary/25 [a&]:hover:scale-105',
        secondary:
          'border-transparent bg-gradient-to-r from-secondary to-secondary/90 text-secondary-foreground shadow-md shadow-secondary/15 [a&]:hover:shadow-lg [a&]:hover:shadow-secondary/20 [a&]:hover:scale-105',
        destructive:
          'border-transparent bg-gradient-to-r from-destructive to-destructive/90 text-white shadow-md shadow-destructive/20 [a&]:hover:shadow-lg [a&]:hover:shadow-destructive/25 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 [a&]:hover:scale-105',
        outline:
          'text-foreground border-2 bg-background/60 [a&]:hover:bg-accent/80 [a&]:hover:text-accent-foreground [a&]:hover:border-primary/40 [a&]:hover:scale-105 shadow-sm'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'

  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge }
