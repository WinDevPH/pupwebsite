import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700',
        gold: 'bg-gold-500 text-brand-950 shadow-sm hover:bg-gold-400',
        outline:
          'border border-brand-200 bg-white text-brand-800 hover:border-brand-300 hover:bg-brand-50 dark:border-brand-500/40 dark:bg-zinc-900 dark:text-brand-200 dark:hover:border-brand-400/55 dark:hover:bg-brand-500/15',
        ghost:
          'text-brand-800 hover:bg-brand-50 dark:text-brand-200 dark:hover:bg-brand-500/15',
      },
      size: {
        sm: 'h-9 px-4 text-[13px]',
        default: 'h-10 px-5',
        lg: 'h-11 px-6 text-[15px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
})
