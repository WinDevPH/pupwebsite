import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowUpDown,
  Images,
  LayoutGrid,
  Loader2,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Table2,
  X,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
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
  RegisterBulkSelectionBar,
  RegisterPaginationBar,
  RegisterPanelHeading,
  tableCheckboxCls,
  workspaceCatalogPadCls,
  workspaceCatalogSegTrackInlineCls,
  workspaceCatalogShellCls,
  workspaceCatalogToolbarActionsRowCls,
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
import { CatalogSelect } from '@/components/ui/CatalogSelect'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import { setPageScrollLocked } from '@/hooks/useLenis'
import {
  deleteGalleryBatch,
  deleteGalleryBatches,
  getGalleryBatchById,
  getGalleryDisplaySettings,
  listGalleryBatches,
  listGalleryYears,
  setGalleryDisplayYear,
  type GalleryBatchRecord,
  type GalleryImageRecord,
} from '@/lib/gallery-api'
import { cn } from '@/lib/utils'
import { ConfirmDeleteDialog } from '@/components/portal/ConfirmDeleteDialog'

const BASE_PATH = '/admin/gallery'
const PAGE_SIZE_KEY = 'pup-admin-gallery-page-size'
const VIEW_KEY = 'pup-admin-gallery-view'
const REGISTER_HEADING_ID = 'gallery-register-heading'

type SortKey = 'title' | 'year' | 'imageCount' | 'status' | 'sortOrder'
type SortDir = 'asc' | 'desc'

