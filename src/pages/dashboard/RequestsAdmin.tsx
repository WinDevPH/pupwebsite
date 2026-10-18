import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ArrowUpDown,
  CheckCircle2,
  CircleDot,
  Clock,
  Download,
  Inbox,
  LayoutGrid,
  Layers,
  Loader2,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  Table2,
  Trash2,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { RequireLoginRedirect } from '@/components/portal/RequireLoginRedirect'
import { HorizontalDragScrollTableWrap } from '@/components/portal/HorizontalDragScrollTableWrap'
import { PortalActionMenu } from '@/components/portal/RegisterRowActions'
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
  deletePortalRequest,
  deletePortalRequests,
  listPortalRequests,
  portalRequestAttachmentUrl,
  type PortalRequestRecord,
  type PortalRequestStatus,
} from '@/lib/requests-api'
import { formatPhDateTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import { ConfirmDeleteDialog } from '@/components/portal/ConfirmDeleteDialog'

const PAGE_SIZE_KEY = 'pup-admin-requests-page-size'
const VIEW_KEY = 'pup-admin-requests-view'
const REGISTER_HEADING_ID = 'requests-register-heading'

type StatusFilter = 'all' | PortalRequestStatus
type SortKey = 'id' | 'name' | 'subject' | 'status' | 'submittedAt'
type SortDir = 'asc' | 'desc'

function rowKey(item: PortalRequestRecord) {
  return item.dbId ?? item.id
}

function statusTone(status: string) {
  switch (status) {
    case 'Replied':
    case 'Closed':
      return 'emerald' as const
    case 'In review':
      return 'amber' as const
    case 'Received':
      return 'maroon' as const
    default:
      return 'brand' as const
  }
}

export default function RequestsAdmin() {
  const navigate = useNavigate()
  const location = useLocation()
  const [items, setItems] = useState<PortalRequestRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadBusy, setReloadBusy] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'submittedAt',
    dir: 'desc',
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(() => readStoredRegisterPageSize(PAGE_SIZE_KEY))
  const [registerView, setRegisterView] = useState<RegisterView>(() =>
    initialRegisterView(VIEW_KEY),
  )
  const [busyId, setBusyId] = useState<number | string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [pendingDelete, setPendingDelete] = useState<PortalRequestRecord | null>(null)
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false)
  const [toast, setToast] = useState<SnackToast | null>(null)
  const [openMenuId, setOpenMenuId] = useState<number | string | null>(null)
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (opts?.soft) setReloadBusy(true)
    else setLoading(true)
    const result = await listPortalRequests()
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
  }, [showToast])

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
    setPage(1)
  }, [query, statusFilter, sort, pageSize])

  const statusCounts = useMemo(() => {
    const base: Record<StatusFilter, number> = {
      all: items.length,
      Submitted: 0,
      Received: 0,
      'In review': 0,
      Replied: 0,
      Closed: 0,
    }
    for (const item of items) {
      if (item.status in base) {
        base[item.status as PortalRequestStatus] += 1
      }
    }
    return base
  }, [items])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (!needle) return true
      const haystack =
        `${item.id} ${item.name} ${item.email} ${item.subject} ${item.attachment} ${item.body ?? ''} ${item.status}`.toLowerCase()
      return haystack.includes(needle)
    })
  }, [items, query, statusFilter])

  const sorted = useMemo(() => {
    const rows = [...filtered]
    const dir = sort.dir === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      let cmp = 0
      switch (sort.key) {
        case 'id':
          cmp = a.id.localeCompare(b.id)
          break
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'subject':
          cmp = a.subject.localeCompare(b.subject)
          break
        case 'status':
          cmp = a.status.localeCompare(b.status)
          break
        case 'submittedAt':
        default:
          cmp = a.submittedAt.localeCompare(b.submittedAt)
          break
      }
      return cmp * dir
    })
    return rows
  }, [filtered, sort])

  const pageMeta = useMemo(() => {
    const total = sorted.length
    const psz = effectiveRegisterPageSize(pageSize, total)
    const pages = total === 0 ? 0 : Math.ceil(total / psz)
    const safePage = pages === 0 ? 1 : Math.min(Math.max(1, page), pages)
    const start = total === 0 ? 0 : (safePage - 1) * psz
    const from = total === 0 ? 0 : start + 1
    const to = total === 0 ? 0 : Math.min(start + psz, total)
    const rows = total === 0 ? [] : sorted.slice(start, start + psz)
    return { total, psz, pages, page: safePage, from, to, rows }
  }, [sorted, page, pageSize])

  const pageIds = useMemo(
    () => pageMeta.rows.map((row) => row.dbId).filter((id): id is number => typeof id === 'number'),
    [pageMeta.rows],
  )
  const selectedOnPageCount = useMemo(
    () => pageIds.filter((id) => selectedIds.includes(id)).length,
    [pageIds, selectedIds],
  )

  useEffect(() => {
    const valid = new Set(items.map((item) => item.dbId).filter((id): id is number => typeof id === 'number'))
    setSelectedIds((prev) => prev.filter((id) => valid.has(id)))
  }, [items])

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

  function handleSortClick(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    )
  }

  function openDetails(item: PortalRequestRecord) {
    setOpenMenuId(null)
    if (!item.dbId) {
      showToast('This request cannot be opened.', 'error')
      return
    }
    navigate(`/admin/requests/${item.dbId}`)
  }

  async function handleDelete() {
    if (!pendingDelete?.dbId) return
    setBusyId(pendingDelete.dbId)
    const result = await deletePortalRequest(pendingDelete.dbId)
    setBusyId(null)
    if (!result.ok) {
      showToast(result.error, 'error')
      return
    }
    showToast('Request deleted.', 'success')
    setSelectedIds((prev) => prev.filter((id) => id !== pendingDelete.dbId))
    setPendingDelete(null)
    await load({ soft: true })
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setBulkDeleting(true)
    const result = await deletePortalRequests(ids)
    setBulkDeleting(false)
    setPendingBulkDelete(false)
    setSelectedIds([])
    if (!result.ok) {
      showToast(result.error, 'error')
      return
    }
    showToast(
      ids.length === 1 ? 'Request deleted.' : `${ids.length} requests deleted.`,
      'success',
    )
    await load({ soft: true })
  }

  const busy = loading || reloadBusy || busyId !== null || bulkDeleting

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
      onPrev={() => setPage((prev) => (prev <= 1 ? prev : prev - 1))}
      onNext={() => setPage((prev) => Math.min(pageMeta.pages, prev + 1))}
      onGoPage={(pn) => setPage(Math.min(Math.max(1, pn), pageMeta.pages))}
      ariaLabel="Requests register pagination"
    />
  )

  return (
    <div className={workspaceTenantMainStackCls}>
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="min-w-0 space-y-1">
          <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900 sm:text-[22px] dark:text-zinc-50">
            Requests
          </h1>
          <p className="max-w-xl text-[13px] leading-6 text-zinc-500 dark:text-zinc-400">
            Review Student Services Portal submissions, update status, and download attachments.
          </p>
        </div>
      </div>

      <>
          <section aria-label="Catalog" className="w-full max-w-none">
            <div className={`${workspaceCatalogShellCls} ${workspaceCatalogPadCls} w-full max-w-none`}>
              <div
                role="toolbar"
                aria-label="Requests catalog filters"
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
                        placeholder="Searchâ€¦"
                        aria-label="Search requests"
                        className={`${catalogInput} min-w-0 w-full pl-9`}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      title="Reload catalog"
                      aria-label="Reload catalog"
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
                      disabled={busy}
                      title="Reload catalog"
                      aria-label="Reload catalog"
                      onClick={() => void load({ soft: true })}
                      className={`${catalogToolbarIconBtn} max-sm:hidden`}
                    >
                      <RefreshCw
                        className={`${workspaceCatalogToolbarIconCls} ${reloadBusy ? 'animate-spin' : 'opacity-85'}`}
                        aria-hidden
                      />
                    </button>

                    <div
                      role="radiogroup"
                      aria-label="Status filter"
                      className={workspaceCatalogSegTrackInlineCls}
                    >
                      {(
                        [
                          { key: 'all' as const, icon: Layers, label: 'All' },
                          { key: 'Submitted' as const, icon: Send, label: 'Submitted' },
                          { key: 'In review' as const, icon: Clock, label: 'In review' },
                          { key: 'Replied' as const, icon: CheckCircle2, label: 'Replied' },
                          { key: 'Closed' as const, icon: Inbox, label: 'Closed' },
                        ] as const
                      ).map(({ key, icon: Icon, label }) => (
                        <button
                          key={key}
                          type="button"
                          role="radio"
                          aria-checked={statusFilter === key}
                          title={`${label} (${statusCounts[key]})`}
                          aria-label={`${label} (${statusCounts[key]})`}
                          onClick={() => setStatusFilter(key)}
                          className={catalogSegIcon(statusFilter === key)}
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
            aria-label="Registered Requests"
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
                <h2 id={REGISTER_HEADING_ID} className="sr-only">
                  Registered Requests
                </h2>
                <Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-hidden />
                Loading requestsâ€¦
              </div>
            ) : sorted.length === 0 ? (
              <div className={workspaceRegisterPanelShellCls(registerView)}>
                <RegisterPanelHeading
                  headingId={REGISTER_HEADING_ID}
                  title="Registered Requests"
                  subtitle={`${items.length === 0 ? '0' : '0 matching'} in catalog`}
                />
                <div className="min-w-0 bg-white px-4 py-5 sm:px-5 sm:py-6 dark:bg-zinc-950">
                  <div className="flex flex-col items-center overflow-hidden rounded-lg border border-dashed border-zinc-300/90 bg-zinc-50/85 px-5 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
                    <Inbox
                      className="mb-5 h-[3.75rem] w-[3.75rem] shrink-0 text-brand-600/45"
                      strokeWidth={1.35}
                      aria-hidden
                    />
                    <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
                      {items.length === 0 ? 'No requests yet' : 'No matching requests'}
                    </p>
                    <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {items.length === 0
                        ? 'Submissions from the Student Services Portal appear here.'
                        : 'Adjust search, status filter, or reload.'}
                    </p>
                  </div>
                </div>
                <footer className={plansRegisterPanelFooterCls}>{paginationBar}</footer>
              </div>
            ) : registerView === 'table' ? (
              <div className={workspaceRegisterPanelShellCls('table')}>
                <RegisterPanelHeading
                  headingId={REGISTER_HEADING_ID}
                  title="Registered Requests"
                  subtitle={`${pageMeta.total.toLocaleString()} record${pageMeta.total === 1 ? '' : 's'}`}
                />
                <HorizontalDragScrollTableWrap className={plansRegisterTableScrollerCls}>
                  <table className={workspaceRegisterTableCls}>
                    <caption className="sr-only">Portal request register rows</caption>
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
                            aria-label="Select all requests on this page"
                            title="Select this page"
                          />
                        </th>
                        <SortTh
                          label="Tracking"
                          column="id"
                          activeKey={sort.key}
                          activeDir={sort.dir}
                          onSort={handleSortClick}
                          className="w-[11rem]"
                        />
                        <SortTh
                          label="Sender"
                          column="name"
                          activeKey={sort.key}
                          activeDir={sort.dir}
                          onSort={handleSortClick}
                          className="w-[14rem]"
                        />
                        <SortTh
                          label="Subject"
                          column="subject"
                          activeKey={sort.key}
                          activeDir={sort.dir}
                          onSort={handleSortClick}
                          className="w-[16rem] max-w-[16rem] sm:w-[18rem]"
                        />
                        <SortTh
                          label="Filed"
                          column="submittedAt"
                          activeKey={sort.key}
                          activeDir={sort.dir}
                          onSort={handleSortClick}
                          className="w-[10rem]"
                        />
                        <SortTh
                          label="Status"
                          column="status"
                          activeKey={sort.key}
                          activeDir={sort.dir}
                          onSort={handleSortClick}
                          className="w-[8rem]"
                        />
                        <th scope="col" className={workspaceRegisterThActionsCellCls}>
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageMeta.rows.map((item) => {
                        const key = rowKey(item)
                        const selected = item.dbId ? selectedIds.includes(item.dbId) : false
                        return (
                          <tr
                            key={key}
                            className={cn(workspaceRegisterTbodyRowCls, 'cursor-pointer')}
                            onClick={() => openDetails(item)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                openDetails(item)
                              }
                            }}
                            tabIndex={0}
                          >
                            <td
                              className="w-[2.75rem] px-2 py-2 align-middle"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                className={tableCheckboxCls}
                                checked={selected}
                                disabled={!item.dbId || busy}
                                onChange={() => item.dbId && toggleRowSelected(item.dbId)}
                                aria-label={`Select ${item.id}`}
                              />
                            </td>
                            <td className="px-3 py-2.5 align-middle">
                              <span className="font-mono text-[12px] font-semibold text-brand-800 dark:text-brand-300">
                                {item.id}
                              </span>
                            </td>
                            <td className="min-w-0 px-3 py-2.5 align-middle">
                              <p className="truncate text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
                                {item.name}
                              </p>
                              <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                                {item.email}
                              </p>
                            </td>
                            <td className="min-w-0 px-3 py-2.5 align-middle">
                              <p className="truncate text-[13px] font-medium text-zinc-800 dark:text-zinc-200">
                                {item.subject}
                              </p>
                              <p className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                                <Paperclip className="size-3 shrink-0" aria-hidden />
                                <span className="truncate">{item.attachment}</span>
                              </p>
                            </td>
                            <td className="px-3 py-2.5 align-middle text-[12px] text-zinc-600 dark:text-zinc-300">
                              {formatPhDateTime(item.submittedAt)}
                            </td>
                            <td className="px-3 py-2.5 align-middle">
                              <StatusBadge status={item.status} />
                            </td>
                            <td
                              className="w-[3rem] px-2 py-2 align-middle"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <RowMenu
                                item={item}
                                open={openMenuId === key}
                                busy={busyId === item.dbId}
                                onOpenChange={(open) => setOpenMenuId(open ? key : null)}
                                onView={() => openDetails(item)}
                                onDelete={() => setPendingDelete(item)}
                              />
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
                  headingId={REGISTER_HEADING_ID}
                  title="Registered Requests"
                  subtitle={`${pageMeta.total.toLocaleString()} record${pageMeta.total === 1 ? '' : 's'}`}
                />
                <div className="grid gap-3 bg-white p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3 dark:bg-zinc-950">
                  {pageMeta.rows.map((item) => {
                    const key = rowKey(item)
                    const selected = item.dbId ? selectedIds.includes(item.dbId) : false
                    return (
                      <article
                        key={key}
                        className={cn(
                          'group relative flex min-w-0 cursor-pointer flex-col rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 transition hover:border-brand-200 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-brand-500/30',
                          selected && 'ring-2 ring-brand-500/30',
                        )}
                        onClick={() => openDetails(item)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            openDetails(item)
                          }
                        }}
                        tabIndex={0}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-mono text-[11px] font-semibold text-brand-800 dark:text-brand-300">
                            {item.id}
                          </span>
                          <div
                            className="flex items-center gap-1"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              className={tableCheckboxCls}
                              checked={selected}
                              disabled={!item.dbId || busy}
                              onChange={() => item.dbId && toggleRowSelected(item.dbId)}
                              aria-label={`Select ${item.id}`}
                            />
                            <RowMenu
                              item={item}
                              open={openMenuId === key}
                              busy={busyId === item.dbId}
                              onOpenChange={(open) => setOpenMenuId(open ? key : null)}
                              onView={() => openDetails(item)}
                              onDelete={() => setPendingDelete(item)}
                            />
                          </div>
                        </div>
                        <h3 className="mt-2 truncate text-[14px] font-semibold text-zinc-900 dark:text-zinc-50">
                          {item.subject}
                        </h3>
                        <p className="mt-1 truncate text-[12px] text-zinc-600 dark:text-zinc-400">
                          {item.name} Â· {item.email}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <StatusBadge status={item.status} />
                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            {formatPhDateTime(item.submittedAt)}
                          </span>
                        </div>
                      </article>
                    )
                  })}
                </div>
                <footer className={plansRegisterPanelFooterCls}>{paginationBar}</footer>
              </div>
            )}
          </section>
        </>

      {pendingDelete ? (
        <ConfirmDeleteDialog
          title={pendingDelete.id}
          noun="request"
          description="This request will be removed from the database, including its attachment. This action cannot be undone."
          busy={busyId === pendingDelete.dbId}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}

      {pendingBulkDelete ? (
        <ConfirmDeleteDialog
          title={`${selectedIds.length} selected request${selectedIds.length === 1 ? '' : 's'}`}
          noun="requests"
          description="These requests will be removed from the database, including their attachments. This action cannot be undone."
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

function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status)
  return (
    <span
      className={cn(
        'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-[10px] border px-2 py-1 text-[11px] font-medium leading-none shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:shadow-none',
        tone === 'emerald' &&
          'border-emerald-200/85 bg-gradient-to-br from-white to-emerald-50/80 text-emerald-950 dark:border-emerald-500/22 dark:from-zinc-950 dark:to-emerald-500/14 dark:text-emerald-50',
        tone === 'amber' &&
          'border-amber-200/85 bg-gradient-to-br from-white to-amber-50/80 text-amber-950 dark:border-amber-500/22 dark:from-zinc-950 dark:to-amber-500/14 dark:text-amber-50',
        tone === 'maroon' &&
          'border-maroon-200/85 bg-gradient-to-br from-white to-maroon-50/80 text-maroon-950 dark:border-maroon-500/22 dark:from-zinc-950 dark:to-maroon-500/14 dark:text-maroon-50',
        tone === 'brand' &&
          'border-brand-200/85 bg-gradient-to-br from-white to-brand-50/80 text-brand-950 dark:border-brand-500/22 dark:from-zinc-950 dark:to-brand-500/14 dark:text-brand-50',
      )}
      title={status}
    >
      <span
        className={cn(
          'inline-flex h-2 w-2 shrink-0 rounded-full',
          tone === 'emerald' && 'bg-emerald-500',
          tone === 'amber' && 'bg-amber-500',
          tone === 'maroon' && 'bg-maroon-600',
          tone === 'brand' && 'bg-brand-600',
        )}
        aria-hidden
      />
      <span className="truncate">{status}</span>
    </span>
  )
}

function SortTh({
  label,
  column,
  activeKey,
  activeDir,
  onSort,
  className = '',
}: {
  label: string
  column: SortKey
  activeKey: SortKey
  activeDir: SortDir
  onSort: (key: SortKey) => void
  className?: string
}) {
  const active = activeKey === column
  return (
    <th
      scope="col"
      className={cn(workspaceRegisterThSortCellCls, className)}
      aria-sort={active ? (activeDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex min-h-8 w-full items-center gap-1.5 rounded-md px-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-inherit outline-none transition hover:bg-zinc-100/80 focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:bg-zinc-900 dark:focus-visible:ring-brand-400/35"
      >
        {label}
        <ArrowUpDown
          className={cn(
            'h-3 w-3 shrink-0 stroke-[2.25]',
            active
              ? 'text-brand-700 opacity-90 dark:text-brand-300'
              : 'opacity-45 dark:text-zinc-500',
          )}
          aria-hidden
        />
      </button>
    </th>
  )
}

function RowMenu({
  item,
  open,
  busy,
  onOpenChange,
  onView,
  onDelete,
}: {
  item: PortalRequestRecord
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onView: () => void
  onDelete: () => void
}) {
  return (
    <PortalActionMenu
      open={open}
      onOpenChange={onOpenChange}
      disabled={busy}
      ariaLabel={`Actions for ${item.id}`}
      items={[
        { id: 'view', label: 'View details', icon: CircleDot, onClick: onView },
        {
          id: 'download',
          label: 'Download',
          icon: Download,
          href: portalRequestAttachmentUrl(item),
        },
        { id: 'delete', label: 'Delete', icon: Trash2, danger: true, onClick: onDelete },
      ]}
    />
  )
}
