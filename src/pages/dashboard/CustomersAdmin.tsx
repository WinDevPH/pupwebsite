import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bookmark,
  FileText,
  Layers,
  LayoutGrid,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  ShoppingBag,
  Table2,
  UserRound,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { RequireLoginRedirect } from '@/components/portal/RequireLoginRedirect'
import { HorizontalDragScrollTableWrap } from '@/components/portal/HorizontalDragScrollTableWrap'
import {
  catalogInput,
  catalogSegIcon,
  catalogToolbarIconBtn,
  effectiveRegisterPageSize,
  initialRegisterView,
  plansRegisterPanelFooterCls,
  plansRegisterTableScrollerCls,
  readStoredRegisterPageSize,
  RegisterPaginationBar,
  RegisterPanelHeading,
  workspaceCatalogPadCls,
  workspaceCatalogSegTrackInlineCls,
  workspaceCatalogShellCls,
  workspaceCatalogToolbarActionsRowCls,
  workspaceCatalogToolbarDividerCls,
  workspaceCatalogToolbarIconCls,
  workspaceCatalogToolbarMainRowCls,
  workspaceCatalogToolbarSearchFieldCls,
  workspaceCatalogToolbarSearchRowCls,
  workspaceRegisterPanelShellCls,
  workspaceRegisterSectionStackCls,
  workspaceRegisterTableCls,
  workspaceRegisterTbodyRowCls,
  workspaceRegisterThActionsCellCls,
  workspaceRegisterThSortCellCls,
  workspaceRegisterTheadCls,
  workspaceTenantMainStackCls,
  writeStoredRegisterPageSize,
  type RegisterView,
} from '@/components/portal/register-ui'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import {
  buildCustomers,
  customerInitials,
  encodeCustomerKey,
  type CustomerRecord,
} from '@/lib/customers'
import { formatPhDateTime } from '@/lib/datetime'
import { listPortalRequests } from '@/lib/requests-api'
import { formatReservationMoney, listReservations } from '@/lib/reservations-api'
import { cn } from '@/lib/utils'

type SegFilter = 'all' | 'locker' | 'merch' | 'requests'

const PAGE_SIZE_KEY = 'pup-admin-customers-page-size'
const VIEW_KEY = 'pup-admin-customers-view'
const REGISTER_HEADING_ID = 'customers-register-heading'
const REGISTER_TITLE = 'Customer register'

const SEG_OPTIONS: { key: SegFilter; icon: typeof Layers; label: string }[] = [
  { key: 'all', icon: Layers, label: 'All' },
  { key: 'locker', icon: Lock, label: 'Lockers' },
  { key: 'merch', icon: ShoppingBag, label: 'Merch' },
  { key: 'requests', icon: FileText, label: 'Requests' },
]

function matchesSeg(item: CustomerRecord, seg: SegFilter) {
  if (seg === 'locker') return item.lockerCount > 0
  if (seg === 'merch') return item.merchCount > 0
  if (seg === 'requests') return item.requestCount > 0
  return true
}

