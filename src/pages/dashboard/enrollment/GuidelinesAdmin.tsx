import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  FileText,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Table2,
  Trash2,
  X,
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
import { Button } from '@/components/ui/button'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import { setPageScrollLocked } from '@/hooks/useLenis'
import {
  deleteBatchWindow,
  deleteScheduleDay,
  listBatchWindows,
  listScheduleDays,
  type EnrollmentBatchWindow,
  type EnrollmentScheduleDay,
} from '@/lib/enrollment-guidelines-api'
import { cn } from '@/lib/utils'
import {
  EnrollmentEmptyState,
  EnrollmentPageHeader,
  EnrollmentStatusBadge,
} from '@/pages/dashboard/enrollment/enrollment-admin-ui'

const BASE_PATH = '/admin/enrollment/guidelines'
const SCHEDULE_PAGE_KEY = 'pup-admin-enrollment-schedule-page-size'
const WINDOWS_PAGE_KEY = 'pup-admin-enrollment-windows-page-size'
const VIEW_KEY = 'pup-admin-enrollment-guidelines-view'
const SCHEDULE_HEADING_ID = 'enrollment-schedule-heading'
const WINDOWS_HEADING_ID = 'enrollment-windows-heading'
const TAB_KEY = 'pup-admin-enrollment-guidelines-tab'
const SCHEDULE_REGISTER_TITLE = 'Schedule days register'
const WINDOWS_REGISTER_TITLE = 'Batch windows register'

type GuidelinesTab = 'schedule' | 'windows'
type PublishFilter = 'all' | 'published' | 'draft'

type PendingDelete =
  | { kind: 'schedule'; row: EnrollmentScheduleDay }
  | { kind: 'window'; row: EnrollmentBatchWindow }

const TABS: { id: GuidelinesTab; label: string; icon: typeof CalendarDays }[] = [
  { id: 'schedule', label: 'Schedule days', icon: CalendarDays },
  { id: 'windows', label: 'Batch windows', icon: Clock },
]

const PUBLISH_FILTERS: {
  id: PublishFilter
  label: string
  icon: typeof ClipboardList
}[] = [
  { id: 'all', label: 'All', icon: ClipboardList },
  { id: 'published', label: 'Published', icon: CheckCircle2 },
  { id: 'draft', label: 'Draft', icon: FileText },
]

function readStoredTab(): GuidelinesTab {
  try {
    const saved = sessionStorage.getItem(TAB_KEY)
    if (saved === 'schedule' || saved === 'windows') return saved
  } catch {
    /* ignore */
  }
  return 'schedule'
}

function matchesPublish(rowPublished: boolean, filter: PublishFilter) {
  if (filter === 'all') return true
  if (filter === 'published') return rowPublished
  return !rowPublished
}

function paginate<T>(items: T[], pageNo: number, pageSize: number) {
  const total = items.length
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
    rows: total === 0 ? [] : items.slice(start, start + psz),
  }
}

