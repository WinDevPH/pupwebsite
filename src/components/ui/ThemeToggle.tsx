import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'

type ThemeToggleProps = {
  className?: string
  /** `ghost`: square tile (admin header). `default`: circular (public nav). */
  variant?: 'default' | 'ghost'
  /** Border around the tile. Use on auth screens; headers/nav stay borderless. */
  bordered?: boolean
}

export function ThemeToggle({
  className = '',
  variant = 'default',
  bordered = false,
}: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  const ghostBordered =
    'group relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200/80 bg-transparent text-zinc-600 shadow-none outline-none ring-0 transition-[color,border-color] duration-200 hover:border-zinc-400/90 hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:border-white/[0.18] dark:bg-transparent dark:text-zinc-300 dark:hover:border-white/35 dark:hover:text-brand-300'
  const ghostBorderless =
    'group relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-0 bg-transparent text-zinc-600 shadow-none outline-none ring-0 transition-colors duration-200 hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:bg-transparent dark:text-zinc-300 dark:hover:text-brand-300'

  const defaultBordered =
    'group relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200/80 bg-transparent text-zinc-700 shadow-none outline-none transition-[color,border-color,transform] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] hover:border-brand-400/85 hover:text-brand-600 hover:scale-[1.03] active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:border-white/[0.18] dark:bg-transparent dark:text-zinc-200 dark:hover:border-brand-400/55 dark:hover:text-brand-300'
  const defaultBorderless =
    'group relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-zinc-700 shadow-none outline-none transition-[color,transform] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] hover:text-brand-600 hover:scale-[1.03] active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:bg-transparent dark:text-zinc-200 dark:hover:text-brand-300'

  const base =
    variant === 'ghost'
      ? bordered
        ? ghostBordered
        : ghostBorderless
      : bordered
        ? defaultBordered
        : defaultBorderless

  const iconSize = variant === 'ghost' ? 'h-[17px] w-[17px]' : 'h-5 w-5'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(base, className)}
    >
      <Sun
        className={cn(
          iconSize,
          'transition-all duration-500 ease-[cubic-bezier(0.33,1,0.68,1)]',
          isDark ? '-rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100',
        )}
      />
      <Moon
        className={cn(
          'absolute',
          iconSize,
          'transition-all duration-500 ease-[cubic-bezier(0.33,1,0.68,1)]',
          isDark ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0',
        )}
      />
    </button>
  )
}
