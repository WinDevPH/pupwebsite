import { Link } from 'react-router-dom'
import {
  LOCKER_COLS,
  LOCKER_RATES,
  LOCKER_ROWS,
  lockerCode,
  lockerCodeFromItem,
} from '@/components/portal/catalog'
import { formatPhLongDate } from '@/lib/datetime'
import { cn } from '@/lib/utils'

function pesos(value: number) {
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export type LockerBayItem = {
  id: string | number
  name: string
  number?: string | null
  availability?: string | null
  stock?: number
}

function isAssigned(item: LockerBayItem | undefined) {
  if (!item) return false
  return item.availability === 'reserved' || item.availability === 'out' || item.stock === 0
}

export function LockerGrid({
  items,
  asOf,
  variant = 'page',
  selectedCode,
  query = '',
  disabled = false,
  onSelect,
}: {
  items: LockerBayItem[]
  asOf?: string | Date | null
  variant?: 'page' | 'picker'
  selectedCode?: string
  query?: string
  disabled?: boolean
  onSelect?: (item: LockerBayItem, code: string) => void
}) {
  const picker = variant === 'picker'
  const needle = query.trim().toLowerCase()
  const byCode = new Map<string, LockerBayItem>()
  for (const item of items) {
    const code = lockerCodeFromItem(item)
    if (code) byCode.set(code, item)
  }

  function cell(row: string, col: number, compact: boolean) {
    const code = lockerCode(row, col)
    const item = byCode.get(code)
    const assigned = isAssigned(item)
    const selected = Boolean(selectedCode && selectedCode === code)
    const dimmed = Boolean(needle && !code.toLowerCase().includes(needle) && !selected)
    const className = cn(
      '-mb-px -mr-px flex items-center justify-center border border-brand-800 font-semibold tracking-wide dark:border-brand-500/70',
      compact ? 'h-12 text-xs' : 'h-14 text-sm lg:h-16 lg:text-base',
      assigned && !selected
        ? 'bg-brand-700 text-white'
        : selected
          ? 'relative z-[1] bg-brand-50 text-brand-950 ring-2 ring-inset ring-brand-600 dark:bg-brand-500/20 dark:text-white dark:ring-brand-300'
          : 'bg-white text-brand-950 dark:bg-zinc-950 dark:text-zinc-50',
      dimmed && 'opacity-35',
    )

    if (picker) {
      const canPick = Boolean(item) && !disabled
      if (canPick && item) {
        return (
          <button
            key={code}
            type="button"
            disabled={disabled}
            onClick={() => onSelect?.(item, code)}
            aria-pressed={selected}
            aria-label={selected ? `${code} selected` : `Select locker ${code}`}
            className={cn(className, 'transition-colors hover:bg-brand-50 dark:hover:bg-brand-500/15')}
          >
            {code}
          </button>
        )
      }
      return (
        <span
          key={code}
          className={className}
          aria-label={assigned ? `${code} assigned` : `${code} unavailable`}
        >
          {code}
        </span>
      )
    }

    if (assigned || !item) {
      return (
        <span
          key={code}
          className={className}
          aria-label={assigned ? `${code} assigned` : `${code} unavailable`}
        >
          {code}
        </span>
      )
    }

    return (
      <Link
        key={code}
        to={`/portal/reserve/locker/${item.id}`}
        className={cn(className, 'transition-colors hover:bg-brand-50')}
        aria-label={`Reserve locker ${code}`}
      >
        {code}
      </Link>
    )
  }

  const bay = (
    <>
      <div className={cn('grid gap-5 sm:hidden', picker ? 'mt-3' : 'mt-6')}>
        {LOCKER_ROWS.map((row) => (
          <section key={row} aria-label={`Row ${row}`}>
            <p className="mb-2 text-center text-sm font-bold tracking-[0.14em] text-brand-800 dark:text-brand-300">
              ROW {row}
            </p>
            <div className="grid grid-cols-3 overflow-hidden border border-brand-800 dark:border-brand-500/70">
              {Array.from({ length: LOCKER_COLS }, (_, index) => cell(row, index + 1, true))}
            </div>
          </section>
        ))}
      </div>

      <div className={cn('hidden min-w-0 sm:block', picker ? 'mt-3' : 'mt-8')}>
        <div className="grid grid-cols-[2.75rem_repeat(12,minmax(0,1fr))] overflow-hidden border border-brand-800 dark:border-brand-500/70">
          {LOCKER_ROWS.flatMap((row) => [
            <div
              key={`${row}-label`}
              className="-mb-px -mr-px flex h-14 items-center justify-center border border-brand-800 bg-brand-50 text-base font-bold text-brand-800 lg:h-16 dark:border-brand-500/70 dark:bg-brand-500/15 dark:text-brand-200"
              aria-hidden
            >
              {row}
            </div>,
            ...Array.from({ length: LOCKER_COLS }, (_, index) => cell(row, index + 1, false)),
          ])}
        </div>
      </div>

      <ul
        className={cn(
          'flex flex-wrap items-center justify-center gap-5 text-xs font-semibold tracking-wide text-brand-950 uppercase sm:gap-8 sm:text-sm dark:text-zinc-100',
          picker ? 'mt-4' : 'mt-6 sm:mt-10',
        )}
      >
        <li className="inline-flex items-center gap-2.5">
          <span className="size-3.5 bg-brand-700" aria-hidden />
          Assigned
        </li>
        <li className="inline-flex items-center gap-2.5">
          <span className="size-3.5 border border-brand-200 bg-white dark:border-zinc-600 dark:bg-zinc-950" aria-hidden />
          Unassigned
        </li>
        {picker ? (
          <li className="inline-flex items-center gap-2.5">
            <span className="size-3.5 border-2 border-brand-600 bg-brand-50 dark:bg-brand-500/20" aria-hidden />
            Selected
          </li>
        ) : null}
      </ul>
    </>
  )

  if (picker) {
    return (
      <div className="w-full min-w-0" aria-label="Locker availability">
        {bay}
      </div>
    )
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8">
      <p className="text-center text-sm text-brand-700 sm:text-base">
        As of {formatPhLongDate(asOf ?? new Date())}
      </p>

      {bay}

      <section className="mt-10 sm:mt-14" aria-labelledby="locker-rates-title">
        <h2
          id="locker-rates-title"
          className="text-center font-hero text-xl tracking-[0.04em] text-brand-950 uppercase sm:text-2xl"
        >
          Rental rates and payment
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm leading-6 text-brand-700">
          The following rates apply per locker for the rental period stated in the official announcement
          or assignment confirmation.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="mx-auto w-full max-w-3xl border-collapse text-left text-[12px] sm:text-sm">
            <caption className="sr-only">Official locker rental rates by transaction and row</caption>
            <thead>
              <tr className="bg-brand-700 text-white">
                <th scope="col" className="px-2.5 py-2.5 font-semibold sm:px-4 sm:py-3">
                  Transaction
                </th>
                <th scope="col" className="px-2.5 py-2.5 font-semibold sm:px-4 sm:py-3">
                  Locker location
                </th>
                <th scope="col" className="px-2.5 py-2.5 text-right font-semibold sm:px-4 sm:py-3">
                  <span className="sm:hidden">Fee</span>
                  <span className="hidden sm:inline">Fee per rental period</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {LOCKER_RATES.map((row) => (
                <tr
                  key={`${row.transaction}-${row.location}`}
                  className="border-b border-brand-100 text-brand-950"
                >
                  <td className="px-2.5 py-2.5 font-semibold sm:px-4 sm:py-3">{row.transaction}</td>
                  <td className="px-2.5 py-2.5 leading-5 sm:px-4 sm:py-3">{row.location}</td>
                  <td className="px-2.5 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap sm:px-4 sm:py-3">
                    {pesos(row.fee)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
