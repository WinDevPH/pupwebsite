import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function DashboardEmpty({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: { to: string; label: string }
  compact?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300/90 bg-zinc-50/85 text-center dark:border-zinc-700 dark:bg-zinc-900/50',
        compact ? 'px-4 py-6' : 'px-5 py-8',
        className,
      )}
    >
      <Icon
        className={cn(
          'shrink-0 text-brand-600/45',
          compact ? 'mb-3 size-9' : 'mb-4 size-12',
        )}
        strokeWidth={1.35}
        aria-hidden
      />
      <p
        className={cn(
          'font-semibold text-zinc-900 dark:text-zinc-50',
          compact ? 'text-[12.5px]' : 'text-[13px]',
        )}
      >
        {title}
      </p>
      <p
        className={cn(
          'mx-auto mt-1.5 max-w-[16rem] leading-relaxed text-zinc-600 dark:text-zinc-400',
          compact ? 'text-[11.5px]' : 'text-[12px]',
        )}
      >
        {description}
      </p>
      {action ? (
        <Link
          to={action.to}
          className="mt-3 inline-flex h-8 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-[12px] font-semibold text-brand-700 transition hover:border-brand-300 hover:bg-brand-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-brand-300 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  )
}
