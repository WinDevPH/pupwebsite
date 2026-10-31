import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router-dom'
import {
  listAdminNotifications,
  type AdminNotification,
  type NotificationKind,
} from '@/lib/notifications-api'

const SEEN_KEY = 'pup-admin-notification-seen-v2'
const CLEARED_KEY = 'pup-admin-notification-cleared-v2'

const POLL_IDLE_MS = 20000
const POLL_OPEN_MS = 8000
const MAX_STORED_IDS = 300

type NotificationsContextValue = {
  items: AdminNotification[]
  unread: AdminNotification[]
  unreadCount: number
  hasUnread: boolean
  hasUnreadKind: (kind: NotificationKind) => boolean
  kindCount: (kind: NotificationKind) => number
  loading: boolean
  refreshing: boolean
  error: string | null
  lastUpdatedAt: number | null
  refresh: () => Promise<void>
  markAllRead: () => void
  markRead: (id: string) => void
  clearAll: () => void
  setPanelOpen: (open: boolean) => void
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined)

function readIdSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

function writeIdSet(key: string, ids: Set<string>) {
  try {
    const keep = [...ids].slice(-MAX_STORED_IDS)
    localStorage.setItem(key, JSON.stringify(keep))
  } catch {
    /* ignore */
  }
}

function pruneToKnown(ids: Set<string>, known: Set<string>) {
  const next = new Set<string>()
  for (const id of ids) {
    if (known.has(id)) next.add(id)
  }
  return next
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const emptyCounts = { request: 0, reservation: 0, feedback: 0, chat: 0, total: 0 }
  const [rawItems, setRawItems] = useState<AdminNotification[]>([])
  const [counts, setCounts] = useState(emptyCounts)
  const [seenIds, setSeenIds] = useState<Set<string>>(() => readIdSet(SEEN_KEY))
  const [clearedIds, setClearedIds] = useState<Set<string>>(() => readIdSet(CLEARED_KEY))
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const inFlightRef = useRef(false)
  const wasPanelOpenRef = useRef(false)

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setRefreshing(true)
    const result = await listAdminNotifications()
    inFlightRef.current = false
    setRefreshing(false)

    if (!result.ok) {
      setError(result.error)
      setLoading(false)
      return
    }

    const nextItems = result.data.items
    const knownIds = new Set(nextItems.map((item) => item.id))
    setRawItems(nextItems)
    setCounts({
      request: result.data.counts?.request ?? 0,
      reservation: result.data.counts?.reservation ?? 0,
      feedback: result.data.counts?.feedback ?? 0,
      chat: result.data.counts?.chat ?? 0,
      total: result.data.counts?.total ?? nextItems.length,
    })
    setError(null)
    setLastUpdatedAt(Date.now())

    setSeenIds((prev) => {
      const pruned = pruneToKnown(prev, knownIds)
      for (const id of prev) {
        if (id.startsWith('chat:')) continue
        if (!knownIds.has(id) && pruned.size < MAX_STORED_IDS) pruned.add(id)
      }
      writeIdSet(SEEN_KEY, pruned)
      return pruned
    })
    setClearedIds((prev) => {
      const pruned = pruneToKnown(prev, knownIds)
      writeIdSet(CLEARED_KEY, pruned)
      return pruned
    })

    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const intervalMs = panelOpen ? POLL_OPEN_MS : POLL_IDLE_MS
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      void refresh()
    }, intervalMs)

    function onFocus() {
      void refresh()
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') void refresh()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [panelOpen, refresh])

  const visibleItems = useMemo(
    () => rawItems.filter((item) => !clearedIds.has(item.id)),
    [rawItems, clearedIds],
  )

  const items = useMemo(
    () => visibleItems.filter((item) => item.kind !== 'chat'),
    [visibleItems],
  )

  const unread = useMemo(
    () => items.filter((item) => !seenIds.has(item.id)),
    [items, seenIds],
  )

  const unreadChat = useMemo(
    () => visibleItems.filter((item) => item.kind === 'chat' && !seenIds.has(item.id)),
    [seenIds, visibleItems],
  )

  const markRead = useCallback((id: string) => {
    setSeenIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      writeIdSet(SEEN_KEY, next)
      return next
    })
  }, [])

  const markAllRead = useCallback(() => {
    setSeenIds((prev) => {
      const next = new Set(prev)
      for (const item of items) {
        if (item.kind === 'chat') continue
        next.add(item.id)
      }
      writeIdSet(SEEN_KEY, next)
      return next
    })
  }, [items])

  const clearAll = useCallback(() => {
    setClearedIds((prev) => {
      const next = new Set(prev)
      for (const item of rawItems) {
        if (item.kind === 'chat') continue
        next.add(item.id)
      }
      writeIdSet(CLEARED_KEY, next)
      return next
    })
    setSeenIds((prev) => {
      const next = new Set(prev)
      for (const item of rawItems) {
        if (item.kind === 'chat') continue
        next.add(item.id)
      }
      writeIdSet(SEEN_KEY, next)
      return next
    })
  }, [rawItems])

  // Mark everything read when the panel closes after being open (user reviewed the list).
  useEffect(() => {
    if (wasPanelOpenRef.current && !panelOpen && items.length > 0) {
      markAllRead()
    }
    wasPanelOpenRef.current = panelOpen
  }, [panelOpen, items, markAllRead])

  // Visiting a request/reservation detail marks that alert read.
  useEffect(() => {
    const path = location.pathname
    const requestMatch = path.match(/^\/admin\/requests\/(\d+)\/?$/)
    if (requestMatch?.[1]) {
      markRead(`request:${requestMatch[1]}`)
      return
    }
    const reservationMatch = path.match(/^\/admin\/reservations\/(\d+)(?:\/edit)?\/?$/)
    if (reservationMatch?.[1]) {
      markRead(`reservation:${reservationMatch[1]}`)
      return
    }
    const feedbackMatch = path.match(/^\/admin\/feedback\/?$/)
    if (feedbackMatch) {
      const openId = new URLSearchParams(location.search).get('open')
      if (openId) markRead(`feedback:${openId}`)
    }
  }, [location.pathname, location.search, markRead])

  const hasUnreadKind = useCallback(
    (kind: NotificationKind) =>
      kind === 'chat'
        ? unreadChat.length > 0
        : unread.some((item) => item.kind === kind),
    [unread, unreadChat],
  )

  const kindCount = useCallback(
    (kind: NotificationKind) => (kind === 'chat' ? unreadChat.length : counts[kind] ?? 0),
    [counts, unreadChat],
  )

  const value = useMemo<NotificationsContextValue>(
    () => ({
      items,
      unread,
      unreadCount: unread.length,
      hasUnread: unread.length > 0,
      hasUnreadKind,
      kindCount,
      loading,
      refreshing,
      error,
      lastUpdatedAt,
      refresh,
      markAllRead,
      markRead,
      clearAll,
      setPanelOpen,
    }),
    [
      items,
      unread,
      hasUnreadKind,
      kindCount,
      loading,
      refreshing,
      error,
      lastUpdatedAt,
      refresh,
      markAllRead,
      markRead,
      clearAll,
    ],
  )

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationsProvider')
  }
  return ctx
}
