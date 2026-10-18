import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  ChevronDown,
  ChevronLeft,
  ChevronsUpDown,
  LogOut,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react'
import logo from '@/assets/pup-col-sc-logo.png'
import { siteName } from '@/components/layout/nav-data'
import { useNotifications } from '@/context/NotificationsContext'
import { cn } from '@/lib/utils'
import { portalNavGroups, type PortalNavGroup, type PortalNavItem } from './nav'

const linkBase =
  'group relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-50 dark:focus-visible:ring-brand-400/40 dark:focus-visible:ring-offset-zinc-950'

const linkIdle =
  'text-zinc-600 hover:bg-brand-50/90 hover:text-brand-900 dark:hover:bg-brand-500/12 dark:hover:text-brand-100'

const linkActive = 'bg-transparent font-semibold text-brand-700'

const iconIdle =
  'text-zinc-400 transition-colors group-hover:text-brand-600 dark:group-hover:text-brand-300'

const iconActive = 'text-brand-600'

/** Nested tree: discrete └ connectors with gaps (NetLynk style). */
const nestedTreeListCls = 'relative ml-[1.125rem] mt-1 flex flex-col gap-1.5'

const nestedTreeItemCls = [
  'relative pl-[0.95rem]',
  'before:pointer-events-none before:absolute before:top-0 before:left-0 before:h-1/2 before:w-px',
  'before:bg-zinc-300 dark:before:bg-zinc-600',
  'after:pointer-events-none after:absolute after:top-1/2 after:left-0 after:h-px after:w-[0.7rem]',
  'after:bg-zinc-300 dark:after:bg-zinc-600',
].join(' ')

const OPEN_GROUP_KEY = 'pup-sidebar-open-group'

type PortalSidebarProps = {
  mobileOpen: boolean
  desktopCollapsed: boolean
  onCloseMobile: () => void
  displayName: string
  userEmail?: string
  avatarUrl?: string | null
  role: string
  onLogout: () => void
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'DS'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

function pathMatchesItem(pathname: string, item: PortalNavItem) {
  if (item.exact) return pathname === item.to
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

function groupHasActive(pathname: string, items: PortalNavItem[]) {
  return items.some((item) => pathMatchesItem(pathname, item))
}

function isMultiGroup(group: (typeof portalNavGroups)[number]) {
  return group.collapsible !== false && group.items.length > 1
}

function alertDotForItem(itemId: string, flags: { request: boolean; reservation: boolean }) {
  if (itemId === 'requests') return flags.request
  if (itemId === 'reservations') return flags.reservation
  return false
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function itemMatchesQuery(item: PortalNavItem, group: PortalNavGroup, query: string) {
  const q = normalizeSearch(query)
  if (!q) return true
  const haystack = `${item.label} ${item.id} ${group.heading} ${group.id}`.toLowerCase()
  return q.split(' ').every((token) => token && haystack.includes(token))
}

function filterNavGroups(query: string): PortalNavGroup[] {
  const q = normalizeSearch(query)
  if (!q) return portalNavGroups
  return portalNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => itemMatchesQuery(item, group, q)),
    }))
    .filter((group) => group.items.length > 0)
}

function NavSearchField({
  id,
  value,
  searching,
  inputRef,
  onChange,
  onClear,
  onEscapeEmpty,
}: {
  id: string
  value: string
  searching: boolean
  inputRef?: RefObject<HTMLInputElement | null>
  onChange: (value: string) => void
  onClear: () => void
  onEscapeEmpty?: () => void
}) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-zinc-400"
        aria-hidden
      />
      <input
        ref={inputRef}
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return
          if (value.trim()) {
            event.preventDefault()
            onClear()
            return
          }
          onEscapeEmpty?.()
        }}
        placeholder="Search navigation…"
        autoComplete="off"
        spellCheck={false}
        className={cn(
          'h-9 w-full rounded-xl border border-zinc-200/90 bg-white py-0 pr-8 pl-8 text-[13px] text-zinc-800 outline-none transition',
          'placeholder:text-zinc-400',
          'focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20',
          'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-500/50 dark:focus:ring-brand-400/20',
          '[appearance:textfield] [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none',
        )}
      />
      {searching ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute top-1/2 right-1.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 outline-none transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-brand-500/35 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}

