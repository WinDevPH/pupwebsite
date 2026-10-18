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
  FolderKanban,
  LayoutGrid,
  Loader2,
  Pencil,
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
import { projectIconMap, projectIconOptions } from '@/components/home/project-data'
import { Button } from '@/components/ui/button'
import { RichTextContent } from '@/components/ui/RichTextEditor'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import { stripHtml } from '@/lib/rich-text'
import { setPageScrollLocked } from '@/hooks/useLenis'
import {
  deleteProject,
  listProjects,
  type ProjectIconKey,
  type ProjectRecord,
} from '@/lib/projects-api'
import { cn } from '@/lib/utils'
import { ConfirmDeleteDialog } from '@/components/portal/ConfirmDeleteDialog'

const PAGE_SIZE_KEY = 'pup-admin-projects-page-size'
const VIEW_KEY = 'pup-admin-projects-view'
const REGISTER_HEADING_ID = 'projects-register-heading'

type SortKey = 'title' | 'icon' | 'sortOrder' | 'status' | 'slug'
type SortDir = 'asc' | 'desc'

function projectIconMeta(icon: ProjectIconKey) {
  const key = (icon in projectIconMap ? icon : 'folder-kanban') as ProjectIconKey
  const Icon = projectIconMap[key]
  const label = projectIconOptions.find((option) => option.id === key)?.label ?? 'General'
  return { Icon, label, key }
}

function plainSummary(text: string, maxLen = 120) {
  const plain = stripHtml(text).trim()
  if (!plain) return ''
  if (plain.length <= maxLen) return plain
  return `${plain.slice(0, maxLen - 1)}…`
}