export default function GalleryAdmin() {
  const navigate = useNavigate()
  const location = useLocation()
  const [items, setItems] = useState<GalleryBatchRecord[]>([])
  const [years, setYears] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadBusy, setReloadBusy] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [query, setQuery] = useState('')
  const [yearFilter, setYearFilter] = useState<string>('all')
  const [publicPin, setPublicPin] = useState<string>('auto')
  const [publicYear, setPublicYear] = useState<string | null>(null)
  const [pinBusy, setPinBusy] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'sortOrder',
    dir: 'asc',
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(() => readStoredRegisterPageSize(PAGE_SIZE_KEY))
  const [registerView, setRegisterView] = useState<RegisterView>(() =>
    initialRegisterView(VIEW_KEY),
  )
  const [busyId, setBusyId] = useState<number | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [pendingDelete, setPendingDelete] = useState<GalleryBatchRecord | null>(null)
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false)
  const [viewing, setViewing] = useState<GalleryBatchRecord | null>(null)
  const [viewingImages, setViewingImages] = useState<GalleryImageRecord[]>([])
  const [viewingLoading, setViewingLoading] = useState(false)
  const [toast, setToast] = useState<SnackToast | null>(null)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (opts?.soft) setReloadBusy(true)
    else setLoading(true)
    const [batchesResult, yearsResult, displayResult] = await Promise.all([
      listGalleryBatches(),
      listGalleryYears({ all: true }),
      getGalleryDisplaySettings(),
    ])
    if (!batchesResult.ok) {
      setItems([])
      if (batchesResult.status === 401 || batchesResult.status === 403) {
        setNeedsLogin(true)
      } else {
        setNeedsLogin(false)
        showToast(batchesResult.error, 'error')
      }
      setLoading(false)
      setReloadBusy(false)
      return
    }
    setNeedsLogin(false)
    setItems(batchesResult.data.items)
    setYears(yearsResult.ok ? yearsResult.data.years : [])
    if (displayResult.ok) {
      setPublicPin(displayResult.data.pinnedYear ?? 'auto')
      setPublicYear(displayResult.data.publicYear)
    } else {
      setPublicPin('auto')
      setPublicYear(null)
    }
    setLoading(false)
    setReloadBusy(false)
  }, [showToast])

  useEffect(() => {
    void load()
  }, [load])

  async function handlePublicPinChange(next: string) {
    setPinBusy(true)
    const result = await setGalleryDisplayYear(next === 'auto' ? null : next)
    setPinBusy(false)
    if (!result.ok) {
      showToast(result.error, 'error')
      return
    }
    setPublicPin(result.data.pinnedYear ?? 'auto')
    setPublicYear(result.data.publicYear)
    showToast(
      result.data.mode === 'pinned' && result.data.pinnedYear
        ? `Public gallery pinned to A.Y. ${result.data.pinnedYear}.`
        : 'Public gallery set to latest published year.',
      'success',
    )
  }

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
  }, [query, yearFilter, sort, pageSize])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter((item) => {
      if (yearFilter !== 'all' && item.academicYear !== yearFilter) return false
      if (!needle) return true
      const haystack = `${item.title} ${item.academicYear}`.toLowerCase()
      return haystack.includes(needle)
    })
  }, [items, query, yearFilter])

  const sorted = useMemo(() => {
    const rows = [...filtered]
    const dir = sort.dir === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      let cmp = 0
      switch (sort.key) {
        case 'title':
          cmp = a.title.localeCompare(b.title)
          break
        case 'year':
          cmp = a.academicYear.localeCompare(b.academicYear)
          break
        case 'imageCount':
          cmp = a.imageCount - b.imageCount
          break
        case 'status':
          cmp = Number(a.published) - Number(b.published)
          break
        case 'sortOrder':
        default:
          cmp = a.sortOrder - b.sortOrder || a.id - b.id
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

  const pageIds = useMemo(() => pageMeta.rows.map((row) => row.id), [pageMeta.rows])
  const selectedOnPageCount = useMemo(
    () => pageIds.filter((id) => selectedIds.includes(id)).length,
    [pageIds, selectedIds],
  )

  useEffect(() => {
    const valid = new Set(items.map((item) => item.id))
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
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    )
  }

  function goCreate() {
    navigate(`${BASE_PATH}/new`)
  }

  function goEdit(item: GalleryBatchRecord) {
    setViewing(null)
    navigate(`${BASE_PATH}/${item.id}/edit`)
  }

  async function openDetails(item: GalleryBatchRecord) {
    setOpenMenuId(null)
    setViewing(item)
    setViewingImages([])
    setViewingLoading(true)
    const result = await getGalleryBatchById(item.id)
    setViewingLoading(false)
    if (!result.ok) {
      showToast(result.error, 'error')
      setViewing(null)
      return
    }
    setViewing(result.data.item)
    setViewingImages(
      [...result.data.images].sort((a, b) => a.sortOrder - b.sortOrder || (a.id ?? 0) - (b.id ?? 0)),
    )
  }

  async function handleDelete() {
    if (!pendingDelete) return
    setBusyId(pendingDelete.id)
    const result = await deleteGalleryBatch(pendingDelete.id)
    setBusyId(null)
    if (!result.ok) {
      showToast(result.error, 'error')
      return
    }
    showToast('Batch deleted.', 'success')
    setSelectedIds((prev) => prev.filter((id) => id !== pendingDelete.id))
    setPendingDelete(null)
    await load({ soft: true })
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setBulkDeleting(true)
    const result = await deleteGalleryBatches(ids)
    setBulkDeleting(false)
    setPendingBulkDelete(false)
    setSelectedIds([])
    if (!result.ok) {
      showToast(result.error, 'error')
      return
    }
    showToast(
      result.data.deleted === 1
        ? 'Batch deleted.'
        : `${result.data.deleted} batches deleted.`,
      'success',
    )
    await load({ soft: true })
  }

  const busy = loading || reloadBusy || busyId !== null || bulkDeleting || pinBusy
  const effectivePublicYear = publicYear
  const pinYearChoices = useMemo(() => {
    if (publicPin === 'auto' || years.includes(publicPin)) return years
    return [...years, publicPin]
  }, [years, publicPin])

  function isPublicBatch(item: GalleryBatchRecord) {
    return Boolean(effectivePublicYear) && item.academicYear === effectivePublicYear && item.published
  }

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
      ariaLabel="Gallery register pagination"
    />
  )

  return (
    <div className={workspaceTenantMainStackCls}>
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="min-w-0 space-y-1">
          <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900 sm:text-[22px] dark:text-zinc-50">
            Gallery
          </h1>
          <p className="max-w-xl text-[13px] leading-6 text-zinc-500 dark:text-zinc-400">
            Batches by academic year. Pin which batch appears on The Council.
          </p>
        </div>
        <button type="button" className={workspacePageAddBtnCls} onClick={goCreate}>
          <Plus className="h-4 w-4" aria-hidden />
          New batch
        </button>
      </div>

      <>
        <section aria-label="Catalog" className="w-full max-w-none">
          <div className={`${workspaceCatalogShellCls} ${workspaceCatalogPadCls} w-full max-w-none`}>
            <div
              role="toolbar"
              aria-label="Gallery catalog filters"
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
                      aria-label="Search gallery batches"
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
                  <CatalogSelect
                    size="compact"
                    className="w-[10.5rem] shrink-0"
                    aria-label="Filter by academic year"
                    disabled={busy}
                    value={yearFilter}
                    options={[
                      { value: 'all', label: 'All years' },
                      ...years.map((year) => ({
                        value: year,
                        label: `A.Y. ${year}`,
                      })),
                    ]}
                    onChange={setYearFilter}
                  />

                  <CatalogSelect
                    size="compact"
                    className="w-[12.75rem] shrink-0"
                    aria-label="Pin academic year for public gallery on The Council"
                    disabled={busy}
                    value={publicPin}
                    leading={<Pin className="h-3.5 w-3.5" aria-hidden />}
                    options={[
                      {
                        value: 'auto',
                        label: 'Public: Latest',
                        description: 'Newest published year on The Council',
                      },
                      ...pinYearChoices.map((year) => ({
                        value: year,
                        label: `Pin A.Y. ${year}`,
                        description:
                          effectivePublicYear === year
                            ? 'Showing on The Council'
                            : 'Show this year on The Council',
                      })),
                    ]}
                    onChange={(next) => void handlePublicPinChange(next)}
                  />

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
          aria-label="Registered gallery batches"
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
                Registered gallery batches
              </h2>
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-hidden />
              Loading gallery…
            </div>
          ) : sorted.length === 0 ? (
            <div className={workspaceRegisterPanelShellCls(registerView)}>
              <RegisterPanelHeading
                headingId={REGISTER_HEADING_ID}
                title="Registered batches"
                subtitle={`${items.length === 0 ? '0' : '0 matching'} in catalog`}
                onAdd={goCreate}
                addAriaLabel="New batch"
              />
              <div className="min-w-0 bg-white px-4 py-5 sm:px-5 sm:py-6 dark:bg-zinc-950">
                <div className="flex flex-col items-center overflow-hidden rounded-lg border border-dashed border-zinc-300/90 bg-zinc-50/85 px-5 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
                  <Images
                    className="mb-5 h-[3.75rem] w-[3.75rem] shrink-0 text-brand-600/45"
                    strokeWidth={1.35}
                    aria-hidden
                  />
                  <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
                    {items.length === 0 ? 'No batches yet' : 'No matching batches'}
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {items.length === 0
                      ? 'Create the first gallery batch for The Council page.'
                      : 'Adjust search, year filter, or reload.'}
                  </p>
                </div>
              </div>
              <footer className={plansRegisterPanelFooterCls}>{paginationBar}</footer>
            </div>
          ) : registerView === 'table' ? (
            <div className={workspaceRegisterPanelShellCls('table')}>
              <RegisterPanelHeading
                headingId={REGISTER_HEADING_ID}
                title="Registered batches"
                subtitle={`${pageMeta.total.toLocaleString()} record${pageMeta.total === 1 ? '' : 's'}`}
                onAdd={goCreate}
                addAriaLabel="New batch"
              />
              <HorizontalDragScrollTableWrap className={plansRegisterTableScrollerCls}>
                <table className={workspaceRegisterTableCls}>
                  <caption className="sr-only">Gallery batch register rows</caption>
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
                          title="Select this page"
                        />
                      </th>
                      <SortTh
                        label="Title"
                        column="title"
                        activeKey={sort.key}
                        activeDir={sort.dir}
                        onSort={handleSortClick}
                        className="w-[16rem] max-w-[16rem] sm:w-[20rem] sm:max-w-[20rem]"
                      />
                      <SortTh
                        label="A.Y."
                        column="year"
                        activeKey={sort.key}
                        activeDir={sort.dir}
                        onSort={handleSortClick}
                        className="w-[9rem]"
                      />
                      <SortTh
                        label="Images"
                        column="imageCount"
                        activeKey={sort.key}
                        activeDir={sort.dir}
                        onSort={handleSortClick}
                        className="w-[6rem]"
                      />
                      <SortTh
                        label="Status"
                        column="status"
                        activeKey={sort.key}
                        activeDir={sort.dir}
                        onSort={handleSortClick}
                        className="w-[7rem]"
                      />
                      <th scope="col" className={workspaceRegisterThActionsCellCls} aria-sort="none">
                        <span className="inline-flex min-h-8 w-full items-center justify-end gap-1.5 pr-px">
                          Actions
                          <ArrowUpDown
                            className="h-3 w-3 shrink-0 stroke-[2.25] text-brand-700/95 opacity-45 dark:text-zinc-400"
                            aria-hidden
                          />
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-zinc-950">
                    {pageMeta.rows.map((item) => {
                      const selectedRow = selectedIds.includes(item.id)
                      const onPublic = isPublicBatch(item)
                      return (
                        <tr
                          key={item.id}
                          className={cn(
                            workspaceRegisterTbodyRowCls,
                            'cursor-pointer',
                            selectedRow && 'bg-brand-50/85 dark:bg-brand-500/10',
                          )}
                          aria-selected={selectedRow}
                          onClick={() => void openDetails(item)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              void openDetails(item)
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-label={`View ${item.title}`}
                        >
                          <td
                            className="w-[2.5rem] whitespace-nowrap px-1 py-2 text-center sm:w-11 sm:px-1.5"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              className={tableCheckboxCls}
                              checked={selectedRow}
                              disabled={busy}
                              aria-label={`Select ${item.title}`}
                              onChange={() => toggleRowSelected(item.id)}
                            />
                          </td>
                          <td className="max-w-[20rem] px-1.5 py-2 sm:px-2">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                                {item.coverImage ? (
                                  <img
                                    src={item.coverImage}
                                    alt=""
                                    className="size-full object-cover"
                                  />
                                ) : (
                                  <Images className="h-4 w-4 text-zinc-400" aria-hidden />
                                )}
                              </span>
                              <p
                                className="min-w-0 truncate font-semibold leading-tight text-zinc-900 dark:text-zinc-50"
                                title={item.title}
                              >
                                {item.title}
                              </p>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-1.5 py-2 sm:px-2">
                            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-zinc-600 dark:text-zinc-400">
                              {item.academicYear}
                              {onPublic ? (
                                <span
                                  title="Shown on The Council"
                                  className="inline-flex items-center gap-0.5 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-brand-800 uppercase dark:bg-brand-500/15 dark:text-brand-200"
                                >
                                  <Pin className="size-2.5" aria-hidden />
                                  Public
                                </span>
                              ) : null}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-1.5 py-2 font-mono text-[12px] tabular-nums text-zinc-600 sm:px-2 dark:text-zinc-300">
                            {item.imageCount}
                          </td>
                          <td className="whitespace-nowrap px-1.5 py-2 sm:px-2">
                            <StatusBadge published={item.published} />
                          </td>
                          <td
                            className="whitespace-nowrap px-1 py-2 pr-1.5 sm:px-1.5 sm:pr-2.5"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <div className="flex items-center justify-end">
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
                headingId={REGISTER_HEADING_ID}
                title="Registered batches"
                subtitle={`${pageMeta.total.toLocaleString()} record${pageMeta.total === 1 ? '' : 's'}`}
                onAdd={goCreate}
                addAriaLabel="New batch"
              />
              <ul className="grid gap-3 bg-transparent px-0 py-2.5 sm:grid-cols-2 sm:gap-3 sm:bg-white sm:px-4 sm:py-4 xl:grid-cols-3 dark:sm:bg-zinc-950">
                {pageMeta.rows.map((item) => {
                  const selectedRow = selectedIds.includes(item.id)
                  const onPublic = isPublicBatch(item)
                  return (
                    <li key={item.id} className="min-w-0">
                      <article
                        className={cn(
                          'group flex h-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-2xl border transition outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                          selectedRow
                            ? 'border-brand-300/70 bg-brand-50/40 dark:border-brand-500/35 dark:bg-brand-500/10'
                            : 'border-zinc-200/80 bg-zinc-50/50 hover:border-brand-300/60 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-brand-500/30 dark:hover:bg-zinc-950',
                        )}
                        onClick={() => void openDetails(item)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            void openDetails(item)
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`View ${item.title}`}
                      >
                        <div className="flex items-center justify-between gap-2 px-3.5 pt-3.5">
                          <input
                            type="checkbox"
                            className={tableCheckboxCls}
                            checked={selectedRow}
                            disabled={busy}
                            aria-label={`Select ${item.title}`}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => toggleRowSelected(item.id)}
                          />
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
                        </div>

                        <div className="relative mx-3.5 mt-1 flex aspect-[16/9] items-center justify-center overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900">
                          {item.coverImage ? (
                            <img
                              src={item.coverImage}
                              alt=""
                              className="absolute inset-0 size-full object-cover"
                            />
                          ) : (
                            <Images
                              className="h-10 w-10 text-zinc-300 dark:text-zinc-600"
                              strokeWidth={1.25}
                              aria-hidden
                            />
                          )}
                        </div>

                        <div className="flex flex-1 flex-col gap-2.5 p-3.5 pt-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge published={item.published} />
                            {onPublic ? (
                              <span className="inline-flex items-center gap-0.5 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-brand-800 uppercase dark:bg-brand-500/15 dark:text-brand-200">
                                <Pin className="size-2.5" aria-hidden />
                                Public
                              </span>
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <h3
                              className="truncate text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
                              title={item.title}
                            >
                              {item.title}
                            </h3>
                            <p className="mt-1 font-mono text-[12px] tabular-nums text-zinc-600 dark:text-zinc-400">
                              A.Y. {item.academicYear} · {item.imageCount} image
                              {item.imageCount === 1 ? '' : 's'}
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

      {viewing ? (
        <GalleryBatchDetailsModal
          item={viewing}
          images={viewingImages}
          loading={viewingLoading}
          publicYear={effectivePublicYear}
          onClose={() => {
            setViewing(null)
            setViewingImages([])
          }}
          onEdit={() => goEdit(viewing)}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDeleteDialog
          title={pendingDelete.title}
          noun="batch"
          description="This batch will be removed from the gallery with all its images. This action cannot be undone."
          busy={busyId === pendingDelete.id}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}

      {pendingBulkDelete ? (
        <ConfirmDeleteDialog
          title={`${selectedIds.length} selected batch${selectedIds.length === 1 ? '' : 'es'}`}
          noun="batches"
          description="These batches will be removed from the gallery with all their images. This action cannot be undone."
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

function StatusBadge({ published }: { published: boolean }) {
  const label = published ? 'Published' : 'Draft'
  return (
    <span
      className={cn(
        'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-[10px] border px-2 py-1 text-[11px] font-medium leading-none shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:shadow-none',
        published
          ? 'border-emerald-200/85 bg-gradient-to-br from-white to-emerald-50/80 text-emerald-950 dark:border-emerald-500/22 dark:from-zinc-950 dark:to-emerald-500/14 dark:text-emerald-50'
          : 'border-amber-200/85 bg-gradient-to-br from-white to-amber-50/80 text-amber-950 dark:border-amber-500/22 dark:from-zinc-950 dark:to-amber-500/14 dark:text-amber-50',
      )}
      title={label}
    >
      <span
        className={cn(
          'inline-flex h-2 w-2 shrink-0 rounded-full motion-safe:animate-pulse',
          published
            ? 'bg-emerald-500 shadow-[0_0_0_2px_rgba(255,255,255,0.95)] dark:bg-emerald-400 dark:shadow-[0_0_0_2px_rgba(9,9,11,0.94)]'
            : 'bg-amber-500 shadow-[0_0_0_2px_rgba(255,255,255,0.95)] dark:bg-amber-400 dark:shadow-[0_0_0_2px_rgba(9,9,11,0.94)]',
        )}
        aria-hidden
      />
      <span className="min-w-0 truncate tracking-[-0.01em]">{label}</span>
    </span>
  )
}

function GalleryBatchDetailsModal({
  item,
  images,
  loading,
  publicYear,
  onClose,
  onEdit,
}: {
  item: GalleryBatchRecord
  images: GalleryImageRecord[]
  loading: boolean
  publicYear: string | null
  onClose: () => void
  onEdit: () => void
}) {
  const titleId = useId()
  const thumbs = images.slice(0, 4)
  const onPublic = Boolean(publicYear) && item.academicYear === publicYear && item.published

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
        className="relative flex max-h-[min(92dvh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-zinc-200/80 bg-white shadow-[0_24px_64px_-28px_rgba(30,5,65,0.55)] sm:rounded-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/50"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 sm:px-6 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-400 uppercase dark:text-zinc-500">
              Gallery batch
            </p>
            <p className="mt-0.5 truncate text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
              Batch details
            </p>
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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge published={item.published} />
            {onPublic ? (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-brand-800 uppercase dark:bg-brand-500/15 dark:text-brand-200">
                <Pin className="size-2.5" aria-hidden />
                Public
              </span>
            ) : null}
          </div>
          <h2
            id={titleId}
            className="mt-3 text-[18px] leading-snug font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            {item.title}
          </h2>
          <p className="mt-1 font-mono text-[13px] tabular-nums text-zinc-600 dark:text-zinc-400">
            A.Y. {item.academicYear} · {item.imageCount} image
            {item.imageCount === 1 ? '' : 's'}
          </p>

          {loading ? (
            <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-200 py-10 text-[13px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading previews…
            </div>
          ) : thumbs.length > 0 ? (
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {thumbs.map((img) => (
                <div
                  key={img.id ?? img.src}
                  className="relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <img src={img.src} alt="" className="size-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 flex items-center justify-center rounded-xl border border-dashed border-zinc-200 py-10 dark:border-zinc-700">
              <Images className="h-8 w-8 text-zinc-300 dark:text-zinc-600" aria-hidden />
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-zinc-100 px-5 py-4 sm:px-6 dark:border-zinc-800">
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
