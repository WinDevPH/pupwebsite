import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
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
  XCircle,
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
import { formatPhDateTime } from '@/lib/datetime'
import { downloadAppointmentsCatalogExcel } from '@/lib/enrollment-appointments-excel'
import { downloadAppointmentsCatalogPdf } from '@/lib/enrollment-appointments-pdf'
import {
  deleteAppointment,
  listAppointments,
  type AppointmentStatus,
  type EnrollmentAppointment,
} from '@/lib/enrollment-appointments-api'
import { getRoutingBundle } from '@/lib/enrollment-routing-api'
import { setPageScrollLocked } from '@/hooks/useLenis'
import { cn } from '@/lib/utils'
import {
  EnrollmentEmptyState,
  EnrollmentPageHeader,
} from '@/pages/dashboard/enrollment/enrollment-admin-ui'
import { AppointmentProofImage } from '@/pages/dashboard/enrollment/AppointmentProofImage'

const BASE_PATH = '/admin/enrollment/appointments'
const PAGE_SIZE_KEY = 'pup-admin-enrollment-appointments-page-size'
const VIEW_KEY = 'pup-admin-enrollment-appointments-view'
const HEADING_ID = 'enrollment-appointments-heading'
const REGISTER_TITLE = 'Appointment register'

type StatusFilter = 'all' | AppointmentStatus

const STATUS_FILTERS: {
  id: StatusFilter
  label: string
  icon: typeof ClipboardCheck
}[] = [
  { id: 'all', label: 'All', icon: ClipboardCheck },
  { id: 'pending', label: 'Pending', icon: Clock3 },
  { id: 'approved', label: 'Approved', icon: CheckCircle2 },
  { id: 'rejected', label: 'Rejected', icon: XCircle },
]

function statusTone(status: string) {
  switch (status) {
    case 'approved':
      return {
        wrap: 'border-emerald-200/85 bg-gradient-to-br from-white to-emerald-50/80 text-emerald-950 dark:border-emerald-500/22 dark:from-zinc-950 dark:to-emerald-500/14 dark:text-emerald-50',
        dot: 'bg-emerald-500 dark:bg-emerald-400',
        label: 'Approved',
      }
    case 'rejected':
      return {
        wrap: 'border-rose-200/85 bg-gradient-to-br from-white to-rose-50/80 text-rose-950 dark:border-rose-500/22 dark:from-zinc-950 dark:to-rose-500/14 dark:text-rose-50',
        dot: 'bg-rose-500 dark:bg-rose-400',
        label: 'Rejected',
      }
    default:
      return {
        wrap: 'border-amber-200/85 bg-gradient-to-br from-white to-amber-50/80 text-amber-950 dark:border-amber-500/22 dark:from-zinc-950 dark:to-amber-500/14 dark:text-amber-50',
        dot: 'bg-amber-500 dark:bg-amber-400',
        label: 'Pending',
      }
  }
}

function AppointmentStatusBadge({ status }: { status: string }) {
  const tone = statusTone(status)
  return (
    <span
      className={cn(
        'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-[10px] border px-2 py-1 text-[11px] font-medium leading-none shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:shadow-none',
        tone.wrap,
      )}
      title={tone.label}
    >
      <span className={cn('inline-flex h-2 w-2 shrink-0 rounded-full', tone.dot)} aria-hidden />
      <span className="min-w-0 truncate tracking-[-0.01em]">{tone.label}</span>
    </span>
  )
}