export default function ProjectsAdmin() {
  const navigate = useNavigate()
  const location = useLocation()
  const [items, setItems] = useState<ProjectRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadBusy, setReloadBusy] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [query, setQuery] = useState('')
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
  const [pendingDelete, setPendingDelete] = useState<ProjectRecord | null>(null)
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false)
  const [viewing, setViewing] = useState<ProjectRecord | null>(null)
  const [toast, setToast] = useState<SnackToast | null>(null)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (opts?.soft) setReloadBusy(true)
    else setLoading(true)
    const result = await listProjects({ all: true })
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
  }, [query, sort, pageSize])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter((item) => {
      if (!needle) return true
      const { label } = projectIconMeta(item.icon)
      const haystack =
        `${item.title} ${stripHtml(item.summary)} ${stripHtml(item.body ?? '')} ${item.slug} ${label}`.toLowerCase()
      return haystack.includes(needle)
    })
  }, [items, query])

  const sorted = useMemo(() => {
    const rows = [...filtered]
    const dir = sort.dir === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      let cmp = 0
      switch (sort.key) {
        case 'title':
          cmp = a.title.localeCompare(b.title)
          break
        case 'icon':
          cmp = projectIconMeta(a.icon).label.localeCompare(projectIconMeta(b.icon).label)
          break
        case 'slug':
          cmp = a.slug.localeCompare(b.slug)
          break
        case 'status':
          cmp = Number(a.published) - Number(b.published)
          break
        case 'sortOrder':
        default:
          cmp = a.sortOrder - b.sortOrder
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
    navigate('/admin/projects/new')
  }

  function goEdit(item: ProjectRecord) {
    setViewing(null)
    navigate(`/admin/projects/${item.id}/edit`)
  }

  function openDetails(item: ProjectRecord) {
    setOpenMenuId(null)
    setViewing(item)
  }

  async function handleDelete() {
    if (!pendingDelete) return
    setBusyId(pendingDelete.id)
    const result = await deleteProject(pendingDelete.id)
    setBusyId(null)
    if (!result.ok) {
      showToast(result.error, 'error')
      return
    }
    showToast('Project deleted.', 'success')
    setSelectedIds((prev) => prev.filter((id) => id !== pendingDelete.id))
    setPendingDelete(null)
    await load({ soft: true })
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setBulkDeleting(true)
    let failed = 0
    for (const id of ids) {
      const result = await deleteProject(id)
      if (!result.ok) failed += 1
    }
    setBulkDeleting(false)
    setPendingBulkDelete(false)
    setSelectedIds([])
    if (failed > 0) {
      showToast(`Deleted with ${failed} error(s).`, 'error')
    } else {
      showToast(
        ids.length === 1 ? 'Project deleted.' : `${ids.length} projects deleted.`,
        'success',
      )
    }
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
      ariaLabel="Projects register pagination"
    />
  )

  return (
    <div className={workspaceTenantMainStackCls}>
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="min-w-0 space-y-1">
          <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900 sm:text-[22px] dark:text-zinc-50">
            Projects
          </h1>
          <p className="max-w-xl text-[13px] leading-6 text-zinc-500 dark:text-zinc-400">
            Manage campus projects and initiatives shown on the public homepage.
          </p>
        </div>
        <button type="button" className={workspacePageAddBtnCls} onClick={goCreate}>
          <Plus className="h-4 w-4" aria-hidden />
          New project
        </button>
      </div>

      <>
          <section aria-label="Catalog" className="w-full max-w-none">
            <div className={`${workspaceCatalogShellCls} ${workspaceCatalogPadCls} w-full max-w-none`}>
              <div
                role="toolbar"
                aria-label="Projects catalog filters"
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
                        aria-label="Search projects"
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
            aria-label="Registered Projects"
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
                  Registered Projects
                </h2>
                <Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-hidden />
                Loading projects…
              </div>
            ) : sorted.length === 0 ? (
              <div className={workspaceRegisterPanelShellCls(registerView)}>
                <RegisterPanelHeading
                  headingId={REGISTER_HEADING_ID}
                  title="Registered Projects"
                  subtitle={`${items.length === 0 ? '0' : '0 matching'} in catalog`}
                  onAdd={goCreate}
                  addAriaLabel="New project"
                />
                <div className="min-w-0 bg-white px-4 py-5 sm:px-5 sm:py-6 dark:bg-zinc-950">
                  <div className="flex flex-col items-center overflow-hidden rounded-lg border border-dashed border-zinc-300/90 bg-zinc-50/85 px-5 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
                    <FolderKanban
                      className="mb-5 h-[3.75rem] w-[3.75rem] shrink-0 text-brand-600/45"
                      strokeWidth={1.35}
                      aria-hidden
                    />
                    <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
                      {items.length === 0 ? 'No projects yet' : 'No matching projects'}
                    </p>
                    <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {items.length === 0
                        ? 'Create the first campus project for the public site.'
                        : 'Adjust search or reload.'}
                    </p>
                  </div>
                </div>
                <footer className={plansRegisterPanelFooterCls}>{paginationBar}</footer>
              </div>
            ) : registerView === 'table' ? (
              <div className={workspaceRegisterPanelShellCls('table')}>
                <RegisterPanelHeading
                  headingId={REGISTER_HEADING_ID}
                  title="Registered Projects"
                  subtitle={`${pageMeta.total.toLocaleString()} record${pageMeta.total === 1 ? '' : 's'}`}
                  onAdd={goCreate}
                  addAriaLabel="New project"
                />
                <HorizontalDragScrollTableWrap className={plansRegisterTableScrollerCls}>
                  <table className={workspaceRegisterTableCls}>
                    <caption className="sr-only">Project register rows</caption>
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
                            aria-label="Select all projects on this page"
                            title="Select this page"
                          />
                        </th>
                        <SortTh
                          label="Project"
                          column="title"
                          activeKey={sort.key}
                          activeDir={sort.dir}
                          onSort={handleSortClick}
                          className="w-[16rem] max-w-[16rem] sm:w-[20rem] sm:max-w-[20rem] lg:w-[24rem] lg:max-w-[24rem]"
                        />
                        <SortTh
                          label="Icon"
                          column="icon"
                          activeKey={sort.key}
                          activeDir={sort.dir}
                          onSort={handleSortClick}
                          className="w-[8.5rem]"
                        />
                        <SortTh
                          label="Order"
                          column="sortOrder"
                          activeKey={sort.key}
                          activeDir={sort.dir}
                          onSort={handleSortClick}
                          className="w-[5.5rem]"
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
                        const { Icon, label } = projectIconMeta(item.icon)
                        const summaryPlain = plainSummary(item.summary)
                        const selectedRow = selectedIds.includes(item.id)
                        return (
                          <tr
                            key={item.id}
                            className={cn(
                              workspaceRegisterTbodyRowCls,
                              'cursor-pointer',
                              selectedRow && 'bg-brand-50/85 dark:bg-brand-500/10',
                            )}
                            aria-selected={selectedRow}
                            onClick={() => openDetails(item)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                openDetails(item)
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
                            <td className="w-[16rem] max-w-[16rem] px-1.5 py-2 sm:w-[20rem] sm:max-w-[20rem] sm:px-2 lg:w-[24rem] lg:max-w-[24rem]">
                              <div className="flex min-w-0 max-w-full items-center gap-2.5 overflow-hidden sm:gap-3">
                                {item.image ? (
                                  <img
                                    src={item.image}
                                    alt=""
                                    width={40}
                                    height={40}
                                    className="h-9 w-9 shrink-0 rounded-lg object-cover bg-zinc-100 dark:bg-zinc-800"
                                  />
                                ) : (
                                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
                                    <FolderKanban className="h-4 w-4" aria-hidden />
                                  </span>
                                )}
                                <div className="min-w-0 flex-1 overflow-hidden">
                                  <p
                                    className="truncate font-semibold leading-tight text-zinc-900 dark:text-zinc-50"
                                    title={item.title}
                                  >
                                    {item.title}
                                  </p>
                                  <p
                                    className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400"
                                    title={stripHtml(item.summary) || undefined}
                                  >
                                    {summaryPlain || 'No summary'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-1.5 py-2 sm:px-2">
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-800 dark:text-brand-300">
                                <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                                {label}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-1.5 py-2 font-mono text-[11px] tabular-nums text-zinc-600 sm:px-2 dark:text-zinc-400">
                              {item.sortOrder}
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
                  title="Registered Projects"
                  subtitle={`${pageMeta.total.toLocaleString()} record${pageMeta.total === 1 ? '' : 's'}`}
                  onAdd={goCreate}
                  addAriaLabel="New project"
                />
                <ul className="grid gap-3 bg-transparent px-0 py-2.5 sm:grid-cols-2 sm:gap-3 sm:bg-white sm:px-4 sm:py-4 xl:grid-cols-3 dark:sm:bg-zinc-950">
                  {pageMeta.rows.map((item) => {
                    const { Icon, label } = projectIconMeta(item.icon)
                    const summaryPlain = stripHtml(item.summary)
                    const selectedRow = selectedIds.includes(item.id)
                    return (
                      <li key={item.id} className="min-w-0">
                        <article
                          className={cn(
                            'group flex h-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-2xl border transition outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                            selectedRow
                              ? 'border-brand-300/70 bg-brand-50/40 dark:border-brand-500/35 dark:bg-brand-500/10'
                              : 'border-zinc-200/80 bg-zinc-50/50 hover:border-brand-300/60 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-brand-500/30 dark:hover:bg-zinc-950',
                          )}
                          onClick={() => openDetails(item)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              openDetails(item)
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-label={`View ${item.title}`}
                        >
                          <div className="flex items-start justify-between gap-2 p-3.5 pb-0">
                            <label
                              className="inline-flex cursor-pointer items-center rounded-lg bg-white p-1.5 shadow-sm dark:bg-zinc-950 dark:shadow-none"
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
                            </label>
                            <div
                              className="flex items-center gap-1.5"
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              <StatusBadge published={item.published} />
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
                          </div>

                          <div className="relative mx-3.5 mt-3 aspect-[16/9] overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt=""
                                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-zinc-300 dark:text-zinc-600">
                                <FolderKanban className="h-10 w-10" strokeWidth={1.25} aria-hidden />
                              </div>
                            )}
                          </div>

                          <div className="flex flex-1 flex-col gap-2.5 p-3.5 pt-3">
                            <span className="inline-flex w-fit items-center gap-1 rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-semibold tracking-wide text-brand-800 uppercase dark:border-zinc-700 dark:bg-zinc-950 dark:text-brand-300">
                              <Icon className="h-3 w-3 opacity-90" aria-hidden />
                              {label}
                            </span>
                            <div className="min-w-0">
                              <h3
                                className="truncate text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
                                title={item.title}
                              >
                                {item.title}
                              </h3>
                              <p
                                className="mt-1 line-clamp-2 text-[12px] leading-5 text-zinc-600 dark:text-zinc-400"
                                title={summaryPlain || undefined}
                              >
                                {summaryPlain || 'No summary'}
                              </p>
                            </div>
                            <div className="mt-auto rounded-xl border border-zinc-200/70 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                              <p className="text-[10px] font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
                                Sort order
                              </p>
                              <p className="mt-0.5 truncate font-mono text-[11px] tabular-nums text-zinc-700 dark:text-zinc-300">
                                {item.sortOrder}
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
        <ProjectDetailsModal
          item={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => goEdit(viewing)}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDeleteDialog
          title={pendingDelete.title}
          noun="project"
          description="This project will be removed from the database and the public homepage. This action cannot be undone."
          busy={busyId === pendingDelete.id}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}

      {pendingBulkDelete ? (
        <ConfirmDeleteDialog
          title={`${selectedIds.length} selected project${selectedIds.length === 1 ? '' : 's'}`}
          noun="projects"
          description="These projects will be removed from the database and the public homepage. This action cannot be undone."
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

function ProjectDetailsModal({
  item,
  onClose,
  onEdit,
}: {
  item: ProjectRecord
  onClose: () => void
  onEdit: () => void
}) {
  const titleId = useId()
  const { Icon, label } = projectIconMeta(item.icon)
  const summaryPlain = stripHtml(item.summary)

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
        className="relative flex max-h-[min(92dvh,42rem)] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200/80 bg-white shadow-[0_24px_64px_-28px_rgba(30,5,65,0.55)] sm:rounded-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/50"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 sm:px-6 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-zinc-400 uppercase dark:text-zinc-500">
              <Icon className="size-3.5 opacity-80" aria-hidden />
              {label}
            </p>
            <p className="mt-0.5 truncate text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
              Project details
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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-5 px-5 py-5 sm:px-6 sm:py-6">
            <div className="relative h-[13rem] w-[9.5rem] shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950">
              {item.image ? (
                <img src={item.image} alt="" className="size-full object-cover" />
              ) : (
                <span className="grid size-full place-items-center text-zinc-300 dark:text-zinc-600">
                  <FolderKanban className="h-9 w-9" strokeWidth={1.25} aria-hidden />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge published={item.published} />
                <span className="font-mono text-[12px] text-zinc-500 dark:text-zinc-400">
                  Order {item.sortOrder}
                </span>
              </div>
              <h2
                id={titleId}
                className="mt-3 text-[19px] leading-snug font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
              >
                {item.title}
              </h2>
              {summaryPlain ? (
                <p className="mt-2 line-clamp-5 text-[14px] leading-6 text-zinc-600 dark:text-zinc-300">
                  {summaryPlain}
                </p>
              ) : (
                <p className="mt-2 text-[14px] leading-6 text-zinc-400 italic dark:text-zinc-500">
                  No summary provided.
                </p>
              )}
            </div>
          </div>

          {item.body ? (
            <div className="border-t border-zinc-100 px-5 py-5 sm:px-6 dark:border-zinc-800">
              <RichTextContent html={item.body} className="text-[14px]" />
            </div>
          ) : null}
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
