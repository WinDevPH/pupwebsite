import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal, Pencil, Trash2, type LucideIcon } from 'lucide-react'

const MENU_MIN_WIDTH = 168

export type PortalActionItem = {
  id: string
  label: string
  icon?: LucideIcon
  href?: string
  danger?: boolean
  onClick?: () => void
}

type MenuPos = { top: number; left: number }

function computeMenuPos(anchor: DOMRect, itemCount: number): MenuPos {
  const gap = 4
  const estimatedHeight = Math.max(44, itemCount * 40 + 8)
  let top = anchor.bottom + gap
  if (top + estimatedHeight > window.innerHeight - 8) {
    top = Math.max(8, anchor.top - estimatedHeight - gap)
  }
  let left = anchor.right - MENU_MIN_WIDTH
  left = Math.min(left, window.innerWidth - MENU_MIN_WIDTH - 8)
  left = Math.max(8, left)
  return { top, left }
}

/**
 * Row ⋯ menu that portals above overflow-clipped table scrollers and sticky footers.
 */
export function PortalActionMenu({
  open,
  onOpenChange,
  items,
  disabled,
  ariaLabel = 'Row actions',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: PortalActionItem[]
  disabled?: boolean
  ariaLabel?: string
}) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<MenuPos | null>(null)
  const visibleItems = items.filter(Boolean)

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const update = () => {
      const el = buttonRef.current
      if (!el) return
      setPos(computeMenuPos(el.getBoundingClientRect(), visibleItems.length))
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, visibleItems.length])

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={(event) => {
          event.stopPropagation()
          onOpenChange(!open)
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-zinc-500 outline-none transition hover:border-zinc-200/70 hover:bg-white/90 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:opacity-40 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {open && pos
        ? createPortal(
            <>
              <button
                type="button"
                className="fixed inset-0 z-[240] cursor-default"
                aria-label="Close actions"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenChange(false)
                }}
              />
              <div
                role="menu"
                style={{ top: pos.top, left: pos.left, minWidth: MENU_MIN_WIDTH }}
                className="fixed z-[241] overflow-hidden rounded-lg border border-zinc-200/95 bg-white py-1 shadow-lg ring-1 ring-black/[0.04] dark:border-zinc-700 dark:bg-zinc-900 dark:ring-white/[0.04]"
                onClick={(event) => event.stopPropagation()}
              >
                {visibleItems.map((item) => {
                  const Icon = item.icon
                  const className = item.danger
                    ? 'flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-red-800 outline-none transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10'
                    : 'flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-zinc-800 outline-none transition hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800'

                  if (item.href) {
                    return (
                      <a
                        key={item.id}
                        role="menuitem"
                        href={item.href}
                        className={className}
                        onClick={(event) => {
                          event.stopPropagation()
                          onOpenChange(false)
                          item.onClick?.()
                        }}
                      >
                        {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
                        {item.label}
                      </a>
                    )
                  }

                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      className={className}
                      onClick={(event) => {
                        event.stopPropagation()
                        onOpenChange(false)
                        item.onClick?.()
                      }}
                    >
                      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  )
}

export function RegisterRowActions({
  open,
  onOpenChange,
  onEdit,
  onDelete,
  disabled,
  hideDelete = false,
  editLabel = 'Edit',
  deleteLabel = 'Delete',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
  disabled?: boolean
  hideDelete?: boolean
  editLabel?: string
  deleteLabel?: string
}) {
  const items: PortalActionItem[] = [
    { id: 'edit', label: editLabel, icon: Pencil, onClick: onEdit },
    ...(hideDelete
      ? []
      : [{ id: 'delete', label: deleteLabel, icon: Trash2, danger: true, onClick: onDelete }]),
  ]

  return (
    <PortalActionMenu
      open={open}
      onOpenChange={onOpenChange}
      items={items}
      disabled={disabled}
    />
  )
}
