import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Clock,
  GraduationCap,
  Layers,
  LayoutGrid,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Table2,
  UserCog,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { RequireLoginRedirect } from '@/components/portal/RequireLoginRedirect'
import { HorizontalDragScrollTableWrap } from '@/components/portal/HorizontalDragScrollTableWrap'
import { RegisterRowActions } from '@/components/portal/RegisterRowActions'
import { Button } from '@/components/ui/button'
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
  deleteUser,
  formatLastLogin,
  listUsers,
  userInitials,
  userRoleLabel,
  type UserRecord,
  type UserRole,
} from '@/lib/users-api'
import { formatPhDateTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import { ConfirmDeleteDialog } from '@/components/portal/ConfirmDeleteDialog'
import { setPageScrollLocked } from '@/hooks/useLenis'

type SegFilter = 'all' | UserRole

const PAGE_SIZE_KEY = 'pup-admin-users-page-size'
const VIEW_KEY = 'pup-admin-users-view'
const REGISTER_HEADING_ID = 'users-register-heading'
const REGISTER_TITLE = 'User register'
const SELF_DELETE_MESSAGE = 'You cannot delete your own account.'

const SEG_OPTIONS: { key: SegFilter; icon: typeof Layers; label: string }[] = [
  { key: 'all', icon: Layers, label: 'All' },
  { key: 'admin', icon: Shield, label: 'Admin' },
  { key: 'officer', icon: UserCog, label: 'Officer' },
  { key: 'student', icon: GraduationCap, label: 'Student' },
]

function yearLabel(year: number | null) {
  return year ? `Year ${year}` : '—'
}

function activeLabel(active: boolean) {
  return active ? 'Active' : 'Inactive'
}

function lastLoginSortValue(value: string | null) {
  if (!value) return 0
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? 0 : t
}

export default function UsersAdmin() {
  const navigate = useNavigate()
  const location = useLocation()
  const [items, setItems] = useState<UserRecord[]>([])
  const [meId, setMeId] = useState<number | null>(null)
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
  const [pendingDelete, setPendingDelete] = useState<UserRecord | null>(null)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [viewing, setViewing] = useState<UserRecord | null>(null)
  const [toast, setToast] = useState<SnackToast | null>(null)

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (opts?.soft) setReloadBusy(true)
      else setLoading(true)
      const result = await listUsers()
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
      setMeId(typeof result.data.meId === 'number' ? result.data.meId : null)
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

  const segCounts = useMemo(
    () => ({
      all: items.length,
      admin: items.filter((i) => i.role === 'admin').length,
      officer: items.filter((i) => i.role === 'officer').length,
      student: items.filter((i) => i.role === 'student').length,
    }),
    [items],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items
      .filter((item) => {
        if (segFilter !== 'all' && item.role !== segFilter) return false
        if (!needle) return true
        const haystack =
          `${item.fullName} ${item.email} ${item.studentNumber ?? ''} ${item.role} ${userRoleLabel(item.role)} ${activeLabel(item.active)}`.toLowerCase()
        return haystack.includes(needle)
      })
      .sort(
        (a, b) =>
          lastLoginSortValue(b.lastLoginAt) - lastLoginSortValue(a.lastLoginAt) ||
          a.fullName.localeCompare(b.fullName),
      )
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
    navigate('/admin/users/new')
  }

  function goEdit(item: UserRecord) {
    navigate(`/admin/users/${item.id}/edit`)
  }

  function requestDelete(item: UserRecord) {
    if (item.id === meId) {
      showToast(SELF_DELETE_MESSAGE, 'error')
      return
    }
    setPendingDelete(item)
  }

  async function handleDelete() {
    if (!pendingDelete) return
    const item = pendingDelete
    if (item.id === meId) {
      setPendingDelete(null)
      showToast(SELF_DELETE_MESSAGE, 'error')
      return
    }
    setBusyId(item.id)
    const result = await deleteUser(item.id)
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
    showToast('User deleted.', 'success')
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
      ariaLabel="Users register pagination"
    />
  )

  const reloadButtons = (extraCls: string) => (
    <button
      type="button"
      disabled={busy}
      title="Reload users"
      aria-label="Reload users"
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
            Users
          </h1>
          <p className="max-w-xl text-[13px] leading-6 text-zinc-500 dark:text-zinc-400">
            Admin accounts, officers, and portal students.
          </p>
        </div>
        <button type="button" className={workspacePageAddBtnCls} onClick={goCreate}>
          <Plus className="h-4 w-4" aria-hidden />
          New user
        </button>
      </div>

      <section aria-label="Catalog" className="w-full max-w-none">
        <div className={`${workspaceCatalogShellCls} ${workspaceCatalogPadCls} w-full max-w-none`}>
          <div
            role="toolbar"
            aria-label="User filters"
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
                    placeholder="Search name, email, student #, role, active…"
                    aria-label="Search users"
                    className={`${catalogInput} min-w-0 w-full pl-9`}
                  />
                </div>
                {reloadButtons('sm:hidden')}
              </div>

              <div className={workspaceCatalogToolbarActionsRowCls}>
                {reloadButtons('max-sm:hidden')}

                <div
                  role="radiogroup"
                  aria-label="Role filter"
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
            Loading users…
          </div>
        ) : filtered.length === 0 ? (
          <div className={workspaceRegisterPanelShellCls(registerView)}>
            <RegisterPanelHeading
              headingId={REGISTER_HEADING_ID}
              title={REGISTER_TITLE}
              subtitle={`${items.length === 0 ? '0' : '0 matching'} users`}
              onAdd={goCreate}
              addAriaLabel="New user"
            />
            <div className="min-w-0 bg-white px-4 py-5 sm:px-5 sm:py-6 dark:bg-zinc-950">
              <div className="flex flex-col items-center overflow-hidden rounded-lg border border-dashed border-zinc-300/90 bg-zinc-50/85 px-5 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
                <Users
                  className="mb-5 h-[3.75rem] w-[3.75rem] shrink-0 text-brand-600/45"
                  strokeWidth={1.35}
                  aria-hidden
                />
                <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
                  {items.length === 0 ? 'No users yet' : 'No matching users'}
                </p>
                <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {items.length === 0
                    ? 'Create an account to give someone access to the portal.'
                    : 'Adjust search, role filter, or reload.'}
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
              addAriaLabel="New user"
            />
            <HorizontalDragScrollTableWrap className={plansRegisterTableScrollerCls}>
              <table className={workspaceRegisterTableCls}>
                <caption className="sr-only">User register rows</caption>
                <thead className={workspaceRegisterTheadCls}>
                  <tr className="[&_th]:text-brand-900/80 dark:[&_th]:text-zinc-300">
                    <th
                      scope="col"
                      className={cn(
                        workspaceRegisterThSortCellCls,
                        'w-[16rem] max-w-[16rem] text-left sm:w-[20rem] sm:max-w-[20rem] lg:w-[24rem] lg:max-w-[24rem]',
                      )}
                    >
                      User
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[7rem] text-left')}
                    >
                      Role
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[8rem] text-left')}
                    >
                      Student #
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[5rem] text-left')}
                    >
                      Year
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[7rem] text-left')}
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[11rem] text-left')}
                    >
                      Last login
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
                      onClick={() => setViewing(item)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setViewing(item)
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`View details for ${item.fullName || item.email}`}
                    >
                      <td className="w-[16rem] max-w-[16rem] px-1.5 py-2 sm:w-[20rem] sm:max-w-[20rem] sm:px-2 lg:w-[24rem] lg:max-w-[24rem]">
                        <div className="flex min-w-0 max-w-full items-center gap-2.5">
                          <UserAvatar name={item.fullName} role={item.role} src={item.avatarUrl} />
                          <div className="min-w-0 overflow-hidden">
                            <p
                              className="truncate font-semibold leading-tight text-zinc-900 dark:text-zinc-50"
                              title={item.fullName}
                            >
                              {item.fullName || 'Unnamed'}
                              {item.id === meId ? (
                                <span className="ml-1.5 text-[10px] font-semibold tracking-wide text-brand-700 uppercase dark:text-brand-300">
                                  You
                                </span>
                              ) : null}
                            </p>
                            <p
                              className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400"
                              title={item.email}
                            >
                              {item.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 sm:px-2">
                        <RoleBadge role={item.role} />
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 font-mono text-[12px] text-zinc-700 sm:px-2 dark:text-zinc-300">
                        {item.studentNumber || '—'}
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 text-[12px] text-zinc-700 sm:px-2 dark:text-zinc-300">
                        {yearLabel(item.yearLevel)}
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 sm:px-2">
                        <ActiveBadge active={item.active} />
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 text-[12px] text-zinc-600 sm:px-2 dark:text-zinc-400">
                        {formatLastLogin(item.lastLoginAt)}
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
              onAdd={goCreate}
              addAriaLabel="New user"
            />
            <ul className="grid gap-3 bg-transparent px-0 py-2.5 sm:grid-cols-2 sm:gap-3 sm:bg-white sm:px-4 sm:py-4 xl:grid-cols-3 dark:sm:bg-zinc-950">
              {pageMeta.rows.map((item) => (
                <li key={item.id} className="min-w-0">
                  <article
                    className={cn(
                      'group flex h-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-2xl border transition outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                      'border-zinc-200/80 bg-zinc-50/50 hover:border-brand-300/60 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-brand-500/30 dark:hover:bg-zinc-950',
                    )}
                    onClick={() => setViewing(item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setViewing(item)
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`View details for ${item.fullName || item.email}`}
                  >
                    <div className="flex items-start justify-between gap-2 p-3.5 pb-0">
                      <RoleBadge role={item.role} />
                      <div
                        className="flex items-center gap-1.5"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <ActiveBadge active={item.active} />
                        <div className="rounded-lg bg-white shadow-sm dark:bg-zinc-950 dark:shadow-none">
                          {renderActions(item)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col gap-2.5 p-3.5 pt-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar name={item.fullName} role={item.role} src={item.avatarUrl} size="lg" />
                        <div className="min-w-0">
                          <h3
                            className="truncate text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
                            title={item.fullName}
                          >
                            {item.fullName || 'Unnamed'}
                            {item.id === meId ? (
                              <span className="ml-1.5 text-[10px] font-semibold tracking-wide text-brand-700 uppercase dark:text-brand-300">
                                You
                              </span>
                            ) : null}
                          </h3>
                          <p
                            className="mt-0.5 truncate text-[12px] text-zinc-600 dark:text-zinc-400"
                            title={item.email}
                          >
                            {item.email}
                          </p>
                        </div>
                      </div>
                      <div className="mt-auto grid grid-cols-2 gap-2">
                        <div className="min-w-0 rounded-xl border border-zinc-200/70 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                          <p className="text-[10px] font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
                            Student #
                          </p>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                            {item.studentNumber || '—'}
                          </p>
                        </div>
                        <div className="min-w-0 rounded-xl border border-zinc-200/70 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                          <p className="text-[10px] font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
                            Year
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-zinc-700 dark:text-zinc-300">
                            {yearLabel(item.yearLevel)}
                          </p>
                        </div>
                      </div>
                      <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                        Last login {formatLastLogin(item.lastLoginAt)}
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

      {viewing ? (
        <UserDetailsModal
          user={items.find((row) => row.id === viewing.id) ?? viewing}
          isSelf={viewing.id === meId}
          onClose={() => setViewing(null)}
          onEdit={() => {
            const id = viewing.id
            setViewing(null)
            navigate(`/admin/users/${id}/edit`)
          }}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDeleteDialog
          title={pendingDelete.fullName || pendingDelete.email || 'User'}
          noun="user"
          detail={pendingDelete.fullName && pendingDelete.email ? pendingDelete.email : undefined}
          description="This account will be removed from the database. This action cannot be undone."
          busy={busyId === pendingDelete.id}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )

  function renderActions(item: UserRecord) {
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
          requestDelete(item)
        }}
        hideDelete={item.id === meId}
        disabled={busyId === item.id}
      />
    )
  }
}

const ROLE_BADGE_CLS: Record<UserRole, string> = {
  admin:
    'border-violet-200/80 bg-violet-50/80 text-violet-900 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-200',
  officer:
    'border-sky-200/80 bg-sky-50/80 text-sky-900 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-200',
  student:
    'border-zinc-200/85 bg-zinc-50 text-zinc-700 dark:border-zinc-600/40 dark:bg-zinc-800/60 dark:text-zinc-300',
}

const AVATAR_CLS: Record<UserRole, string> = {
  admin: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200',
  officer: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200',
  student: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
}

function UserAvatar({
  name,
  role,
  src,
  size = 'md',
}: {
  name: string
  role: UserRole
  src?: string | null
  size?: 'md' | 'lg'
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = Boolean(src) && failedSrc !== src
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold tracking-wide',
        size === 'lg' ? 'h-10 w-10 text-[13px]' : 'h-8 w-8 text-[11px]',
        AVATAR_CLS[role] ?? AVATAR_CLS.student,
      )}
      aria-hidden
    >
      {showImage ? (
        <img
          src={src as string}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setFailedSrc(src ?? null)}
          className="h-full w-full object-cover"
        />
      ) : (
        userInitials(name)
      )}
    </span>
  )
}

function formatDateTime(iso: string | null | undefined) {
  return formatPhDateTime(iso)
}

function UserDetailsModal({
  user,
  isSelf,
  onClose,
  onEdit,
}: {
  user: UserRecord
  isSelf: boolean
  onClose: () => void
  onEdit: () => void
}) {
  const titleId = useId()
  const displayName = user.fullName || 'Unnamed'

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
              <UserRound className="size-3.5 opacity-80" aria-hidden />
              {userRoleLabel(user.role)}
            </p>
            <p className="mt-0.5 truncate text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
              User details
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
          <div className="flex flex-col items-center gap-4 bg-gradient-to-b from-zinc-50/90 to-transparent px-5 py-6 sm:flex-row sm:items-start sm:gap-5 sm:from-transparent sm:px-6 sm:py-6 dark:from-zinc-950/50 sm:dark:from-transparent">
            <div className="relative size-[7.5rem] shrink-0 overflow-hidden rounded-full border-2 border-white bg-zinc-100 shadow-[0_12px_28px_-16px_rgba(30,5,65,0.5)] ring-1 ring-zinc-200/90 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-zinc-700 sm:size-[8.25rem] sm:rounded-2xl sm:border sm:shadow-none sm:ring-0">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="size-full object-cover object-center"
                />
              ) : (
                <span
                  className={cn(
                    'flex size-full items-center justify-center text-[30px] font-semibold tracking-wide sm:text-[32px]',
                    AVATAR_CLS[user.role] ?? AVATAR_CLS.student,
                  )}
                >
                  {userInitials(user.fullName || user.email)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 text-center sm:pt-0.5 sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
                <ActiveBadge active={user.active} />
                <RoleBadge role={user.role} />
                {isSelf ? (
                  <span className="inline-flex items-center rounded-full border border-brand-200/80 bg-brand-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-brand-700 uppercase dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300">
                    You
                  </span>
                ) : null}
              </div>
              <h2
                id={titleId}
                className="mt-3 text-[19px] leading-snug font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
              >
                {displayName}
              </h2>
              <p className="mt-2 inline-flex max-w-full items-start justify-center gap-1.5 text-[14px] leading-6 break-all text-zinc-600 sm:justify-start dark:text-zinc-300">
                <Mail
                  className="mt-0.5 size-3.5 shrink-0 text-brand-700 dark:text-brand-300"
                  aria-hidden
                />
                <span className="min-w-0 text-left">{user.email}</span>
              </p>
            </div>
          </div>

          <div className="border-t border-zinc-100 px-5 py-5 sm:px-6 dark:border-zinc-800">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetaCell label="Student number">
                <span className="font-mono">{user.studentNumber || '—'}</span>
              </MetaCell>
              <MetaCell label="Year level">{yearLabel(user.yearLevel)}</MetaCell>
              <MetaCell label="Last login">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5 shrink-0 text-zinc-400" aria-hidden />
                  {formatLastLogin(user.lastLoginAt)}
                </span>
              </MetaCell>
              <MetaCell label="Created">
                {user.createdAt ? formatDateTime(user.createdAt) : '—'}
              </MetaCell>
            </div>
          </div>
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

function MetaCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-950/60">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-zinc-400 uppercase dark:text-zinc-500">
        {label}
      </p>
      <div className="mt-1 min-w-0 text-[13px] font-medium break-words text-zinc-800 dark:text-zinc-100">
        {children}
      </div>
    </div>
  )
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        ROLE_BADGE_CLS[role] ?? ROLE_BADGE_CLS.student,
      )}
    >
      {userRoleLabel(role)}
    </span>
  )
}

