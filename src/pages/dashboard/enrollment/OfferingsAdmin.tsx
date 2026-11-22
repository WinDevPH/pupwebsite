import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  FilePenLine,
  FileSpreadsheet,
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
import {
  ExportProgressOverlay,
  type ExportFormat,
  type ExportPhase,
} from '@/components/portal/ExportProgressOverlay'
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
  deleteOffering,
  listOfferings,
  updateOffering,
  type EnrollmentOffering,
} from '@/lib/enrollment-offerings-api'
import { downloadOfferingsCatalogExcel } from '@/lib/enrollment-offerings-excel'
import { downloadOfferingsCatalogPdf } from '@/lib/enrollment-offerings-pdf'
import { getRoutingBundle } from '@/lib/enrollment-routing-api'
import { cn } from '@/lib/utils'
import {
  EnrollmentEmptyState,
  EnrollmentPageHeader,
  EnrollmentStatusBadge,
} from '@/pages/dashboard/enrollment/enrollment-admin-ui'

const BASE_PATH = '/admin/enrollment/offerings'
const PAGE_SIZE_KEY = 'pup-admin-enrollment-offerings-page-size'
const VIEW_KEY = 'pup-admin-enrollment-offerings-view'
const HEADING_ID = 'enrollment-offerings-heading'
const REGISTER_TITLE = 'Offering register'

type StatusFilter = 'all' | 'published' | 'draft'

const STATUS_FILTERS: {
  id: StatusFilter
  label: string
  icon: typeof BookOpen
}[] = [
  { id: 'all', label: 'All', icon: BookOpen },
  { id: 'published', label: 'Published', icon: CheckCircle2 },
  { id: 'draft', label: 'Draft', icon: FilePenLine },
]

function offeringSearchText(row: EnrollmentOffering) {
  const status = row.published ? 'published' : 'draft'
  return `${row.code} ${row.title} ${row.section} ${row.year} ${row.units} ${row.availability} ${row.scheduleLabel} ${row.timeLabel} ${row.days.join(' ')} ${status}`
}

function metaLine(row: EnrollmentOffering) {
  const section = row.section || '—'
  const year = row.year || '—'
  return `${section} · Year ${year} · ${row.units} unit${row.units === 1 ? '' : 's'}`
}

function offeringIsOpen(row: Pick<EnrollmentOffering, 'availability' | 'full'>) {
  return !(row.full === true || row.availability === 'FULL')
}

function OfferingAvailabilityToggle({
  open,
  disabled,
  busy,
  onChange,
  size = 'md',
}: {
  open: boolean
  disabled?: boolean
  busy?: boolean
  onChange: (next: 'OPEN' | 'FULL') => void
  size?: 'sm' | 'md'
}) {
  return (
    <div
      role="group"
      aria-label="Availability"
      className={cn(
        'inline-flex rounded-md border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-900',
        size === 'sm' ? 'h-7' : 'h-8',
      )}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {(['OPEN', 'FULL'] as const).map((option) => {
        const active = option === 'OPEN' ? open : !open
        return (
          <button
            key={option}
            type="button"
            disabled={disabled || busy}
            aria-pressed={active}
            onClick={() => onChange(option)}
            className={cn(
              'inline-flex items-center justify-center rounded px-2 font-semibold transition-colors disabled:opacity-60',
              size === 'sm' ? 'min-w-[3.25rem] text-[10px]' : 'min-w-[3.5rem] text-[11px]',
              active
                ? option === 'OPEN'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-zinc-700 text-white shadow-sm dark:bg-zinc-600'
                : 'text-zinc-500 hover:bg-white hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-950 dark:hover:text-zinc-200',
            )}
          >
            {busy && active ? (
              <Loader2 className="size-3 animate-spin" aria-hidden />
            ) : option === 'OPEN' ? (
              'Open'
            ) : (
              'Full'
            )}
          </button>
        )
      })}
    </div>
  )
}