function NavItemLink({
  item,
  desktopCollapsed,
  onCloseMobile,
  nested = false,
  showAlert = false,
}: {
  item: PortalNavItem
  desktopCollapsed: boolean
  onCloseMobile: () => void
  nested?: boolean
  showAlert?: boolean
}) {
  return (
    <li className={nested ? nestedTreeItemCls : undefined}>
      <NavLink
        to={item.to}
        end={item.exact ?? false}
        title={item.label}
        onClick={onCloseMobile}
        className={({ isActive }) =>
          cn(
            linkBase,
            isActive ? linkActive : linkIdle,
            nested && '!rounded-lg py-1.5 pl-2',
            desktopCollapsed && !nested && 'xl:relative xl:justify-center xl:gap-0 xl:px-2 xl:py-2.5',
          )
        }
      >
        {({ isActive }) => (
          <>
            <span className="relative z-[1] shrink-0">
              <item.Icon
                className={cn(
                  nested ? 'h-4 w-4' : 'h-[17px] w-[17px]',
                  isActive ? iconActive : iconIdle,
                )}
                strokeWidth={1.9}
                aria-hidden
              />
              {showAlert && desktopCollapsed ? (
                <span
                  className="absolute -top-0.5 -right-0.5 hidden size-2 rounded-full bg-rose-500 ring-2 ring-zinc-50 xl:block dark:ring-zinc-950"
                  aria-hidden
                />
              ) : null}
            </span>
            <span
              className={cn(
                'relative z-[1] min-w-0 flex-1 truncate',
                desktopCollapsed && !nested && 'xl:sr-only xl:flex-none',
              )}
            >
              {item.label}
            </span>
            {showAlert ? (
              <span
                className={cn(
                  'relative z-[1] size-2 shrink-0 rounded-full bg-rose-500',
                  desktopCollapsed && 'xl:hidden',
                )}
                aria-label="New alerts"
              />
            ) : null}
          </>
        )}
      </NavLink>
    </li>
  )
}

function CollapsibleNavGroup({
  id,
  label,
  Icon,
  items,
  open,
  onToggle,
  desktopCollapsed,
  onCloseMobile,
  alertFlags,
}: {
  id: string
  label: string
  Icon: LucideIcon
  items: PortalNavItem[]
  open: boolean
  onToggle: (id: string) => void
  desktopCollapsed: boolean
  onCloseMobile: () => void
  alertFlags: { request: boolean; reservation: boolean }
}) {
  const { pathname } = useLocation()
  const active = groupHasActive(pathname, items)
  const groupAlert = items.some((item) => alertDotForItem(item.id, alertFlags))

  const panel = (
    <ul className={nestedTreeListCls}>
      {items.map((item) => (
        <NavItemLink
          key={item.id}
          item={item}
          desktopCollapsed={false}
          onCloseMobile={onCloseMobile}
          nested
          showAlert={alertDotForItem(item.id, alertFlags)}
        />
      ))}
    </ul>
  )

  const trigger = (
    <button
      type="button"
      onClick={() => onToggle(id)}
      aria-expanded={open}
      className={cn(linkBase, 'w-full', active && !open ? linkActive : linkIdle)}
    >
      <span className="relative shrink-0">
        <Icon
          className={cn('h-[17px] w-[17px]', active ? iconActive : iconIdle)}
          strokeWidth={1.9}
          aria-hidden
        />
        {groupAlert && !open ? (
          <span
            className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-rose-500 ring-2 ring-zinc-50 dark:ring-zinc-950"
            aria-hidden
          />
        ) : null}
      </span>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {groupAlert && !open ? (
        <span className="size-2 shrink-0 rounded-full bg-rose-500" aria-label="New alerts" />
      ) : null}
      <ChevronDown
        className={cn(
          'h-3.5 w-3.5 shrink-0 text-zinc-400 transition group-hover:text-brand-500',
          open && 'rotate-180',
        )}
        aria-hidden
      />
    </button>
  )

  if (desktopCollapsed) {
    return (
      <li className="xl:block">
        <div className="hidden xl:block">
          <NavItemLink
            item={items[0]!}
            desktopCollapsed
            onCloseMobile={onCloseMobile}
            showAlert={alertDotForItem(items[0]!.id, alertFlags)}
          />
        </div>
        <div className="xl:hidden">
          {trigger}
          {open ? panel : null}
        </div>
      </li>
    )
  }

  return (
    <li>
      {trigger}
      {open ? panel : null}
    </li>
  )
}

