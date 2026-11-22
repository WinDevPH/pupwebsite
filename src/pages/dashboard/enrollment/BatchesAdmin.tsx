import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  Eye,
  FilePen,
  Layers,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Table2,
  Trash2,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ConfirmDeleteDialog } from '@/components/portal/ConfirmDeleteDialog'
import { HorizontalDragScrollTableWrap } from '@/components/portal/HorizontalDragScrollTableWrap'
import { PortalActionMenu } from '@/components/portal/RegisterRowActions'
import { RequireLoginRedirect } from '@/components/portal/RequireLoginRedirect'
import {
  catalogInput,
  catalogSegIcon,
  catalogToolbarIconBtn,
  effectiveRegisterPageSize,
  initialRegisterView,
  plansRegisterPanelFooterCls,
  plansRegisterTableScrollerCls,
  readStoredRegisterPageSize,
  RegisterBulkSelectionBar,
  RegisterPaginationBar,
  RegisterPanelHeading,
  tableCheckboxCls,
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
  workspaceRegisterBulkSelectionPlacementCls,
  workspaceRegisterPanelShellCls,
  workspaceRegisterSectionStackCls,
  workspaceRegisterTableCls,
  workspaceRegisterTbodyRowCls,
  workspaceRegisterThActionsCellCls,
  workspaceRegisterThCheckboxCellCls,
  workspaceRegisterThSortCellCls,
  workspaceRegisterTheadCls,
  workspaceTenantMainStackCls,
  writeStoredRegisterPageSize,
  type RegisterView,
} from '@/components/portal/register-ui'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import {
  deleteAppointmentBatch,
  listAppointmentBatches,
  updateAppointmentBatch,
  updateEnrollmentWalkIn,
  type EnrollmentAppointmentBatch,
} from '@/lib/enrollment-batches-api'
import { cn } from '@/lib/utils'
import {
  EnrollmentEmptyState,
  EnrollmentPageHeader,
  EnrollmentStatusBadge,
} from '@/pages/dashboard/enrollment/enrollment-admin-ui'

const BASE_PATH = '/admin/enrollment/batches'
const PAGE_SIZE_KEY = 'pup-admin-enrollment-batches-page-size'
const VIEW_KEY = 'pup-admin-enrollment-batches-view'
const HEADING_ID = 'enrollment-batches-heading'
const REGISTER_TITLE = 'Queue register'

type PublishFilter = 'all' | 'published' | 'draft'

const PUBLISH_FILTERS: {
  id: PublishFilter
  label: string
  icon: typeof Layers
}[] = [
  { id: 'all', label: 'All', icon: Layers },
  { id: 'published', label: 'Published', icon: CheckCircle2 },
  { id: 'draft', label: 'Draft', icon: FilePen },
]

function WalkInToggle({
  open,
  busy,
  disabled,
  onChange,
}: {
  open: boolean
  busy?: boolean
  disabled?: boolean
  onChange: (next: 'OPEN' | 'CLOSED') => void
}) {
  return (
    <div
      role="group"
      aria-label="Walk-in status"
      className="inline-flex h-9 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-900"
    >
      {(['OPEN', 'CLOSED'] as const).map((option) => {
        const active = option === 'OPEN' ? open : !open
        return (
          <button
            key={option}
            type="button"
            disabled={disabled || busy}
            aria-pressed={active}
            onClick={() => onChange(option)}
            className={cn(
              'inline-flex min-w-[4.25rem] items-center justify-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold transition-colors disabled:opacity-60',
              active
                ? option === 'OPEN'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-zinc-700 text-white shadow-sm dark:bg-zinc-600'
                : 'text-zinc-500 hover:bg-white hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-950 dark:hover:text-zinc-200',
            )}
          >
            {busy && active ? (
              <Loader2 className="size-3 animate-spin" aria-hidden />
            ) : (
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  active
                    ? 'bg-white/90'
                    : option === 'OPEN'
                      ? 'bg-emerald-500/70'
                      : 'bg-zinc-400',
                )}
                aria-hidden
              />
            )}
            {option === 'OPEN' ? 'Open' : 'Closed'}
          </button>
        )
      })}
    </div>
  )
}

type QueueStatus = 'Serving' | 'Up next' | 'Closed'