export default function OfferingsAdmin() {
  const navigate = useNavigate()
  const location = useLocation()
  const [items, setItems] = useState<EnrollmentOffering[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadBusy, setReloadBusy] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [pageNo, setPageNo] = useState(1)
  const [pageSize, setPageSize] = useState(() => readStoredRegisterPageSize(PAGE_SIZE_KEY))
  const [registerView, setRegisterView] = useState<RegisterView>(() =>
    initialRegisterView(VIEW_KEY),
  )
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [busyId, setBusyId] = useState<number | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<EnrollmentOffering | null>(null)
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [viewing, setViewing] = useState<EnrollmentOffering | null>(null)
  const [toast, setToast] = useState<SnackToast | null>(null)
  const [availabilityBusyId, setAvailabilityBusyId] = useState<number | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf')
  const [exportPhase, setExportPhase] = useState<ExportPhase>('idle')
  const [exportCount, setExportCount] = useState(0)
  const openCapacityById = useRef<Map<number, number>>(new Map())
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (opts?.soft) setReloadBusy(true)
      else setLoading(true)
      const result = await listOfferings({ all: true })
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
  }, [query, pageSize, statusFilter])

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
      if (statusFilter === 'published' && !row.published) return false
      if (statusFilter === 'draft' && row.published) return false
      if (!needle) return true
      return offeringSearchText(row).toLowerCase().includes(needle)
    })
  }, [items, query, statusFilter])

  function exportScope(rows: EnrollmentOffering[], selectedRows: EnrollmentOffering[]) {
    const scopeParts: string[] = []
    if (selectedRows.length > 0) {
      scopeParts.push(`Selected (${selectedRows.length})`)
    } else {
      if (statusFilter === 'published') scopeParts.push('Published only')
      else if (statusFilter === 'draft') scopeParts.push('Draft only')
      else scopeParts.push('All statuses')
      if (query.trim()) scopeParts.push(`Search “${query.trim()}”`)
      if (rows.length === 0) scopeParts.push('Empty catalog')
    }
    return scopeParts.join(' · ')
  }

  function rowsForExport() {
    const selectedRows = filtered.filter((row) => selectedIds.includes(row.id))
    const rows = selectedRows.length > 0 ? selectedRows : filtered
    return { rows, selectedRows }
  }

  async function beginExport(format: ExportFormat, count: number) {
    setExportFormat(format)
    setExportCount(count)
    setExportPhase('running')
    setExportBusy(true)
    setExportMenuOpen(false)
    await new Promise<void>((resolve) => window.setTimeout(resolve, 40))
  }

  async function finishExport(ok: boolean) {
    setExportPhase(ok ? 'done' : 'error')
    await new Promise<void>((resolve) => window.setTimeout(resolve, ok ? 650 : 450))
    setExportBusy(false)
    setExportPhase('idle')
  }

  async function exportPdf() {
    if (exportBusy) return
    const { rows, selectedRows } = rowsForExport()
    if (rows.length === 0) return
    await beginExport('pdf', rows.length)
    try {
      let termBanner = ''
      const routing = await getRoutingBundle({ all: true })
      if (routing.ok) termBanner = routing.data.settings.termBanner || ''

      await downloadOfferingsCatalogPdf({
        offerings: rows,
        termBanner,
        scopeLabel: exportScope(rows, selectedRows),
      })
      await finishExport(true)
      showToast(
        rows.length === 0
          ? 'Exported empty PDF catalog.'
          : selectedRows.length > 0
            ? `Exported ${selectedRows.length} selected offering${selectedRows.length === 1 ? '' : 's'} (PDF).`
            : `Exported ${rows.length} offering${rows.length === 1 ? '' : 's'} (PDF).`,
        'success',
      )
    } catch (error) {
      await finishExport(false)
      showToast(error instanceof Error ? error.message : 'Could not export PDF.', 'error')
    }
  }

  async function exportExcel() {
    if (exportBusy) return
    const { rows, selectedRows } = rowsForExport()
    if (rows.length === 0) return
    await beginExport('excel', rows.length)
    try {
      downloadOfferingsCatalogExcel({
        offerings: rows,
        scopeLabel: exportScope(rows, selectedRows),
      })
      await finishExport(true)
      showToast(
        rows.length === 0
          ? 'Exported empty Excel catalog.'
          : selectedRows.length > 0
            ? `Exported ${selectedRows.length} selected offering${selectedRows.length === 1 ? '' : 's'} (Excel).`
            : `Exported ${rows.length} offering${rows.length === 1 ? '' : 's'} (Excel).`,
        'success',
      )
    } catch (error) {
      await finishExport(false)
      showToast(error instanceof Error ? error.message : 'Could not export Excel.', 'error')
    }
  }

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

  useEffect(() => {
    if (!exportMenuOpen) return
    function onPointer(event: MouseEvent) {
      const target = event.target as Node
      if (exportMenuRef.current?.contains(target)) return
      setExportMenuOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setExportMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [exportMenuOpen])

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

  function goEdit(item: EnrollmentOffering) {
    setViewing(null)
    navigate(`${BASE_PATH}/${item.id}/edit`)
  }

  function goView(item: EnrollmentOffering) {
    setOpenMenuId(null)
    setViewing(item)
  }

  async function setOfferingAvailability(row: EnrollmentOffering, next: 'OPEN' | 'FULL') {
    const currentlyOpen = offeringIsOpen(row)
    if ((next === 'OPEN' && currentlyOpen) || (next === 'FULL' && !currentlyOpen)) return

    setAvailabilityBusyId(row.id)
    let capacity: number
    if (next === 'FULL') {
      if (row.capacity > 0) openCapacityById.current.set(row.id, row.capacity)
      capacity = 0
    } else {
      const remembered = openCapacityById.current.get(row.id)
      capacity =
        remembered != null && remembered > 0
          ? remembered
          : Math.max(40, row.takenCount + 1, row.capacity || 0)
    }

    const result = await updateOffering({
      id: row.id,
      code: row.code,
      title: row.title,
      section: row.section,
      year: row.year,
      units: row.units,
      days: row.days,
      startHour: row.startHour,
      endHour: row.endHour,
      timeLabel: row.timeLabel,
      scheduleLabel: row.scheduleLabel,
      capacity,
      availability: next,
      sortOrder: row.sortOrder,
      published: row.published,
    })
    setAvailabilityBusyId(null)

    if (!result.ok) {
      if (result.status === 401 || result.status === 403) setNeedsLogin(true)
      else showToast(result.error, 'error')
      return
    }

    const updated = result.data.item
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    setViewing((current) => (current?.id === updated.id ? updated : current))
    showToast(next === 'OPEN' ? 'Marked open.' : 'Marked full.', 'success')
  }

  async function handleDelete() {
    if (!pendingDelete) return
    setBusyId(pendingDelete.id)
    const result = await deleteOffering(pendingDelete.id)
    setBusyId(null)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) setNeedsLogin(true)
      else showToast(result.error, 'error')
      return
    }
    showToast('Offering deleted.', 'success')
    setSelectedIds((prev) => prev.filter((id) => id !== pendingDelete.id))
    setPendingDelete(null)
    setViewing((current) => (current?.id === pendingDelete.id ? null : current))
    setItems((prev) => prev.filter((item) => item.id !== pendingDelete.id))
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setBulkDeleting(true)
    let failed = 0
    for (const id of ids) {
      const result = await deleteOffering(id)
      if (!result.ok) failed += 1
    }
    setBulkDeleting(false)
    setPendingBulkDelete(false)
    setSelectedIds([])
    setViewing((current) => (current && ids.includes(current.id) ? null : current))
    if (failed > 0) showToast(`Deleted with ${failed} error(s).`, 'error')
    else {
      showToast(
        ids.length === 1 ? 'Offering deleted.' : `${ids.length} offerings deleted.`,
        'success',
      )
    }
    await load({ soft: true })
  }

  const busy =
    loading ||
    reloadBusy ||
    busyId !== null ||
    bulkDeleting ||
    availabilityBusyId !== null ||
    exportBusy

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
      ariaLabel="Offerings pagination"
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

  function rowActions(row: EnrollmentOffering) {
    return (
      <PortalActionMenu
        open={openMenuId === row.id}
        onOpenChange={(open) => setOpenMenuId(open ? row.id : null)}
        disabled={busyId === row.id}
        items={[
          { id: 'view', label: 'View details', icon: Eye, onClick: () => goView(row) },
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
        title="Class Offerings"
        description="Class sections, availability, and units in the enrollment class builder."
        action={
          <button type="button" className={workspacePageAddBtnCls} onClick={goCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            Add offering
          </button>
        }
      />

      <section aria-label="Catalog" className="w-full max-w-none">
        <div className={`${workspaceCatalogShellCls} ${workspaceCatalogPadCls} w-full max-w-none`}>
          <div
            role="toolbar"
            aria-label="Offerings catalog filters"
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
                    placeholder="Search code, title, section…"
                    aria-label="Search offerings"
                    className={`${catalogInput} min-w-0 w-full pl-9`}
                  />
                </div>
                {reloadBtn('sm:hidden')}
              </div>

              <div className={workspaceCatalogToolbarActionsRowCls}>
                {reloadBtn('max-sm:hidden')}

                <div ref={exportMenuRef} className="relative shrink-0">
                  <button
                    type="button"
                    disabled={exportBusy || filtered.length === 0}
                    title={
                      filtered.length === 0
                        ? 'No records to download yet'
                        : 'Download catalog'
                    }
                    aria-label={
                      filtered.length === 0
                        ? 'Download catalog unavailable — no records'
                        : 'Download catalog'
                    }
                    aria-haspopup="menu"
                    aria-expanded={exportMenuOpen}
                    aria-busy={exportBusy}
                    onClick={() => {
                      if (filtered.length === 0) return
                      setExportMenuOpen((open) => !open)
                    }}
                    className={cn(
                      catalogToolbarIconBtn,
                      'inline-flex items-center gap-0.5 px-2',
                      exportMenuOpen &&
                        'border-brand-300 bg-brand-50/70 text-brand-900 dark:border-brand-500/40 dark:bg-brand-500/10',
                    )}
                  >
                    {exportBusy ? (
                      <Loader2
                        className={`${workspaceCatalogToolbarIconCls} animate-spin`}
                        aria-hidden
                      />
                    ) : (
                      <Download
                        className={`${workspaceCatalogToolbarIconCls} opacity-85`}
                        aria-hidden
                      />
                    )}
                    <ChevronDown className="size-3 opacity-70" aria-hidden />
                  </button>
                  {exportMenuOpen && filtered.length > 0 ? (
                    <div
                      role="menu"
                      aria-label="Download format"
                      className="absolute top-[calc(100%+6px)] right-0 z-40 min-w-[11.5rem] overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-[0_12px_28px_-16px_rgba(15,23,42,0.45)] dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-black/50"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        disabled={exportBusy || filtered.length === 0}
                        onClick={() => void exportPdf()}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[12px] font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:text-zinc-100 dark:hover:bg-zinc-900"
                      >
                        <FileText className="size-3.5 text-brand-600" aria-hidden />
                        Download PDF
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={exportBusy || filtered.length === 0}
                        onClick={() => void exportExcel()}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[12px] font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:text-zinc-100 dark:hover:bg-zinc-900"
                      >
                        <FileSpreadsheet className="size-3.5 text-emerald-600" aria-hidden />
                        Download Excel
                      </button>
                    </div>
                  ) : null}
                </div>

                <span className={workspaceCatalogToolbarDividerCls} aria-hidden />

                <div
                  role="radiogroup"
                  aria-label="Filter by status"
                  className={workspaceCatalogSegTrackInlineCls}
                >
                  {STATUS_FILTERS.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={statusFilter === id}
                      title={`${label} (${counts[id]})`}
                      aria-label={`${label} (${counts[id]})`}
                      onClick={() => setStatusFilter(id)}
                      className={catalogSegIcon(statusFilter === id)}
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
            Loading offerings…
          </div>
        ) : filtered.length === 0 ? (
          <div className={workspaceRegisterPanelShellCls(registerView)}>
            <RegisterPanelHeading
              headingId={HEADING_ID}
              title={REGISTER_TITLE}
              subtitle={`${items.length === 0 ? '0' : '0 matching'} in catalog`}
              onAdd={goCreate}
              addAriaLabel="Add offering"
            />
            <div className="min-w-0 bg-white px-4 py-5 sm:px-5 sm:py-6 dark:bg-zinc-950">
              <EnrollmentEmptyState
                Icon={BookOpen}
                title={items.length === 0 ? 'No offerings yet' : 'No matching offerings'}
                description={
                  items.length === 0
                    ? 'Add course sections students can pick in the class builder.'
                    : 'Adjust search or status filter to see more offerings.'
                }
                actionLabel={items.length === 0 ? 'Add offering' : undefined}
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
              addAriaLabel="Add offering"
            />
            <HorizontalDragScrollTableWrap className={plansRegisterTableScrollerCls}>
              <table className={workspaceRegisterTableCls}>
                <caption className="sr-only">Enrollment class offerings</caption>
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
                        aria-label="Select all offerings on this page"
                      />
                    </th>
                    <th scope="col" className={cn(workspaceRegisterThSortCellCls, 'text-left')}>
                      Code
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[6rem] text-left')}
                    >
                      Section
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[5rem] text-left')}
                    >
                      Year
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[5rem] text-left')}
                    >
                      Units
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[9.5rem] text-left')}
                    >
                      Availability
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[7.5rem] text-left')}
                    >
                      Status
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
                        aria-label={`View offering ${row.code}`}
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
                            aria-label={`Select ${row.code}`}
                            onChange={() => toggleRowSelected(row.id)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex min-w-0 items-start gap-2">
                            <BookOpen
                              className="mt-0.5 h-4 w-4 shrink-0 text-brand-600"
                              aria-hidden
                            />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
                                {row.code}
                              </p>
                              <p
                                className="mt-0.5 truncate text-[12px] text-zinc-500 dark:text-zinc-400"
                                title={row.title}
                              >
                                {row.title}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-[12px] text-zinc-600 dark:text-zinc-400">
                          {row.section || '—'}
                        </td>
                        <td className="px-2 py-2 text-[12px] text-zinc-600 dark:text-zinc-400">
                          {row.year || '—'}
                        </td>
                        <td className="px-2 py-2 text-[12px] tabular-nums text-zinc-600 dark:text-zinc-400">
                          {row.units}
                        </td>
                        <td className="px-2 py-2">
                          <OfferingAvailabilityToggle
                            open={offeringIsOpen(row)}
                            size="sm"
                            disabled={busyId === row.id}
                            busy={availabilityBusyId === row.id}
                            onChange={(next) => void setOfferingAvailability(row, next)}
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
              addAriaLabel="Add offering"
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
                      aria-label={`View ${row.code}`}
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
                            aria-label={`Select ${row.code}`}
                            onChange={() => toggleRowSelected(row.id)}
                          />
                        </label>
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <EnrollmentStatusBadge published={row.published} />
                          {rowActions(row)}
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col gap-2.5 p-3.5 pt-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                            {row.code}
                          </h3>
                          <p
                            className="mt-1 truncate text-[12px] text-zinc-500 dark:text-zinc-400"
                            title={row.title}
                          >
                            {row.title}
                          </p>
                        </div>
                        <div className="rounded-xl border border-zinc-200/70 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                          <p className="inline-flex items-center gap-1.5 truncate text-[12px] font-medium text-zinc-800 dark:text-zinc-200">
                            <BookOpen className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden />
                            {metaLine(row)}
                          </p>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <OfferingAvailabilityToggle
                            open={offeringIsOpen(row)}
                            size="sm"
                            disabled={busyId === row.id}
                            busy={availabilityBusyId === row.id}
                            onChange={(next) => void setOfferingAvailability(row, next)}
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

      {viewing ? (
        <OfferingDetailsModal
          item={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => goEdit(viewing)}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDeleteDialog
          title={pendingDelete.title || pendingDelete.code || 'Offering'}
          noun="offering"
          description="This course offering will be removed from the enrollment hub. This action cannot be undone."
          busy={busyId === pendingDelete.id}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}

      {pendingBulkDelete ? (
        <ConfirmDeleteDialog
          title={`${selectedIds.length} selected offering${selectedIds.length === 1 ? '' : 's'}`}
          noun="offerings"
          description="These course offerings will be removed from the enrollment hub. This action cannot be undone."
          busy={bulkDeleting}
          bulk
          onCancel={() => setPendingBulkDelete(false)}
          onConfirm={() => void handleBulkDelete()}
        />
      ) : null}

      <ExportProgressOverlay
        open={exportBusy}
        format={exportFormat}
        phase={exportPhase}
        recordCount={exportCount}
        title={exportFormat === 'pdf' ? 'Class offerings PDF' : 'Class offerings Excel'}
      />

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

function OfferingDetailField({
  label,
  value,
  wide,
}: {
  label: string
  value: string
  wide?: boolean
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950',
        wide && 'sm:col-span-2',
      )}
    >
      <p className="text-[10px] font-semibold tracking-[0.12em] text-zinc-400 uppercase">{label}</p>
      <p className="mt-1 break-words text-[13px] font-medium text-zinc-900 dark:text-zinc-50">
        {value || '—'}
      </p>
    </div>
  )
}

function OfferingDetailsModal({
  item,
  onClose,
  onEdit,
}: {
  item: EnrollmentOffering
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
        className="relative flex max-h-[min(92dvh,44rem)] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200/80 bg-white shadow-[0_24px_64px_-28px_rgba(30,5,65,0.55)] sm:rounded-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 sm:px-6 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-400 uppercase">
              Offering details
            </p>
            <p className="mt-0.5 font-mono text-[12px] text-zinc-500">{item.code}</p>
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
            <span className="text-[12px] font-medium text-zinc-500">{item.availability || '—'}</span>
          </div>
          <h2
            id={titleId}
            className="mt-3 text-[19px] leading-snug font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            {item.title}
          </h2>
          <p className="mt-1 text-[13px] text-zinc-500">
            {`${item.section || '—'} · Year ${item.year || '—'} · ${item.units} ${item.units === 1 ? 'unit' : 'units'}`}
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <OfferingDetailField label="Code" value={item.code} />
            <OfferingDetailField label="Section" value={item.section} />
            <OfferingDetailField label="Year" value={item.year} />
            <OfferingDetailField label="Units" value={String(item.units)} />
            <OfferingDetailField label="Availability" value={item.availability} />
            <OfferingDetailField label="Days" value={item.days.join(' / ')} />
            <OfferingDetailField label="Start hour" value={String(item.startHour)} />
            <OfferingDetailField label="End hour" value={String(item.endHour)} />
            <OfferingDetailField label="Time" value={item.timeLabel} wide />
            <OfferingDetailField label="Schedule" value={item.scheduleLabel} wide />
            <OfferingDetailField label="Sort order" value={String(item.sortOrder)} />
            <OfferingDetailField label="Published" value={item.published ? 'Published' : 'Draft'} />
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-zinc-100 px-5 py-4 sm:flex-row sm:px-6 dark:border-zinc-800">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11 flex-1 rounded-xl"
            onClick={onClose}
          >
            Close
          </Button>
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