export function PortalSidebar({
  mobileOpen,
  desktopCollapsed,
  onCloseMobile,
  displayName,
  userEmail,
  avatarUrl,
  role,
  onLogout,
}: PortalSidebarProps) {
  const { pathname } = useLocation()
  const { hasUnread, hasUnreadKind } = useNotifications()
  const alertFlags = useMemo(
    () => ({
      request: hasUnreadKind('request'),
      reservation: hasUnreadKind('reservation'),
    }),
    [hasUnreadKind],
  )
  const [menuOpen, setMenuOpen] = useState(false)
  const [openGroupId, setOpenGroupId] = useState<string | null>(null)
  const [navQuery, setNavQuery] = useState('')
  const [collapsedSearchOpen, setCollapsedSearchOpen] = useState(false)
  const menuRootRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const collapsedSearchRef = useRef<HTMLDivElement>(null)
  const hydratedRef = useRef(false)
  const searchFieldId = useId()
  const searching = normalizeSearch(navQuery).length > 0
  const visibleGroups = useMemo(() => filterNavGroups(navQuery), [navQuery])
  const matchCount = useMemo(
    () => visibleGroups.reduce((sum, group) => sum + group.items.length, 0),
    [visibleGroups],
  )

  const activeMultiGroupId = useMemo(() => {
    for (const group of portalNavGroups) {
      if (isMultiGroup(group) && groupHasActive(pathname, group.items)) return group.id
    }
    return null
  }, [pathname])

  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true
    if (activeMultiGroupId) {
      setOpenGroupId(activeMultiGroupId)
      return
    }
    try {
      const raw = sessionStorage.getItem(OPEN_GROUP_KEY)
      if (raw && portalNavGroups.some((group) => group.id === raw && isMultiGroup(group))) {
        setOpenGroupId(raw)
      }
    } catch {
      /* ignore */
    }
  }, [activeMultiGroupId])

  useEffect(() => {
    if (!hydratedRef.current) return
    if (activeMultiGroupId) setOpenGroupId(activeMultiGroupId)
  }, [activeMultiGroupId])

  useEffect(() => {
    if (!menuOpen) return
    function onDoc(event: MouseEvent) {
      if (menuRootRef.current?.contains(event.target as Node)) return
      setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  useEffect(() => {
    setNavQuery('')
    setCollapsedSearchOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!collapsedSearchOpen) return
    const timer = window.setTimeout(() => searchInputRef.current?.focus(), 20)
    function onDoc(event: MouseEvent) {
      if (collapsedSearchRef.current?.contains(event.target as Node)) return
      setCollapsedSearchOpen(false)
      setNavQuery('')
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setCollapsedSearchOpen(false)
        setNavQuery('')
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [collapsedSearchOpen])

  function toggleGroup(id: string) {
    setOpenGroupId((current) => {
      const next = current === id ? null : id
      try {
        if (next) sessionStorage.setItem(OPEN_GROUP_KEY, next)
        else sessionStorage.removeItem(OPEN_GROUP_KEY)
      } catch {
        /* ignore */
      }
      return next
    })
  }

  function clearNavQuery() {
    setNavQuery('')
    searchInputRef.current?.focus()
  }

  function renderNavGroups(groups: PortalNavGroup[], opts?: { forceExpand?: boolean; rail?: boolean }) {
    const forceExpand = Boolean(opts?.forceExpand)
    const rail = Boolean(opts?.rail)
    return groups.map((group, index) => {
      const multi = isMultiGroup(group)
      const ParentIcon = group.items[0].Icon

      return (
        <div key={group.id} className={index === 0 ? '' : 'mt-5'}>
          {!multi || forceExpand ? (
            <p
              className={cn(
                'px-2.5 pt-1 pb-1.5 text-[10px] font-semibold tracking-[0.14em] text-zinc-400 uppercase',
                rail && desktopCollapsed && !forceExpand && 'xl:hidden',
              )}
            >
              {group.heading}
            </p>
          ) : null}

          <ul className="space-y-0.5">
            {multi && !forceExpand ? (
              <CollapsibleNavGroup
                id={group.id}
                label={group.heading}
                Icon={ParentIcon}
                items={group.items}
                open={openGroupId === group.id}
                onToggle={toggleGroup}
                desktopCollapsed={rail ? desktopCollapsed : false}
                onCloseMobile={onCloseMobile}
                alertFlags={alertFlags}
              />
            ) : (
              group.items.map((item) => (
                <NavItemLink
                  key={item.id}
                  item={item}
                  desktopCollapsed={forceExpand ? false : rail ? desktopCollapsed : false}
                  onCloseMobile={() => {
                    setNavQuery('')
                    setCollapsedSearchOpen(false)
                    onCloseMobile()
                  }}
                  showAlert={alertDotForItem(item.id, alertFlags)}
                />
              ))
            )}
          </ul>
        </div>
      )
    })
  }

  const searchFieldProps = {
    value: navQuery,
    searching,
    onChange: setNavQuery,
    onClear: clearNavQuery,
    onEscapeEmpty: () => setCollapsedSearchOpen(false),
  }

  return (
    <>
      <div
        role="presentation"
        aria-hidden={!mobileOpen}
        className={cn(
          'fixed inset-0 z-40 bg-zinc-900/55 pt-[env(safe-area-inset-top,0px)] backdrop-blur-sm transition-opacity duration-200 xl:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onCloseMobile}
      />

      <aside
        id="portal-sidebar"
        className={cn(
          'portal-sidebar fixed inset-y-0 left-0 z-50 flex w-[min(17.75rem,calc(100vw-2.5rem))] flex-col border-r border-zinc-200/80 bg-zinc-50 transition-[transform,width] duration-200 ease-[cubic-bezier(0.33,1,0.68,1)] dark:border-zinc-800 dark:bg-zinc-950 xl:z-30 xl:translate-x-0',
          desktopCollapsed ? 'xl:w-[4.75rem]' : 'xl:w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full xl:translate-x-0',
        )}
      >
        <div
          className={cn(
            'flex border-b border-zinc-200/80 px-3 xl:px-3.5 dark:border-white/[0.06]',
            desktopCollapsed
              ? 'h-auto flex-col items-center gap-1 py-3 xl:px-2'
              : 'h-14 items-center justify-between sm:h-[3.5rem]',
          )}
        >
          <Link
            to="/admin"
            title={`${siteName.short} ${siteName.unit} · Admin`}
            className={cn(
              'relative flex min-w-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-500/35',
              desktopCollapsed && 'xl:justify-center',
            )}
            onClick={onCloseMobile}
          >
            <img
              src={logo}
              alt=""
              width={32}
              height={32}
              className="size-8 shrink-0 rounded-lg object-contain"
            />
            <span
              className={cn(
                'truncate text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-white',
                desktopCollapsed && 'xl:sr-only',
              )}
            >
              {siteName.short}
              <span className="text-brand-600 dark:text-brand-400"> SC</span>
            </span>
            {hasUnread ? (
              <span
                className={cn(
                  'ms-auto size-2 shrink-0 rounded-full bg-rose-500',
                  desktopCollapsed && 'xl:absolute xl:top-1 xl:right-1 xl:ms-0',
                )}
                title="New alerts"
                aria-label="New alerts"
              />
            ) : null}
          </Link>

          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 outline-none hover:bg-brand-50 hover:text-brand-700 xl:hidden dark:hover:bg-brand-500/15 dark:hover:text-brand-200"
            aria-label="Close navigation"
            onClick={onCloseMobile}
          >
            <ChevronLeft className="size-[14px] shrink-0" strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        <div
          className={cn(
            'shrink-0 px-2.5 pt-2.5 pb-1.5 xl:px-3',
            desktopCollapsed && 'xl:hidden',
          )}
        >
          <label htmlFor={searchFieldId} className="sr-only">
            Search navigation
          </label>
          <NavSearchField id={searchFieldId} inputRef={searchInputRef} {...searchFieldProps} />
          {searching ? (
            <p className="mt-1.5 px-0.5 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
              {matchCount === 0
                ? 'No matching pages'
                : `${matchCount} match${matchCount === 1 ? '' : 'es'}`}
            </p>
          ) : null}
        </div>

        {desktopCollapsed ? (
          <div ref={collapsedSearchRef} className="relative hidden shrink-0 px-2 pt-2 pb-1 xl:block">
            <button
              type="button"
              aria-label="Search navigation"
              aria-expanded={collapsedSearchOpen}
              title="Search"
              onClick={() => setCollapsedSearchOpen((open) => !open)}
              className={cn(
                'inline-flex h-9 w-full items-center justify-center rounded-xl border outline-none transition',
                collapsedSearchOpen || searching
                  ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-200'
                  : 'border-zinc-200/90 bg-white text-zinc-500 hover:border-brand-300/70 hover:text-brand-700 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-brand-500/35 dark:hover:text-brand-200',
              )}
            >
              <Search className="size-3.5" aria-hidden />
            </button>
            {collapsedSearchOpen ? (
              <div className="absolute top-0 left-[calc(100%+0.5rem)] z-50 w-[16.5rem] rounded-2xl border border-zinc-200/90 bg-white p-2.5 shadow-[0_18px_40px_-24px_rgba(30,5,65,0.55)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/50">
                <label htmlFor={`${searchFieldId}-collapsed`} className="sr-only">
                  Search navigation
                </label>
                <NavSearchField
                  id={`${searchFieldId}-collapsed`}
                  inputRef={searchInputRef}
                  {...searchFieldProps}
                />
                <div
                  data-lenis-prevent
                  className="mt-2 max-h-[min(24rem,70vh)] overflow-y-auto overscroll-contain"
                >
                  {searching && matchCount === 0 ? (
                    <p className="px-2.5 py-6 text-center text-[12px] text-zinc-400 dark:text-zinc-500">
                      No matching pages
                    </p>
                  ) : searching ? (
                    renderNavGroups(visibleGroups, { forceExpand: true })
                  ) : (
                    <p className="px-2.5 py-4 text-center text-[12px] leading-5 text-zinc-400 dark:text-zinc-500">
                      Type to filter pages in the sidebar.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <nav
          aria-label="Portal sections"
          data-lenis-prevent
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain pt-1 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            desktopCollapsed ? 'xl:px-2' : 'px-2.5 xl:px-3',
          )}
        >
          {searching && matchCount === 0 ? (
            <>
              <div
                className={cn(
                  'px-2.5 py-10 text-center',
                  desktopCollapsed && 'xl:hidden',
                )}
              >
                <p className="text-[13px] font-medium text-zinc-600 dark:text-zinc-300">
                  No matching pages
                </p>
                <p className="mt-1 text-[12px] leading-5 text-zinc-400 dark:text-zinc-500">
                  Try another keyword, or clear the search.
                </p>
                <button
                  type="button"
                  onClick={clearNavQuery}
                  className="mt-3 inline-flex h-8 items-center justify-center rounded-lg px-3 text-[12px] font-semibold text-brand-700 outline-none transition hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-500/35 dark:text-brand-300 dark:hover:bg-brand-500/10"
                >
                  Clear search
                </button>
              </div>
              {desktopCollapsed ? (
                <div className="hidden xl:block">
                  {renderNavGroups(portalNavGroups, { rail: true })}
                </div>
              ) : null}
            </>
          ) : (
            renderNavGroups(
              desktopCollapsed && collapsedSearchOpen ? portalNavGroups : visibleGroups,
              {
                forceExpand: searching && !(desktopCollapsed && collapsedSearchOpen),
                rail: true,
              },
            )
          )}
        </nav>

        <div className="shrink-0 border-t border-zinc-200/80 pb-[env(safe-area-inset-bottom,0px)]">
          <div
            ref={menuRootRef}
            className={cn('relative', desktopCollapsed ? 'px-2 py-2.5' : 'px-3 py-3 xl:px-3.5')}
          >
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title={displayName}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-2xl border border-zinc-200/80 bg-white px-2.5 py-2 text-left shadow-sm transition hover:border-brand-300/70 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-brand-500/35',
                desktopCollapsed && 'xl:justify-center xl:px-2',
              )}
            >
              <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-[10px] font-bold text-brand-800 uppercase dark:bg-brand-500/20 dark:text-brand-200">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="size-full object-cover" />
                ) : (
                  initialsFor(displayName)
                )}
              </span>
              <div className={cn('min-w-0 flex-1', desktopCollapsed && 'xl:hidden')}>
                <p className="truncate text-[13px] leading-tight font-semibold tracking-tight text-zinc-900">
                  {displayName}
                </p>
                <p className="mt-0.5 truncate text-[11px] font-medium text-zinc-500">{role}</p>
              </div>
              <ChevronsUpDown
                className={cn('h-3.5 w-3.5 shrink-0 text-zinc-400', desktopCollapsed && 'xl:hidden')}
                aria-hidden
              />
            </button>

            {menuOpen ? (
              <div
                role="menu"
                data-lenis-prevent
                className={cn(
                  'absolute bottom-[calc(100%+0.4rem)] z-50 overflow-hidden rounded-xl border border-zinc-200/90 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900',
                  desktopCollapsed
                    ? 'right-2 left-2 xl:right-auto xl:left-full xl:ml-2 xl:w-48'
                    : 'right-3 left-3 xl:right-3.5 xl:left-3.5',
                )}
              >
                {userEmail ? (
                  <p className="truncate px-3 py-2 text-[11px] text-zinc-500">{userEmail}</p>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onLogout()
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  )
}
