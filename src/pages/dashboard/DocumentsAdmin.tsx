import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ClipboardList,
  FileText,
  Gavel,
  Layers,
  LayoutGrid,
  Loader2,
  Plus,
  RefreshCw,
  ScrollText,
  Search,
  Table2,
  UserCheck,
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
  DOCUMENT_CATEGORIES,
  deleteDocument,
  listDocuments,
  type DocumentCategory,
  type DocumentRecord,
} from '@/lib/documents-api'
import { cn } from '@/lib/utils'
import { ConfirmDeleteDialog } from '@/components/portal/ConfirmDeleteDialog'

type SegFilter = 'all' | DocumentCategory

const PAGE_SIZE_KEY = 'pup-admin-documents-page-size'
const VIEW_KEY = 'pup-admin-documents-view'
const REGISTER_HEADING_ID = 'documents-register-heading'
const REGISTER_TITLE = 'Registered Documents'

const CATEGORY_ICON: Record<DocumentCategory, typeof FileText> = {
  board_resolution: Gavel,
  appointment_resolution: UserCheck,
  memorandum: ScrollText,
  report: ClipboardList,
}

const CATEGORY_LABEL: Record<DocumentCategory, string> = DOCUMENT_CATEGORIES.reduce(
  (acc, item) => ({ ...acc, [item.value]: item.label }),
  {} as Record<DocumentCategory, string>,
)

const SEG_OPTIONS: { key: SegFilter; icon: typeof Layers; label: string }[] = [
  { key: 'all', icon: Layers, label: 'All' },
  ...DOCUMENT_CATEGORIES.map((item) => ({
    key: item.value as SegFilter,
    icon: CATEGORY_ICON[item.value],
    label: item.label,
  })),
]

