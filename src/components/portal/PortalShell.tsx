import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { setPageScrollLocked } from '@/hooks/useLenis'
import {
  AUTH_USER_EVENT,
  clearStoredAuthUser,
  isManagerRole,
  loginPathWithNext,
  logoutRequest,
  meRequest,
  readStoredAuthUser,
  writeStoredAuthUser,
  type AuthUser,
} from '@/lib/auth-api'
import { NotificationsProvider } from '@/context/NotificationsContext'
import { PortalHeader } from './PortalHeader'
import { PortalSidebar } from './PortalSidebar'

const SIDEBAR_COLLAPSED_KEY = 'pup-portal-desktop-sidebar-collapsed'

function readCollapsedPref(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function writeCollapsedPref(collapsed: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function PortalShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState<AuthUser | null>(() => readStoredAuthUser())
  const [authState, setAuthState] = useState<'checking' | 'ok' | 'denied'>('checking')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(readCollapsedPref)

  useEffect(() => {
    let cancelled = false

    void meRequest().then((result) => {
      if (cancelled) return
      if (!result.ok || !isManagerRole(result.data.user.role)) {
        clearStoredAuthUser()
        setUser(null)
        setAuthState('denied')
        return
      }
      writeStoredAuthUser(result.data.user)
      setUser(result.data.user)
      setAuthState('ok')
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function onAuthUser(event: Event) {
      const next = (event as CustomEvent<AuthUser>).detail
      if (next?.email) setUser(next)
    }
    window.addEventListener(AUTH_USER_EVENT, onAuthUser)
    return () => window.removeEventListener(AUTH_USER_EVENT, onAuthUser)
  }, [])

  useEffect(() => {
    queueMicrotask(() => setMobileNavOpen(false))
  }, [location.pathname])

  useEffect(() => {
    if (!mobileNavOpen) return
    function onEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileNavOpen(false)
    }
    window.addEventListener('keydown', onEsc)
    setPageScrollLocked(true)
    return () => {
      window.removeEventListener('keydown', onEsc)
      setPageScrollLocked(false)
    }
  }, [mobileNavOpen])

  useEffect(() => {
    writeCollapsedPref(desktopSidebarCollapsed)
  }, [desktopSidebarCollapsed])

  async function handleLogout() {
    await logoutRequest()
    clearStoredAuthUser()
    setUser(null)
    setMobileNavOpen(false)
    navigate('/login', { replace: true })
  }

  if (authState === 'denied') {
    return (
      <Navigate
        to={loginPathWithNext(`${location.pathname}${location.search}`)}
        replace
      />
    )
  }

  if (authState === 'checking' || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
        <div className="inline-flex items-center gap-2 text-sm font-medium">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Checking sign-in…
        </div>
      </div>
    )
  }

  const displayName = user.fullName.trim() || user.email
  const roleLabel = user.role.trim() || 'Officer'

  return (
    <NotificationsProvider>
      <div className="portal-shell min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <div className="flex min-h-screen">
          <PortalSidebar
            mobileOpen={mobileNavOpen}
            desktopCollapsed={desktopSidebarCollapsed}
            onCloseMobile={() => setMobileNavOpen(false)}
            displayName={displayName}
            userEmail={user.email}
            avatarUrl={user.avatarUrl}
            role={roleLabel}
            onLogout={() => void handleLogout()}
          />
          <div
            className={`flex min-w-0 flex-1 flex-col transition-[padding] duration-200 ease-[cubic-bezier(0.33,1,0.68,1)] ${
              desktopSidebarCollapsed ? 'xl:pl-[4.75rem]' : 'xl:pl-64'
            }`}
          >
            <PortalHeader
              onMenuClick={() => setMobileNavOpen(true)}
              desktopSidebarCollapsed={desktopSidebarCollapsed}
              onToggleDesktopSidebar={() => setDesktopSidebarCollapsed((value) => !value)}
              displayName={displayName}
              userEmail={user.email}
              avatarUrl={user.avatarUrl}
              role={roleLabel}
              onLogout={() => void handleLogout()}
            />
            <div className="flex flex-1 flex-col">
              <div className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 px-3 py-3.5 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:px-5 sm:py-7 sm:pb-[max(1.75rem,env(safe-area-inset-bottom,0px))] lg:px-10 lg:py-8 lg:pb-[max(3rem,env(safe-area-inset-bottom,0px))]">
                <Outlet />
              </div>
            </div>
          </div>
        </div>
      </div>
    </NotificationsProvider>
  )
}
