import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarCheck,
  Layers,
  LayoutGrid,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  ShoppingBag,
  Table2,
  UserRound,
  Wallet,
} from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { RequireLoginRedirect } from '@/components/portal/RequireLoginRedirect'
import { HorizontalDragScrollTableWrap } from '@/components/portal/HorizontalDragScrollTableWrap'
import { RegisterRowActions } from '@/components/portal/RegisterRowActions'
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
  workspacePageAddBtnCls,
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
  RESERVATION_STATUSES,
  deleteReservation,
  formatReservationMoney,
  listReservations,
  reservationRentalLabel,
  type ReservationRecord,
  type ReservationShop,
  type ReservationStatus,
} from '@/lib/reservations-api'
import { formatPhDateTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import { ConfirmDeleteDialog } from '@/components/portal/ConfirmDeleteDialog'

type SegFilter = 'all' | ReservationShop | 'renewal'

const PAGE_SIZE_KEY = 'pup-admin-reservations-page-size'
const VIEW_KEY = 'pup-admin-reservations-view'
const REGISTER_HEADING_ID = 'reservations-register-heading'
const REGISTER_TITLE = 'Reservation register'

const SEG_OPTIONS: { key: SegFilter; icon: typeof Layers; label: string }[] = [
  { key: 'all', icon: Layers, label: 'All' },
  { key: 'merch', icon: ShoppingBag, label: 'Merch' },
  { key: 'locker', icon: Lock, label: 'Locker' },
  { key: 'renewal', icon: Repeat, label: 'Renewals' },
]

function isLockerRenewal(item: ReservationRecord) {
  return item.shop === 'locker' && item.rentalType === 'renewal'
}

function matchesSeg(item: ReservationRecord, seg: SegFilter) {
  if (seg === 'all') return true
  if (seg === 'renewal') return isLockerRenewal(item)
  return item.shop === seg
}

const SHOP_LABEL: Record<ReservationShop, string> = {
  merch: 'Merch',
  locker: 'Locker',
}

function statusLabel(status: ReservationStatus | string) {
  return RESERVATION_STATUSES.find((s) => s.value === status)?.label ?? String(status || '—')
}

function formatSubmitted(value: string) {
  return formatPhDateTime(value)
}

function submittedSortValue(value: string) {
  const t = new Date(value.includes('T') ? value : value.replace(' ', 'T')).getTime()
  return Number.isNaN(t) ? 0 : t
}

export default function ReservationsAdmin() {
  const navigate = useNavigate()
  const location = useLocation()
  const [items, setItems] = useState<ReservationRecord[]>([])
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
  const [busyId, setBusyId] = useState<number | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ReservationRecord | null>(null)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [toast, setToast] = useState<SnackToast | null>(null)

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (opts?.soft) setReloadBusy(true)
      else setLoading(true)
      const result = await listReservations({ all: true })
      if (!result.ok) {
        setItems([])
        if (result.status === 401 || result.status === 403) {
          setNeedsLogin(true)
        } else {
          setNeedsLogin(false)
          showToast(result.error, 'error')
        }
        setLoading(false)
        setReloadBusy(false)
        return
      }
      setNeedsLogin(false)
      setItems(result.data.items)
      setLoading(false)
      setReloadBusy(false)
    },
    [showToast],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const flash = (
      location.state as { toast?: { message: string; variant: SnackToast['variant'] } } | null
    )?.toast
    if (!flash?.message) return
    setToast({ id: Date.now(), message: flash.message, variant: flash.variant ?? 'success' })
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

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
      all: items.length,
      merch: items.filter((i) => i.shop === 'merch').length,
      locker: items.filter((i) => i.shop === 'locker').length,
      renewal: items.filter(isLockerRenewal).length,
    }),
    [items],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items
      .filter((item) => {
        if (!matchesSeg(item, segFilter)) return false
        if (!needle) return true
        const haystack =
          `${item.code} ${item.name} ${item.email} ${item.itemName} ${item.studentId} ${item.status} ${statusLabel(item.status)} ${item.shop === 'locker' ? reservationRentalLabel(item.rentalType) : ''}`.toLowerCase()
        return haystack.includes(needle)
      })
      .sort(
        (a, b) =>
          submittedSortValue(b.submittedAt) - submittedSortValue(a.submittedAt) || b.id - a.id,
      )
  }, [items, query, segFilter])

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

  function setRegisterViewPref(view: RegisterView) {
    setRegisterView(view)
    try {
      sessionStorage.setItem(VIEW_KEY, view)
    } catch {
      /* ignore */
    }
  }

  function goCreate() {
    navigate('/admin/reservations/new')
  }

  function goEdit(item: ReservationRecord) {
    navigate(`/admin/reservations/${item.id}/edit`)
  }

  async function handleDelete() {
    if (!pendingDelete) return
    const item = pendingDelete
    setBusyId(item.id)
    const result = await deleteReservation(item.id)
    setBusyId(null)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        setNeedsLogin(true)
        return
      }
      setPendingDelete(null)
      showToast(result.error, 'error')
      return
    }
    setItems((prev) => prev.filter((row) => row.id !== item.id))
    setPendingDelete(null)
    showToast('Reservation deleted.', 'success')
  }

  const busy = loading || reloadBusy || busyId !== null

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
      ariaLabel="Reservations register pagination"
    />
  )

  const reloadButtons = (extraCls: string) => (
    <button
      type="button"
      disabled={busy}
      title="Reload reservations"
      aria-label="Reload reservations"
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
            Reservations
          </h1>
          <p className="max-w-xl text-[13px] leading-6 text-zinc-500 dark:text-zinc-400">
            Locker, merch, and locker-renewal reservations from the portal.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/admin/customers"
            className="inline-flex size-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white text-zinc-700 transition hover:border-brand-200 hover:text-brand-800 sm:h-10 sm:w-auto sm:px-3 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          >
            <UserRound className="h-4 w-4" aria-hidden />
            <span className="sr-only sm:not-sr-only text-[13px] font-semibold">Customers</span>
          </Link>
          <Link
            to="/admin/income"
            className="inline-flex size-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white text-zinc-700 transition hover:border-brand-200 hover:text-brand-800 sm:h-10 sm:w-auto sm:px-3 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          >
            <Wallet className="h-4 w-4" aria-hidden />
            <span className="sr-only sm:not-sr-only text-[13px] font-semibold">Income reports</span>
          </Link>
          <button type="button" className={workspacePageAddBtnCls} onClick={goCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            New reservation
          </button>
        </div>
      </div>

      <section aria-label="Catalog" className="w-full max-w-none">
        <div className={`${workspaceCatalogShellCls} ${workspaceCatalogPadCls} w-full max-w-none`}>
          <div
            role="toolbar"
            aria-label="Reservation filters"
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
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={busy}
                    placeholder="Search…"
                    aria-label="Search reservations"
                    className={`${catalogInput} min-w-0 w-full pl-9`}
                  />
                </div>
                {reloadButtons('sm:hidden')}
              </div>

              <div className={workspaceCatalogToolbarActionsRowCls}>
                {reloadButtons('max-sm:hidden')}

                <div
                  role="radiogroup"
                  aria-label="Reservation type"
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
            Loading reservations…
          </div>
        ) : filtered.length === 0 ? (
          <div className={workspaceRegisterPanelShellCls(registerView)}>
            <RegisterPanelHeading
              headingId={REGISTER_HEADING_ID}
              title={REGISTER_TITLE}
              subtitle={`${items.length === 0 ? '0' : '0 matching'} reservations`}
              onAdd={goCreate}
              addAriaLabel="New reservation"
            />
            <div className="min-w-0 bg-white px-4 py-5 sm:px-5 sm:py-6 dark:bg-zinc-950">
              <div className="flex flex-col items-center overflow-hidden rounded-lg border border-dashed border-zinc-300/90 bg-zinc-50/85 px-5 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
                <CalendarCheck
                  className="mb-5 h-[3.75rem] w-[3.75rem] shrink-0 text-brand-600/45"
                  strokeWidth={1.35}
                  aria-hidden
                />
                <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
                  {items.length === 0
                    ? 'No reservations yet'
                    : segFilter === 'renewal' && !query.trim()
                      ? 'No locker renewals yet'
                      : 'No matching reservations'}
                </p>
                <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {items.length === 0
                    ? 'Reservations submitted from the portal will appear here.'
                    : segFilter === 'renewal'
                      ? 'No locker renewals match this search. Try All or Locker, or reload.'
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
              onAdd={goCreate}
              addAriaLabel="New reservation"
            />
            <HorizontalDragScrollTableWrap className={plansRegisterTableScrollerCls}>
              <table className={workspaceRegisterTableCls}>
                <caption className="sr-only">Reservation register rows</caption>
                <thead className={workspaceRegisterTheadCls}>
                  <tr className="[&_th]:text-brand-900/80 dark:[&_th]:text-zinc-300">
                    <th
                      scope="col"
                      className={cn(
                        workspaceRegisterThSortCellCls,
                        'w-[16rem] max-w-[16rem] text-left sm:w-[20rem] sm:max-w-[20rem] lg:w-[24rem] lg:max-w-[24rem]',
                      )}
                    >
                      Reservation
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[7rem] text-left')}
                    >
                      Shop
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[10rem] text-left')}
                    >
                      Customer
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[4rem] text-left')}
                    >
                      Qty
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[7rem] text-left')}
                    >
                      Total
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[7rem] text-left')}
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[10rem] text-left')}
                    >
                      Submitted
                    </th>
                    <th scope="col" className={workspaceRegisterThActionsCellCls}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-950">
                  {pageMeta.rows.map((item) => (
                    <tr
                      key={item.id}
                      className={cn(workspaceRegisterTbodyRowCls, 'cursor-pointer')}
                      onClick={() => goEdit(item)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          goEdit(item)
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Edit reservation ${item.code}`}
                    >
                      <td className="w-[16rem] max-w-[16rem] px-1.5 py-2 sm:w-[20rem] sm:max-w-[20rem] sm:px-2 lg:w-[24rem] lg:max-w-[24rem]">
                        <div className="flex min-w-0 max-w-full items-center gap-2.5 overflow-hidden sm:gap-3">
                          <Thumb src={item.image ?? ''} shop={item.shop} size="sm" />
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <p
                              className="truncate font-semibold leading-tight text-zinc-900 dark:text-zinc-50"
                              title={item.itemName}
                            >
                              {item.itemName || 'Untitled'}
                            </p>
                            <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                              {item.code || '—'}
                              {item.shop === 'locker' ? ` · ${reservationRentalLabel(item.rentalType)}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 sm:px-2">
                        <ShopBadge shop={item.shop} />
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 text-[12px] text-zinc-700 sm:px-2 dark:text-zinc-300">
                        <span className="block max-w-[10rem] truncate" title={item.name}>
                          {item.name || '—'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 font-mono text-[12px] tabular-nums text-zinc-700 sm:px-2 dark:text-zinc-300">
                        {item.shop === 'locker' ? '—' : item.quantity}
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 text-[12px] font-medium text-zinc-800 sm:px-2 dark:text-zinc-100">
                        {formatReservationMoney(item.totalAmount)}
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 sm:px-2">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 text-[12px] text-zinc-600 sm:px-2 dark:text-zinc-400">
                        {formatSubmitted(item.submittedAt)}
                      </td>
                      <td
                        className="whitespace-nowrap px-1 py-2 pr-1.5 sm:px-1.5 sm:pr-2.5"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <div className="flex items-center justify-end">{renderActions(item)}</div>
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
              onAdd={goCreate}
              addAriaLabel="New reservation"
            />
            <ul className="grid gap-3 bg-transparent px-0 py-2.5 sm:grid-cols-2 sm:gap-3 sm:bg-white sm:px-4 sm:py-4 xl:grid-cols-3 dark:sm:bg-zinc-950">
              {pageMeta.rows.map((item) => (
                <li key={item.id} className="min-w-0">
                  <article
                    className={cn(
                      'group flex h-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-2xl border transition outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                      'border-zinc-200/80 bg-zinc-50/50 hover:border-brand-300/60 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-brand-500/30 dark:hover:bg-zinc-950',
                    )}
                    onClick={() => goEdit(item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        goEdit(item)
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Edit reservation ${item.code}`}
                  >
                    <div className="flex items-start justify-between gap-2 p-3.5 pb-0">
                      <Thumb src={item.image ?? ''} shop={item.shop} size="lg" />
                      <div
                        className="flex items-center gap-1.5"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <StatusBadge status={item.status} />
                        <div className="rounded-lg bg-white shadow-sm dark:bg-zinc-950 dark:shadow-none">
                          {renderActions(item)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col gap-2.5 p-3.5 pt-3">
                      <ShopBadge shop={item.shop} pill />
                      <div className="min-w-0">
                        <h3
                          className="truncate text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
                          title={item.itemName}
                        >
                          {item.itemName || 'Untitled'}
                        </h3>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                          {item.code || '—'}
                          {item.shop === 'locker' ? ` · ${reservationRentalLabel(item.rentalType)}` : ''}
                        </p>
                        <p className="mt-1 truncate text-[12px] text-zinc-600 dark:text-zinc-400">
                          {item.name || '—'}
                        </p>
                        <p className="mt-1 text-[12px] font-medium text-zinc-800 dark:text-zinc-100">
                          {formatReservationMoney(item.totalAmount)}
                          {item.shop === 'merch' ? (
                            <span className="ml-1 text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                              × {item.quantity}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <div className="mt-auto grid grid-cols-2 gap-2">
                        <div className="min-w-0 rounded-xl border border-zinc-200/70 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                          <p className="text-[10px] font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
                            Shop
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-zinc-700 dark:text-zinc-300">
                            {SHOP_LABEL[item.shop] ?? item.shop}
                          </p>
                        </div>
                        <div className="min-w-0 rounded-xl border border-zinc-200/70 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                          <p className="text-[10px] font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
                            Status
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-zinc-700 dark:text-zinc-300">
                            {statusLabel(item.status)}
                          </p>
                        </div>
                      </div>
                      <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                        Submitted {formatSubmitted(item.submittedAt)}
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

      {pendingDelete ? (
        <ConfirmDeleteDialog
          title={pendingDelete.code || pendingDelete.itemName || 'Reservation'}
          noun="reservation"
          detail={pendingDelete.code && pendingDelete.itemName ? pendingDelete.itemName : undefined}
          description="This reservation will be removed from the reservations register. This action cannot be undone."
          busy={busyId === pendingDelete.id}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )

  function renderActions(item: ReservationRecord) {
    return (
      <RegisterRowActions
        open={openMenuId === item.id}
        onOpenChange={(open) => setOpenMenuId(open ? item.id : null)}
        onEdit={() => {
          setOpenMenuId(null)
          goEdit(item)
        }}
        onDelete={() => {
          setOpenMenuId(null)
          setPendingDelete(item)
        }}
        disabled={busyId === item.id}
      />
    )
  }
}

function Thumb({
  src,
  shop,
  size,
}: {
  src: string
  shop: ReservationShop
  size: 'sm' | 'lg'
}) {
  const cls = size === 'lg' ? 'h-12 w-12 rounded-xl' : 'h-9 w-9 rounded-lg'
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden border border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900',
        cls,
      )}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" loading="lazy" />
      ) : shop === 'locker' ? (
        <Lock className="h-4 w-4" aria-hidden />
      ) : (
        <ShoppingBag className="h-4 w-4" aria-hidden />
      )}
    </span>
  )
}

function ShopBadge({ shop, pill = false }: { shop: ReservationShop; pill?: boolean }) {
  const label = SHOP_LABEL[shop] ?? shop
  if (pill) {
    return (
      <span className="inline-flex w-fit items-center gap-1 rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-semibold tracking-wide text-brand-800 uppercase dark:border-zinc-700 dark:bg-zinc-950 dark:text-brand-300">
        {label}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border border-brand-200/70 bg-brand-50/70 px-2 py-0.5 text-[11px] font-semibold text-brand-800 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-300">
      {label}
    </span>
  )
}

type StatusTone = 'amber' | 'sky' | 'emerald' | 'zinc'

const STATUS_TONE: Record<string, StatusTone> = {
  pending: 'amber',
  submitted: 'amber',
  confirmed: 'sky',
  fulfilled: 'emerald',
  cancelled: 'zinc',
}

const STATUS_TONE_CLS: Record<StatusTone, { badge: string; dot: string }> = {
  amber: {
    badge:
      'border-amber-200/85 bg-gradient-to-br from-white to-amber-50/80 text-amber-950 dark:border-amber-500/22 dark:from-zinc-950 dark:to-amber-500/14 dark:text-amber-50',
    dot: 'bg-amber-500 shadow-[0_0_0_2px_rgba(255,255,255,0.95)] dark:bg-amber-400 dark:shadow-[0_0_0_2px_rgba(9,9,11,0.94)]',
  },
  sky: {
    badge:
      'border-sky-200/85 bg-gradient-to-br from-white to-sky-50/80 text-sky-950 dark:border-sky-500/22 dark:from-zinc-950 dark:to-sky-500/14 dark:text-sky-50',
    dot: 'bg-sky-500 shadow-[0_0_0_2px_rgba(255,255,255,0.95)] dark:bg-sky-400 dark:shadow-[0_0_0_2px_rgba(9,9,11,0.94)]',
  },
  emerald: {
    badge:
      'border-emerald-200/85 bg-gradient-to-br from-white to-emerald-50/80 text-emerald-950 dark:border-emerald-500/22 dark:from-zinc-950 dark:to-emerald-500/14 dark:text-emerald-50',
    dot: 'bg-emerald-500 shadow-[0_0_0_2px_rgba(255,255,255,0.95)] dark:bg-emerald-400 dark:shadow-[0_0_0_2px_rgba(9,9,11,0.94)]',
  },
  zinc: {
    badge:
      'border-zinc-200/85 bg-gradient-to-br from-white to-zinc-100/80 text-zinc-600 dark:border-zinc-600/40 dark:from-zinc-950 dark:to-zinc-800/60 dark:text-zinc-400',
    dot: 'bg-zinc-400 shadow-[0_0_0_2px_rgba(255,255,255,0.95)] dark:bg-zinc-500 dark:shadow-[0_0_0_2px_rgba(9,9,11,0.94)]',
  },
}

function StatusBadge({ status }: { status: ReservationStatus }) {
  const label = statusLabel(status)
  const tone = STATUS_TONE_CLS[STATUS_TONE[status] ?? 'zinc']
  const live = status === 'pending' || status === 'submitted'
  return (
    <span
      className={cn(
        'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-[10px] border px-2 py-1 text-[11px] font-medium leading-none shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:shadow-none',
        tone.badge,
      )}
      title={label}
    >
      <span
        className={cn(
          'inline-flex h-2 w-2 shrink-0 rounded-full',
          live && 'motion-safe:animate-pulse',
          tone.dot,
        )}
        aria-hidden
      />
      <span className="min-w-0 truncate tracking-[-0.01em]">{label}</span>
    </span>
  )
}