export default function DocumentsAdmin() {
  const navigate = useNavigate()
  const location = useLocation()
  const [items, setItems] = useState<DocumentRecord[]>([])
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
  const [pendingDelete, setPendingDelete] = useState<DocumentRecord | null>(null)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [toast, setToast] = useState<SnackToast | null>(null)

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (opts?.soft) setReloadBusy(true)
      else setLoading(true)
      const result = await listDocuments({ all: true })
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

  const segCounts = useMemo(() => {
    const counts: Record<SegFilter, number> = {
      all: items.length,
      board_resolution: 0,
      appointment_resolution: 0,
      memorandum: 0,
      report: 0,
    }
    for (const item of items) {
      if (item.category in counts) counts[item.category] += 1
    }
    return counts
  }, [items])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items
      .filter((item) => {
        if (segFilter !== 'all' && item.category !== segFilter) return false
        if (!needle) return true
        const haystack =
          `${item.title} ${item.number} ${item.seriesLabel} ${item.category} ${CATEGORY_LABEL[item.category] ?? ''}`.toLowerCase()
        return haystack.includes(needle)
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
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
    navigate(
      segFilter === 'all'
        ? '/admin/documents/new'
        : `/admin/documents/new?category=${segFilter}`,
    )
  }

  function goEdit(item: DocumentRecord) {
    navigate(`/admin/documents/${item.id}/edit`)
  }

  async function handleDelete() {
    if (!pendingDelete) return
    const item = pendingDelete
    setBusyId(item.id)
    const result = await deleteDocument(item.id)
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
    showToast('Document deleted.', 'success')
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
      ariaLabel="Documents register pagination"
    />
  )

  const reloadButtons = (extraCls: string) => (
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

  const subtitle = `${pageMeta.total.toLocaleString()} record${pageMeta.total === 1 ? '' : 's'}`

  return (
    <div className={workspaceTenantMainStackCls}>
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="min-w-0 space-y-1">
          <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900 sm:text-[22px] dark:text-zinc-50">
            Documents
          </h1>
          <p className="max-w-xl text-[13px] leading-6 text-zinc-500 dark:text-zinc-400">
            Resolutions, memoranda, and reports listed on{' '}
            <a
              href="/transparency"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-2 dark:text-brand-300"
            >
              /transparency
            </a>{' '}
            and the Legislative page.
          </p>
        </div>
        <button type="button" className={workspacePageAddBtnCls} onClick={goCreate}>
          <Plus className="h-4 w-4" aria-hidden />
          New document
        </button>
      </div>

      <section aria-label="Catalog" className="w-full max-w-none">
        <div className={`${workspaceCatalogShellCls} ${workspaceCatalogPadCls} w-full max-w-none`}>
          <div
            role="toolbar"
            aria-label="Documents catalog filters"
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
                    aria-label="Search documents"
                    className={`${catalogInput} min-w-0 w-full pl-9`}
                  />
                </div>
                {reloadButtons('sm:hidden')}
              </div>

              <div className={workspaceCatalogToolbarActionsRowCls}>
                {reloadButtons('max-sm:hidden')}

                <div
                  role="radiogroup"
                  aria-label="Category filter"
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
            Loading documents…
          </div>
        ) : filtered.length === 0 ? (
          <div className={workspaceRegisterPanelShellCls(registerView)}>
            <RegisterPanelHeading
              headingId={REGISTER_HEADING_ID}
              title={REGISTER_TITLE}
              subtitle={`${items.length === 0 ? '0' : '0 matching'} in catalog`}
              onAdd={goCreate}
              addAriaLabel="New document"
            />
            <div className="min-w-0 bg-white px-4 py-5 sm:px-5 sm:py-6 dark:bg-zinc-950">
              <div className="flex flex-col items-center overflow-hidden rounded-lg border border-dashed border-zinc-300/90 bg-zinc-50/85 px-5 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
                <FileText
                  className="mb-5 h-[3.75rem] w-[3.75rem] shrink-0 text-brand-600/45"
                  strokeWidth={1.35}
                  aria-hidden
                />
                <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
                  {items.length === 0 ? 'No documents yet' : 'No matching documents'}
                </p>
                <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {items.length === 0
                    ? 'Add a resolution, memorandum, or report for the public site.'
                    : 'Adjust search, category filter, or reload.'}
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
              addAriaLabel="New document"
            />
            <HorizontalDragScrollTableWrap className={plansRegisterTableScrollerCls}>
              <table className={workspaceRegisterTableCls}>
                <caption className="sr-only">Documents register rows</caption>
                <thead className={workspaceRegisterTheadCls}>
                  <tr className="[&_th]:text-brand-900/80 dark:[&_th]:text-zinc-300">
                    <th
                      scope="col"
                      className={cn(
                        workspaceRegisterThSortCellCls,
                        'w-[16rem] max-w-[16rem] text-left sm:w-[22rem] sm:max-w-[22rem] lg:w-[28rem] lg:max-w-[28rem]',
                      )}
                    >
                      Title
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[7rem] text-left')}
                    >
                      Number
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[11rem] text-left')}
                    >
                      Category
                    </th>
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
                  {pageMeta.rows.map((item) => {
                    const Icon = CATEGORY_ICON[item.category] ?? FileText
                    return (
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
                        aria-label={`Edit ${item.title}`}
                      >
                        <td className="w-[16rem] max-w-[16rem] px-1.5 py-2 sm:w-[22rem] sm:max-w-[22rem] sm:px-2 lg:w-[28rem] lg:max-w-[28rem]">
                          <div className="flex min-w-0 max-w-full items-center gap-2.5 overflow-hidden sm:gap-3">
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                              <Icon className="h-4 w-4" aria-hidden />
                            </span>
                            <div className="min-w-0 flex-1 overflow-hidden">
                              <p
                                className="truncate font-semibold leading-tight text-zinc-900 dark:text-zinc-50"
                                title={item.title}
                              >
                                {item.title || 'Untitled'}
                              </p>
                              {item.seriesLabel ? (
                                <p className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                                  {item.seriesLabel}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-2 font-mono text-[12px] text-zinc-600 sm:px-2 dark:text-zinc-400">
                          {item.number || '—'}
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-2 sm:px-2">
                          <CategoryBadge category={item.category} />
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
                            {renderActions(item)}
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
              title={REGISTER_TITLE}
              subtitle={subtitle}
              onAdd={goCreate}
              addAriaLabel="New document"
            />
            <ul className="grid gap-3 bg-transparent px-0 py-2.5 sm:grid-cols-2 sm:gap-3 sm:bg-white sm:px-4 sm:py-4 xl:grid-cols-3 dark:sm:bg-zinc-950">
              {pageMeta.rows.map((item) => {
                const Icon = CATEGORY_ICON[item.category] ?? FileText
                return (
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
                      aria-label={`Edit ${item.title}`}
                    >
                      <div className="flex items-start justify-between gap-2 p-3.5 pb-0">
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200/80 bg-white text-brand-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-brand-300 dark:shadow-none">
                          <Icon className="h-5 w-5" aria-hidden />
                        </span>
                        <div
                          className="flex items-center gap-1.5"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <StatusBadge published={item.published} />
                          <div className="rounded-lg bg-white shadow-sm dark:bg-zinc-950 dark:shadow-none">
                            {renderActions(item)}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col gap-2.5 p-3.5 pt-3">
                        <CategoryBadge category={item.category} pill />
                        <div className="min-w-0">
                          <h3
                            className="line-clamp-2 text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
                            title={item.title}
                          >
                            {item.title || 'Untitled'}
                          </h3>
                          {item.seriesLabel ? (
                            <p className="mt-1 truncate text-[12px] text-zinc-600 dark:text-zinc-400">
                              {item.seriesLabel}
                            </p>
                          ) : null}
                        </div>
                        <div className="mt-auto rounded-xl border border-zinc-200/70 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                          <p className="text-[10px] font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
                            Number
                          </p>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                            {item.number ? `No. ${item.number}` : '—'}
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

      {pendingDelete ? (
        <ConfirmDeleteDialog
          title={pendingDelete.title || 'Untitled'}
          noun="document"
          description="This document will be removed from the database and the public site. This action cannot be undone."
          busy={busyId === pendingDelete.id}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )

  function renderActions(item: DocumentRecord) {
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

function CategoryBadge({ category, pill = false }: { category: DocumentCategory; pill?: boolean }) {
  const label = CATEGORY_LABEL[category] ?? category
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
