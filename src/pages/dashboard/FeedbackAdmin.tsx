import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  CheckCircle2,
  CircleAlert,
  CircleDot,
  Ellipsis,
  Inbox,
  Layers,
  LayoutGrid,
  Lightbulb,
  Loader2,
  Mail,
  MessagesSquare,
  RefreshCw,
  Search,
  Table2,
  ThumbsUp,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
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
import { ConfirmDeleteDialog } from '@/components/portal/ConfirmDeleteDialog'
import { Button } from '@/components/ui/button'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import { formatPhDateTime } from '@/lib/datetime'
import {
  FEEDBACK_KIND_LABEL,
  deleteFeedback,
  listFeedback,
  updateFeedbackStatus,
  type FeedbackKind,
  type FeedbackRecord,
  type FeedbackStatus,
} from '@/lib/feedback-api'
import { useNotifications } from '@/context/NotificationsContext'
import { setPageScrollLocked } from '@/hooks/useLenis'
import { cn } from '@/lib/utils'

const PAGE_SIZE_KEY = 'pup-admin-feedback-page-size'
const VIEW_KEY = 'pup-admin-feedback-view'
const REGISTER_HEADING_ID = 'feedback-register-heading'
const REGISTER_TITLE = 'Feedback register'

type KindFilter = 'all' | FeedbackKind
type StatusFilter = 'all' | FeedbackStatus

const KIND_OPTIONS: { key: KindFilter; icon: typeof Layers; label: string }[] = [
  { key: 'all', icon: Layers, label: 'All kinds' },
  { key: 'suggestion', icon: Lightbulb, label: FEEDBACK_KIND_LABEL.suggestion },
  { key: 'concern', icon: CircleAlert, label: FEEDBACK_KIND_LABEL.concern },
  { key: 'compliment', icon: ThumbsUp, label: FEEDBACK_KIND_LABEL.compliment },
  { key: 'other', icon: Ellipsis, label: FEEDBACK_KIND_LABEL.other },
]

const STATUS_OPTIONS: { key: StatusFilter; icon: typeof Inbox; label: string }[] = [
  { key: 'all', icon: Inbox, label: 'All' },
  { key: 'new', icon: CircleDot, label: 'New' },
  { key: 'read', icon: CheckCircle2, label: 'Read' },
]

function kindLabel(kind: FeedbackKind | string) {
  return FEEDBACK_KIND_LABEL[kind as FeedbackKind] ?? 'Something else'
}

function submittedSortValue(value?: string) {
  if (!value) return 0
  const t = new Date(value.includes('T') ? value : value.replace(' ', 'T')).getTime()
  return Number.isNaN(t) ? 0 : t
}

function previewMessage(message: string) {
  const text = message.replace(/\s+/g, ' ').trim()
  return text.length > 90 ? `${text.slice(0, 87)}…` : text
}

