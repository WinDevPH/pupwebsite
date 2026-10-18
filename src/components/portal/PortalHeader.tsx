import { useEffect, useRef, useState } from 'react'
import {
  Bell,
  Bookmark,
  CheckCheck,
  ChevronRight,
  FileText,
  Inbox,
  Loader2,
  LogOut,
  Menu,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useNotifications } from '@/context/NotificationsContext'
import { formatNotificationTime } from '@/lib/notifications-api'
import { cn } from '@/lib/utils'
import { SidebarLayoutToggleIcon } from './SidebarLayoutToggleIcon'
import { breadcrumbsFor } from './nav'

function formatLiveStamp(updatedAt: number | null) {
  if (!updatedAt) return 'Waiting for updates'
  const secs = Math.max(0, Math.round((Date.now() - updatedAt) / 1000))
  if (secs < 8) return 'Live · just now'
  if (secs < 60) return `Live · ${secs}s ago`
  const mins = Math.round(secs / 60)
  if (mins < 60) return `Updated ${mins}m ago`
  return `Updated ${Math.round(mins / 60)}h ago`
}

const barHeight = 'min-h-14 h-14'

const ghostToggleCore =
  'size-10 shrink-0 items-center justify-center rounded-xl border-0 bg-transparent text-zinc-600 outline-none shadow-none ring-0 transition-[color] duration-200 hover:text-brand-800 focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:text-white'

const ghostToggle = `inline-flex ${ghostToggleCore}`
const ghostToggleCollapse = ghostToggleCore

const sep =
  'hidden h-6 w-px shrink-0 self-center bg-zinc-200/90 md:block dark:bg-white/[0.08]'

