import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  CreditCard,
  Eye,
  EyeOff,
  LayoutGrid,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
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
  formControlWellCls,
  formWorkspacePrimaryBtnCls,
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
  workspaceFormFieldGroupCls,
  workspaceFormLabelCls,
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
import {
  deletePaymentChannel,
  deleteRoutingDate,
  deleteRoutingSlot,
  deleteRoutingStep,
  getRoutingBundle,
  updateRoutingSettings,
  type EnrollmentDate,
  type EnrollmentPaymentChannel,
  type EnrollmentRoutingSettings,
  type EnrollmentRoutingStep,
  type EnrollmentTimeSlot,
} from '@/lib/enrollment-routing-api'
import {
  defaultEnrollmentPayment,
  getEnrollmentPayment,
  mergeEnrollmentPayment,
  saveEnrollmentPayment,
  type EnrollmentPaymentSettings,
} from '@/lib/site-settings-api'
import { setPageScrollLocked } from '@/hooks/useLenis'
import {
  EnrollmentEmptyState,
  EnrollmentPageHeader,
  EnrollmentStatusBadge,
} from '@/pages/dashboard/enrollment/enrollment-admin-ui'
import { cn } from '@/lib/utils'

type Tab = 'dates' | 'slots' | 'channels' | 'stations' | 'settings'

const TABS: { id: Tab; label: string; icon: typeof Calendar }[] = [
  { id: 'dates', label: 'Dates', icon: Calendar },
  { id: 'slots', label: 'Slots', icon: Clock },
  { id: 'channels', label: 'Payment channels', icon: CreditCard },
  { id: 'stations', label: 'Stations', icon: MapPin },
  { id: 'settings', label: 'Settings', icon: Settings2 },
]

type ListKind = 'dates' | 'slots' | 'channels' | 'stations'

type RoutingRow =
  | EnrollmentDate
  | EnrollmentTimeSlot
  | EnrollmentPaymentChannel
  | EnrollmentRoutingStep

type PubFilter = 'all' | 'published' | 'draft'

const PUB_FILTERS: { id: PubFilter; label: string; icon: typeof ClipboardList }[] = [
  { id: 'all', label: 'All', icon: ClipboardList },
  { id: 'published', label: 'Published', icon: CheckCircle2 },
  { id: 'draft', label: 'Draft', icon: EyeOff },
]

const PAGE_SIZE_KEY_PREFIX = 'pup-admin-enrollment-routing'
const VIEW_KEY_PREFIX = 'pup-admin-enrollment-routing'

function pageSizeKey(kind: ListKind) {
  return `${PAGE_SIZE_KEY_PREFIX}-${kind}-page-size`
}

function viewKey(kind: ListKind) {
  return `${VIEW_KEY_PREFIX}-${kind}-view`
}

function headingId(kind: ListKind) {
  return `enrollment-routing-${kind}-heading`
}

const defaultYearLevels = (): EnrollmentRoutingSettings['yearLevels'] => [
  { value: '1', label: '1st Year', description: '' },
  { value: '2', label: '2nd Year', description: '' },
  { value: '3', label: '3rd Year', description: '' },
  { value: '4', label: '4th Year', description: '' },
]

const BASE_PATH = '/admin/enrollment/routing'

function parseTab(raw: unknown): Tab | null {
  if (
    raw === 'dates' ||
    raw === 'slots' ||
    raw === 'channels' ||
    raw === 'stations' ||
    raw === 'settings'
  ) {
    return raw
  }
  return null
}