export default function GuidelinesAdmin() {
  const navigate = useNavigate()
  const location = useLocation()
  const [tab, setTab] = useState<GuidelinesTab>(() => readStoredTab())
  const [scheduleDays, setScheduleDays] = useState<EnrollmentScheduleDay[]>([])
  const [batchWindows, setBatchWindows] = useState<EnrollmentBatchWindow[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadBusy, setReloadBusy] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [query, setQuery] = useState('')
  const [publishFilter, setPublishFilter] = useState<PublishFilter>('all')
  const [schedulePage, setSchedulePage] = useState(1)
  const [windowsPage, setWindowsPage] = useState(1)
  const [schedulePageSize, setSchedulePageSize] = useState(() =>
    readStoredRegisterPageSize(SCHEDULE_PAGE_KEY),
  )
  const [windowsPageSize, setWindowsPageSize] = useState(() =>
    readStoredRegisterPageSize(WINDOWS_PAGE_KEY),
  )
  const [registerView, setRegisterView] = useState<RegisterView>(() =>
    initialRegisterView(VIEW_KEY),
  )
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<number[]>([])
  const [selectedWindowIds, setSelectedWindowIds] = useState<number[]>([])
  const [busyId, setBusyId] = useState<number | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [viewingSchedule, setViewingSchedule] = useState<EnrollmentScheduleDay | null>(null)
  const [viewingWindow, setViewingWindow] = useState<EnrollmentBatchWindow | null>(null)
  const [toast, setToast] = useState<SnackToast | null>(null)
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (opts?.soft) setReloadBusy(true)
      else setLoading(true)
      const [scheduleResult, windowsResult] = await Promise.all([
        listScheduleDays({ all: true }),
        listBatchWindows({ all: true }),
      ])
      if (!scheduleResult.ok) {
        setScheduleDays([])
        setBatchWindows([])
        if (scheduleResult.status === 401 || scheduleResult.status === 403) setNeedsLogin(true)
        else {
          setNeedsLogin(false)
          showToast(scheduleResult.error, 'error')
        }
      } else if (!windowsResult.ok) {
        setScheduleDays([])
        setBatchWindows([])
        if (windowsResult.status === 401 || windowsResult.status === 403) setNeedsLogin(true)
        else {
          setNeedsLogin(false)
          showToast(windowsResult.error, 'error')
        }
      } else {
        setNeedsLogin(false)
        setScheduleDays(scheduleResult.data.items)
        setBatchWindows(windowsResult.data.items)
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
    setSchedulePage(1)
    setWindowsPage(1)
  }, [query, schedulePageSize, windowsPageSize, publishFilter])

  const isSchedule = tab === 'schedule'
  const catalogItems = isSchedule ? scheduleDays : batchWindows

  const publishCounts = useMemo(() => {
    const items = catalogItems
    return {
      all: items.length,
      published: items.filter((row) => row.published).length,
      draft: items.filter((row) => !row.published).length,
    }
  }, [catalogItems])

  const filteredSchedule = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return scheduleDays.filter((row) => {
      if (!matchesPublish(row.published, publishFilter)) return false
      if (!needle) return true
      return `${row.dateLabel} ${row.groupLabel} ${row.dayLabel}`.toLowerCase().includes(needle)
    })
  }, [scheduleDays, query, publishFilter])

  const filteredWindows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return batchWindows.filter((row) => {
      if (!matchesPublish(row.published, publishFilter)) return false
      if (!needle) return true
      return `${row.label} ${row.timeLabel} ${row.detail} ${row.tone}`.toLowerCase().includes(needle)
    })
  }, [batchWindows, query, publishFilter])

  const pageSize = isSchedule ? schedulePageSize : windowsPageSize
  const schedulePageMeta = useMemo(
    () => paginate(filteredSchedule, schedulePage, schedulePageSize),
    [filteredSchedule, schedulePage, schedulePageSize],
  )
  const windowsPageMeta = useMemo(
    () => paginate(filteredWindows, windowsPage, windowsPageSize),
    [filteredWindows, windowsPage, windowsPageSize],
  )
  const pageMeta = isSchedule ? schedulePageMeta : windowsPageMeta

  const selectedIds = isSchedule ? selectedScheduleIds : selectedWindowIds
  const setSelectedIds = isSchedule ? setSelectedScheduleIds : setSelectedWindowIds

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

  function selectTab(next: GuidelinesTab) {
    setTab(next)
    setOpenMenuId(null)
    setViewingSchedule(null)
    setViewingWindow(null)
    setSelectedScheduleIds([])
    setSelectedWindowIds([])
    try {
      sessionStorage.setItem(TAB_KEY, next)
    } catch {
      /* ignore */
    }
  }

  function setRegisterViewPref(view: RegisterView) {
    setRegisterView(view)
    try {
      sessionStorage.setItem(VIEW_KEY, view)
    } catch {
      /* ignore */
    }
  }

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

  function goCreate() {
    navigate(`${BASE_PATH}/${isSchedule ? 'schedule' : 'windows'}/new`)
  }

  function goEditSchedule(row: EnrollmentScheduleDay) {
    setViewingSchedule(null)
    navigate(`${BASE_PATH}/schedule/${row.id}/edit`)
  }

  function goEditWindow(row: EnrollmentBatchWindow) {
    setViewingWindow(null)
    navigate(`${BASE_PATH}/windows/${row.id}/edit`)
  }

  function goViewSchedule(row: EnrollmentScheduleDay) {
    setOpenMenuId(null)
    setViewingSchedule(row)
  }

  function goViewWindow(row: EnrollmentBatchWindow) {
    setOpenMenuId(null)
    setViewingWindow(row)
  }

  async function handleDelete() {
    if (!pendingDelete) return
    setBusyId(pendingDelete.row.id)
    const result =
      pendingDelete.kind === 'schedule'
        ? await deleteScheduleDay(pendingDelete.row.id)
        : await deleteBatchWindow(pendingDelete.row.id)
    setBusyId(null)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) setNeedsLogin(true)
      else showToast(result.error, 'error')
      return
    }
    const deletedId = pendingDelete.row.id
    const kind = pendingDelete.kind
    showToast(kind === 'schedule' ? 'Schedule day deleted.' : 'Batch window deleted.', 'success')
    setPendingDelete(null)
    if (kind === 'schedule') {
      setSelectedScheduleIds((prev) => prev.filter((id) => id !== deletedId))
      setViewingSchedule((current) => (current?.id === deletedId ? null : current))
      setScheduleDays((prev) => prev.filter((item) => item.id !== deletedId))
    } else {
      setSelectedWindowIds((prev) => prev.filter((id) => id !== deletedId))
      setViewingWindow((current) => (current?.id === deletedId ? null : current))
      setBatchWindows((prev) => prev.filter((item) => item.id !== deletedId))
    }
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setBulkDeleting(true)
    let failed = 0
    for (const id of ids) {
      const result = isSchedule ? await deleteScheduleDay(id) : await deleteBatchWindow(id)
      if (!result.ok) failed += 1
    }
    setBulkDeleting(false)
    setPendingBulkDelete(false)
    setSelectedIds([])
    if (failed > 0) showToast(`Deleted with ${failed} error(s).`, 'error')
    else {
      showToast(
        ids.length === 1
          ? isSchedule
            ? 'Schedule day deleted.'
            : 'Batch window deleted.'
          : isSchedule
            ? `${ids.length} schedule days deleted.`
            : `${ids.length} batch windows deleted.`,
        'success',
      )
    }
    await load({ soft: true })
  }

  const busy = loading || reloadBusy || busyId !== null || bulkDeleting

  if (needsLogin) return <RequireLoginRedirect />

  const headingId = isSchedule ? SCHEDULE_HEADING_ID : WINDOWS_HEADING_ID
  const registerTitle = isSchedule ? SCHEDULE_REGISTER_TITLE : WINDOWS_REGISTER_TITLE
  const catalogEmpty = catalogItems.length === 0

  const paginationBar = (
    <RegisterPaginationBar
      disabled={busy}
      showingFrom={pageMeta.from}
      showingTo={pageMeta.to}
      totalRecords={pageMeta.total}
      pageSize={pageSize}
      onPageSizeChange={(n) => {
        if (isSchedule) {
          setSchedulePageSize(n)
          writeStoredRegisterPageSize(SCHEDULE_PAGE_KEY, n)
        } else {
          setWindowsPageSize(n)
          writeStoredRegisterPageSize(WINDOWS_PAGE_KEY, n)
        }
      }}
      page={pageMeta.page}
      totalPages={pageMeta.pages}
      onPrev={() =>
        (isSchedule ? setSchedulePage : setWindowsPage)((p) => (p <= 1 ? p : p - 1))
      }
      onNext={() =>
        (isSchedule ? setSchedulePage : setWindowsPage)((p) => Math.min(pageMeta.pages, p + 1))
      }
      onGoPage={(pn) =>
        (isSchedule ? setSchedulePage : setWindowsPage)(
          Math.min(Math.max(1, pn), pageMeta.pages),
        )
      }
      ariaLabel={isSchedule ? 'Schedule days pagination' : 'Batch windows pagination'}
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

  function scheduleRowActions(row: EnrollmentScheduleDay) {
    return (
      <PortalActionMenu
        open={openMenuId === row.id && isSchedule}
        onOpenChange={(open) => setOpenMenuId(open ? row.id : null)}
        disabled={busyId === row.id}
        items={[
          {
            id: 'view',
            label: 'View details',
            icon: Eye,
            onClick: () => goViewSchedule(row),
          },
          {
            id: 'edit',
            label: 'Edit',
            icon: Pencil,
            onClick: () => goEditSchedule(row),
          },
          {
            id: 'delete',
            label: 'Delete',
            icon: Trash2,
            danger: true,
            onClick: () => setPendingDelete({ kind: 'schedule', row }),
          },
        ]}
      />
    )
  }

  function windowRowActions(row: EnrollmentBatchWindow) {
    return (
      <PortalActionMenu
        open={openMenuId === row.id && !isSchedule}
        onOpenChange={(open) => setOpenMenuId(open ? row.id : null)}
        disabled={busyId === row.id}
        items={[
          {
            id: 'view',
            label: 'View details',
            icon: Eye,
            onClick: () => goViewWindow(row),
          },
          {
            id: 'edit',
            label: 'Edit',
            icon: Pencil,
            onClick: () => goEditWindow(row),
          },
          {
            id: 'delete',
            label: 'Delete',
            icon: Trash2,
            danger: true,
            onClick: () => setPendingDelete({ kind: 'window', row }),
          },
        ]}
      />
    )
  }

  const emptyDescription =
    catalogEmpty
      ? isSchedule
        ? 'Add enrollment schedule days for the public guidelines calendar.'
        : 'Add time windows shown alongside the public enrollment guidelines.'
      : 'Adjust search or publish filter to see more records.'

  const emptyTitle = catalogEmpty
    ? isSchedule
      ? 'No schedule days yet'
      : 'No batch windows yet'
    : isSchedule
      ? 'No matching schedule days'
      : 'No matching batch windows'

  const emptyIcon = isSchedule ? CalendarDays : Clock
  const addLabel = isSchedule ? 'Add schedule day' : 'Add batch window'

  return (
    <div className={workspaceTenantMainStackCls}>
      <EnrollmentPageHeader
        title="Guidelines"
        description="Manage schedule days and batch windows that appear on the public enrollment guidelines page."
        action={
          <button type="button" className={workspacePageAddBtnCls} onClick={goCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            {isSchedule ? 'Add schedule day' : 'Add batch window'}
          </button>
        }
      />

      <div
        role="tablist"
        aria-label="Guidelines sections"
        className="-mx-0.5 flex gap-0.5 overflow-x-auto rounded-xl border border-zinc-200/90 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-950 [scrollbar-width:thin]"
      >
        {TABS.map((item) => {
          const Icon = item.icon
          const active = tab === item.id
          const count = item.id === 'schedule' ? scheduleDays.length : batchWindows.length
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={busy && loading}
              onClick={() => selectTab(item.id)}
              className={cn(
                'inline-flex shrink-0 min-h-8 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition sm:min-h-9 sm:px-3 sm:text-[12px]',
                active
                  ? 'bg-brand-50 text-brand-900 dark:bg-brand-500/15 dark:text-brand-100'
                  : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900',
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              <span className="whitespace-nowrap">{item.label}</span>
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                  active
                    ? 'bg-brand-100/90 text-brand-800 dark:bg-brand-500/25 dark:text-brand-100'
                    : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <section aria-label="Catalog" className="w-full max-w-none">
        <div className={`${workspaceCatalogShellCls} ${workspaceCatalogPadCls} w-full max-w-none`}>
          <div
            role="toolbar"
            aria-label={isSchedule ? 'Schedule days catalog filters' : 'Batch windows catalog filters'}
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
                    placeholder={
                      isSchedule ? 'Search schedule days…' : 'Search batch windows…'
                    }
                    aria-label={isSchedule ? 'Search schedule days' : 'Search batch windows'}
                    className={`${catalogInput} min-w-0 w-full pl-9`}
                  />
                </div>
                {reloadBtn('sm:hidden')}
              </div>

              <div className={workspaceCatalogToolbarActionsRowCls}>
                {reloadBtn('max-sm:hidden')}

                <div
                  role="radiogroup"
                  aria-label="Filter by publish status"
                  className={workspaceCatalogSegTrackInlineCls}
                >
                  {PUBLISH_FILTERS.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={publishFilter === id}
                      title={`${label} (${publishCounts[id]})`}
                      aria-label={`${label} (${publishCounts[id]})`}
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
        aria-labelledby={headingId}
        aria-label={registerTitle}
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
            <h2 id={headingId} className="sr-only">
              {registerTitle}
            </h2>
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-hidden />
            Loading guidelines…
          </div>
        ) : pageMeta.total === 0 ? (
          <div className={workspaceRegisterPanelShellCls(registerView)}>
            <RegisterPanelHeading
              headingId={headingId}
              title={isSchedule ? 'Schedule days' : 'Batch windows'}
              subtitle={`${catalogEmpty ? '0' : '0 matching'} in catalog`}
              onAdd={goCreate}
              addAriaLabel={addLabel}
            />
            <div className="min-w-0 bg-white px-4 py-5 sm:px-5 sm:py-6 dark:bg-zinc-950">
              <EnrollmentEmptyState
                Icon={emptyIcon}
                title={emptyTitle}
                description={emptyDescription}
                actionLabel={catalogEmpty ? addLabel : undefined}
                onAction={catalogEmpty ? goCreate : undefined}
              />
            </div>
            <footer className={plansRegisterPanelFooterCls}>{paginationBar}</footer>
          </div>
        ) : registerView === 'table' ? (
          <div className={workspaceRegisterPanelShellCls('table')}>
            <RegisterPanelHeading
              headingId={headingId}
              title={isSchedule ? 'Schedule days' : 'Batch windows'}
              subtitle={`${pageMeta.total.toLocaleString()} record${pageMeta.total === 1 ? '' : 's'}`}
              onAdd={goCreate}
              addAriaLabel={addLabel}
            />
            <HorizontalDragScrollTableWrap className={plansRegisterTableScrollerCls}>
              <table className={workspaceRegisterTableCls}>
                <caption className="sr-only">
                  {isSchedule ? 'Enrollment schedule days' : 'Enrollment batch windows'}
                </caption>
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
                        aria-label={`Select all ${isSchedule ? 'schedule days' : 'batch windows'} on this page`}
                      />
                    </th>
                    {isSchedule ? (
                      <>
                        <th scope="col" className={cn(workspaceRegisterThSortCellCls, 'text-left')}>
                          Date
                        </th>
                        <th scope="col" className={cn(workspaceRegisterThSortCellCls, 'text-left')}>
                          Group
                        </th>
                        <th scope="col" className={cn(workspaceRegisterThSortCellCls, 'text-left')}>
                          Day
                        </th>
                        <th
                          scope="col"
                          className={cn(workspaceRegisterThSortCellCls, 'w-[5rem] text-left')}
                        >
                          Muted
                        </th>
                        <th
                          scope="col"
                          className={cn(workspaceRegisterThSortCellCls, 'w-[5rem] text-left')}
                        >
                          Sort
                        </th>
                      </>
                    ) : (
                      <>
                        <th scope="col" className={cn(workspaceRegisterThSortCellCls, 'text-left')}>
                          Label
                        </th>
                        <th scope="col" className={cn(workspaceRegisterThSortCellCls, 'text-left')}>
                          Time
                        </th>
                        <th scope="col" className={cn(workspaceRegisterThSortCellCls, 'text-left')}>
                          Detail
                        </th>
                        <th
                          scope="col"
                          className={cn(workspaceRegisterThSortCellCls, 'w-[6rem] text-left')}
                        >
                          Tone
                        </th>
                        <th
                          scope="col"
                          className={cn(workspaceRegisterThSortCellCls, 'w-[5rem] text-left')}
                        >
                          Sort
                        </th>
                      </>
                    )}
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[7rem] text-left')}
                    >
                      Status
                    </th>
                    <th scope="col" className={workspaceRegisterThActionsCellCls}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-950">
                    {isSchedule
                    ? schedulePageMeta.rows.map((row) => {
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
                            onClick={() => goViewSchedule(row)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                goViewSchedule(row)
                              }
                            }}
                            tabIndex={0}
                            role="button"
                            aria-label={`View schedule day ${row.dateLabel}`}
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
                                aria-label={`Select ${row.dateLabel}`}
                                onChange={() => toggleRowSelected(row.id)}
                              />
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex items-center gap-2">
                                <CalendarDays
                                  className="h-4 w-4 shrink-0 text-brand-600"
                                  aria-hidden
                                />
                                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                                  {row.dateLabel}
                                </span>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-[12px] text-zinc-600 dark:text-zinc-400">
                              {row.groupLabel}
                            </td>
                            <td className="px-2 py-2 text-[12px] text-zinc-600 dark:text-zinc-400">
                              {row.dayLabel}
                            </td>
                            <td className="px-2 py-2 text-[12px] text-zinc-600 dark:text-zinc-400">
                              {row.muted ? 'Yes' : 'No'}
                            </td>
                            <td className="px-2 py-2 text-[12px] tabular-nums text-zinc-600 dark:text-zinc-400">
                              {row.sortOrder}
                            </td>
                            <td className="px-2 py-2">
                              <EnrollmentStatusBadge published={row.published} />
                            </td>
                            <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end">
                                {scheduleRowActions(row)}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    : windowsPageMeta.rows.map((row) => {
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
                            onClick={() => goViewWindow(row)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                goViewWindow(row)
                              }
                            }}
                            tabIndex={0}
                            role="button"
                            aria-label={`View batch window ${row.label}`}
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
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                                  {row.label}
                                </span>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-[12px] text-zinc-600 dark:text-zinc-400">
                              {row.timeLabel}
                            </td>
                            <td className="max-w-[14rem] truncate px-2 py-2 text-[12px] text-zinc-600 dark:text-zinc-400">
                              {row.detail || '—'}
                            </td>
                            <td className="px-2 py-2 text-[12px] capitalize text-zinc-600 dark:text-zinc-400">
                              {row.tone}
                            </td>
                            <td className="px-2 py-2 text-[12px] tabular-nums text-zinc-600 dark:text-zinc-400">
                              {row.sortOrder}
                            </td>
                            <td className="px-2 py-2">
                              <EnrollmentStatusBadge published={row.published} />
                            </td>
                            <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end">
                                {windowRowActions(row)}
                              </div>
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
              headingId={headingId}
              title={isSchedule ? 'Schedule days' : 'Batch windows'}
              subtitle={`${pageMeta.total.toLocaleString()} record${pageMeta.total === 1 ? '' : 's'}`}
              onAdd={goCreate}
              addAriaLabel={addLabel}
            />
            <ul className="grid gap-3 bg-transparent px-0 py-2.5 sm:grid-cols-2 sm:gap-3 sm:bg-white sm:px-4 sm:py-4 xl:grid-cols-3 dark:sm:bg-zinc-950">
              {isSchedule
                ? schedulePageMeta.rows.map((row) => {
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
                          onClick={() => goViewSchedule(row)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              goViewSchedule(row)
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-label={`View ${row.dateLabel}`}
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
                                aria-label={`Select ${row.dateLabel}`}
                                onChange={() => toggleRowSelected(row.id)}
                              />
                            </label>
                            <div
                              className="flex items-center gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <EnrollmentStatusBadge published={row.published} />
                              {scheduleRowActions(row)}
                            </div>
                          </div>
                          <div className="flex flex-1 flex-col gap-2.5 p-3.5 pt-3">
                            <div className="min-w-0">
                              <h3 className="truncate text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                                {row.dateLabel}
                              </h3>
                              <p className="mt-1 truncate text-[12px] text-zinc-500 dark:text-zinc-400">
                                {row.groupLabel} · {row.dayLabel}
                              </p>
                            </div>
                            <div className="rounded-xl border border-zinc-200/70 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                              <p className="truncate text-[12px] text-zinc-600 dark:text-zinc-400">
                                {row.muted ? 'Muted on calendar' : 'Visible on calendar'} · sort{' '}
                                {row.sortOrder}
                              </p>
                            </div>
                          </div>
                        </article>
                      </li>
                    )
                  })
                : windowsPageMeta.rows.map((row) => {
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
                          onClick={() => goViewWindow(row)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              goViewWindow(row)
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
                              className="flex items-center gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <EnrollmentStatusBadge published={row.published} />
                              {windowRowActions(row)}
                            </div>
                          </div>
                          <div className="flex flex-1 flex-col gap-2.5 p-3.5 pt-3">
                            <div className="min-w-0">
                              <h3 className="truncate text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                                {row.label}
                              </h3>
                              <p className="mt-1 truncate text-[12px] text-zinc-500 dark:text-zinc-400">
                                {row.timeLabel}
                              </p>
                            </div>
                            <div className="rounded-xl border border-zinc-200/70 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                              <p className="truncate text-[12px] text-zinc-600 dark:text-zinc-400">
                                {row.detail || 'No detail'} · {row.tone} · sort {row.sortOrder}
                              </p>
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

      {viewingSchedule ? (
        <ScheduleDayDetailsModal
          item={viewingSchedule}
          onClose={() => setViewingSchedule(null)}
          onEdit={() => goEditSchedule(viewingSchedule)}
        />
      ) : null}

      {viewingWindow ? (
        <BatchWindowDetailsModal
          item={viewingWindow}
          onClose={() => setViewingWindow(null)}
          onEdit={() => goEditWindow(viewingWindow)}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDeleteDialog
          title={
            pendingDelete.kind === 'schedule'
              ? pendingDelete.row.dateLabel || 'Schedule day'
              : pendingDelete.row.label || 'Batch window'
          }
          noun={pendingDelete.kind === 'schedule' ? 'schedule day' : 'batch window'}
          description="This record will be removed from the enrollment hub. This action cannot be undone."
          busy={busyId === pendingDelete.row.id}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}

      {pendingBulkDelete ? (
        <ConfirmDeleteDialog
          title={`${selectedIds.length} selected ${isSchedule ? 'schedule day' : 'batch window'}${selectedIds.length === 1 ? '' : 's'}`}
          noun={isSchedule ? 'schedule days' : 'batch windows'}
          description="These records will be removed from the enrollment hub. This action cannot be undone."
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

function ScheduleDayDetailsModal({
  item,
  onClose,
  onEdit,
}: {
  item: EnrollmentScheduleDay
  onClose: () => void
  onEdit: () => void
}) {
  const titleId = useId()

  useEffect(() => {
    setPageScrollLocked(true)
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      setPageScrollLocked(false)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-brand-950/55 backdrop-blur-[2px] dark:bg-black/70"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(92dvh,40rem)] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200/80 bg-white shadow-[0_24px_64px_-28px_rgba(30,5,65,0.55)] sm:rounded-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 sm:px-6 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-400 uppercase">
              Schedule day
            </p>
            <p className="mt-0.5 text-[12px] text-zinc-500">Guidelines calendar entry</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <EnrollmentStatusBadge published={item.published} />
            {item.muted ? (
              <span className="text-[12px] text-zinc-500">Muted on public calendar</span>
            ) : null}
          </div>
          <h2
            id={titleId}
            className="mt-3 text-[19px] leading-snug font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            {item.dateLabel}
          </h2>
          <p className="mt-1 text-[13px] text-zinc-500">
            {item.groupLabel} · {item.dayLabel}
          </p>
          <p className="mt-4 text-[12px] text-zinc-600 dark:text-zinc-400">
            Sort order {item.sortOrder}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-zinc-100 px-5 py-4 sm:flex-row sm:px-6 dark:border-zinc-800">
          <Button type="button" size="lg" className="h-11 flex-1 rounded-xl" onClick={onEdit}>
            <Pencil className="size-4" aria-hidden />
            Edit
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function BatchWindowDetailsModal({
  item,
  onClose,
  onEdit,
}: {
  item: EnrollmentBatchWindow
  onClose: () => void
  onEdit: () => void
}) {
  const titleId = useId()

  useEffect(() => {
    setPageScrollLocked(true)
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      setPageScrollLocked(false)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-brand-950/55 backdrop-blur-[2px] dark:bg-black/70"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(92dvh,40rem)] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200/80 bg-white shadow-[0_24px_64px_-28px_rgba(30,5,65,0.55)] sm:rounded-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 sm:px-6 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-400 uppercase">
              Batch window
            </p>
            <p className="mt-0.5 text-[12px] capitalize text-zinc-500">{item.tone} tone</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <EnrollmentStatusBadge published={item.published} />
          </div>
          <h2
            id={titleId}
            className="mt-3 text-[19px] leading-snug font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            {item.label}
          </h2>
          <p className="mt-1 text-[13px] text-zinc-500">{item.timeLabel}</p>
          {item.detail ? (
            <p className="mt-4 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              {item.detail}
            </p>
          ) : null}
          <p className="mt-4 text-[12px] text-zinc-600 dark:text-zinc-400">
            Sort order {item.sortOrder}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-zinc-100 px-5 py-4 sm:flex-row sm:px-6 dark:border-zinc-800">
          <Button type="button" size="lg" className="h-11 flex-1 rounded-xl" onClick={onEdit}>
            <Pencil className="size-4" aria-hidden />
            Edit
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}