function normalizeQueueStatus(status: string): QueueStatus {
  const key = status.trim().toLowerCase()
  if (key === 'serving') return 'Serving'
  if (key === 'closed') return 'Closed'
  return 'Up next'
}

function QueueStatusToggle({
  value,
  busy,
  disabled,
  onChange,
}: {
  value: QueueStatus
  busy?: boolean
  disabled?: boolean
  onChange: (next: QueueStatus) => void
}) {
  return (
    <div
      role="group"
      aria-label="Queue status"
      className="inline-flex h-7 rounded-md border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-900"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {(['Serving', 'Up next', 'Closed'] as const).map((option) => {
        const active = value === option
        return (
          <button
            key={option}
            type="button"
            disabled={disabled || busy}
            aria-pressed={active}
            onClick={() => onChange(option)}
            className={cn(
              'inline-flex min-w-[3.25rem] items-center justify-center rounded px-1.5 text-[10px] font-semibold transition-colors disabled:opacity-60',
              active
                ? option === 'Serving'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : option === 'Up next'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-zinc-700 text-white shadow-sm dark:bg-zinc-600'
                : 'text-zinc-500 hover:bg-white hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-950',
            )}
          >
            {busy && active ? <Loader2 className="size-3 animate-spin" aria-hidden /> : option}
          </button>
        )
      })}
    </div>
  )
}

function matchesPublish(row: EnrollmentAppointmentBatch, filter: PublishFilter) {
  if (filter === 'published') return row.published
  if (filter === 'draft') return !row.published
  return true
}

