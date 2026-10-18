import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react'
import {
  AlignLeft,
  Flag,
  Gavel,
  Layers,
  LayoutGrid,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Table2,
  Target,
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
import { aboutIcon } from '@/lib/about-content-icons'
import {
  getAboutContent,
  saveAboutSections,
  type AboutSections,
} from '@/lib/about-content-api'
import {
  ABOUT_KIND_LABEL,
  aboutEditPath,
  aboutNewPath,
  type AboutAdminPage,
  type AboutRowKind,
} from '@/lib/about-admin-routes'
import { stripHtml } from '@/lib/rich-text'
import { cn } from '@/lib/utils'
import { ConfirmDeleteDialog } from '@/components/portal/ConfirmDeleteDialog'

export type { AboutAdminPage } from '@/lib/about-admin-routes'

export type AboutRow = {
  id: string
  kind: AboutRowKind
  index?: number
  title: string
  preview: string
  icon?: string
  when?: string
  note?: string
}

type SegFilter = 'all' | 'statements' | 'values' | 'goals'

const REGISTER_HEADING_ID = 'about-register-heading'

const PAGE_META: Record<
  AboutAdminPage,
  {
    title: string
    subtitle: string
    registerTitle: string
    newLabel: string
    emptyTitle: string
    emptyBody: string
    icon: typeof AlignLeft
  }
> = {
  mvvg: {
    title: 'Mission, Vision, Values & Goals',
    subtitle: 'Manage the statements, core values, and term goals shown on The Council.',
    registerTitle: 'Registered Statements, Values & Goals',
    newLabel: 'New',
    emptyTitle: 'No content yet',
    emptyBody: 'Add a core value or term goal for the public site.',
    icon: AlignLeft,
  },
  mandate: {
    title: 'Mandate',
    subtitle: 'Manage the mandate cards shown on The Council.',
    registerTitle: 'Registered Mandate Items',
    newLabel: 'New item',
    emptyTitle: 'No mandate items yet',
    emptyBody: 'Create the first mandate card for the public site.',
    icon: Gavel,
  },
  agenda: {
    title: 'Term agenda',
    subtitle: 'Manage the term agenda cards shown on The Council.',
    registerTitle: 'Registered Agenda Items',
    newLabel: 'New item',
    emptyTitle: 'No agenda items yet',
    emptyBody: 'Create the first agenda card for the public site.',
    icon: Target,
  },
  history: {
    title: 'History',
    subtitle: 'Manage the timeline marks shown on The Council.',
    registerTitle: 'Registered History Marks',
    newLabel: 'New mark',
    emptyTitle: 'No history marks yet',
    emptyBody: 'Create the first timeline mark for the public site.',
    icon: Flag,
  },
}

function buildRows(page: AboutAdminPage, sections: AboutSections): AboutRow[] {
  if (page === 'mvvg') {
    const rows: AboutRow[] = [
      {
        id: 'mission',
        kind: 'mission',
        title: 'Mission',
        preview: stripHtml(sections.mission.text),
      },
      {
        id: 'vision',
        kind: 'vision',
        title: 'Vision',
        preview: stripHtml(sections.vision.text),
      },
    ]
    sections.values.items.forEach((item, index) =>
      rows.push({
        id: `values-${index}`,
        kind: 'values',
        index,
        title: item.title,
        preview: stripHtml(item.text),
        icon: item.icon,
      }),
    )
    sections.goals.items.forEach((item, index) =>
      rows.push({
        id: `goals-${index}`,
        kind: 'goals',
        index,
        title: item.title,
        preview: stripHtml(item.text),
        icon: item.icon,
      }),
    )
    return rows
  }
  if (page === 'history') {
    return sections.history.items.map((item, index) => ({
      id: `history-${index}`,
      kind: 'history' as const,
      index,
      title: item.title,
      preview: stripHtml(item.text),
      when: item.when,
      note: item.note,
    }))
  }
  return sections[page].items.map((item, index) => ({
    id: `${page}-${index}`,
    kind: page,
    index,
    title: item.title,
    preview: stripHtml(item.text),
    icon: item.icon,
  }))
}

function rowIcon(row: AboutRow): ComponentType<{ className?: string }> {
  if (row.kind === 'mission') return Target
  if (row.kind === 'vision') return AlignLeft
  if (row.kind === 'history') return Flag
  return aboutIcon(row.icon)
}

function canDelete(row: AboutRow) {
  return row.kind !== 'mission' && row.kind !== 'vision'
}

export default function AboutAdmin({ page }: { page: AboutAdminPage }) {
  const meta = PAGE_META[page]
  const PAGE_SIZE_KEY = `pup-admin-about-${page}-page-size`
  const VIEW_KEY = `pup-admin-about-${page}-view`

  const navigate = useNavigate()
  const location = useLocation()
  const [sections, setSections] = useState<AboutSections | null>(null)
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
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<AboutRow | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [toast, setToast] = useState<SnackToast | null>(null)

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (opts?.soft) setReloadBusy(true)
      else setLoading(true)
      const result = await getAboutContent()
      if (!result.ok) {
        setSections(null)
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
      setSections(result.data.sections)
      setLoading(false)
      setReloadBusy(false)
    },
    [showToast],
  )

  useEffect(() => {
    void load()
  }, [load, page])

  // Reset view prefs when switching between About pages (same component instance).
  useEffect(() => {
    setQuery('')
    setSegFilter('all')
    setPageNo(1)
    setOpenMenuId(null)
    setPageSize(readStoredRegisterPageSize(PAGE_SIZE_KEY))
    setRegisterView(initialRegisterView(VIEW_KEY))
  }, [page, PAGE_SIZE_KEY, VIEW_KEY])

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

  const items = useMemo(() => (sections ? buildRows(page, sections) : []), [page, sections])

  const segCounts = useMemo(
    () => ({
      all: items.length,
      statements: items.filter((r) => r.kind === 'mission' || r.kind === 'vision').length,
      values: items.filter((r) => r.kind === 'values').length,
      goals: items.filter((r) => r.kind === 'goals').length,
    }),
    [items],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter((row) => {
      if (page === 'mvvg' && segFilter !== 'all') {
        if (segFilter === 'statements' && row.kind !== 'mission' && row.kind !== 'vision') {
          return false
        }
        if (segFilter === 'values' && row.kind !== 'values') return false
        if (segFilter === 'goals' && row.kind !== 'goals') return false
      }
      if (!needle) return true
      const haystack =
        `${row.title} ${row.preview} ${row.when ?? ''} ${row.note ?? ''} ${ABOUT_KIND_LABEL[row.kind]}`.toLowerCase()
      return haystack.includes(needle)
    })
  }, [items, query, page, segFilter])

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
    if (page === 'mvvg') {
      navigate(aboutNewPath(page, segFilter === 'goals' ? 'goals' : 'values'))
      return
    }
    navigate(aboutNewPath(page))
  }

  function goEdit(row: AboutRow) {
    navigate(aboutEditPath(page, row.kind, row.index))
  }

  async function handleDelete() {
    if (!pendingDelete || pendingDelete.index === undefined) return
    const row = pendingDelete
    const index = row.index as number
    setBusyId(row.id)

    const fresh = await getAboutContent()
    if (!fresh.ok) {
      setBusyId(null)
      if (fresh.status === 401 || fresh.status === 403) {
        setNeedsLogin(true)
        return
      }
      showToast(fresh.error, 'error')
      return
    }

    const current = fresh.data.sections
    let payload: Partial<AboutSections>
    switch (row.kind) {
      case 'values': {
        const next = [...current.values.items]
        if (next.length <= 1) return failDelete('At least one core value must remain.')
        next.splice(index, 1)
        payload = { values: { items: next } }
        break
      }
      case 'goals': {
        const next = [...current.goals.items]
        if (next.length <= 1) return failDelete('At least one goal must remain.')
        next.splice(index, 1)
        payload = { goals: { items: next } }
        break
      }
      case 'mandate': {
        const next = [...current.mandate.items]
        if (next.length <= 1) return failDelete('At least one mandate item must remain.')
        next.splice(index, 1)
        payload = { mandate: { items: next } }
        break
      }
      case 'agenda': {
        const next = [...current.agenda.items]
        if (next.length <= 1) return failDelete('At least one agenda item must remain.')
        next.splice(index, 1)
        payload = { agenda: { items: next } }
        break
      }
      case 'history': {
        const next = [...current.history.items]
        if (next.length <= 1) return failDelete('At least one history mark must remain.')
        next.splice(index, 1)
        payload = { history: { items: next } }
        break
      }
      default:
        return failDelete('This entry cannot be deleted.')
    }

    const result = await saveAboutSections(payload)
    setBusyId(null)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        setNeedsLogin(true)
        return
      }
      showToast(result.error, 'error')
      return
    }
    showToast(`${ABOUT_KIND_LABEL[row.kind]} deleted.`, 'success')
    setPendingDelete(null)
    setSections(result.data.sections)
  }

  function failDelete(message: string) {
    setBusyId(null)
    setPendingDelete(null)
    showToast(message, 'error')
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
      ariaLabel="About register pagination"
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

  const segOptions = [
    { key: 'all' as const, icon: Layers, label: 'All' },
    { key: 'statements' as const, icon: AlignLeft, label: 'Statements' },
    { key: 'values' as const, icon: Scale, label: 'Values' },
    { key: 'goals' as const, icon: Target, label: 'Goals' },
  ]

  return (
    <div className={workspaceTenantMainStackCls}>
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="min-w-0 space-y-1">
          <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900 sm:text-[22px] dark:text-zinc-50">
            {meta.title}
          </h1>
          <p className="max-w-xl text-[13px] leading-6 text-zinc-500 dark:text-zinc-400">
            {meta.subtitle}
          </p>
        </div>
        <button type="button" className={workspacePageAddBtnCls} onClick={goCreate}>
          <Plus className="h-4 w-4" aria-hidden />
          {meta.newLabel}
        </button>
      </div>

      <section aria-label="Catalog" className="w-full max-w-none">
        <div className={`${workspaceCatalogShellCls} ${workspaceCatalogPadCls} w-full max-w-none`}>
          <div
            role="toolbar"
            aria-label="About catalog filters"
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
                    aria-label="Search about content"
                    className={`${catalogInput} min-w-0 w-full pl-9`}
                  />
                </div>
                {reloadButtons('sm:hidden')}
              </div>

              <div className={workspaceCatalogToolbarActionsRowCls}>
                {reloadButtons('max-sm:hidden')}

                {page === 'mvvg' ? (
                  <>
                    <div
                      role="radiogroup"
                      aria-label="Content type filter"
                      className={workspaceCatalogSegTrackInlineCls}
                    >
                      {segOptions.map(({ key, icon: Icon, label }) => (
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
                  </>
                ) : null}

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
        aria-label={meta.registerTitle}
        className={workspaceRegisterSectionStackCls}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-zinc-300/90 bg-zinc-50/80 px-5 py-12 text-[13px] text-zinc-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400">
            <h2 id={REGISTER_HEADING_ID} className="sr-only">
              {meta.registerTitle}
            </h2>
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-hidden />
            Loading about content…
          </div>
        ) : filtered.length === 0 ? (
          <div className={workspaceRegisterPanelShellCls(registerView)}>
            <RegisterPanelHeading
              headingId={REGISTER_HEADING_ID}
              title={meta.registerTitle}
              subtitle={`${items.length === 0 ? '0' : '0 matching'} in catalog`}
              onAdd={goCreate}
              addAriaLabel={meta.newLabel}
            />
            <div className="min-w-0 bg-white px-4 py-5 sm:px-5 sm:py-6 dark:bg-zinc-950">
              <div className="flex flex-col items-center overflow-hidden rounded-lg border border-dashed border-zinc-300/90 bg-zinc-50/85 px-5 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
                <meta.icon
                  className="mb-5 h-[3.75rem] w-[3.75rem] shrink-0 text-brand-600/45"
                  strokeWidth={1.35}
                  aria-hidden
                />
                <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
                  {items.length === 0 ? meta.emptyTitle : 'No matching entries'}
                </p>
                <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {items.length === 0
                    ? meta.emptyBody
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
              title={meta.registerTitle}
              subtitle={`${pageMeta.total.toLocaleString()} record${pageMeta.total === 1 ? '' : 's'}`}
              onAdd={goCreate}
              addAriaLabel={meta.newLabel}
            />
            <HorizontalDragScrollTableWrap className={plansRegisterTableScrollerCls}>
              <table className={workspaceRegisterTableCls}>
                <caption className="sr-only">About content register rows</caption>
                <thead className={workspaceRegisterTheadCls}>
                  <tr className="[&_th]:text-brand-900/80 dark:[&_th]:text-zinc-300">
                    <th
                      scope="col"
                      className={cn(
                        workspaceRegisterThSortCellCls,
                        'w-[16rem] max-w-[16rem] text-left sm:w-[20rem] sm:max-w-[20rem] lg:w-[24rem] lg:max-w-[24rem]',
                      )}
                    >
                      Title
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[7.5rem] text-left')}
                    >
                      Type
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[7rem] text-left')}
                    >
                      Status
                    </th>
                    <th scope="col" className={cn(workspaceRegisterThSortCellCls, 'text-left')}>
                      Preview
                    </th>
                    <th scope="col" className={workspaceRegisterThActionsCellCls}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-950">
                  {pageMeta.rows.map((row) => {
                    const Icon = rowIcon(row)
                    return (
                      <tr
                        key={row.id}
                        className={cn(workspaceRegisterTbodyRowCls, 'cursor-pointer')}
                        onClick={() => goEdit(row)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            goEdit(row)
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Edit ${row.title}`}
                      >
                        <td className="w-[16rem] max-w-[16rem] px-1.5 py-2 sm:w-[20rem] sm:max-w-[20rem] sm:px-2 lg:w-[24rem] lg:max-w-[24rem]">
                          <div className="flex min-w-0 max-w-full items-center gap-2.5 overflow-hidden sm:gap-3">
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                              <Icon className="h-4 w-4" aria-hidden />
                            </span>
                            <div className="min-w-0 flex-1 overflow-hidden">
                              <p
                                className="truncate font-semibold leading-tight text-zinc-900 dark:text-zinc-50"
                                title={row.title}
                              >
                                {row.title || 'Untitled'}
                              </p>
                              {row.when ? (
                                <p className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                                  {row.when}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-2 sm:px-2">
                          <TypeBadge kind={row.kind} />
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-2 sm:px-2">
                          <StatusBadge />
                        </td>
                        <td className="max-w-[18rem] px-1.5 py-2 sm:px-2 lg:max-w-[28rem]">
                          <p
                            className="truncate text-[12px] text-zinc-600 dark:text-zinc-400"
                            title={row.preview}
                          >
                            {row.preview || '—'}
                          </p>
                        </td>
                        <td
                          className="whitespace-nowrap px-1 py-2 pr-1.5 sm:px-1.5 sm:pr-2.5"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <div className="flex items-center justify-end">
                            {renderActions(row)}
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
              title={meta.registerTitle}
              subtitle={`${pageMeta.total.toLocaleString()} record${pageMeta.total === 1 ? '' : 's'}`}
              onAdd={goCreate}
              addAriaLabel={meta.newLabel}
            />
            <ul className="grid gap-3 bg-transparent px-0 py-2.5 sm:grid-cols-2 sm:gap-3 sm:bg-white sm:px-4 sm:py-4 xl:grid-cols-3 dark:sm:bg-zinc-950">
              {pageMeta.rows.map((row) => {
                const Icon = rowIcon(row)
                const metaLabel = row.when ? 'When' : 'Type'
                const metaValue = row.when || ABOUT_KIND_LABEL[row.kind]
                return (
                  <li key={row.id} className="min-w-0">
                    <article
                      className={cn(
                        'group flex h-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-2xl border transition outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                        'border-zinc-200/80 bg-zinc-50/50 hover:border-brand-300/60 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-brand-500/30 dark:hover:bg-zinc-950',
                      )}
                      onClick={() => goEdit(row)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          goEdit(row)
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Edit ${row.title}`}
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
                          <StatusBadge />
                          <div className="rounded-lg bg-white shadow-sm dark:bg-zinc-950 dark:shadow-none">
                            {renderActions(row)}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col gap-2.5 p-3.5 pt-3">
                        <span className="inline-flex w-fit items-center gap-1 rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-semibold tracking-wide text-brand-800 uppercase dark:border-zinc-700 dark:bg-zinc-950 dark:text-brand-300">
                          <Icon className="h-3 w-3 opacity-90" aria-hidden />
                          {ABOUT_KIND_LABEL[row.kind]}
                        </span>
                        <div className="min-w-0">
                          <h3
                            className="truncate text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
                            title={row.title}
                          >
                            {row.title || 'Untitled'}
                          </h3>
                          <p
                            className="mt-1 line-clamp-3 text-[12px] leading-5 text-zinc-600 dark:text-zinc-400"
                            title={row.preview || undefined}
                          >
                            {row.preview || 'No text'}
                          </p>
                        </div>
                        <div className="mt-auto rounded-xl border border-zinc-200/70 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                          <p className="text-[10px] font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
                            {metaLabel}
                          </p>
                          <p
                            className="mt-0.5 truncate font-mono text-[11px] text-zinc-700 dark:text-zinc-300"
                            title={metaValue}
                          >
                            {metaValue}
                            {row.note ? ` · ${row.note}` : ''}
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
          description="This entry will be removed from the database and the public Council page. This action cannot be undone."
          noun={ABOUT_KIND_LABEL[pendingDelete.kind].toLowerCase()}
          busy={busyId === pendingDelete.id}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )

  function renderActions(row: AboutRow) {
    const deletable = canDelete(row)
    return (
      <RegisterRowActions
        open={openMenuId === row.id}
        onOpenChange={(open) => setOpenMenuId(open ? row.id : null)}
        onEdit={() => {
          setOpenMenuId(null)
          goEdit(row)
        }}
        onDelete={() => {
          setOpenMenuId(null)
          if (!deletable) return
          setPendingDelete(row)
        }}
        hideDelete={!deletable}
        disabled={busyId === row.id}
      />
    )
  }
}

function TypeBadge({ kind, pill = false }: { kind: AboutRowKind; pill?: boolean }) {
  const label = ABOUT_KIND_LABEL[kind]
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

function StatusBadge() {
  return (
    <span
      className={cn(
        'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-[10px] border px-2 py-1 text-[11px] font-medium leading-none shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:shadow-none',
        'border-emerald-200/85 bg-gradient-to-br from-white to-emerald-50/80 text-emerald-950 dark:border-emerald-500/22 dark:from-zinc-950 dark:to-emerald-500/14 dark:text-emerald-50',
      )}
      title="Published"
    >
      <span
        className="inline-flex h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(255,255,255,0.95)] motion-safe:animate-pulse dark:bg-emerald-400 dark:shadow-[0_0_0_2px_rgba(9,9,11,0.94)]"
        aria-hidden
      />
      <span className="min-w-0 truncate tracking-[-0.01em]">Published</span>
    </span>
  )
}

export { AboutAdmin }
export { AboutAdmin as AboutContentAdmin }