export default function FeedbackAdmin() {
  const { refresh: refreshAlerts, markRead } = useNotifications()
  const [searchParams, setSearchParams] = useSearchParams()
  const openedFromQuery = useRef<number | null>(null)
  const [items, setItems] = useState<FeedbackRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadBusy, setReloadBusy] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [pageNo, setPageNo] = useState(1)
  const [pageSize, setPageSize] = useState(() => readStoredRegisterPageSize(PAGE_SIZE_KEY))
  const [registerView, setRegisterView] = useState<RegisterView>(() =>
    initialRegisterView(VIEW_KEY),
  )
  const [busyId, setBusyId] = useState<number | null>(null)
  const [pendingDelete, setPendingDelete] = useState<FeedbackRecord | null>(null)
  const [openItem, setOpenItem] = useState<FeedbackRecord | null>(null)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [toast, setToast] = useState<SnackToast | null>(null)

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (opts?.soft) setReloadBusy(true)
      else setLoading(true)
      const result = await listFeedback()
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
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    setPageNo(1)
  }, [query, kindFilter, statusFilter, pageSize])

  const kindCounts = useMemo(() => {
    const base: Record<KindFilter, number> = {
      all: items.length,
      suggestion: 0,
      concern: 0,
      compliment: 0,
      other: 0,
    }
    for (const item of items) {
      if (item.kind in base) base[item.kind] += 1
    }
    return base
  }, [items])

  const statusCounts = useMemo(() => {
    const base: Record<StatusFilter, number> = { all: items.length, new: 0, read: 0 }
    for (const item of items) {
      if (item.status in base) base[item.status] += 1
    }
    return base
  }, [items])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items
      .filter((item) => {
        if (kindFilter !== 'all' && item.kind !== kindFilter) return false
        if (statusFilter !== 'all' && item.status !== statusFilter) return false
        if (!needle) return true
        const haystack =
          `${item.name} ${item.email} ${item.kind} ${kindLabel(item.kind)} ${item.message} ${item.status}`.toLowerCase()
        return haystack.includes(needle)
      })
      .sort(
        (a, b) =>
          submittedSortValue(b.createdAt) - submittedSortValue(a.createdAt) || b.id - a.id,
      )
  }, [items, query, kindFilter, statusFilter])

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

  const applyItem = useCallback((next: FeedbackRecord) => {
    setItems((prev) => prev.map((row) => (row.id === next.id ? next : row)))
    setOpenItem((current) => (current?.id === next.id ? next : current))
  }, [])

  async function markStatus(item: FeedbackRecord, status: FeedbackStatus) {
    if (item.status === status) return
    setBusyId(item.id)
    const result = await updateFeedbackStatus(item.id, status)
    setBusyId(null)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        setNeedsLogin(true)
        return
      }
      showToast(result.error, 'error')
      return
    }
    applyItem(result.data.item)
    markRead(`feedback:${item.id}`)
    void refreshAlerts()
    showToast(status === 'read' ? 'Marked as read.' : 'Marked as new.', 'success')
  }

  const openDetails = useCallback(
    async (item: FeedbackRecord) => {
      setOpenMenuId(null)
      setOpenItem(item)
      markRead(`feedback:${item.id}`)
      if (item.status === 'new') {
        const result = await updateFeedbackStatus(item.id, 'read')
        if (result.ok) {
          applyItem(result.data.item)
          void refreshAlerts()
        }
      }
    },
    [applyItem, markRead, refreshAlerts],
  )

  useEffect(() => {
    const raw = searchParams.get('open')
    const openId = raw ? Number(raw) : 0
    if (!openId || items.length === 0) return
    if (openedFromQuery.current === openId) return
    const match = items.find((item) => item.id === openId)
    if (!match) return
    openedFromQuery.current = openId
    void openDetails(match)
    const next = new URLSearchParams(searchParams)
    next.delete('open')
    setSearchParams(next, { replace: true })
  }, [items, openDetails, searchParams, setSearchParams])

  async function handleDelete() {
    if (!pendingDelete) return
    const item = pendingDelete
    setBusyId(item.id)
    const result = await deleteFeedback(item.id)
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
    setOpenItem((current) => (current?.id === item.id ? null : current))
    markRead(`feedback:${item.id}`)
    void refreshAlerts()
    showToast('Feedback deleted.', 'success')
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
      ariaLabel="Feedback register pagination"
    />
  )

  const reloadButtons = (extraCls: string) => (
    <button
      type="button"
      disabled={busy}
      title="Reload feedback"
      aria-label="Reload feedback"
      onClick={() => void load({ soft: true })}
      className={`${catalogToolbarIconBtn} ${extraCls}`}
    >
      <RefreshCw
        className={`${workspaceCatalogToolbarIconCls} ${reloadBusy ? 'animate-spin' : 'opacity-85'}`}
        aria-hidden
      />
    </button>
  )

  const subtitle = `${pageMeta.total.toLocaleString()} note${pageMeta.total === 1 ? '' : 's'}`

  function renderActions(item: FeedbackRecord) {
    return (
      <PortalActionMenu
        open={openMenuId === item.id}
        onOpenChange={(open) => setOpenMenuId(open ? item.id : null)}
        disabled={busyId === item.id}
        ariaLabel={`Actions for ${item.name}`}
        items={[
          {
            id: 'view',
            label: 'View details',
            icon: CircleDot,
            onClick: () => void openDetails(item),
          },
          {
            id: item.status === 'read' ? 'unread' : 'read',
            label: item.status === 'read' ? 'Mark as new' : 'Mark as read',
            icon: item.status === 'read' ? Inbox : CheckCircle2,
            onClick: () => void markStatus(item, item.status === 'read' ? 'new' : 'read'),
          },
          {
            id: 'delete',
            label: 'Delete',
            icon: Trash2,
            danger: true,
            onClick: () => setPendingDelete(item),
          },
        ]}
      />
    )
  }

  return (
    <div className={workspaceTenantMainStackCls}>
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="min-w-0 space-y-1">
          <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900 sm:text-[22px] dark:text-zinc-50">
            Feedbacks
          </h1>
          <p className="max-w-xl text-[13px] leading-6 text-zinc-500 dark:text-zinc-400">
            Notes sent from the homepage contact form.
          </p>
        </div>
      </div>

      <section aria-label="Catalog" className="w-full max-w-none">
        <div className={`${workspaceCatalogShellCls} ${workspaceCatalogPadCls} w-full max-w-none`}>
          <div
            role="toolbar"
            aria-label="Feedback filters"
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
                    aria-label="Search feedback"
                    className={`${catalogInput} min-w-0 w-full pl-9`}
                  />
                </div>
                {reloadButtons('sm:hidden')}
              </div>

              <div className={workspaceCatalogToolbarActionsRowCls}>
                {reloadButtons('max-sm:hidden')}

                <div
                  role="radiogroup"
                  aria-label="Status filter"
                  className={workspaceCatalogSegTrackInlineCls}
                >
                  {STATUS_OPTIONS.map(({ key, icon: Icon, label }) => (
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
                  aria-label="Kind filter"
                  className={workspaceCatalogSegTrackInlineCls}
                >
                  {KIND_OPTIONS.map(({ key, icon: Icon, label }) => (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={kindFilter === key}
                      title={`${label} (${kindCounts[key]})`}
                      aria-label={`${label} (${kindCounts[key]})`}
                      onClick={() => setKindFilter(key)}
                      className={catalogSegIcon(kindFilter === key)}
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
            Loading feedback…
          </div>
        ) : filtered.length === 0 ? (
          <div className={workspaceRegisterPanelShellCls(registerView)}>
            <RegisterPanelHeading
              headingId={REGISTER_HEADING_ID}
              title={REGISTER_TITLE}
              subtitle={`${items.length === 0 ? '0' : '0 matching'} notes`}
            />
            <div className="min-w-0 bg-white px-4 py-5 sm:px-5 sm:py-6 dark:bg-zinc-950">
              <div className="flex flex-col items-center overflow-hidden rounded-lg border border-dashed border-zinc-300/90 bg-zinc-50/85 px-5 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
                <MessagesSquare
                  className="mb-5 h-[3.75rem] w-[3.75rem] shrink-0 text-brand-600/45"
                  strokeWidth={1.35}
                  aria-hidden
                />
                <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
                  {items.length === 0 ? 'No feedback yet' : 'No matching feedback'}
                </p>
                <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {items.length === 0
                    ? 'Notes submitted from the homepage contact form will appear here.'
                    : 'Adjust search, status, kind filter, or reload.'}
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
            />
            <HorizontalDragScrollTableWrap className={plansRegisterTableScrollerCls}>
              <table className={workspaceRegisterTableCls}>
                <caption className="sr-only">Feedback register rows</caption>
                <thead className={workspaceRegisterTheadCls}>
                  <tr className="[&_th]:text-brand-900/80 dark:[&_th]:text-zinc-300">
                    <th
                      scope="col"
                      className={cn(
                        workspaceRegisterThSortCellCls,
                        'w-[16rem] max-w-[16rem] text-left sm:w-[20rem] sm:max-w-[20rem]',
                      )}
                    >
                      Sender
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[8rem] text-left')}
                    >
                      About
                    </th>
                    <th
                      scope="col"
                      className={cn(
                        workspaceRegisterThSortCellCls,
                        'w-[16rem] max-w-[16rem] text-left sm:w-[20rem] sm:max-w-[20rem]',
                      )}
                    >
                      Message
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[6rem] text-left')}
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[10rem] text-left')}
                    >
                      Received
                    </th>
                    <th scope="col" className={workspaceRegisterThActionsCellCls}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-950">
                  {pageMeta.rows.map((item) => (
                    <tr
                      key={item.id}
                      className={cn(workspaceRegisterTbodyRowCls, 'cursor-pointer')}
                      onClick={() => void openDetails(item)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          void openDetails(item)
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open feedback from ${item.name}`}
                    >
                      <td className="min-w-0 w-[16rem] max-w-[16rem] px-1.5 py-2 sm:w-[20rem] sm:max-w-[20rem] sm:px-2">
                        <div className="flex min-w-0 max-w-full items-center gap-2.5">
                          <SenderAvatar name={item.name} />
                          <div className="min-w-0 overflow-hidden">
                            <p
                              className={cn(
                                'truncate text-[13px] leading-tight text-zinc-900 dark:text-zinc-50',
                                item.status === 'new' ? 'font-semibold' : 'font-medium',
                              )}
                              title={item.name}
                            >
                              {item.name}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                              {item.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 sm:px-2">
                        <KindBadge kind={item.kind} />
                      </td>
                      <td className="min-w-0 px-1.5 py-2 sm:px-2">
                        <p
                          className="line-clamp-2 max-w-[20rem] text-[12px] leading-5 text-zinc-600 dark:text-zinc-300"
                          title={item.message}
                        >
                          {previewMessage(item.message)}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 sm:px-2">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 text-[12px] text-zinc-600 sm:px-2 dark:text-zinc-400">
                        {item.createdAt ? formatPhDateTime(item.createdAt) : '—'}
                      </td>
                      <td
                        className="whitespace-nowrap px-1 py-2 pr-1.5 sm:px-1.5 sm:pr-2.5"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <div className="flex items-center justify-end">{renderActions(item)}</div>
                      </td>
                    </tr>
                  ))}
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
            />
            <ul className="grid gap-3 bg-transparent px-0 py-2.5 sm:grid-cols-2 sm:gap-3 sm:bg-white sm:px-4 sm:py-4 xl:grid-cols-3 dark:sm:bg-zinc-950">
              {pageMeta.rows.map((item) => (
                <li key={item.id} className="min-w-0">
                  <article
                    className={cn(
                      'group flex h-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-2xl border transition outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                      'border-zinc-200/80 bg-zinc-50/50 hover:border-brand-300/60 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-brand-500/30 dark:hover:bg-zinc-950',
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
                    aria-label={`Open feedback from ${item.name}`}
                  >
                    <div className="flex items-start justify-between gap-2 p-3.5 pb-0">
                      <KindBadge kind={item.kind} pill />
                      <div
                        className="flex items-center gap-1.5"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <StatusBadge status={item.status} />
                        <div className="rounded-lg bg-white shadow-sm dark:bg-zinc-950 dark:shadow-none">
                          {renderActions(item)}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-3.5 pt-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <SenderAvatar name={item.name} />
                        <div className="min-w-0">
                          <h3
                            className={cn(
                              'truncate text-[13px] tracking-tight text-zinc-900 dark:text-zinc-50',
                              item.status === 'new' ? 'font-semibold' : 'font-medium',
                            )}
                            title={item.name}
                          >
                            {item.name}
                          </h3>
                          <p className="mt-0.5 truncate text-[12px] text-zinc-500 dark:text-zinc-400">
                            {item.email}
                          </p>
                        </div>
                      </div>
                      <p className="line-clamp-3 text-[12px] leading-5 text-zinc-600 dark:text-zinc-300">
                        {item.message}
                      </p>
                      <p className="mt-auto truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                        {item.createdAt ? formatPhDateTime(item.createdAt) : '—'}
                      </p>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
            <footer className={plansRegisterPanelFooterCls}>{paginationBar}</footer>
          </div>
        )}
      </section>

      {openItem ? (
        <FeedbackDetailDialog
          item={openItem}
          busy={busyId === openItem.id}
          onClose={() => setOpenItem(null)}
          onToggleStatus={() =>
            void markStatus(openItem, openItem.status === 'read' ? 'new' : 'read')
          }
          onDelete={() => setPendingDelete(openItem)}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDeleteDialog
          title={pendingDelete.name}
          noun="feedback"
          detail={pendingDelete.email}
          description="This note will be removed from the feedback register. This action cannot be undone."
          busy={busyId === pendingDelete.id}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

function SenderAvatar({ size = 'md' }: { name?: string; size?: 'md' | 'lg' }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-800 ring-1 ring-brand-200/70 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/25',
        size === 'lg' ? 'mt-0.5 h-10 w-10' : 'h-8 w-8',
      )}
      aria-hidden
    >
      <UserRound className={size === 'lg' ? 'size-5' : 'size-4'} />
    </span>
  )
}

function KindBadge({ kind, pill = false }: { kind: FeedbackKind; pill?: boolean }) {
  const label = kindLabel(kind)
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

function StatusBadge({ status }: { status: FeedbackStatus }) {
  const isNew = status === 'new'
  return (
    <span
      className={cn(
        'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-[10px] border px-2 py-1 text-[11px] font-medium leading-none shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:shadow-none',
        isNew
          ? 'border-maroon-200/85 bg-gradient-to-br from-white to-maroon-50/80 text-maroon-950 dark:border-maroon-500/22 dark:from-zinc-950 dark:to-maroon-500/14 dark:text-maroon-50'
          : 'border-emerald-200/85 bg-gradient-to-br from-white to-emerald-50/80 text-emerald-950 dark:border-emerald-500/22 dark:from-zinc-950 dark:to-emerald-500/14 dark:text-emerald-50',
      )}
      title={isNew ? 'New' : 'Read'}
    >
      <span
        className={cn(
          'inline-flex h-2 w-2 shrink-0 rounded-full',
          isNew
            ? 'bg-maroon-600 motion-safe:animate-pulse'
            : 'bg-emerald-500',
        )}
        aria-hidden
      />
      <span className="min-w-0 truncate tracking-[-0.01em]">{isNew ? 'New' : 'Read'}</span>
    </span>
  )
}

function FeedbackDetailDialog({
  item,
  busy,
  onClose,
  onToggleStatus,
  onDelete,
}: {
  item: FeedbackRecord
  busy: boolean
  onClose: () => void
  onToggleStatus: () => void
  onDelete: () => void
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  const busyRef = useRef(busy)
  const replyHref = `mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent(
    `Re: ${kindLabel(item.kind)} from ${item.name}`,
  )}`

  onCloseRef.current = onClose
  busyRef.current = busy

  useEffect(() => {
    setPageScrollLocked(true)
    const previous = document.activeElement as HTMLElement | null
    const timer = window.setTimeout(() => closeRef.current?.focus(), 20)

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
      setPageScrollLocked(false)
      previous?.focus?.()
    }
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        tabIndex={-1}
        className="absolute inset-0 bg-brand-950/50 backdrop-blur-[3px] dark:bg-black/70"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-lenis-prevent
        className={cn(
          'sheet-up relative flex w-full max-w-xl flex-col overflow-hidden border border-zinc-200/90 bg-white outline-none',
          'max-h-[min(88dvh,100dvh-env(safe-area-inset-bottom,0px))]',
          'rounded-t-[1.25rem] shadow-[0_24px_64px_-28px_rgba(30,5,65,0.45)]',
          'sm:max-h-[min(92dvh,40rem)] sm:rounded-2xl',
          'dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-[0_24px_64px_-20px_rgba(0,0,0,0.75)]',
        )}
      >
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        </div>

        <div className="flex shrink-0 items-start gap-3 px-4 pt-2 pb-3 sm:border-b sm:border-zinc-100 sm:px-6 sm:pt-5 sm:pb-4 dark:sm:border-zinc-800">
          <SenderAvatar name={item.name} size="lg" />
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-400 uppercase dark:text-zinc-500">
              {kindLabel(item.kind)}
            </p>
            <h2
              id={titleId}
              className="mt-0.5 truncate text-[16px] font-semibold tracking-tight text-zinc-950 dark:text-zinc-50"
            >
              {item.name}
            </h2>
            <p className="mt-0.5 truncate text-[12px] text-zinc-500 dark:text-zinc-400">
              {item.email}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-zinc-400 outline-none transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-brand-500/35 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 sm:size-9 sm:border sm:border-zinc-200 dark:sm:border-zinc-700"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6 sm:py-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            <KindBadge kind={item.kind} />
          </div>
          <dl className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-2 sm:gap-3">
            <div className="min-w-0 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
              <dt className="text-[10px] font-semibold tracking-wide text-zinc-400 uppercase">
                Email
              </dt>
              <dd className="mt-0.5 truncate text-[13px] font-medium text-zinc-800 dark:text-zinc-100">
                <a href={replyHref} className="hover:text-brand-700 dark:hover:text-brand-300">
                  {item.email}
                </a>
              </dd>
            </div>
            <div className="min-w-0 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
              <dt className="text-[10px] font-semibold tracking-wide text-zinc-400 uppercase">
                Received
              </dt>
              <dd className="mt-0.5 text-[13px] font-medium text-zinc-800 dark:text-zinc-100">
                {item.createdAt ? formatPhDateTime(item.createdAt) : '—'}
              </dd>
            </div>
          </dl>
          <p className="mt-4 whitespace-pre-wrap text-[14px] leading-7 text-zinc-700 sm:mt-5 dark:text-zinc-200">
            {item.message}
          </p>
        </div>

        <div
          className={cn(
            'grid shrink-0 gap-2 border-t border-zinc-100 bg-zinc-50/80 px-4 pt-3',
            'pb-[max(0.85rem,env(safe-area-inset-bottom,0px))]',
            'grid-cols-2 sm:flex sm:bg-transparent sm:px-6 sm:py-4 sm:pb-4',
            'dark:border-zinc-800 dark:bg-zinc-900/80 dark:sm:bg-transparent',
          )}
        >
          <Button
            type="button"
            size="lg"
            className="col-span-2 h-11 rounded-xl sm:order-3 sm:flex-1"
            asChild
          >
            <a href={replyHref}>
              <Mail className="size-4" aria-hidden />
              Reply
            </a>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11 rounded-xl sm:order-2 sm:flex-1"
            onClick={onToggleStatus}
            disabled={busy}
          >
            {item.status === 'read' ? (
              <Inbox className="size-4" aria-hidden />
            ) : (
              <CheckCircle2 className="size-4" aria-hidden />
            )}
            <span className="truncate">
              {item.status === 'read' ? 'Mark as new' : 'Mark as read'}
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11 rounded-xl text-maroon-700 hover:bg-maroon-50 dark:text-maroon-300 dark:hover:bg-maroon-500/10 sm:order-1 sm:flex-1"
            onClick={onDelete}
            disabled={busy}
          >
            <Trash2 className="size-4" aria-hidden />
            Delete
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