export default function AppointmentsAdmin() {
  const navigate = useNavigate()
  const location = useLocation()
  const [items, setItems] = useState<EnrollmentAppointment[]>([])
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
  const [pendingDelete, setPendingDelete] = useState<EnrollmentAppointment | null>(null)
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [viewing, setViewing] = useState<EnrollmentAppointment | null>(null)
  const [toast, setToast] = useState<SnackToast | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf')
  const [exportPhase, setExportPhase] = useState<ExportPhase>('idle')
  const [exportCount, setExportCount] = useState(0)
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (opts?.soft) setReloadBusy(true)
      else setLoading(true)
      const result = await listAppointments({ status: 'all' })
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
      pending: items.filter((row) => row.status === 'pending').length,
      approved: items.filter((row) => row.status === 'approved').length,
      rejected: items.filter((row) => row.status === 'rejected').length,
    }),
    [items],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      if (!needle) return true
      return `${row.trackingCode} ${row.fullName} ${row.studentNumber} ${row.enrollmentDateLabel} ${row.timeSlotLabel} ${row.status} ${row.yearLevel}`
        .toLowerCase()
        .includes(needle)
    })
  }, [items, query, statusFilter])

  function exportScope(rows: EnrollmentAppointment[], selectedRows: EnrollmentAppointment[]) {
    const scopeParts: string[] = []
    if (selectedRows.length > 0) {
      scopeParts.push(`Selected (${selectedRows.length})`)
    } else {
      if (statusFilter === 'pending') scopeParts.push('Pending only')
      else if (statusFilter === 'approved') scopeParts.push('Approved only')
      else if (statusFilter === 'rejected') scopeParts.push('Rejected only')
      else scopeParts.push('All statuses')
      if (query.trim()) scopeParts.push(`Search “${query.trim()}”`)
      if (rows.length === 0) scopeParts.push('Empty register')
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

      await downloadAppointmentsCatalogPdf({
        appointments: rows,
        termBanner,
        scopeLabel: exportScope(rows, selectedRows),
      })
      await finishExport(true)
      showToast(
        rows.length === 0
          ? 'Exported empty PDF register.'
          : selectedRows.length > 0
            ? `Exported ${selectedRows.length} selected appointment${selectedRows.length === 1 ? '' : 's'} (PDF).`
            : `Exported ${rows.length} appointment${rows.length === 1 ? '' : 's'} (PDF).`,
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
      downloadAppointmentsCatalogExcel({
        appointments: rows,
        scopeLabel: exportScope(rows, selectedRows),
      })
      await finishExport(true)
      showToast(
        rows.length === 0
          ? 'Exported empty Excel register.'
          : selectedRows.length > 0
            ? `Exported ${selectedRows.length} selected appointment${selectedRows.length === 1 ? '' : 's'} (Excel).`
            : `Exported ${rows.length} appointment${rows.length === 1 ? '' : 's'} (Excel).`,
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

  function goEdit(item: EnrollmentAppointment) {
    setViewing(null)
    navigate(`${BASE_PATH}/${item.id}/edit`)
  }

  function goView(item: EnrollmentAppointment) {
    setOpenMenuId(null)
    setViewing(item)
  }

  async function handleDelete() {
    if (!pendingDelete) return
    setBusyId(pendingDelete.id)
    const result = await deleteAppointment(pendingDelete.id)
    setBusyId(null)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) setNeedsLogin(true)
      else showToast(result.error, 'error')
      return
    }
    showToast('Appointment deleted.', 'success')
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
      const result = await deleteAppointment(id)
      if (!result.ok) failed += 1
    }
    setBulkDeleting(false)
    setPendingBulkDelete(false)
    setSelectedIds([])
    if (failed > 0) showToast(`Deleted with ${failed} error(s).`, 'error')
    else {
      showToast(
        ids.length === 1 ? 'Appointment deleted.' : `${ids.length} appointments deleted.`,
        'success',
      )
    }
    await load({ soft: true })
  }

  const busy = loading || reloadBusy || busyId !== null || bulkDeleting || exportBusy

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
      ariaLabel="Appointments pagination"
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

  function rowActions(row: EnrollmentAppointment) {
    return (
      <PortalActionMenu
        open={openMenuId === row.id}
        onOpenChange={(open) => setOpenMenuId(open ? row.id : null)}
        disabled={busyId === row.id}
        items={[
          {
            id: 'view',
            label: 'View details',
            description: 'Booking & proof',
            icon: Eye,
            onClick: () => goView(row),
          },
          {
            id: 'edit',
            label: 'Edit appointment',
            description: 'Update booking',
            icon: Pencil,
            onClick: () => goEdit(row),
          },
          {
            id: 'delete',
            label: 'Delete',
            description: 'Release slot capacity',
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
        title="Appointments"
        description="Review routing slip bookings, add records manually, and approve or reject slots."
        action={
          <button type="button" className={workspacePageAddBtnCls} onClick={goCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            Add appointment
          </button>
        }
      />

      <section aria-label="Catalog" className="w-full max-w-none">
        <div className={`${workspaceCatalogShellCls} ${workspaceCatalogPadCls} w-full max-w-none`}>
          <div
            role="toolbar"
            aria-label="Appointments catalog filters"
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
                    placeholder="Search name, student no., tracking…"
                    aria-label="Search appointments"
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
                        : 'Download register'
                    }
                    aria-label={
                      filtered.length === 0
                        ? 'Download register unavailable — no records'
                        : 'Download register'
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
            Loading appointments…
          </div>
        ) : filtered.length === 0 ? (
          <div className={workspaceRegisterPanelShellCls(registerView)}>
            <RegisterPanelHeading
              headingId={HEADING_ID}
              title={REGISTER_TITLE}
              subtitle={`${items.length === 0 ? '0' : '0 matching'} in catalog`}
              onAdd={goCreate}
              addAriaLabel="Add appointment"
            />
            <div className="min-w-0 bg-white px-4 py-5 sm:px-5 sm:py-6 dark:bg-zinc-950">
              <EnrollmentEmptyState
                Icon={ClipboardCheck}
                title={items.length === 0 ? 'No appointments yet' : 'No matching appointments'}
                description={
                  items.length === 0
                    ? 'Add a booking manually or wait for routing slip submissions.'
                    : 'Adjust search or status filter to see more appointments.'
                }
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
              addAriaLabel="Add appointment"
            />
            <HorizontalDragScrollTableWrap className={plansRegisterTableScrollerCls}>
              <table className={workspaceRegisterTableCls}>
                <caption className="sr-only">Enrollment appointments</caption>
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
                        aria-label="Select all appointments on this page"
                      />
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[3.5rem] text-left')}
                    >
                      Proof
                    </th>
                    <th scope="col" className={cn(workspaceRegisterThSortCellCls, 'text-left')}>
                      Student
                    </th>
                    <th scope="col" className={cn(workspaceRegisterThSortCellCls, 'text-left')}>
                      Booking
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[8rem] text-left')}
                    >
                      Tracking
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[7rem] text-left')}
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[9rem] text-left')}
                    >
                      Submitted
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
                        aria-label={`View appointment ${row.trackingCode}`}
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
                            aria-label={`Select ${row.fullName}`}
                            onChange={() => toggleRowSelected(row.id)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          {row.hasProof ? (
                            <AppointmentProofImage
                              appointmentId={row.id}
                              proofName={row.proofName || 'Payment proof'}
                              variant="thumb"
                            />
                          ) : (
                            <div
                              className="flex size-11 items-center justify-center rounded-lg border border-dashed border-zinc-200 text-[10px] font-medium text-zinc-400 dark:border-zinc-700"
                              title="No proof"
                            >
                              —
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
                              {row.fullName}
                            </p>
                            <p className="mt-0.5 truncate text-[12px] text-zinc-500 dark:text-zinc-400">
                              {row.studentNumber} · {row.yearLevel} ·{' '}
                              {row.classification === 'irregular' ? 'Irregular' : 'Regular'}
                            </p>
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex min-w-0 flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-700 dark:text-zinc-300">
                              <CalendarDays
                                className="h-3.5 w-3.5 shrink-0 text-brand-600"
                                aria-hidden
                              />
                              <span className="truncate">{row.enrollmentDateLabel}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 dark:text-zinc-400">
                              <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              <span className="truncate">{row.timeSlotLabel}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-2 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                          {row.trackingCode}
                        </td>
                        <td className="px-2 py-2">
                          <AppointmentStatusBadge status={row.status} />
                        </td>
                        <td className="px-2 py-2 text-[12px] text-zinc-600 dark:text-zinc-400">
                          {formatPhDateTime(row.createdAt)}
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
              addAriaLabel="Add appointment"
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
                      aria-label={`View ${row.fullName}`}
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
                            aria-label={`Select ${row.fullName}`}
                            onChange={() => toggleRowSelected(row.id)}
                          />
                        </label>
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <AppointmentStatusBadge status={row.status} />
                          {rowActions(row)}
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col gap-2.5 p-3.5 pt-3">
                        <div className="flex items-start gap-3">
                          {row.hasProof ? (
                            <AppointmentProofImage
                              appointmentId={row.id}
                              proofName={row.proofName || 'Payment proof'}
                              variant="thumb"
                              className="size-14 rounded-xl"
                            />
                          ) : (
                            <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white text-[10px] font-medium text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950">
                              No proof
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                              {row.fullName}
                            </h3>
                            <p className="mt-1 truncate text-[12px] text-zinc-500 dark:text-zinc-400">
                              {row.studentNumber}
                            </p>
                          </div>
                        </div>
                        <div className="rounded-xl border border-zinc-200/70 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                          <p className="truncate text-[12px] font-medium text-zinc-800 dark:text-zinc-200">
                            {row.enrollmentDateLabel}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-zinc-500">{row.timeSlotLabel}</p>
                        </div>
                        <p className="font-mono text-[11px] text-zinc-500">{row.trackingCode}</p>
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
        <AppointmentDetailsModal
          item={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => goEdit(viewing)}
          onOpenFull={() => {
            setViewing(null)
            navigate(`${BASE_PATH}/${viewing.id}`)
          }}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDeleteDialog
          title={pendingDelete.fullName || pendingDelete.trackingCode}
          noun="appointment"
          description="This appointment booking will be removed permanently, including any payment proof file."
          busy={busyId === pendingDelete.id}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}

      {pendingBulkDelete ? (
        <ConfirmDeleteDialog
          title={`${selectedIds.length} selected appointment${selectedIds.length === 1 ? '' : 's'}`}
          noun="appointments"
          description="These appointment bookings will be removed permanently. This action cannot be undone."
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
        title={exportFormat === 'pdf' ? 'Appointments PDF' : 'Appointments Excel'}
      />

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

function AppointmentDetailsModal({
  item,
  onClose,
  onEdit,
  onOpenFull,
}: {
  item: EnrollmentAppointment
  onClose: () => void
  onEdit: () => void
  onOpenFull: () => void
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
              Appointment details
            </p>
            <p className="mt-0.5 font-mono text-[12px] text-zinc-500">{item.trackingCode}</p>
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
            <AppointmentStatusBadge status={item.status} />
            <span className="text-[12px] text-zinc-500">
              Submitted {formatPhDateTime(item.createdAt)}
            </span>
          </div>
          <h2
            id={titleId}
            className="mt-3 text-[19px] leading-snug font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            {item.fullName}
          </h2>
          <p className="mt-1 text-[13px] text-zinc-500">
            {item.studentNumber} · {item.yearLevel} ·{' '}
            {item.classification === 'irregular' ? 'Irregular' : 'Regular'}
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-zinc-400 uppercase">
                Enrollment date
              </p>
              <p className="mt-1 text-[13px] font-medium text-zinc-900 dark:text-zinc-50">
                {item.enrollmentDateLabel}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-zinc-400 uppercase">
                Time slot
              </p>
              <p className="mt-1 text-[13px] font-medium text-zinc-900 dark:text-zinc-50">
                {item.timeSlotLabel}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-zinc-400 uppercase">
                Payment
              </p>
              <p className="mt-1 text-[13px] font-medium text-zinc-900 dark:text-zinc-50">
                {item.paymentMode || '—'}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-zinc-400 uppercase">
                Reference
              </p>
              <p className="mt-1 text-[13px] font-medium text-zinc-900 dark:text-zinc-50">
                {item.referenceNo || '—'}
              </p>
            </div>
          </div>

          {item.hasProof ? (
            <div className="mt-4">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-zinc-400 uppercase">
                Payment proof
              </p>
              <div className="mt-2 overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                <AppointmentProofImage
                  appointmentId={item.id}
                  proofName={item.proofName || 'Payment proof'}
                  variant="panel"
                  imgClassName="max-h-56 object-contain"
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-zinc-100 px-5 py-4 sm:flex-row sm:px-6 dark:border-zinc-800">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11 flex-1 rounded-xl"
            onClick={onOpenFull}
          >
            Full review
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
