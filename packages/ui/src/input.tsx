import { ComponentProps } from 'react'

import { cn } from './utils'

function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/20 border-input flex h-11 w-full min-w-0 rounded-lg border-2 bg-background/60 backdrop-blur-sm px-4 py-2 text-base shadow-md transition-all duration-200 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-primary focus-visible:ring-primary/20 focus-visible:ring-[4px] focus-visible:shadow-lg',
        'hover:border-primary/40 hover:shadow-lg',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className
      )}
      {...props}
    />
  )
}

export { Input }
