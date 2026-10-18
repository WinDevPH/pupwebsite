import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { catalogInput } from '@/components/portal/register-ui'
import { cn } from '@/lib/utils'

export type CatalogSelectOption = {
  value: string
  label: string
  description?: string
  disabled?: boolean
  /** Optional leading glyph (e.g. Lucide icon) shown in the trigger and list. */
  icon?: ReactNode
}

type CatalogSelectProps = {
  id?: string
  value: string
  options: CatalogSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  'aria-label'?: string
  className?: string
  /** Compact control for toolbars */
  size?: 'default' | 'compact'
  leading?: ReactNode
}

type ListPos = {
  top: number
  left: number
  width: number
  maxHeight: number
  placement: 'bottom' | 'top'
}

const LIST_GAP = 6
const LIST_VIEWPORT_PAD = 8
const LIST_MAX_CAP = 288 // 18rem

function computeListPos(anchor: DOMRect): ListPos {
  const width = Math.max(anchor.width, 11 * 16)
  const spaceBelow = window.innerHeight - anchor.bottom - LIST_VIEWPORT_PAD
  const spaceAbove = anchor.top - LIST_VIEWPORT_PAD
  const preferBottom = spaceBelow >= Math.min(10 * 16, spaceAbove) || spaceBelow >= spaceAbove
  const available = preferBottom ? spaceBelow : spaceAbove
  const maxHeight = Math.max(8 * 16, Math.min(LIST_MAX_CAP, available - LIST_GAP))

  let left = anchor.left
  left = Math.min(left, window.innerWidth - width - LIST_VIEWPORT_PAD)
  left = Math.max(LIST_VIEWPORT_PAD, left)

  if (preferBottom) {
    return {
      top: anchor.bottom + LIST_GAP,
      left,
      width,
      maxHeight,
      placement: 'bottom',
    }
  }

  return {
    top: Math.max(LIST_VIEWPORT_PAD, anchor.top - LIST_GAP - maxHeight),
    left,
    width,
    maxHeight,
    placement: 'top',
  }
}

export function CatalogSelect({
  id,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  required = false,
  'aria-label': ariaLabel,
  className,
  size = 'default',
  leading,
}: CatalogSelectProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<ListPos | null>(null)
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )
  const [active, setActive] = useState(selectedIndex)

  const selected = options.find((option) => option.value === value)

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const update = () => {
      const el = buttonRef.current
      if (!el) return
      setPos(computeListPos(el.getBoundingClientRect()))
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    setActive(selectedIndex)
  }, [open, selectedIndex])

  useEffect(() => {
    if (!open) return
    const list = listRef.current
    if (!list) return
    const option =
      list.querySelectorAll<HTMLElement>('[role="option"]')[active] ??
      list.querySelector<HTMLElement>('[aria-selected="true"]')
    option?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  function choose(next: string) {
    onChange(next)
    setOpen(false)
  }

  function openList(index?: number) {
    if (disabled || options.length === 0) return
    setActive(typeof index === 'number' ? index : selectedIndex)
    setOpen(true)
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        openList(event.key === 'ArrowUp' ? options.length - 1 : 0)
        return
      }
      setActive((current) => {
        const step = event.key === 'ArrowDown' ? 1 : -1
        let next = current
        for (let i = 0; i < options.length; i += 1) {
          next = (next + step + options.length) % options.length
          if (!options[next]?.disabled) return next
        }
        return current
      })
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!open) openList()
      else if (options[active] && !options[active].disabled) choose(options[active].value)
    } else if (event.key === 'Escape') {
      setOpen(false)
    } else if (event.key === 'Home' && open) {
      event.preventDefault()
      setActive(0)
    } else if (event.key === 'End' && open) {
      event.preventDefault()
      setActive(options.length - 1)
    }
  }

  const listStyle: CSSProperties | undefined = pos
    ? {
        top: pos.top,
        left: pos.left,
        width: pos.width,
        maxHeight: pos.maxHeight,
      }
    : undefined

  return (
    <div ref={rootRef} className={cn('relative w-full min-w-0', className)}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={cn(
          catalogInput,
          'flex items-center gap-2 text-left',
          leading || selected?.icon ? 'pl-9' : null,
          'pr-9',
          size === 'compact' && 'h-9 max-w-none text-[12px] font-semibold',
          open &&
            'border-brand-500 ring-[3px] ring-brand-500/18 dark:border-brand-400 dark:ring-brand-400/22',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        {leading ? (
          <span className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-zinc-400">
            {leading}
          </span>
        ) : selected?.icon ? (
          <span className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-brand-700 dark:text-brand-300">
            {selected.icon}
          </span>
        ) : null}
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            selected ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500',
          )}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            'pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-zinc-400 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && pos
        ? createPortal(
            <>
              <button
                type="button"
                className="fixed inset-0 z-[90] cursor-default"
                aria-label="Close options"
                onClick={() => setOpen(false)}
              />
              <ul
                ref={listRef}
                id={listId}
                role="listbox"
                aria-label={ariaLabel || 'Options'}
                data-lenis-prevent
                tabIndex={-1}
                style={listStyle}
                className={cn(
                  'fixed z-[91] overflow-y-auto overscroll-contain rounded-xl border border-zinc-200 bg-white p-1 shadow-[0_18px_40px_-24px_rgba(30,5,65,0.45)] [-ms-overflow-style:none] [scrollbar-width:none] dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-black/40 [&::-webkit-scrollbar]:hidden',
                  size === 'compact' && 'min-w-[11rem]',
                )}
                onWheel={(event) => {
                  event.stopPropagation()
                }}
              >
                {options.map((option, index) => {
                  const isSelected = option.value === value
                  const isActive = index === active
                  return (
                    <li key={option.value} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={option.disabled}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => {
                          if (!option.disabled) choose(option.value)
                        }}
                        className={cn(
                          'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] outline-none transition',
                          option.disabled && 'cursor-not-allowed opacity-40',
                          isActive && !option.disabled
                            ? 'bg-brand-50 text-brand-900 dark:bg-brand-500/15 dark:text-brand-100'
                            : 'text-zinc-800 dark:text-zinc-100',
                          isSelected && 'font-semibold',
                        )}
                      >
                        <span className="flex min-w-0 items-start gap-2.5">
                          {option.icon ? (
                            <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center text-brand-700 dark:text-brand-300">
                              {option.icon}
                            </span>
                          ) : null}
                          <span className="min-w-0">
                            <span className="block truncate">{option.label}</span>
                            {option.description ? (
                              <span className="mt-0.5 block truncate text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                                {option.description}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        {isSelected ? (
                          <Check
                            className="size-3.5 shrink-0 text-brand-700 dark:text-brand-300"
                            aria-hidden
                          />
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>,
            document.body,
          )
        : null}
    </div>
  )
}