function ActiveBadge({ active }: { active: boolean }) {
  const label = activeLabel(active)
  return (
    <span
      className={cn(
        'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-[10px] border px-2 py-1 text-[11px] font-medium leading-none shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:shadow-none',
        active
          ? 'border-emerald-200/85 bg-gradient-to-br from-white to-emerald-50/80 text-emerald-950 dark:border-emerald-500/22 dark:from-zinc-950 dark:to-emerald-500/14 dark:text-emerald-50'
          : 'border-zinc-200/85 bg-gradient-to-br from-white to-zinc-100/80 text-zinc-600 dark:border-zinc-600/40 dark:from-zinc-950 dark:to-zinc-800/60 dark:text-zinc-400',
      )}
      title={label}
    >
      <span
        className={cn(
          'inline-flex h-2 w-2 shrink-0 rounded-full',
          active
            ? 'bg-emerald-500 shadow-[0_0_0_2px_rgba(255,255,255,0.95)] dark:bg-emerald-400 dark:shadow-[0_0_0_2px_rgba(9,9,11,0.94)]'
            : 'bg-zinc-400 shadow-[0_0_0_2px_rgba(255,255,255,0.95)] dark:bg-zinc-500 dark:shadow-[0_0_0_2px_rgba(9,9,11,0.94)]',
        )}
        aria-hidden
      />
      <span className="min-w-0 truncate tracking-[-0.01em]">{label}</span>
    </span>
  )
}
