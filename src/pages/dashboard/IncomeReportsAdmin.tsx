import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bookmark,
  ChartColumn,
  Download,
  Layers,
  Loader2,
  Lock,
  RefreshCw,
  RotateCcw,
  Search,
  SearchX,
  Shirt,
  ShoppingBag,
  Wallet,
} from 'lucide-react'
import { DashboardEmpty } from '@/components/dashboard/DashboardEmpty'
import { IncomeBarChart } from '@/components/dashboard/IncomeBarChart'
import { RequireLoginRedirect } from '@/components/portal/RequireLoginRedirect'
import {
  catalogInput,
  catalogSegIcon,
  catalogToolbarIconBtn,
  workspaceCatalogPadCls,
  workspaceCatalogSegTrackInlineCls,
  workspaceCatalogShellCls,
  workspaceCatalogToolbarActionsRowCls,
  workspaceCatalogToolbarDividerCls,
  workspaceCatalogToolbarIconCls,
  workspaceCatalogToolbarMainRowCls,
  workspaceCatalogToolbarSearchFieldCls,
  workspaceCatalogToolbarSearchRowCls,
  workspaceRegisterTableCls,
  workspaceRegisterTbodyRowCls,
  workspaceRegisterThSortCellCls,
  workspaceRegisterTheadCls,
  workspaceTenantMainStackCls,
} from '@/components/portal/register-ui'
import { HorizontalDragScrollTableWrap } from '@/components/portal/HorizontalDragScrollTableWrap'
import { THEME_CHART } from '@/lib/dashboard-stats'
import { formatPhDate } from '@/lib/datetime'
import {
  DEFAULT_INCOME_FILTERS,
  INCOME_BASES,
  INCOME_BASIS_STATUSES,
  INCOME_PERIODS,
  buildIncomeKpis,
  buildIncomeSeries,
  buildIncomeStatusSlices,
  buildIncomeTopItems,
  filterIncomeReservations,
  filtersAreDefault,
  incomeCsv,
  pesosCompact,
  type IncomeBasisId,
  type IncomeFilters,
  type IncomePeriodId,
  type IncomeShopFilter,
} from '@/lib/income-report'
import {
  RESERVATION_STATUSES,
  formatReservationMoney,
  listReservations,
  type ReservationRecord,
  type ReservationShop,
  type ReservationStatus,
} from '@/lib/reservations-api'
import { cn } from '@/lib/utils'

const SHOP_OPTIONS: { key: IncomeShopFilter; icon: typeof Layers; label: string }[] = [
  { key: 'all', icon: Layers, label: 'All' },
  { key: 'merch', icon: ShoppingBag, label: 'Merch' },
  { key: 'locker', icon: Lock, label: 'Locker' },
]

const SHOP_LABEL: Record<ReservationShop, string> = { merch: 'Merch', locker: 'Locker' }

function statusLabel(status: ReservationStatus | string) {
  return RESERVATION_STATUSES.find((item) => item.value === status)?.label ?? String(status || '—')
}

function statusTone(status: string) {
  switch (status) {
    case 'fulfilled':
    case 'confirmed':
      return 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
    case 'cancelled':
      return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
    case 'submitted':
      return 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
    default:
      return 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
  }
}