export default function CustomersAdmin() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<CustomerRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadBusy, setReloadBusy] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [query, setQuery] = useState('')
  const [segFilter, setSegFilter] = useState<SegFilter>('all')
  const [pageNo, setPageNo] = useState(1)
  const [pageSize, setPageSize] = useState(() => readStoredRegisterPageSize(PAGE_SIZE_KEY))
  const [registerView, setRegisterView] = useState<RegisterView>(() =>
    initialRegisterView(VIEW_KEY),
  )
  const [toast, setToast] = useState<SnackToast | null>(null)

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (opts?.soft) setReloadBusy(true)
      else setLoading(true)
      const [reservations, requests] = await Promise.all([
        listReservations({ all: true }),
        listPortalRequests(),
      ])
      if (!reservations.ok) {
        setCustomers([])
        if (reservations.status === 401 || reservations.status === 403) setNeedsLogin(true)
        else {
          setNeedsLogin(false)
          showToast(reservations.error, 'error')
        }
        setLoading(false)
        setReloadBusy(false)
        return
      }
      setNeedsLogin(false)
      setCustomers(buildCustomers(reservations.data.items, requests.ok ? requests.data.items : []))
      if (!requests.ok && requests.status !== 401 && requests.status !== 403) {
        showToast(requests.error, 'error')
      }
      setLoading(false)
      setReloadBusy(false)
    },
    [showToast],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    setPageNo(1)
  }, [query, segFilter, pageSize])

  const segCounts = useMemo(
    () => ({
      all: customers.length,
      locker: customers.filter((item) => matchesSeg(item, 'locker')).length,
      merch: customers.filter((item) => matchesSeg(item, 'merch')).length,
      requests: customers.filter((item) => matchesSeg(item, 'requests')).length,
    }),
    [customers],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return customers.filter((item) => {
      if (!matchesSeg(item, segFilter)) return false
      if (!needle) return true
      const haystack =
        `${item.name} ${item.email} ${item.mobile} ${item.studentId} ${item.year}`.toLowerCase()
      return haystack.includes(needle)
    })
  }, [customers, query, segFilter])

  const pageMeta = useMemo(() => {
    const total = filtered.length
    const psz = effectiveRegisterPageSize(pageSize, total)
    const pages = total === 0 ? 0 : Math.ceil(total / psz)
    const safePage = pages === 0 ? 1 : Math.min(Math.max(1, pageNo), pages)
    const start = total === 0 ? 0 : (safePage - 1) * psz
    const from = total === 0 ? 0 : start + 1
    const to = total === 0 ? 0 : Math.min(start + psz, total)
    const rows = total === 0 ? [] : filtered.slice(start, start + psz)
    return { total, psz, pages, page: safePage, from, to, rows }
  }, [filtered, pageNo, pageSize])

  function handlePageSizeChange(n: number) {
    setPageSize(n)
    writeStoredRegisterPageSize(PAGE_SIZE_KEY, n)
  }

  function setRegisterViewPref(next: RegisterView) {
    setRegisterView(next)
    try {
      sessionStorage.setItem(VIEW_KEY, next)
    } catch {
      /* ignore */
    }
  }

  function goRecord(item: CustomerRecord) {
    navigate(`/admin/customers/${encodeCustomerKey(item.key)}`)
  }

  const busy = loading || reloadBusy
  if (needsLogin) return <RequireLoginRedirect />

  const paginationBar = (
    <RegisterPaginationBar
      disabled={busy}
      showingFrom={pageMeta.from}
      showingTo={pageMeta.to}
      totalRecords={pageMeta.total}
      pageSize={pageSize}
      onPageSizeChange={handlePageSizeChange}
      page={pageMeta.page}
      totalPages={pageMeta.pages}
      onPrev={() => setPageNo((prev) => (prev <= 1 ? prev : prev - 1))}
      onNext={() => setPageNo((prev) => Math.min(pageMeta.pages, prev + 1))}
      onGoPage={(pn) => setPageNo(Math.min(Math.max(1, pn), pageMeta.pages))}
      ariaLabel="Customers register pagination"
    />
  )

  const reloadButtons = (extraCls: string) => (
    <button
      type="button"
      disabled={busy}
      title="Reload customers"
      aria-label="Reload customers"
      onClick={() => void load({ soft: true })}
      className={`${catalogToolbarIconBtn} ${extraCls}`}
    >
      <RefreshCw
        className={`${workspaceCatalogToolbarIconCls} ${reloadBusy ? 'animate-spin' : 'opacity-85'}`}
        aria-hidden
      />
    </button>
  )

  const subtitle = `${pageMeta.total.toLocaleString()} record${pageMeta.total === 1 ? '' : 's'}`

  return (
    <div className={workspaceTenantMainStackCls}>
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="min-w-0 space-y-1">
          <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900 sm:text-[22px] dark:text-zinc-50">
            Customers
          </h1>
          <p className="max-w-xl text-[13px] leading-6 text-zinc-500 dark:text-zinc-400">
            Open a student to review locker holds, merch purchases, and request tracking IDs.
          </p>
        </div>
        <Link
          to="/admin/reservations"
          className="inline-flex size-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white text-zinc-700 transition hover:border-brand-200 hover:text-brand-800 sm:h-10 sm:w-auto sm:px-3 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
        >
          <Bookmark className="h-4 w-4" aria-hidden />
          <span className="sr-only text-[13px] font-semibold sm:not-sr-only">Reservations</span>
        </Link>
      </div>

      <section aria-label="Catalog" className="w-full max-w-none">
        <div className={`${workspaceCatalogShellCls} ${workspaceCatalogPadCls} w-full max-w-none`}>
          <div
            role="toolbar"
            aria-label="Customer filters"
            className="flex w-full min-w-0 flex-col gap-2.5 sm:gap-3"
          >
            <div className={workspaceCatalogToolbarMainRowCls}>
              <div className={workspaceCatalogToolbarSearchRowCls}>
                <div className={workspaceCatalogToolbarSearchFieldCls}>
                  <Search
                    className={`pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-zinc-400 ${workspaceCatalogToolbarIconCls}`}
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    disabled={busy}
                    placeholder="Search name, email, or student ID…"
                    aria-label="Search customers"
                    className={`${catalogInput} min-w-0 w-full pl-9`}
                  />
                </div>
                {reloadButtons('sm:hidden')}
              </div>

              <div className={workspaceCatalogToolbarActionsRowCls}>
                {reloadButtons('max-sm:hidden')}

                <div
                  role="radiogroup"
                  aria-label="Customer type"
                  className={workspaceCatalogSegTrackInlineCls}
                >
                  {SEG_OPTIONS.map(({ key, icon: Icon, label }) => (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={segFilter === key}
                      title={`${label} (${segCounts[key]})`}
                      aria-label={`${label} (${segCounts[key]})`}
                      disabled={busy}
                      onClick={() => setSegFilter(key)}
                      className={catalogSegIcon(segFilter === key)}
                    >
                      <Icon
                        className={`${workspaceCatalogToolbarIconCls} opacity-85`}
                        aria-hidden
                      />
                    </button>
                  ))}
                </div>
                <span className={workspaceCatalogToolbarDividerCls} aria-hidden />

                <div
                  role="radiogroup"
                  aria-label="Table or card layout"
                  className={workspaceCatalogSegTrackInlineCls}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={registerView === 'table'}
                    title="Table"
                    aria-label="Table layout"
                    disabled={busy}
                    onClick={() => setRegisterViewPref('table')}
                    className={catalogSegIcon(registerView === 'table')}
                  >
                    <Table2
                      className={`${workspaceCatalogToolbarIconCls} opacity-85`}
                      aria-hidden
                    />
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={registerView === 'cards'}
                    title="Cards"
                    aria-label="Card layout"
                    disabled={busy}
                    onClick={() => setRegisterViewPref('cards')}
                    className={catalogSegIcon(registerView === 'cards')}
                  >
                    <LayoutGrid
                      className={`${workspaceCatalogToolbarIconCls} opacity-85`}
                      aria-hidden
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby={REGISTER_HEADING_ID}
        aria-label={REGISTER_TITLE}
        className={workspaceRegisterSectionStackCls}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-zinc-300/90 bg-zinc-50/80 px-5 py-12 text-[13px] text-zinc-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400">
            <h2 id={REGISTER_HEADING_ID} className="sr-only">
              {REGISTER_TITLE}
            </h2>
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-hidden />
            Loading customers…
          </div>
        ) : filtered.length === 0 ? (
          <div className={workspaceRegisterPanelShellCls(registerView)}>
            <RegisterPanelHeading
              headingId={REGISTER_HEADING_ID}
              title={REGISTER_TITLE}
              subtitle={`${customers.length === 0 ? '0' : '0 matching'} customers`}
            />
            <div className="min-w-0 bg-white px-4 py-5 sm:px-5 sm:py-6 dark:bg-zinc-950">
              <div className="flex flex-col items-center overflow-hidden rounded-lg border border-dashed border-zinc-300/90 bg-zinc-50/85 px-5 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
                <UserRound
                  className="mb-5 h-[3.75rem] w-[3.75rem] shrink-0 text-brand-600/45"
                  strokeWidth={1.35}
                  aria-hidden
                />
                <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
                  {customers.length === 0 ? 'No customers yet' : 'No matching customers'}
                </p>
                <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {customers.length === 0
                    ? 'Reservations and portal requests will group here by student.'
                    : 'Adjust search, type filter, or reload.'}
                </p>
              </div>
            </div>
            <footer className={plansRegisterPanelFooterCls}>{paginationBar}</footer>
          </div>
        ) : registerView === 'table' ? (
          <div className={workspaceRegisterPanelShellCls('table')}>
            <RegisterPanelHeading
              headingId={REGISTER_HEADING_ID}
              title={REGISTER_TITLE}
              subtitle={subtitle}
            />
            <HorizontalDragScrollTableWrap className={plansRegisterTableScrollerCls}>
              <table className={workspaceRegisterTableCls}>
                <caption className="sr-only">Customer register rows</caption>
                <thead className={workspaceRegisterTheadCls}>
                  <tr className="[&_th]:text-brand-900/80 dark:[&_th]:text-zinc-300">
                    <th
                      scope="col"
                      className={cn(
                        workspaceRegisterThSortCellCls,
                        'w-[16rem] max-w-[16rem] text-left sm:w-[20rem] sm:max-w-[20rem] lg:w-[24rem] lg:max-w-[24rem]',
                      )}
                    >
                      Customer
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[12rem] text-left')}
                    >
                      Contact
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[14rem] text-left')}
                    >
                      Activity
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[7rem] text-left')}
                    >
                      Total
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[11rem] text-left')}
                    >
                      Last activity
                    </th>
                    <th scope="col" className={workspaceRegisterThActionsCellCls}>
                      View
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-950">
                  {pageMeta.rows.map((item) => (
                    <tr
                      key={item.key}
                      className={cn(workspaceRegisterTbodyRowCls, 'cursor-pointer')}
                      onClick={() => goRecord(item)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          goRecord(item)
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open record for ${item.name}`}
                    >
                      <td className="w-[16rem] max-w-[16rem] px-1.5 py-2 sm:w-[20rem] sm:max-w-[20rem] sm:px-2 lg:w-[24rem] lg:max-w-[24rem]">
                        <div className="flex min-w-0 max-w-full items-center gap-2.5">
                          <Avatar name={item.name} />
                          <div className="min-w-0 overflow-hidden">
                            <p
                              className="truncate font-semibold leading-tight text-zinc-900 dark:text-zinc-50"
                              title={item.name}
                            >
                              {item.name || 'Unknown'}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                              {latestTrackCopy(item)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 text-[12px] text-zinc-700 sm:px-2 dark:text-zinc-300">
                        <span className="block max-w-[12rem] truncate" title={item.email}>
                          {item.email || '—'}
                        </span>
                      </td>
                      <td className="px-1.5 py-2 sm:px-2">
                        <ActivityPills item={item} />
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 text-[12px] font-medium text-zinc-800 sm:px-2 dark:text-zinc-100">
                        {formatReservationMoney(item.totalAmount)}
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 text-[12px] text-zinc-600 sm:px-2 dark:text-zinc-400">
                        {item.lastAt ? formatPhDateTime(item.lastAt) : '—'}
                      </td>
                      <td
                        className="whitespace-nowrap px-1 py-2 pr-1.5 sm:px-1.5 sm:pr-2.5"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <div className="flex items-center justify-end">
                          <ViewRecordButton onClick={() => goRecord(item)} name={item.name} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </HorizontalDragScrollTableWrap>
            <footer className={plansRegisterPanelFooterCls}>{paginationBar}</footer>
          </div>
        ) : (
          <div className={workspaceRegisterPanelShellCls('cards')}>
            <RegisterPanelHeading
              headingId={REGISTER_HEADING_ID}
              title={REGISTER_TITLE}
              subtitle={subtitle}
            />
            <ul className="grid gap-3 bg-transparent px-0 py-2.5 sm:grid-cols-2 sm:gap-3 sm:bg-white sm:px-4 sm:py-4 xl:grid-cols-3 dark:sm:bg-zinc-950">
              {pageMeta.rows.map((item) => (
                <li key={item.key} className="min-w-0">
                  <article
                    className={cn(
                      'group flex h-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-2xl border transition outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                      'border-zinc-200/80 bg-zinc-50/50 hover:border-brand-300/60 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-brand-500/30 dark:hover:bg-zinc-950',
                    )}
                    onClick={() => goRecord(item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        goRecord(item)
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open record for ${item.name}`}
                  >
                    <div className="flex items-start justify-between gap-2 p-3.5 pb-0">
                      <ActivityPills item={item} />
                      <div
                        className="rounded-lg bg-white shadow-sm dark:bg-zinc-950 dark:shadow-none"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <ViewRecordButton onClick={() => goRecord(item)} name={item.name} />
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col gap-2.5 p-3.5 pt-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={item.name} large />
                        <div className="min-w-0">
                          <h3
                            className="truncate text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
                            title={item.name}
                          >
                            {item.name || 'Unknown'}
                          </h3>
                          <p
                            className="mt-0.5 truncate text-[12px] text-zinc-600 dark:text-zinc-400"
                            title={item.email}
                          >
                            {item.email || 'No email'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-auto grid grid-cols-2 gap-2">
                        <MetaCell label="Student ID" value={item.studentId || '—'} mono />
                        <MetaCell
                          label="Total"
                          value={formatReservationMoney(item.totalAmount)}
                        />
                      </div>
                      <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                        {latestTrackCopy(item)}
                        {item.lastAt ? ` · ${formatPhDateTime(item.lastAt)}` : ''}
                      </p>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
            <footer className={plansRegisterPanelFooterCls}>{paginationBar}</footer>
          </div>
        )}
      </section>

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

function latestTrackCopy(item: CustomerRecord) {
  const code = item.reservations[0]?.code || item.requests[0]?.id || ''
  const identity = item.studentId || item.year || 'No student ID'
  return code ? `${identity} · Track ${code}` : identity
}

function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold tracking-wide',
        large ? 'h-10 w-10 text-[13px]' : 'h-8 w-8 text-[11px]',
        'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200',
      )}
      aria-hidden
    >
      {customerInitials(name)}
    </span>
  )
}

