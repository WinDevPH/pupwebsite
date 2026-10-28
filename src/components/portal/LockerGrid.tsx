import { Link } from 'react-router-dom'
import {
  LOCKER_COLS,
  LOCKER_RATES,
  LOCKER_ROWS,
  lockerCode,
  lockerCodeFromItem,
  type ShopItem,
} from '@/components/portal/catalog'
import { lockerGuidelinesUrl } from '@/components/layout/nav-data'
import { formatPhLongDate } from '@/lib/datetime'
import { cn } from '@/lib/utils'

function pesos(value: number) {
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function isAssigned(item: ShopItem | undefined) {
  if (!item) return false
  return item.availability === 'reserved' || item.availability === 'out' || item.stock === 0
}

export function LockerGrid({ items, asOf }: { items: ShopItem[]; asOf?: string | Date | null }) {
  const byCode = new Map<string, ShopItem>()
  for (const item of items) {
    const code = lockerCodeFromItem(item)
    if (code) byCode.set(code, item)
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
      <header className="text-center">
        <h1
          id="locker-page-title"
          className="font-hero text-[clamp(2.1rem,1.2rem+3.2vw,3.6rem)] leading-none tracking-[0.04em] text-brand-950 uppercase"
        >
          Locker Availability
        </h1>
        <p className="mt-2 text-sm text-brand-700 sm:text-base">
          As of {formatPhLongDate(asOf ?? new Date())}
        </p>
      </header>

      <div className="mt-8 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto min-w-[40rem] sm:min-w-0">
          <div className="grid grid-cols-12 gap-x-1 gap-y-3 sm:gap-x-2 sm:gap-y-4">
            {LOCKER_ROWS.flatMap((row) =>
              Array.from({ length: LOCKER_COLS }, (_, index) => {
                const col = index + 1
                const code = lockerCode(row, col)
                const item = byCode.get(code)
                const assigned = isAssigned(item)
                const label = code
                const className = cn(
                  'flex h-9 items-center justify-center text-[11px] font-semibold tracking-wide sm:h-10 sm:text-sm',
                  assigned
                    ? 'bg-brand-700 text-white'
                    : 'text-brand-950',
                )

                if (assigned || !item) {
                  return (
                    <span
                      key={code}
                      className={className}
                      aria-label={assigned ? `${label} assigned` : `${label} unavailable`}
                    >
                      {label}
                    </span>
                  )
                }

                return (
                  <Link
                    key={code}
                    to={`/portal/reserve/locker/${item.id}`}
                    className={cn(className, 'rounded-sm transition-colors hover:bg-brand-50')}
                    aria-label={`Reserve locker ${label}`}
                  >
                    {label}
                  </Link>
                )
              }),
            )}
          </div>
        </div>
      </div>

      <ul className="mt-10 flex flex-wrap items-center justify-center gap-8 text-sm font-semibold tracking-wide text-brand-950 uppercase">
        <li className="inline-flex items-center gap-2.5">
          <span className="size-3.5 bg-brand-700" aria-hidden />
          Assigned
        </li>
        <li className="inline-flex items-center gap-2.5">
          <span className="size-3.5 border border-brand-200 bg-white" aria-hidden />
          Unassigned
        </li>
      </ul>

      <section className="mt-14" aria-labelledby="locker-rates-title">
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
          <table className="mx-auto w-full max-w-3xl min-w-[32rem] border-collapse text-left text-sm">
            <caption className="sr-only">Official locker rental rates by transaction and row</caption>
            <thead>
              <tr className="bg-brand-700 text-white">
                <th scope="col" className="px-4 py-3 font-semibold">
                  Transaction
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Locker location
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Fee per rental period
                </th>
              </tr>
            </thead>
            <tbody>
              {LOCKER_RATES.map((row) => (
                <tr
                  key={`${row.transaction}-${row.location}`}
                  className="border-b border-brand-100 text-brand-950"
                >
                  <td className="px-4 py-3 font-semibold">{row.transaction}</td>
                  <td className="px-4 py-3">{row.location}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{pesos(row.fee)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-5 text-center text-sm">
          <a
            href={lockerGuidelinesUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand-700 underline-offset-2 hover:underline"
          >
            Locker Guidelines
          </a>
        </p>
      </section>
    </div>
  )
}