function downloadCsv(csv: string) {
  const stamp = new Date().toISOString().slice(0, 10)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `reservation-income-${stamp}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function IncomeReportsAdmin() {
  const navigate = useNavigate()
  const [items, setItems] = useState<ReservationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadBusy, setReloadBusy] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState<IncomeFilters>(DEFAULT_INCOME_FILTERS)

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (opts?.soft) setReloadBusy(true)
    else setLoading(true)
    const result = await listReservations({ all: true })
    if (!result.ok) {
      setItems([])
      if (result.status === 401 || result.status === 403) {
        setNeedsLogin(true)
      } else {
        setNeedsLogin(false)
        setError(result.error)
      }
      setLoading(false)
      setReloadBusy(false)
      return
    }
    setNeedsLogin(false)
    setError('')
    setItems(result.data.items)
    setLoading(false)
    setReloadBusy(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => filterIncomeReservations(items, filters), [items, filters])
  const kpis = useMemo(() => buildIncomeKpis(filtered), [filtered])
  const series = useMemo(() => buildIncomeSeries(filtered, filters), [filtered, filters])
  const statusSlices = useMemo(() => buildIncomeStatusSlices(filtered), [filtered])
  const topItems = useMemo(() => buildIncomeTopItems(filtered), [filtered])
  const statusTotal = Math.max(1, statusSlices.reduce((sum, slice) => sum + slice.value, 0))
  const shopCounts = useMemo(
    () => ({
      all: items.length,
      merch: items.filter((item) => item.shop === 'merch').length,
      locker: items.filter((item) => item.shop === 'locker').length,
    }),
    [items],
  )
  const dirty = !filtersAreDefault(filters)
  const chartEmpty = series.every((row) => row.merch === 0 && row.locker === 0)

  function setFilter<K extends keyof IncomeFilters>(key: K, value: IncomeFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function setBasis(basis: IncomeBasisId) {
    setFilters((current) => ({
      ...current,
      basis,
      statuses: [...INCOME_BASIS_STATUSES[basis]],
    }))
  }

  function toggleStatus(status: ReservationStatus) {
    setFilters((current) => {
      const has = current.statuses.includes(status)
      const next = has ? current.statuses.filter((item) => item !== status) : [...current.statuses, status]
      const matching = INCOME_BASES.find((basis) => {
        const set = INCOME_BASIS_STATUSES[basis.id]
        return next.length === set.length && set.every((item) => next.includes(item))
      })
      return {
        ...current,
        statuses: next,
        basis: matching?.id ?? current.basis,
      }
    })
  }

  if (needsLogin) return <RequireLoginRedirect />

  return (
    <div className={workspaceTenantMainStackCls}>
      <header className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="min-w-0 space-y-1">
          <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900 sm:text-[22px] dark:text-zinc-50">
            Income reports
          </h1>
          <p className="max-w-2xl text-[13px] leading-6 text-zinc-500 dark:text-zinc-400">
            Reservation fees by shop, status, and period. No payment is taken on the site — these
            amounts follow the locker and merch schedule.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/admin/reservations"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] font-semibold text-zinc-700 transition hover:border-brand-200 hover:text-brand-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          >
            <Bookmark className="size-4" aria-hidden />
            <span className="hidden sm:inline">Reservations</span>
          </Link>
          <button
            type="button"
            disabled={loading || filtered.length === 0}
            onClick={() => downloadCsv(incomeCsv(filtered))}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-brand-600 bg-brand-600 px-3 text-[13px] font-semibold text-white transition hover:bg-brand-700 disabled:opacity-45"
          >
            <Download className="size-4" aria-hidden />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-maroon-200 bg-maroon-50 px-3 py-2.5 text-[13px] text-maroon-900 dark:border-maroon-500/30 dark:bg-maroon-500/10 dark:text-maroon-100"
        >
          {error}
        </div>
      ) : null}

      <section aria-label="Income filters" className={`${workspaceCatalogShellCls} ${workspaceCatalogPadCls}`}>
        <div className="flex w-full min-w-0 flex-col gap-2.5 sm:gap-3">
          <div className={workspaceCatalogToolbarMainRowCls}>
            <div className={workspaceCatalogToolbarSearchRowCls}>
              <div className={workspaceCatalogToolbarSearchFieldCls}>
                <Search
                  className={`pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-zinc-400 ${workspaceCatalogToolbarIconCls}`}
                  aria-hidden
                />
                <input
                  type="search"
                  value={filters.query}
                  onChange={(event) => setFilter('query', event.target.value)}
                  disabled={loading}
                  placeholder="Search code, name, item…"
                  aria-label="Search income reservations"
                  className={`${catalogInput} min-w-0 w-full pl-9`}
                />
              </div>
              <button
                type="button"
                disabled={loading}
                title="Reload reservations"
                aria-label="Reload reservations"
                onClick={() => void load({ soft: true })}
                className={`${catalogToolbarIconBtn} sm:hidden`}
              >
                <RefreshCw
                  className={`${workspaceCatalogToolbarIconCls} ${reloadBusy ? 'animate-spin' : 'opacity-85'}`}
                  aria-hidden
                />
              </button>
            </div>

            <div className={workspaceCatalogToolbarActionsRowCls}>
              <button
                type="button"
                disabled={loading}
                title="Reload reservations"
                aria-label="Reload reservations"
                onClick={() => void load({ soft: true })}
                className={`${catalogToolbarIconBtn} max-sm:hidden`}
              >
                <RefreshCw
                  className={`${workspaceCatalogToolbarIconCls} ${reloadBusy ? 'animate-spin' : 'opacity-85'}`}
                  aria-hidden
                />
              </button>
              <div role="radiogroup" aria-label="Shop filter" className={workspaceCatalogSegTrackInlineCls}>
                {SHOP_OPTIONS.map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={filters.shop === key}
                    title={`${label} (${shopCounts[key]})`}
                    aria-label={`${label} (${shopCounts[key]})`}
                    onClick={() => setFilter('shop', key)}
                    className={catalogSegIcon(filters.shop === key)}
                  >
                    <Icon className={`${workspaceCatalogToolbarIconCls} opacity-85`} aria-hidden />
                  </button>
                ))}
              </div>
              <span className={workspaceCatalogToolbarDividerCls} aria-hidden />
              <button
                type="button"
                disabled={!dirty}
                onClick={() => setFilters(DEFAULT_INCOME_FILTERS)}
                className={cn(
                  catalogToolbarIconBtn,
                  !dirty && 'opacity-40',
                )}
                title="Reset filters"
                aria-label="Reset filters"
              >
                <RotateCcw className={workspaceCatalogToolbarIconCls} aria-hidden />
              </button>
            </div>
          </div>

          <div className="-mx-1 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="inline-flex min-w-max gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-900/80">
              {INCOME_BASES.map((item) => {
                const active = filters.basis === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.hint}
                    aria-pressed={active}
                    onClick={() => setBasis(item.id)}
                    className={cn(
                      'h-8 shrink-0 rounded-md px-2.5 text-[12px] font-semibold transition',
                      active
                        ? 'bg-white text-brand-800 shadow-sm dark:bg-zinc-800 dark:text-brand-200'
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200',
                    )}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {RESERVATION_STATUSES.map((item) => {
              const active = filters.statuses.includes(item.value)
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleStatus(item.value)}
                  className={cn(
                    'inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-semibold transition',
                    active
                      ? 'border-brand-600 bg-brand-700 text-white'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:border-brand-200 hover:text-brand-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300',
                  )}
                >
                  {item.label}
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="-mx-1 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="inline-flex min-w-max gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-900/80">
                {INCOME_PERIODS.map((item) => {
                  const active = filters.period === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFilter('period', item.id as IncomePeriodId)}
                      className={cn(
                        'h-8 shrink-0 rounded-md px-2.5 text-[12px] font-semibold transition',
                        active
                          ? 'bg-white text-brand-800 shadow-sm dark:bg-zinc-800 dark:text-brand-200'
                          : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200',
                      )}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </div>
            {filters.period === 'custom' ? (
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-[12px] text-zinc-500">
                  From
                  <input
                    type="date"
                    value={filters.from}
                    onChange={(event) => setFilter('from', event.target.value)}
                    className={`${catalogInput} w-[10.5rem]`}
                  />
                </label>
                <label className="flex items-center gap-2 text-[12px] text-zinc-500">
                  To
                  <input
                    type="date"
                    value={filters.to}
                    onChange={(event) => setFilter('to', event.target.value)}
                    className={`${catalogInput} w-[10.5rem]`}
                  />
                </label>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2 sm:gap-2.5 xl:grid-cols-4">
        <KpiCard
          label="Income"
          value={formatReservationMoney(kpis.total)}
          hint={`${kpis.count.toLocaleString('en-PH')} reservation${kpis.count === 1 ? '' : 's'}`}
          Icon={Wallet}
          loading={loading}
        />
        <KpiCard
          label="Average"
          value={formatReservationMoney(kpis.average)}
          hint="Per reservation in this filter"
          Icon={ChartColumn}
          loading={loading}
        />
        <KpiCard
          label="Merch"
          value={formatReservationMoney(kpis.merch)}
          hint={kpis.total ? `${Math.round((kpis.merch / kpis.total) * 100)}% of income` : 'No merch in range'}
          Icon={Shirt}
          loading={loading}
        />
        <KpiCard
          label="Lockers"
          value={formatReservationMoney(kpis.locker)}
          hint={kpis.total ? `${Math.round((kpis.locker / kpis.total) * 100)}% of income` : 'No lockers in range'}
          Icon={Lock}
          loading={loading}
        />
      </div>

      <section className={cn(workspaceCatalogShellCls, 'overflow-hidden')}>
        <div className="flex flex-col gap-2.5 border-b border-zinc-100 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3 dark:border-zinc-800/80">
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-brand-950 sm:text-sm dark:text-zinc-100">
              Income over time
            </h2>
            <p className="mt-0.5 hidden text-xs text-zinc-500 sm:block dark:text-zinc-400">
              Merch and locker fees in the selected period
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-semibold text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <i
                className="size-2 rounded-full"
                style={{
                  background: `linear-gradient(180deg,${THEME_CHART.requests.from},${THEME_CHART.requests.to})`,
                }}
              />
              Merch
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i
                className="size-2 rounded-full"
                style={{
                  background: `linear-gradient(180deg,${THEME_CHART.reservations.from},${THEME_CHART.reservations.to})`,
                }}
              />
              Locker
            </span>
          </div>
        </div>
        <div className="grid gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[1fr_16rem] lg:items-stretch">
          <div className="min-h-[10.5rem] min-w-0 sm:min-h-[14rem]">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Loading income…
              </div>
            ) : chartEmpty ? (
              <div className="flex h-full items-center justify-center">
                <DashboardEmpty
                  compact
                  icon={ChartColumn}
                  title="No income in this range"
                  description="Try another period or include pipeline and cancelled reservations."
                  className="w-full max-w-sm"
                />
              </div>
            ) : (
              <IncomeBarChart series={series} />
            )}
          </div>
          <div className="flex flex-col justify-center gap-2.5 border-t border-zinc-100 pt-3 sm:gap-3 sm:pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4 dark:border-zinc-800">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-zinc-500 uppercase sm:text-[11px] dark:text-zinc-400">
              By status
            </p>
            {loading ? (
              <p className="text-xs text-zinc-500">Loading…</p>
            ) : statusSlices.length === 0 ? (
              <p className="text-xs text-zinc-500">No amounts for the selected statuses.</p>
            ) : (
              <ul className="space-y-2 sm:space-y-2.5">
                {statusSlices.map((slice, index) => (
                  <li key={slice.status} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs">
                      <span className="truncate font-medium text-zinc-700 dark:text-zinc-200">
                        {statusLabel(slice.status)}
                      </span>
                      <span className="tabular-nums text-zinc-500">{pesosCompact(slice.value)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(6, (slice.value / statusTotal) * 100)}%`,
                          background: THEME_CHART.reservationDonut[index % THEME_CHART.reservationDonut.length],
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <section className={cn(workspaceCatalogShellCls, 'min-w-0 overflow-hidden')}>
          <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-3 py-2.5 sm:px-4 sm:py-3 dark:border-zinc-800/80">
            <div>
              <h2 className="text-[13px] font-semibold text-brand-950 sm:text-sm dark:text-zinc-100">
                Filtered reservations
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                {filtered.length.toLocaleString('en-PH')} matching · {formatReservationMoney(kpis.total)}
              </p>
            </div>
          </div>
          {loading ? (
            <p className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-zinc-500">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading reservations…
            </p>
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <DashboardEmpty
                icon={SearchX}
                title="No matching reservations"
                description="Clear search or widen the status and date filters to see income rows."
                action={
                  dirty
                    ? undefined
                    : { to: '/admin/reservations', label: 'Open reservations' }
                }
              />
              {dirty ? (
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setFilters(DEFAULT_INCOME_FILTERS)}
                    className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white px-3 text-[12px] font-semibold text-brand-700 hover:border-brand-300 hover:bg-brand-50"
                  >
                    Reset filters
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <HorizontalDragScrollTableWrap className="overflow-x-auto">
              <table className={workspaceRegisterTableCls}>
                <thead className={workspaceRegisterTheadCls}>
                  <tr>
                    <th className={workspaceRegisterThSortCellCls}>Code</th>
                    <th className={workspaceRegisterThSortCellCls}>Item</th>
                    <th className={workspaceRegisterThSortCellCls}>Shop</th>
                    <th className={`${workspaceRegisterThSortCellCls} text-right`}>Total</th>
                    <th className={workspaceRegisterThSortCellCls}>Status</th>
                    <th className={workspaceRegisterThSortCellCls}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 40).map((item) => (
                    <tr
                      key={item.id}
                      className={cn(workspaceRegisterTbodyRowCls, 'cursor-pointer')}
                      onClick={() => navigate(`/admin/reservations/${item.id}/edit`)}
                    >
                      <td className="whitespace-nowrap px-2 py-2.5 text-[13px] font-semibold text-brand-800">
                        {item.code}
                      </td>
                      <td className="max-w-[14rem] truncate px-2 py-2.5 text-[13px] text-zinc-800">
                        {item.itemName}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-[13px] text-zinc-600">
                        {SHOP_LABEL[item.shop]}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right text-[13px] font-semibold tabular-nums text-zinc-900">
                        {formatReservationMoney(item.totalAmount)}
                      </td>
                      <td className="px-2 py-2.5">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            statusTone(item.status),
                          )}
                        >
                          {statusLabel(item.status)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-[12px] text-zinc-500">
                        {formatPhDate(item.submittedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </HorizontalDragScrollTableWrap>
          )}
          {!loading && filtered.length > 40 ? (
            <p className="border-t border-zinc-100 px-4 py-2.5 text-xs text-zinc-500">
              Showing the first 40 of {filtered.length.toLocaleString('en-PH')}. Export CSV for the full
              filter.
            </p>
          ) : null}
        </section>

        <section className={cn(workspaceCatalogShellCls, 'min-w-0 overflow-hidden')}>
          <div className="border-b border-zinc-100 px-3 py-2.5 sm:px-4 sm:py-3 dark:border-zinc-800/80">
            <h2 className="text-[13px] font-semibold text-brand-950 sm:text-sm dark:text-zinc-100">
              Top items
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">Highest fees in this filter</p>
          </div>
          {loading ? (
            <p className="px-4 py-10 text-center text-xs text-zinc-500">Loading…</p>
          ) : topItems.length === 0 ? (
            <div className="p-4">
              <DashboardEmpty
                compact
                icon={ShoppingBag}
                title="No items yet"
                description="Item totals appear once reservations match the filter."
              />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {topItems.map((item, index) => (
                <li key={item.key} className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
                      <span className="mr-1.5 text-zinc-400">{index + 1}.</span>
                      {item.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {SHOP_LABEL[item.shop]} · {item.count} reservation{item.count === 1 ? '' : 's'}
                    </p>
                  </div>
                  <p className="shrink-0 text-[13px] font-semibold tabular-nums text-brand-800">
                    {formatReservationMoney(item.amount)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  hint,
  Icon,
  loading,
}: {
  label: string
  value: string
  hint: string
  Icon: typeof Wallet
  loading?: boolean
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 sm:px-3.5 sm:py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 sm:size-9 dark:bg-brand-500/15 dark:text-brand-200">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">{label}</p>
          {loading ? (
            <span className="mt-1.5 block h-6 w-20 animate-pulse rounded-md bg-zinc-200/90 dark:bg-zinc-800" />
          ) : (
            <p className="mt-0.5 truncate text-lg font-semibold tracking-tight text-brand-950 tabular-nums sm:text-xl dark:text-zinc-50">
              {value}
            </p>
          )}
          <p className="mt-0.5 hidden truncate text-[11px] text-zinc-500 sm:block">{hint}</p>
        </div>
      </div>
    </div>
  )
}