export default function BatchesAdmin() {
  const navigate = useNavigate()
  const location = useLocation()
  const [items, setItems] = useState<EnrollmentAppointmentBatch[]>([])
  const [walkIn, setWalkIn] = useState<'OPEN' | 'CLOSED'>('CLOSED')
  const [walkInBusy, setWalkInBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reloadBusy, setReloadBusy] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [query, setQuery] = useState('')
  const [publishFilter, setPublishFilter] = useState<PublishFilter>('all')
  const [pageNo, setPageNo] = useState(1)
  const [pageSize, setPageSize] = useState(() => readStoredRegisterPageSize(PAGE_SIZE_KEY))
  const [registerView, setRegisterView] = useState<RegisterView>(() =>
    initialRegisterView(VIEW_KEY),
  )
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [busyId, setBusyId] = useState<number | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<EnrollmentAppointmentBatch | null>(null)
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [toast, setToast] = useState<SnackToast | null>(null)
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (opts?.soft) setReloadBusy(true)
      else setLoading(true)
      const result = await listAppointmentBatches({ all: true })
      if (!result.ok) {
        setItems([])
        if (result.status === 401 || result.status === 403) setNeedsLogin(true)
        else {
          setNeedsLogin(false)
          showToast(result.error, 'error')
        }
      } else {
        setNeedsLogin(false)
        setItems(result.data.items)
        const wi = result.data.walkIn?.toUpperCase()
        setWalkIn(wi === 'OPEN' ? 'OPEN' : 'CLOSED')
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
  }, [query, pageSize, publishFilter])

  const counts = useMemo(
    () => ({
      all: items.length,
      published: items.filter((row) => row.published).length,
      draft: items.filter((row) => !row.published).length,
    }),
    [items],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter((row) => {
      if (!matchesPublish(row, publishFilter)) return false
      if (!needle) return true
      const publishedLabel = row.published ? 'published' : 'draft'
      return `${row.label} ${row.windowLabel} ${row.status} ${publishedLabel} ${row.scheduledCount}`
        .toLowerCase()
        .includes(needle)
    })
  }, [items, query, publishFilter])

  const pageMeta = useMemo(() => {
    const total = filtered.length
    const psz = effectiveRegisterPageSize(pageSize, total)
    const pages = total === 0 ? 0 : Math.ceil(total / psz)
    const page = pages === 0 ? 1 : Math.min(Math.max(1, pageNo), pages)
    const start = total === 0 ? 0 : (page - 1) * psz
    return {
      total,
      pages,
      page,
      from: total === 0 ? 0 : start + 1,
      to: total === 0 ? 0 : Math.min(start + psz, total),
      rows: total === 0 ? [] : filtered.slice(start, start + psz),
    }
  }, [filtered, pageNo, pageSize])

  const pageIds = useMemo(() => pageMeta.rows.map((row) => row.id), [pageMeta.rows])
  const selectedOnPageCount = useMemo(
    () => pageIds.filter((id) => selectedIds.includes(id)).length,
    [pageIds, selectedIds],
  )

  useEffect(() => {
    const el = selectAllCheckboxRef.current
    if (!el) return
    el.indeterminate = selectedOnPageCount > 0 && selectedOnPageCount < pageIds.length
  }, [selectedOnPageCount, pageIds.length])

  function toggleRowSelected(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleVisibleSelection() {
    setSelectedIds((prev) => {
      const allOnPage = pageIds.length > 0 && pageIds.every((id) => prev.includes(id))
      if (allOnPage) return prev.filter((id) => !pageIds.includes(id))
      const next = new Set(prev)
      for (const id of pageIds) next.add(id)
      return [...next]
    })
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
    navigate(`${BASE_PATH}/new`)
  }

  function goEdit(item: EnrollmentAppointmentBatch) {
    navigate(`${BASE_PATH}/${item.id}/edit`)
  }

  function goView(item: EnrollmentAppointmentBatch) {
    setOpenMenuId(null)
    navigate(`${BASE_PATH}/${item.id}`)
  }

  async function setWalkInStatus(next: 'OPEN' | 'CLOSED') {
    if (walkIn === next) return
    setWalkInBusy(true)
    const result = await updateEnrollmentWalkIn(next)
    setWalkInBusy(false)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) setNeedsLogin(true)
      else showToast(result.error, 'error')
      return
    }
    setWalkIn(next)
    showToast(`Walk-in queue is ${next === 'OPEN' ? 'open' : 'closed'}.`, 'success')
  }

  async function setBatchQueueStatus(row: EnrollmentAppointmentBatch, next: QueueStatus) {
    if (normalizeQueueStatus(row.status) === next) return

    setBusyId(row.id)

    if (next === 'Serving') {
      const others = items.filter(
        (item) => item.id !== row.id && normalizeQueueStatus(item.status) === 'Serving',
      )
      for (const other of others) {
        const demote = await updateAppointmentBatch({
          id: other.id,
          label: other.label,
          windowLabel: other.windowLabel,
          scheduledCount: other.scheduledCount,
          status: 'Up next',
          sortOrder: other.sortOrder,
          published: other.published,
        })
        if (!demote.ok) {
          setBusyId(null)
          if (demote.status === 401 || demote.status === 403) setNeedsLogin(true)
          else showToast(demote.error, 'error')
          return
        }
      }
    }

    const result = await updateAppointmentBatch({
      id: row.id,
      label: row.label,
      windowLabel: row.windowLabel,
      scheduledCount: row.scheduledCount,
      status: next,
      sortOrder: row.sortOrder,
      published: row.published,
    })
    setBusyId(null)

    if (!result.ok) {
      if (result.status === 401 || result.status === 403) setNeedsLogin(true)
      else showToast(result.error, 'error')
      return
    }

    await load({ soft: true })
    const message =
      next === 'Serving'
        ? `${row.label} is now serving.`
        : next === 'Closed'
          ? `${row.label} marked closed.`
          : `${row.label} moved to up next.`
    showToast(message, 'success')
  }

  async function handleDelete() {
    if (!pendingDelete) return
    const target = pendingDelete
    setBusyId(target.id)
    const result = await deleteAppointmentBatch(target.id)
    setBusyId(null)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) setNeedsLogin(true)
      else showToast(result.error, 'error')
      return
    }
    showToast('Appointment batch deleted.', 'success')
    setSelectedIds((prev) => prev.filter((id) => id !== target.id))
    setPendingDelete(null)
    setItems((prev) => prev.filter((item) => item.id !== target.id))
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setBulkDeleting(true)
    let failed = 0
    for (const id of ids) {
      const result = await deleteAppointmentBatch(id)
      if (!result.ok) failed += 1
    }
    setBulkDeleting(false)
    setPendingBulkDelete(false)
    setSelectedIds([])
    if (failed > 0) showToast(`Deleted with ${failed} error(s).`, 'error')
    else {
      showToast(
        ids.length === 1 ? 'Appointment batch deleted.' : `${ids.length} appointment batches deleted.`,
        'success',
      )
    }
    await load({ soft: true })
  }

  const busy = loading || reloadBusy || busyId !== null || bulkDeleting || walkInBusy

  if (needsLogin) return <RequireLoginRedirect />

  const paginationBar = (
    <RegisterPaginationBar
      disabled={busy}
      showingFrom={pageMeta.from}
      showingTo={pageMeta.to}
      totalRecords={pageMeta.total}
      pageSize={pageSize}
      onPageSizeChange={(n) => {
        setPageSize(n)
        writeStoredRegisterPageSize(PAGE_SIZE_KEY, n)
      }}
      page={pageMeta.page}
      totalPages={pageMeta.pages}
      onPrev={() => setPageNo((p) => (p <= 1 ? p : p - 1))}
      onNext={() => setPageNo((p) => Math.min(pageMeta.pages, p + 1))}
      onGoPage={(pn) => setPageNo(Math.min(Math.max(1, pn), pageMeta.pages))}
      ariaLabel="Appointment batches pagination"
    />
  )

  const reloadBtn = (extraCls: string) => (
    <button
      type="button"
      disabled={busy}
      title="Reload catalog"
      aria-label="Reload catalog"
      onClick={() => void load({ soft: true })}
      className={`${catalogToolbarIconBtn} ${extraCls}`}
    >
      <RefreshCw
        className={`${workspaceCatalogToolbarIconCls} ${reloadBusy ? 'animate-spin' : 'opacity-85'}`}
        aria-hidden
      />
    </button>
  )

  function rowActions(row: EnrollmentAppointmentBatch) {
    return (
      <PortalActionMenu
        open={openMenuId === row.id}
        onOpenChange={(open) => setOpenMenuId(open ? row.id : null)}
        disabled={busyId === row.id}
        items={[
          { id: 'view', label: 'View students', icon: Eye, onClick: () => goView(row) },
          { id: 'edit', label: 'Edit', icon: Pencil, onClick: () => goEdit(row) },
          {
            id: 'delete',
            label: 'Delete',
            icon: Trash2,
            danger: true,
            onClick: () => setPendingDelete(row),
          },
        ]}
      />
    )
  }

  return (
    <div className={workspaceTenantMainStackCls}>
      <EnrollmentPageHeader
        title="Serving Queue"
        description="Drive the live enrollment queue: set who is serving, open or close walk-ins, and keep the public board accurate."
        action={
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Walk-in</p>
              <WalkInToggle
                open={walkIn === 'OPEN'}
                busy={walkInBusy}
                disabled={busy && !walkInBusy}
                onChange={(next) => void setWalkInStatus(next)}
              />
            </div>
            <button type="button" className={workspacePageAddBtnCls} onClick={goCreate}>
              <Plus className="h-4 w-4" aria-hidden />
              Add batch
            </button>
          </>
        }
      />

      <section aria-label="Catalog" className="w-full max-w-none">
        <div className={`${workspaceCatalogShellCls} ${workspaceCatalogPadCls} w-full max-w-none`}>
          <div
            role="toolbar"
            aria-label="Batches catalog filters"
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
                    placeholder="Search label, window, status…"
                    aria-label="Search appointment batches"
                    className={`${catalogInput} min-w-0 w-full pl-9`}
                  />
                </div>
                {reloadBtn('sm:hidden')}
              </div>

              <div className={workspaceCatalogToolbarActionsRowCls}>
                {reloadBtn('max-sm:hidden')}

                <div
                  role="radiogroup"
                  aria-label="Filter by publish state"
                  className={workspaceCatalogSegTrackInlineCls}
                >
                  {PUBLISH_FILTERS.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={publishFilter === id}
                      title={`${label} (${counts[id]})`}
                      aria-label={`${label} (${counts[id]})`}
                      onClick={() => setPublishFilter(id)}
                      className={catalogSegIcon(publishFilter === id)}
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
                    <Table2 className={`${workspaceCatalogToolbarIconCls} opacity-85`} aria-hidden />
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
        aria-labelledby={HEADING_ID}
        aria-label={REGISTER_TITLE}
        className={workspaceRegisterSectionStackCls}
      >
        <div className={workspaceRegisterBulkSelectionPlacementCls}>
          <RegisterBulkSelectionBar
            count={selectedIds.length}
            disabled={busy}
            onClear={() => setSelectedIds([])}
            onDelete={() => setPendingBulkDelete(true)}
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-zinc-300/90 bg-zinc-50/80 px-5 py-12 text-[13px] text-zinc-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400">
            <h2 id={HEADING_ID} className="sr-only">
              {REGISTER_TITLE}
            </h2>
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-hidden />
            Loading batches…
          </div>
        ) : filtered.length === 0 ? (
          <div className={workspaceRegisterPanelShellCls(registerView)}>
            <RegisterPanelHeading
              headingId={HEADING_ID}
              title={REGISTER_TITLE}
              subtitle={`${items.length === 0 ? '0' : '0 matching'} in catalog`}
              onAdd={goCreate}
              addAriaLabel="Add batch"
            />
            <div className="min-w-0 bg-white px-4 py-5 sm:px-5 sm:py-6 dark:bg-zinc-950">
              <EnrollmentEmptyState
                Icon={Layers}
                title={items.length === 0 ? 'No queue batches yet' : 'No matching batches'}
                description={
                  items.length === 0
                    ? 'Add morning/afternoon batches to drive the public now-serving board.'
                    : 'Adjust search or publish filter to see more batches.'
                }
                actionLabel={items.length === 0 ? 'Add batch' : undefined}
                onAction={items.length === 0 ? goCreate : undefined}
              />
            </div>
            <footer className={plansRegisterPanelFooterCls}>{paginationBar}</footer>
          </div>
        ) : registerView === 'table' ? (
          <div className={workspaceRegisterPanelShellCls('table')}>
            <RegisterPanelHeading
              headingId={HEADING_ID}
              title={REGISTER_TITLE}
              subtitle={`${pageMeta.total.toLocaleString()} record${pageMeta.total === 1 ? '' : 's'}`}
              onAdd={goCreate}
              addAriaLabel="Add batch"
            />
            <HorizontalDragScrollTableWrap className={plansRegisterTableScrollerCls}>
              <table className={workspaceRegisterTableCls}>
                <caption className="sr-only">Appointment batches</caption>
                <thead className={workspaceRegisterTheadCls}>
                  <tr className="[&_th]:text-brand-900/80 dark:[&_th]:text-zinc-300">
                    <th scope="col" className={workspaceRegisterThCheckboxCellCls}>
                      <input
                        ref={selectAllCheckboxRef}
                        type="checkbox"
                        className={tableCheckboxCls}
                        checked={pageIds.length > 0 && selectedOnPageCount === pageIds.length}
                        onChange={toggleVisibleSelection}
                        disabled={busy || pageIds.length === 0}
                        aria-label="Select all batches on this page"
                      />
                    </th>
                    <th scope="col" className={cn(workspaceRegisterThSortCellCls, 'text-left')}>
                      Label
                    </th>
                    <th scope="col" className={cn(workspaceRegisterThSortCellCls, 'text-left')}>
                      Window
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[6.5rem] text-left')}
                    >
                      Scheduled
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[7.5rem] text-left')}
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[7.5rem] text-left')}
                    >
                      Published
                    </th>
                    <th scope="col" className={workspaceRegisterThActionsCellCls}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-950">
                  {pageMeta.rows.map((row) => {
                    const selectedRow = selectedIds.includes(row.id)
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          workspaceRegisterTbodyRowCls,
                          'cursor-pointer',
                          selectedRow && 'bg-brand-50/85 dark:bg-brand-500/10',
                        )}
                        aria-selected={selectedRow}
                        onClick={() => goView(row)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            goView(row)
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`View batch ${row.label}`}
                      >
                        <td
                          className="w-[2.5rem] whitespace-nowrap px-1 py-2 text-center sm:w-11 sm:px-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className={tableCheckboxCls}
                            checked={selectedRow}
                            disabled={busy}
                            aria-label={`Select ${row.label}`}
                            onChange={() => toggleRowSelected(row.id)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <Layers className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                            <span className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                              {row.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-[12px] text-zinc-600 dark:text-zinc-400">
                          <span className="line-clamp-2">{row.windowLabel || '—'}</span>
                        </td>
                        <td className="px-2 py-2 text-[12px] tabular-nums text-zinc-600 dark:text-zinc-400">
                          {row.scheduledCount}
                        </td>
                        <td className="px-2 py-2">
                          <QueueStatusToggle
                            value={normalizeQueueStatus(row.status)}
                            busy={busyId === row.id}
                            disabled={busy && busyId !== row.id}
                            onChange={(next) => void setBatchQueueStatus(row, next)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <EnrollmentStatusBadge published={row.published} />
                        </td>
                        <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end">{rowActions(row)}</div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </HorizontalDragScrollTableWrap>
            <footer className={plansRegisterPanelFooterCls}>{paginationBar}</footer>
          </div>
        ) : (
          <div className={workspaceRegisterPanelShellCls('cards')}>
            <RegisterPanelHeading
              headingId={HEADING_ID}
              title={REGISTER_TITLE}
              subtitle={`${pageMeta.total.toLocaleString()} record${pageMeta.total === 1 ? '' : 's'}`}
              onAdd={goCreate}
              addAriaLabel="Add batch"
            />
            <ul className="grid gap-3 bg-transparent px-0 py-2.5 sm:grid-cols-2 sm:gap-3 sm:bg-white sm:px-4 sm:py-4 xl:grid-cols-3 dark:sm:bg-zinc-950">
              {pageMeta.rows.map((row) => {
                const selectedRow = selectedIds.includes(row.id)
                return (
                  <li key={row.id} className="min-w-0">
                    <article
                      className={cn(
                        'group flex h-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-2xl border transition outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                        selectedRow
                          ? 'border-brand-300/70 bg-brand-50/40 dark:border-brand-500/35 dark:bg-brand-500/10'
                          : 'border-zinc-200/80 bg-zinc-50/50 hover:border-brand-300/60 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-brand-500/30 dark:hover:bg-zinc-950',
                      )}
                      onClick={() => goView(row)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          goView(row)
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`View ${row.label}`}
                    >
                      <div className="flex items-start justify-between gap-2 p-3.5 pb-0">
                        <label
                          className="inline-flex cursor-pointer items-center rounded-lg bg-white p-1.5 shadow-sm dark:bg-zinc-950 dark:shadow-none"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className={tableCheckboxCls}
                            checked={selectedRow}
                            disabled={busy}
                            aria-label={`Select ${row.label}`}
                            onChange={() => toggleRowSelected(row.id)}
                          />
                        </label>
                        <div
                          className="flex flex-wrap items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <EnrollmentStatusBadge published={row.published} />
                          {rowActions(row)}
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col gap-2.5 p-3.5 pt-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                            {row.label}
                          </h3>
                          <p className="mt-1 truncate text-[12px] text-zinc-500 dark:text-zinc-400">
                            {row.windowLabel || '—'}
                          </p>
                        </div>
                        <div className="rounded-xl border border-zinc-200/70 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                          <p className="inline-flex items-center gap-1.5 truncate text-[12px] font-medium text-zinc-800 dark:text-zinc-200">
                            <Layers className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden />
                            {row.scheduledCount} in queue
                          </p>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <QueueStatusToggle
                            value={normalizeQueueStatus(row.status)}
                            busy={busyId === row.id}
                            disabled={busy && busyId !== row.id}
                            onChange={(next) => void setBatchQueueStatus(row, next)}
                          />
                        </div>
                      </div>
                    </article>
                  </li>
                )
              })}
            </ul>
            <footer className={plansRegisterPanelFooterCls}>{paginationBar}</footer>
          </div>
        )}
      </section>

      {pendingDelete ? (
        <ConfirmDeleteDialog
          title={pendingDelete.label || 'Batch'}
          noun="appointment batch"
          description="This batch will be removed from the enrollment hub. This action cannot be undone."
          busy={busyId === pendingDelete.id}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}

      {pendingBulkDelete ? (
        <ConfirmDeleteDialog
          title={`${selectedIds.length} selected batch${selectedIds.length === 1 ? '' : 'es'}`}
          noun="appointment batches"
          description="These batches will be removed from the enrollment hub. This action cannot be undone."
          busy={bulkDeleting}
          bulk
          onCancel={() => setPendingBulkDelete(false)}
          onConfirm={() => void handleBulkDelete()}
        />
      ) : null}

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