export default function RoutingAdmin() {
  const navigate = useNavigate()
  const location = useLocation()
  const [tab, setTab] = useState<Tab>(() => parseTab((location.state as { tab?: unknown } | null)?.tab) ?? 'dates')
  const [dates, setDates] = useState<EnrollmentDate[]>([])
  const [slots, setSlots] = useState<EnrollmentTimeSlot[]>([])
  const [channels, setChannels] = useState<EnrollmentPaymentChannel[]>([])
  const [steps, setSteps] = useState<EnrollmentRoutingStep[]>([])
  const [settings, setSettings] = useState<EnrollmentRoutingSettings>({
    termBanner: '',
    scFeeLabel: '',
    yearLevels: [],
  })
  const [enrollmentPay, setEnrollmentPay] = useState<EnrollmentPaymentSettings>(
    defaultEnrollmentPayment,
  )
  const [loading, setLoading] = useState(true)
  const [reloadBusy, setReloadBusy] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [listBusy, setListBusy] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<RoutingRow | null>(null)
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false)
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[]>([])
  const [viewing, setViewing] = useState<RoutingRow | null>(null)
  const [toast, setToast] = useState<SnackToast | null>(null)

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  useEffect(() => {
    const state = location.state as
      | { tab?: unknown; toast?: { message: string; variant: SnackToast['variant'] } }
      | null
    const nextTab = parseTab(state?.tab)
    if (nextTab) setTab(nextTab)
    if (state?.toast) {
      showToast(state.toast.message, state.toast.variant)
      navigate(location.pathname, { replace: true, state: nextTab ? { tab: nextTab } : null })
    }
  }, [location.pathname, location.state, navigate, showToast])

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (opts?.soft) setReloadBusy(true)
      else setLoading(true)
      const [bundleResult, payResult] = await Promise.all([
        getRoutingBundle({ all: true }),
        getEnrollmentPayment(),
      ])
      if (!bundleResult.ok) {
        if (bundleResult.status === 401 || bundleResult.status === 403) setNeedsLogin(true)
        else showToast(bundleResult.error, 'error')
      } else {
        setNeedsLogin(false)
        setDates(bundleResult.data.dates)
        setSlots(bundleResult.data.slots)
        setChannels(bundleResult.data.channels)
        setSteps(bundleResult.data.steps)
        const s = bundleResult.data.settings
        setSettings({
          termBanner: s.termBanner || '',
          scFeeLabel: s.scFeeLabel || '',
          yearLevels: Array.isArray(s.yearLevels) ? s.yearLevels : [],
        })
      }
      if (payResult.ok) {
        setEnrollmentPay(
          mergeEnrollmentPayment(defaultEnrollmentPayment, payResult.data.enrollment),
        )
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
    if (tab === 'settings') return
    setViewing(null)
    setPendingDelete(null)
    setPendingBulkDelete(false)
    setBulkDeleteIds([])
  }, [tab])

  const listKind: ListKind | null = useMemo(() => {
    if (tab === 'settings') return null
    return tab === 'stations' ? 'stations' : tab
  }, [tab])

  const listRows = useMemo((): RoutingRow[] => {
    if (!listKind) return []
    if (listKind === 'dates') return dates
    if (listKind === 'slots') return slots
    if (listKind === 'channels') return channels
    return steps
  }, [listKind, dates, slots, channels, steps])

  function goCreate(kind: ListKind) {
    navigate(`${BASE_PATH}/${kind}/new`)
  }

  function goEdit(kind: ListKind, id: number) {
    navigate(`${BASE_PATH}/${kind}/${id}/edit`)
  }

  async function saveRoutingSettingsForm(event: FormEvent) {
    event.preventDefault()
    setSavingSettings(true)
    const result = await updateRoutingSettings(settings)
    setSavingSettings(false)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) setNeedsLogin(true)
      else showToast(result.error, 'error')
      return
    }
    setSettings(result.data.settings)
    showToast('Routing settings saved.', 'success')
  }

  async function savePaymentForm(event: FormEvent) {
    event.preventDefault()
    setSavingPayment(true)
    const result = await saveEnrollmentPayment(enrollmentPay)
    setSavingPayment(false)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) setNeedsLogin(true)
      else showToast(result.error, 'error')
      return
    }
    setEnrollmentPay(mergeEnrollmentPayment(defaultEnrollmentPayment, result.data.enrollment))
    showToast('SC contribution bank details saved. Routing Slip uses this account.', 'success')
  }

  async function deleteRow(id: number, kind: ListKind) {
    setListBusy(true)
    const result =
      kind === 'dates'
        ? await deleteRoutingDate(id)
        : kind === 'slots'
          ? await deleteRoutingSlot(id)
          : kind === 'channels'
            ? await deletePaymentChannel(id)
            : await deleteRoutingStep(id)
    setListBusy(false)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) setNeedsLogin(true)
      else showToast(result.error, 'error')
      return false
    }
    if (kind === 'dates') setDates((p) => p.filter((x) => x.id !== id))
    else if (kind === 'slots') setSlots((p) => p.filter((x) => x.id !== id))
    else if (kind === 'channels') setChannels((p) => p.filter((x) => x.id !== id))
    else setSteps((p) => p.filter((x) => x.id !== id))
    return true
  }

  async function confirmListDelete() {
    if (!pendingDelete || !listKind) return
    const id = pendingDelete.id
    const ok = await deleteRow(id, listKind)
    if (!ok) return
    showToast(`${recordLabel(listKind)} deleted.`, 'success')
    setViewing((v) => (v?.id === id ? null : v))
    setPendingDelete(null)
  }

  async function handleBulkDelete() {
    if (!listKind || bulkDeleteIds.length === 0) return
    const ids = [...bulkDeleteIds]
    setBulkDeleting(true)
    let failed = 0
    for (const id of ids) {
      const result =
        listKind === 'dates'
          ? await deleteRoutingDate(id)
          : listKind === 'slots'
            ? await deleteRoutingSlot(id)
            : listKind === 'channels'
              ? await deletePaymentChannel(id)
              : await deleteRoutingStep(id)
      if (!result.ok) failed += 1
    }
    setBulkDeleting(false)
    setPendingBulkDelete(false)
    setBulkDeleteIds([])
    if (failed > 0) showToast(`Deleted with ${failed} error(s).`, 'error')
    else {
      const noun = ids.length === 1 ? recordLabel(listKind) : recordLabelPlural(listKind)
      showToast(ids.length === 1 ? `${noun} deleted.` : `${ids.length} ${noun} deleted.`, 'success')
    }
    await load({ soft: true })
  }

  if (needsLogin) return <RequireLoginRedirect />

  const busy =
    loading || reloadBusy || listBusy || savingSettings || savingPayment || bulkDeleting
  const emptyCopy = listKind ? LIST_EMPTY_COPY[listKind] : null

  return (
    <div className={workspaceTenantMainStackCls}>
      <EnrollmentPageHeader
        title="Routing Config"
        description="Dates, time slots, payment channels, and stations for the routing slip wizard."
        action={
          listKind && emptyCopy ? (
            <button
              type="button"
              className={workspacePageAddBtnCls}
              disabled={busy}
              onClick={() => goCreate(listKind)}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {emptyCopy.addLabel}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              title="Reload"
              aria-label="Reload routing data"
              onClick={() => void load({ soft: true })}
              className={catalogToolbarIconBtn}
            >
              <RefreshCw
                className={`${workspaceCatalogToolbarIconCls} ${reloadBusy ? 'animate-spin' : 'opacity-85'}`}
                aria-hidden
              />
            </button>
          )
        }
      />

      <div
        role="tablist"
        aria-label="Routing admin sections"
        className="-mx-0.5 flex gap-0.5 overflow-x-auto rounded-xl border border-zinc-200/90 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-950 [scrollbar-width:thin]"
      >
        {TABS.map((item) => {
          const Icon = item.icon
          const active = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={busy && loading}
              onClick={() => setTab(item.id)}
              className={cn(
                'inline-flex shrink-0 min-h-8 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition sm:min-h-9 sm:px-3 sm:text-[12px]',
                active
                  ? 'bg-brand-50 text-brand-900 dark:bg-brand-500/15 dark:text-brand-100'
                  : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900',
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300/90 bg-zinc-50/80 px-5 py-16 text-[13px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-hidden />
          Loading routing data…
        </div>
      ) : listKind && emptyCopy ? (
        <RoutingListRegister
          key={listKind}
          kind={listKind}
          rows={listRows}
          catalogBusy={busy}
          reloadBusy={reloadBusy}
          onReload={() => void load({ soft: true })}
          onView={setViewing}
          onEdit={(id) => goEdit(listKind, id)}
          onDelete={setPendingDelete}
          onBulkDeleteRequest={(ids) => {
            setBulkDeleteIds(ids)
            setPendingBulkDelete(true)
          }}
          emptyCopy={emptyCopy}
        />
      ) : (
        <SettingsTab
          settings={settings}
          enrollmentPay={enrollmentPay}
          savingSettings={savingSettings}
          savingPayment={savingPayment}
          onSettingsChange={setSettings}
          onPaymentChange={setEnrollmentPay}
          onSaveSettings={(e) => void saveRoutingSettingsForm(e)}
          onSavePayment={(e) => void savePaymentForm(e)}
        />
      )}

      {viewing && listKind ? (
        <RoutingRecordDetailsModal
          kind={listKind}
          row={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setViewing(null)
            goEdit(listKind, viewing.id)
          }}
          onDelete={() => {
            setViewing(null)
            setPendingDelete(viewing)
          }}
        />
      ) : null}

      {pendingDelete && listKind ? (
        <ConfirmDeleteDialog
          title={primaryLabel(listKind, pendingDelete)}
          noun={deleteNoun(listKind)}
          description="This record will be removed from the routing slip. This action cannot be undone."
          busy={listBusy}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmListDelete()}
        />
      ) : null}

      {pendingBulkDelete && listKind ? (
        <ConfirmDeleteDialog
          title={`${bulkDeleteIds.length} selected ${deleteNounPlural(listKind)}`}
          noun={deleteNounPlural(listKind)}
          description="These records will be removed from the routing slip. This action cannot be undone."
          busy={bulkDeleting}
          bulk
          onCancel={() => {
            setPendingBulkDelete(false)
            setBulkDeleteIds([])
          }}
          onConfirm={() => void handleBulkDelete()}
        />
      ) : null}

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

type ListRegisterProps = {
  kind: ListKind
  rows: RoutingRow[]
  catalogBusy: boolean
  reloadBusy: boolean
  onReload: () => void
  onView: (row: RoutingRow) => void
  onEdit: (id: number) => void
  onDelete: (row: RoutingRow) => void
  onBulkDeleteRequest: (ids: number[]) => void
  emptyCopy: (typeof LIST_EMPTY_COPY)[ListKind]
}

function RoutingListRegister({
  kind,
  rows,
  catalogBusy,
  reloadBusy,
  onReload,
  onView,
  onEdit,
  onDelete,
  onBulkDeleteRequest,
  emptyCopy,
}: ListRegisterProps) {
  const [query, setQuery] = useState('')
  const [pubFilter, setPubFilter] = useState<PubFilter>('all')
  const [pageNo, setPageNo] = useState(1)
  const [pageSize, setPageSize] = useState(() => readStoredRegisterPageSize(pageSizeKey(kind)))
  const [registerView, setRegisterView] = useState<RegisterView>(() =>
    initialRegisterView(viewKey(kind)),
  )
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null)

  const REGISTER_TITLE = registerTitle(kind)
  const hid = headingId(kind)

  useEffect(() => {
    setPageNo(1)
  }, [query, pageSize, pubFilter, kind])

  useEffect(() => {
    setSelectedIds([])
    setQuery('')
    setPubFilter('all')
    setOpenMenuId(null)
  }, [kind])

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => rows.some((r) => r.id === id)))
  }, [rows])

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    [rows],
  )

  const counts = useMemo(
    () => ({
      all: sorted.length,
      published: sorted.filter((r) => r.published).length,
      draft: sorted.filter((r) => !r.published).length,
    }),
    [sorted],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return sorted.filter((row) => {
      if (pubFilter === 'published' && !row.published) return false
      if (pubFilter === 'draft' && row.published) return false
      if (!needle) return true
      return rowSearchHaystack(kind, row).includes(needle)
    })
  }, [sorted, query, pubFilter, kind])

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
      sessionStorage.setItem(viewKey(kind), view)
    } catch {
      /* ignore */
    }
  }

  function goView(row: RoutingRow) {
    setOpenMenuId(null)
    onView(row)
  }

  const reloadBtn = (extraCls: string) => (
    <button
      type="button"
      disabled={catalogBusy}
      title="Reload catalog"
      aria-label="Reload catalog"
      onClick={onReload}
      className={`${catalogToolbarIconBtn} ${extraCls}`}
    >
      <RefreshCw
        className={`${workspaceCatalogToolbarIconCls} ${reloadBusy ? 'animate-spin' : 'opacity-85'}`}
        aria-hidden
      />
    </button>
  )

  function rowActions(row: RoutingRow) {
    return (
      <PortalActionMenu
        open={openMenuId === row.id}
        onOpenChange={(open) => setOpenMenuId(open ? row.id : null)}
        disabled={catalogBusy}
        items={[
          { id: 'view', label: 'View details', icon: Eye, onClick: () => goView(row) },
          { id: 'edit', label: 'Edit', icon: Pencil, onClick: () => onEdit(row.id) },
          {
            id: 'delete',
            label: 'Delete',
            icon: Trash2,
            danger: true,
            onClick: () => onDelete(row),
          },
        ]}
      />
    )
  }

  const paginationBar = (
    <RegisterPaginationBar
      disabled={catalogBusy}
      showingFrom={pageMeta.from}
      showingTo={pageMeta.to}
      totalRecords={pageMeta.total}
      pageSize={pageSize}
      onPageSizeChange={(n) => {
        setPageSize(n)
        writeStoredRegisterPageSize(pageSizeKey(kind), n)
      }}
      page={pageMeta.page}
      totalPages={pageMeta.pages}
      onPrev={() => setPageNo((p) => (p <= 1 ? p : p - 1))}
      onNext={() => setPageNo((p) => Math.min(pageMeta.pages, p + 1))}
      onGoPage={(pn) => setPageNo(Math.min(Math.max(1, pn), pageMeta.pages))}
      ariaLabel={`${REGISTER_TITLE} pagination`}
    />
  )

  const searchPlaceholder = searchPlaceholderFor(kind)

  return (
    <>
      <section aria-label="Catalog" className="w-full max-w-none">
        <div className={`${workspaceCatalogShellCls} ${workspaceCatalogPadCls} w-full max-w-none`}>
          <div
            role="toolbar"
            aria-label={`${REGISTER_TITLE} catalog filters`}
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
                    disabled={catalogBusy}
                    placeholder={searchPlaceholder}
                    aria-label={`Search ${REGISTER_TITLE.toLowerCase()}`}
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
                  {PUB_FILTERS.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={pubFilter === id}
                      title={`${label} (${counts[id]})`}
                      aria-label={`${label} (${counts[id]})`}
                      onClick={() => setPubFilter(id)}
                      className={catalogSegIcon(pubFilter === id)}
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
        aria-labelledby={hid}
        aria-label={REGISTER_TITLE}
        className={workspaceRegisterSectionStackCls}
      >
        <div className={workspaceRegisterBulkSelectionPlacementCls}>
          <RegisterBulkSelectionBar
            count={selectedIds.length}
            disabled={catalogBusy}
            onClear={() => setSelectedIds([])}
            onDelete={() => onBulkDeleteRequest([...selectedIds])}
          />
        </div>

        {filtered.length === 0 ? (
          <div className={workspaceRegisterPanelShellCls(registerView)}>
            <RegisterPanelHeading
              headingId={hid}
              title={REGISTER_TITLE}
              subtitle={`${rows.length === 0 ? '0' : '0 matching'} in catalog`}
              showMobileAdd={false}
            />
            <div className="min-w-0 bg-white px-4 py-5 sm:px-5 sm:py-6 dark:bg-zinc-950">
              <EnrollmentEmptyState
                Icon={emptyCopy.Icon}
                title={rows.length === 0 ? emptyCopy.title : `No matching ${registerNoun(kind)}s`}
                description={
                  rows.length === 0
                    ? emptyCopy.description
                    : 'Adjust search or published filter to see more records.'
                }
              />
            </div>
            <footer className={plansRegisterPanelFooterCls}>{paginationBar}</footer>
          </div>
        ) : registerView === 'table' ? (
          <div className={workspaceRegisterPanelShellCls('table')}>
            <RegisterPanelHeading
              headingId={hid}
              title={REGISTER_TITLE}
              subtitle={`${pageMeta.total.toLocaleString()} record${pageMeta.total === 1 ? '' : 's'}`}
              showMobileAdd={false}
            />
            <HorizontalDragScrollTableWrap className={plansRegisterTableScrollerCls}>
              <table className={workspaceRegisterTableCls}>
                <caption className="sr-only">{REGISTER_TITLE}</caption>
                <thead className={workspaceRegisterTheadCls}>
                  <tr className="[&_th]:text-brand-900/80 dark:[&_th]:text-zinc-300">
                    <th scope="col" className={workspaceRegisterThCheckboxCellCls}>
                      <input
                        ref={selectAllCheckboxRef}
                        type="checkbox"
                        className={tableCheckboxCls}
                        checked={pageIds.length > 0 && selectedOnPageCount === pageIds.length}
                        onChange={toggleVisibleSelection}
                        disabled={catalogBusy || pageIds.length === 0}
                        aria-label="Select all on this page"
                      />
                    </th>
                    <th scope="col" className={cn(workspaceRegisterThSortCellCls, 'text-left')}>
                      {tablePrimaryColumn(kind)}
                    </th>
                    <th scope="col" className={cn(workspaceRegisterThSortCellCls, 'text-left')}>
                      Details
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[4.5rem] text-left')}
                    >
                      Sort
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[6.5rem] text-left')}
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
                        aria-label={`View ${primaryLabel(kind, row)}`}
                      >
                        <td
                          className="w-[2.5rem] whitespace-nowrap px-1 py-2 text-center sm:w-11 sm:px-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className={tableCheckboxCls}
                            checked={selectedRow}
                            disabled={catalogBusy}
                            aria-label={`Select ${primaryLabel(kind, row)}`}
                            onChange={() => toggleRowSelected(row.id)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
                            {primaryLabel(kind, row)}
                          </p>
                        </td>
                        <td className="px-2 py-2">
                          <p className="truncate text-[12px] text-zinc-600 dark:text-zinc-400">
                            {secondaryLabel(kind, row)}
                          </p>
                        </td>
                        <td className="px-2 py-2 text-[12px] tabular-nums text-zinc-600 dark:text-zinc-400">
                          {row.sortOrder}
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
              headingId={hid}
              title={REGISTER_TITLE}
              subtitle={`${pageMeta.total.toLocaleString()} record${pageMeta.total === 1 ? '' : 's'}`}
              showMobileAdd={false}
            />
            <ul className="grid gap-3 bg-transparent px-0 py-2.5 sm:grid-cols-2 sm:gap-3 sm:bg-white sm:px-4 sm:py-4 xl:grid-cols-3 dark:sm:bg-zinc-950">
              {pageMeta.rows.map((row) => {
                const selectedRow = selectedIds.includes(row.id)
                const Icon = emptyCopy.Icon
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
                      aria-label={`View ${primaryLabel(kind, row)}`}
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
                            disabled={catalogBusy}
                            aria-label={`Select ${primaryLabel(kind, row)}`}
                            onChange={() => toggleRowSelected(row.id)}
                          />
                        </label>
                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <EnrollmentStatusBadge published={row.published} />
                          {rowActions(row)}
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col gap-2.5 p-3.5 pt-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                            {primaryLabel(kind, row)}
                          </h3>
                          <p className="mt-1 truncate text-[12px] text-zinc-500 dark:text-zinc-400">
                            {secondaryLabel(kind, row)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-zinc-200/70 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                          <p className="inline-flex items-center gap-1.5 truncate text-[12px] font-medium text-zinc-800 dark:text-zinc-200">
                            <Icon className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden />
                            Sort order {row.sortOrder}
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
    </>
  )
}

function RoutingRecordDetailsModal({
  kind,
  row,
  onClose,
  onEdit,
  onDelete,
}: {
  kind: ListKind
  row: RoutingRow
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
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

  const detailFields = detailFieldsFor(kind, row)

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
              {registerTitle(kind)} details
            </p>
            <p className="mt-0.5 text-[12px] text-zinc-500">ID {row.id}</p>
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
            <EnrollmentStatusBadge published={row.published} />
            <span className="text-[12px] text-zinc-500">Sort order {row.sortOrder}</span>
          </div>
          <h2
            id={titleId}
            className="mt-3 text-[19px] leading-snug font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            {primaryLabel(kind, row)}
          </h2>

          <dl className="mt-4 space-y-2.5">
            {detailFields.map(({ term, value }) => (
              <div
                key={term}
                className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <dt className="text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
                  {term}
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-[13px] text-zinc-800 dark:text-zinc-200">
                  {value || '—'}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-zinc-100 px-5 py-4 sm:flex-row sm:px-6 dark:border-zinc-800">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11 flex-1 rounded-xl text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
            onClick={onDelete}
          >
            <Trash2 className="size-4" aria-hidden />
            Delete
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

function detailFieldsFor(kind: ListKind, row: RoutingRow): { term: string; value: string }[] {
  if (kind === 'channels') {
    const ch = row as EnrollmentPaymentChannel
    return [
      { term: 'Key', value: ch.key },
      { term: 'Title', value: ch.title },
      { term: 'Copy value', value: ch.copyValue },
      { term: 'Lines', value: ch.lines.join('\n') },
    ]
  }
  if (kind === 'stations') {
    const st = row as EnrollmentRoutingStep
    return [
      { term: 'Step', value: st.step },
      { term: 'Office', value: st.office },
      { term: 'Signature note', value: st.signatureNote ?? '' },
    ]
  }
  if (kind === 'slots') {
    const s = row as EnrollmentTimeSlot
    return [
      { term: 'Label', value: s.label },
      { term: 'Value', value: s.value },
      { term: 'Description', value: s.description },
      {
        term: 'Batch',
        value: s.batchId != null ? String(s.batchId) : '—',
      },
      { term: 'Status', value: s.full ? 'Full' : 'Open' },
    ]
  }
  const d = row as EnrollmentDate
  return [
    { term: 'Label', value: d.label },
    { term: 'Value', value: d.value },
    { term: 'Description', value: d.description },
  ]
}

function registerTitle(kind: ListKind) {
  if (kind === 'dates') return 'Date register'
  if (kind === 'slots') return 'Time slot register'
  if (kind === 'channels') return 'Payment channel register'
  return 'Station register'
}

function registerNoun(kind: ListKind) {
  if (kind === 'dates') return 'date'
  if (kind === 'slots') return 'slot'
  if (kind === 'channels') return 'channel'
  return 'station'
}

function tablePrimaryColumn(kind: ListKind) {
  if (kind === 'channels') return 'Title'
  if (kind === 'stations') return 'Step'
  return 'Label'
}

function searchPlaceholderFor(kind: ListKind) {
  if (kind === 'channels') return 'Search title, key, lines…'
  if (kind === 'stations') return 'Search step, office, signature…'
  if (kind === 'slots') return 'Search label, value, description…'
  return 'Search label, value, description…'
}

function rowSearchHaystack(kind: ListKind, row: RoutingRow) {
  if (kind === 'channels') {
    const ch = row as EnrollmentPaymentChannel
    return `${ch.title} ${ch.key} ${ch.copyValue} ${ch.lines.join(' ')} ${ch.sortOrder}`
  }
  if (kind === 'stations') {
    const st = row as EnrollmentRoutingStep
    return `${st.step} ${st.office} ${st.signatureNote ?? ''} ${st.sortOrder}`
  }
  if (kind === 'slots') {
    const s = row as EnrollmentTimeSlot
    return `${s.label} ${s.value} ${s.description} ${s.sortOrder}`
  }
  const d = row as EnrollmentDate
  return `${d.label} ${d.value} ${d.description} ${d.sortOrder}`
}

function primaryLabel(kind: ListKind, row: RoutingRow) {
  if (kind === 'channels') return (row as EnrollmentPaymentChannel).title
  if (kind === 'stations') return (row as EnrollmentRoutingStep).step
  return (row as EnrollmentDate).label
}

function secondaryLabel(kind: ListKind, row: RoutingRow) {
  if (kind === 'channels') {
    const ch = row as EnrollmentPaymentChannel
    return `Key ${ch.key} · ${ch.lines.length} line${ch.lines.length === 1 ? '' : 's'}`
  }
  if (kind === 'stations') {
    const st = row as EnrollmentRoutingStep
    return [st.office, st.signatureNote].filter(Boolean).join(' · ') || 'No signature note'
  }
  if (kind === 'slots') {
    const s = row as EnrollmentTimeSlot
    const status = s.full ? 'Full' : 'Open'
    return `Value ${s.value}${s.description ? ` · ${s.description}` : ''} · ${status}`
  }
  const d = row as EnrollmentDate
  return `Value ${d.value}${d.description ? ` · ${d.description}` : ''}`
}

function recordLabel(kind: ListKind) {
  return deleteNoun(kind)
}

function recordLabelPlural(kind: ListKind) {
  return deleteNounPlural(kind)
}

function deleteNoun(kind: ListKind) {
  if (kind === 'dates') return 'date option'
  if (kind === 'slots') return 'time slot'
  if (kind === 'channels') return 'payment channel'
  return 'station step'
}

function deleteNounPlural(kind: ListKind) {
  if (kind === 'dates') return 'date options'
  if (kind === 'slots') return 'time slots'
  if (kind === 'channels') return 'payment channels'
  return 'station steps'
}

const LIST_EMPTY_COPY: Record<
  ListKind,
  { Icon: typeof Calendar; title: string; description: string; addLabel: string }
> = {
  dates: {
    Icon: Calendar,
    title: 'No enrollment dates yet',
    description: 'Add date options students can choose when generating a routing slip.',
    addLabel: 'Add date',
  },
  slots: {
    Icon: Clock,
    title: 'No time slots yet',
    description: 'Add time slots paired with enrollment dates on the slip.',
    addLabel: 'Add slot',
  },
  channels: {
    Icon: CreditCard,
    title: 'No payment channels yet',
    description: 'Add payment methods and copy shown on the routing slip.',
    addLabel: 'Add channel',
  },
  stations: {
    Icon: MapPin,
    title: 'No station steps yet',
    description: 'Add office stops and signature lines for the slip walkthrough.',
    addLabel: 'Add station',
  },
}

function Field({
  label,
  value,
  onChange,
  disabled,
  type = 'text',
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  type?: string
  className?: string
}) {
  return (
    <div className={cn(workspaceFormFieldGroupCls, className)}>
      <label className={workspaceFormLabelCls}>{label}</label>
      <input
        type={type}
        className={catalogInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  )
}

function SettingsTab({
  settings,
  enrollmentPay,
  savingSettings,
  savingPayment,
  onSettingsChange,
  onPaymentChange,
  onSaveSettings,
  onSavePayment,
}: {
  settings: EnrollmentRoutingSettings
  enrollmentPay: EnrollmentPaymentSettings
  savingSettings: boolean
  savingPayment: boolean
  onSettingsChange: (s: EnrollmentRoutingSettings) => void
  onPaymentChange: (p: EnrollmentPaymentSettings) => void
  onSaveSettings: (e: FormEvent) => void
  onSavePayment: (e: FormEvent) => void
}) {
  function patchYearLevel(
    index: number,
    patch: Partial<EnrollmentRoutingSettings['yearLevels'][number]>,
  ) {
    onSettingsChange({
      ...settings,
      yearLevels: settings.yearLevels.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        onSubmit={onSaveSettings}
        className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h2 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-50">Routing copy</h2>
        <div className={cn(formControlWellCls, 'mt-4 space-y-4')}>
          <Field
            label="Term banner"
            value={settings.termBanner}
            onChange={(v) => onSettingsChange({ ...settings, termBanner: v })}
            disabled={savingSettings}
          />
          <Field
            label="SC fee label"
            value={settings.scFeeLabel}
            onChange={(v) => onSettingsChange({ ...settings, scFeeLabel: v })}
            disabled={savingSettings}
          />
          <CardDivider>Year levels</CardDivider>
          {settings.yearLevels.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-4 text-center dark:border-zinc-800">
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                No year levels configured yet.
              </p>
              <button
                type="button"
                className="mt-3 inline-flex h-9 items-center justify-center rounded-lg bg-brand-700 px-3 text-[12px] font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
                disabled={savingSettings}
                onClick={() =>
                  onSettingsChange({ ...settings, yearLevels: defaultYearLevels() })
                }
              >
                Add 1st–4th year levels
              </button>
            </div>
          ) : (
            settings.yearLevels.map((yl, index) => (
              <div key={index} className="grid gap-2 rounded-lg border border-zinc-200/80 p-3 dark:border-zinc-800">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Year {index + 1}
                </p>
                <Field label="Value" value={yl.value} onChange={(v) => patchYearLevel(index, { value: v })} disabled={savingSettings} />
                <Field label="Label" value={yl.label} onChange={(v) => patchYearLevel(index, { label: v })} disabled={savingSettings} />
                <Field
                  label="Description"
                  value={yl.description ?? ''}
                  onChange={(v) => patchYearLevel(index, { description: v })}
                  disabled={savingSettings}
                />
              </div>
            ))
          )}
        </div>
        <button type="submit" className={cn(formWorkspacePrimaryBtnCls, 'mt-4')} disabled={savingSettings}>
          {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Save routing settings
        </button>
      </form>

      <form
        onSubmit={onSavePayment}
        className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h2 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-50">SC contribution bank</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Routing Slip shows this bank account for SC contributions. Leave the account number blank
          to print “To follow”. Stored under the site-settings <code className="text-[11px]">enrollment</code>{' '}
          key.
        </p>
        <div className={cn(formControlWellCls, 'mt-4 space-y-4')}>
          <Field
            label="Bank name"
            value={enrollmentPay.bankName}
            onChange={(v) => onPaymentChange({ ...enrollmentPay, bankName: v })}
            disabled={savingPayment}
          />
          <Field
            label="Account name"
            value={enrollmentPay.accountName}
            onChange={(v) => onPaymentChange({ ...enrollmentPay, accountName: v })}
            disabled={savingPayment}
          />
          <Field
            label="Account number"
            value={enrollmentPay.accountNumber}
            onChange={(v) => onPaymentChange({ ...enrollmentPay, accountNumber: v })}
            disabled={savingPayment}
          />
        </div>
        <button type="submit" className={cn(formWorkspacePrimaryBtnCls, 'mt-4')} disabled={savingPayment}>
          {savingPayment ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Save bank details
        </button>
      </form>
    </div>
  )
}

function CardDivider({ children }: { children: ReactNode }) {
  return <p className="text-[12px] font-semibold text-zinc-700 dark:text-zinc-300">{children}</p>
}