function ActivityPills({ item }: { item: CustomerRecord }) {
  const chips = [
    item.lockerCount > 0
      ? {
          key: 'locker',
          label: `${item.lockerCount} locker${item.lockerCount === 1 ? '' : 's'}`,
          cls: 'border-brand-200/70 bg-brand-50/70 text-brand-800 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-300',
        }
      : null,
    item.merchCount > 0
      ? {
          key: 'merch',
          label: `${item.merchCount} merch`,
          cls: 'border-sky-200/80 bg-sky-50/80 text-sky-900 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-200',
        }
      : null,
    item.requestCount > 0
      ? {
          key: 'requests',
          label: `${item.requestCount} request${item.requestCount === 1 ? '' : 's'}`,
          cls: 'border-zinc-200/85 bg-zinc-50 text-zinc-700 dark:border-zinc-600/40 dark:bg-zinc-800/60 dark:text-zinc-300',
        }
      : null,
  ].filter((chip): chip is NonNullable<typeof chip> => Boolean(chip))

  if (chips.length === 0) {
    return <span className="text-[12px] text-zinc-400">—</span>
  }

  return (
    <span className="inline-flex max-w-[16rem] flex-wrap items-center gap-1">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className={cn(
            'inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
            chip.cls,
          )}
        >
          {chip.label}
        </span>
      ))}
    </span>
  )
}

function MetaCell({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-200/70 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-[10px] font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 truncate text-[11px] text-zinc-700 dark:text-zinc-300',
          mono && 'font-mono',
        )}
      >
        {value}
      </p>
    </div>
  )
}

function ViewRecordButton({ onClick, name }: { onClick: () => void; name: string }) {
  return (
    <button
      type="button"
      title={`Open record for ${name}`}
      aria-label={`Open record for ${name}`}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-zinc-500 outline-none transition hover:border-zinc-200/70 hover:bg-white/90 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
    >
      <UserRound className="h-4 w-4" aria-hidden />
    </button>
  )
}