type PortalHeaderProps = {
  onMenuClick: () => void
  desktopSidebarCollapsed: boolean
  onToggleDesktopSidebar: () => void
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

export function PortalHeader({
  onMenuClick,
  desktopSidebarCollapsed,
  onToggleDesktopSidebar,
  displayName,
  userEmail,
  avatarUrl,
  role,
  onLogout,
}: PortalHeaderProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const crumbs = breadcrumbsFor(pathname)
  const {
    items,
    unread,
    unreadCount,
    hasUnread,
    markAllRead,
    markRead,
    clearAll,
    refresh,
    loading,
    refreshing,
    error,
    lastUpdatedAt,
    setPanelOpen,
  } = useNotifications()
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [liveLabel, setLiveLabel] = useState(() => formatLiveStamp(lastUpdatedAt))
  const profileRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPanelOpen(notifOpen)
  }, [notifOpen, setPanelOpen])

  useEffect(() => {
    setLiveLabel(formatLiveStamp(lastUpdatedAt))
    if (!notifOpen) return
    const timer = window.setInterval(() => {
      setLiveLabel(formatLiveStamp(lastUpdatedAt))
    }, 4000)
    return () => window.clearInterval(timer)
  }, [lastUpdatedAt, notifOpen])

  useEffect(() => {
    if (!profileOpen && !notifOpen) return
    function onDoc(event: MouseEvent) {
      const target = event.target as Node
      if (profileOpen && !profileRef.current?.contains(target)) setProfileOpen(false)
      if (notifOpen && !actionsRef.current?.contains(target)) setNotifOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setProfileOpen(false)
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [profileOpen, notifOpen])

  useEffect(() => {
    setNotifOpen(false)
    setProfileOpen(false)
  }, [pathname])

  function toggleNotifications() {
    setProfileOpen(false)
    setNotifOpen((open) => {
      const next = !open
      if (next) void refresh()
      return next
    })
  }

  function openNotification(id: string, href: string) {
    markRead(id)
    setNotifOpen(false)
    navigate(href)
  }

  return (
    <header className="portal-header sticky top-0 z-20 shrink-0 border-b border-zinc-200/80 bg-white/92 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl backdrop-saturate-150 dark:border-zinc-800 dark:bg-zinc-950/92">
      <div
        className={`mx-auto flex ${barHeight} max-w-[1920px] min-w-0 items-center gap-2 px-4 sm:gap-3 sm:px-5 lg:gap-4 lg:px-6`}
      >
        <div className="flex shrink-0 items-center gap-1.5 lg:gap-2">
          <button
            type="button"
            className={`${ghostToggle} xl:hidden`}
            aria-label="Open sidebar"
            onClick={onMenuClick}
          >
            <Menu className="size-[18px]" strokeWidth={2.25} aria-hidden />
          </button>
          <button
            type="button"
            className={`hidden xl:inline-flex ${ghostToggleCollapse}`}
            aria-label={desktopSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!desktopSidebarCollapsed}
            aria-controls="portal-sidebar"
            title={desktopSidebarCollapsed ? 'Expand sidebar' : 'Collapse to icons only'}
            onClick={onToggleDesktopSidebar}
          >
            <SidebarLayoutToggleIcon mode={desktopSidebarCollapsed ? 'expand' : 'collapse'} />
          </button>
        </div>

        <div className={sep} aria-hidden />

        <nav
          className="hidden min-w-0 flex-1 items-center gap-1.5 overflow-x-auto xl:flex [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Breadcrumb"
        >
          <ol className="flex min-w-0 flex-wrap items-center gap-1.5 ps-0.5">
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1
              return (
                <li
                  key={`${index}-${crumb.to}-${crumb.label}`}
                  className={`flex items-center gap-1.5 ${index === 0 ? 'shrink-0' : 'min-w-0'}`}
                >
                  {index > 0 ? (
                    <ChevronRight
                      className="size-[14px] shrink-0 text-zinc-400"
                      strokeWidth={2.25}
                      aria-hidden
                    />
                  ) : null}
                  {isLast ? (
                    <span
                      className="min-w-0 truncate text-[13px] font-semibold text-zinc-900 dark:text-zinc-100"
                      aria-current="page"
                    >
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      to={crumb.to}
                      className="min-w-0 truncate text-[13px] font-medium text-zinc-500 transition-colors hover:text-brand-700 dark:text-zinc-400 dark:hover:text-brand-300"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
              )
            })}
          </ol>
        </nav>

        <div className="min-w-0 flex-1 xl:hidden" aria-hidden />

        <div ref={actionsRef} className="relative flex shrink-0 items-center gap-1">
          <ThemeToggle variant="ghost" className="shrink-0" />

          <div ref={notifRef} className="shrink-0">
            <button
              type="button"
              title="Notifications"
              aria-label={
                hasUnread
                  ? `Notifications, ${unreadCount} unread`
                  : 'Notifications'
              }
              aria-haspopup="menu"
              aria-expanded={notifOpen}
              onClick={toggleNotifications}
              className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-xl border-0 bg-transparent text-zinc-500 outline-none transition-[color] duration-200 hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:text-brand-300"
            >
              <Bell className="size-[17px]" strokeWidth={2} aria-hidden />
              {hasUnread ? (
                <span className="absolute top-1.5 right-1.5 flex size-2.5" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-60" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-950" />
                </span>
              ) : null}
            </button>
          </div>

          <div className={sep} aria-hidden />

          <div ref={profileRef} className="relative ms-0.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setNotifOpen(false)
                setProfileOpen((open) => !open)
              }}
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              title={displayName}
              aria-label={`Account menu · ${displayName}`}
              className="inline-flex size-10 items-center justify-center rounded-xl outline-none transition hover:bg-brand-50/80 focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:bg-brand-500/12"
            >
              <span className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-[10px] font-bold text-brand-800 uppercase ring-[1.5px] ring-black/[0.04] ring-inset dark:bg-brand-500/20 dark:text-brand-200">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="size-full object-cover" />
                ) : (
                  initialsFor(displayName)
                )}
              </span>
            </button>

            {profileOpen ? (
              <div
                role="menu"
                aria-label="Account"
                className="absolute top-[calc(100%+0.4rem)] right-0 z-50 w-[min(16rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-zinc-200/90 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-[#161222]"
              >
                <div className="border-b border-zinc-100 px-3 py-2.5 dark:border-white/[0.06]">
                  <p className="truncate text-[13px] font-semibold text-zinc-900">{displayName}</p>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-zinc-500">
                    {role}
                    {userEmail ? ` · ${userEmail}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileOpen(false)
                    onLogout()
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12.5px] font-medium text-rose-600 hover:bg-rose-50',
                    'dark:text-rose-400 dark:hover:bg-rose-500/10',
                  )}
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>

          {notifOpen ? (
            <div
              role="menu"
              aria-label="Notifications"
              data-lenis-prevent
              className={cn(
                'absolute top-[calc(100%+0.4rem)] right-0 z-50 flex max-h-[min(70vh,26rem)] w-[min(22.5rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-lg',
                'dark:border-white/10 dark:bg-[#161222]',
              )}
            >
              <div className="shrink-0 border-b border-zinc-100 px-3.5 py-3 dark:border-white/[0.06]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                        Notifications
                      </p>
                      {unreadCount > 0 ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      <span
                        className={cn(
                          'inline-flex size-1.5 rounded-full',
                          error
                            ? 'bg-amber-500'
                            : refreshing
                              ? 'animate-pulse bg-brand-500'
                              : 'bg-emerald-500',
                        )}
                        aria-hidden
                      />
                      {error
                        ? 'Could not refresh'
                        : refreshing
                          ? 'Refreshing…'
                          : liveLabel}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Refresh notifications"
                    disabled={refreshing}
                    onClick={() => void refresh()}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 outline-none transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-brand-500/35 disabled:opacity-50 dark:hover:bg-white/5 dark:hover:text-zinc-200"
                  >
                    <RefreshCw
                      className={cn('size-3.5', refreshing && 'animate-spin')}
                      aria-hidden
                    />
                  </button>
                </div>

                {items.length > 0 ? (
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={unread.length === 0}
                      onClick={() => markAllRead()}
                      className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-200/90 bg-white px-2 text-[11px] font-semibold text-zinc-700 outline-none transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 focus-visible:ring-2 focus-visible:ring-brand-500/30 disabled:pointer-events-none disabled:opacity-40 dark:border-white/10 dark:bg-transparent dark:text-zinc-300 dark:hover:border-brand-500/35 dark:hover:bg-brand-500/10 dark:hover:text-brand-200"
                    >
                      <CheckCheck className="size-3.5" aria-hidden />
                      Mark read
                    </button>
                    <button
                      type="button"
                      onClick={() => clearAll()}
                      className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-200/90 bg-white px-2 text-[11px] font-semibold text-zinc-700 outline-none transition hover:border-maroon-300 hover:bg-maroon-50 hover:text-maroon-800 focus-visible:ring-2 focus-visible:ring-maroon-500/25 dark:border-white/10 dark:bg-transparent dark:text-zinc-300 dark:hover:border-maroon-500/35 dark:hover:bg-maroon-500/10 dark:hover:text-maroon-200"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Clear
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {loading && items.length === 0 ? (
                  <div className="space-y-2 px-3.5 py-4">
                    {[0, 1, 2].map((row) => (
                      <div
                        key={row}
                        className="flex animate-pulse items-start gap-2.5 rounded-xl bg-zinc-50/80 px-2.5 py-3 dark:bg-white/[0.03]"
                      >
                        <span className="size-8 shrink-0 rounded-lg bg-zinc-200/90 dark:bg-white/10" />
                        <span className="min-w-0 flex-1 space-y-2 pt-0.5">
                          <span className="block h-3 w-2/3 rounded bg-zinc-200/90 dark:bg-white/10" />
                          <span className="block h-2.5 w-full rounded bg-zinc-200/70 dark:bg-white/[0.07]" />
                          <span className="block h-2 w-1/3 rounded bg-zinc-200/60 dark:bg-white/[0.06]" />
                        </span>
                      </div>
                    ))}
                  </div>
                ) : error && items.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <span className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
                      <Bell className="size-5" aria-hidden />
                    </span>
                    <p className="mt-3 text-[13px] font-semibold text-zinc-800 dark:text-zinc-100">
                      Couldn’t load alerts
                    </p>
                    <p className="mt-1 text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">
                      Check your connection, then try again.
                    </p>
                    <button
                      type="button"
                      onClick={() => void refresh()}
                      className="mt-4 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand-700 px-3.5 text-[12px] font-semibold text-white outline-none transition hover:bg-brand-800 focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:bg-brand-600 dark:hover:bg-brand-500"
                    >
                      {refreshing ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : (
                        <RefreshCw className="size-3.5" aria-hidden />
                      )}
                      Retry
                    </button>
                  </div>
                ) : items.length === 0 ? (
                  <div className="px-5 py-11 text-center">
                    <span className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-zinc-200/90 bg-gradient-to-b from-white to-zinc-50 text-brand-700 shadow-sm dark:border-white/10 dark:from-white/[0.04] dark:to-transparent dark:text-brand-300 dark:shadow-none">
                      <Inbox className="size-5" aria-hidden />
                    </span>
                    <p className="mt-3 text-[13px] font-semibold text-zinc-800 dark:text-zinc-100">
                      You’re all caught up
                    </p>
                    <p className="mx-auto mt-1 max-w-[16rem] text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">
                      Open requests and reservations appear here in real time.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-zinc-100 dark:divide-white/[0.06]">
                    {items.map((item) => {
                      const isUnread = unread.some((entry) => entry.id === item.id)
                      const Icon = item.kind === 'reservation' ? Bookmark : FileText
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => openNotification(item.id, item.href)}
                            className={cn(
                              'flex w-full items-start gap-2.5 px-3.5 py-3 text-left transition hover:bg-brand-50/70 dark:hover:bg-brand-500/10',
                              isUnread && 'bg-brand-50/45 dark:bg-brand-500/10',
                            )}
                          >
                            <span
                              className={cn(
                                'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
                                item.kind === 'reservation'
                                  ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
                                  : 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
                              )}
                            >
                              <Icon className="size-3.5" aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-start justify-between gap-2">
                                <span className="line-clamp-1 text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
                                  {item.title}
                                </span>
                                {isUnread ? (
                                  <span
                                    className="mt-1 size-1.5 shrink-0 rounded-full bg-rose-500"
                                    aria-hidden
                                  />
                                ) : null}
                              </span>
                              <span className="mt-0.5 line-clamp-2 text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">
                                {item.body}
                              </span>
                              <span className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                                <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-500 uppercase dark:bg-white/[0.06] dark:text-zinc-400">
                                  {item.kind === 'reservation' ? 'Reservation' : 'Request'}
                                </span>
                                <span aria-hidden>·</span>
                                <span>{formatNotificationTime(item.createdAt)}</span>
                              </span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              <div className="shrink-0 border-t border-zinc-100 px-2 py-1.5 dark:border-white/[0.06]">
                <div className="grid grid-cols-2 gap-1">
                  <Link
                    to="/admin/requests"
                    role="menuitem"
                    onClick={() => setNotifOpen(false)}
                    className="rounded-lg px-2.5 py-2 text-center text-[12px] font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
                  >
                    Requests
                  </Link>
                  <Link
                    to="/admin/reservations"
                    role="menuitem"
                    onClick={() => setNotifOpen(false)}
                    className="rounded-lg px-2.5 py-2 text-center text-[12px] font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
                  >
                    Reservations
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
