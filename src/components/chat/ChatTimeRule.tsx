import { chatStampBreaks, formatChatDivider } from '@/lib/datetime'

export function ChatTimeRule({
  at,
  previous,
}: {
  at?: string | null
  previous?: string | null
}) {
  if (!chatStampBreaks(previous, at)) return null
  const label = formatChatDivider(at, previous)
  if (!label) return null
  return (
    <div className="flex w-full min-w-0 items-center gap-3 py-2" role="separator">
      <span aria-hidden className="h-px min-w-[1.25rem] flex-1 bg-zinc-300 dark:bg-zinc-600" />
      <time
        dateTime={at ?? undefined}
        className="shrink-0 px-0.5 text-[11px] font-medium leading-none text-zinc-500 dark:text-zinc-400"
      >
        {label}
      </time>
      <span aria-hidden className="h-px min-w-[1.25rem] flex-1 bg-zinc-300 dark:bg-zinc-600" />
    </div>
  )
}
