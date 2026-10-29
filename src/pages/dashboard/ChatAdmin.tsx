import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CircleUser,
  Clock3,
  Inbox,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Shield,
  Trash2,
} from 'lucide-react'
import studentCouncilLogo from '@/assets/org-logos/student-council.png'
import { useOrganizations } from '@/hooks/useOrganizations'
import { AUTH_USER_EVENT, readStoredAuthUser } from '@/lib/auth-api'
import { userInitials } from '@/lib/users-api'
import { RequireLoginRedirect } from '@/components/portal/RequireLoginRedirect'
import {
  catalogInput,
  catalogSegIcon,
  catalogToolbarIconBtn,
  workspaceCatalogPadCls,
  workspaceCatalogSegTrackInlineCls,
  workspaceCatalogShellCls,
  workspaceCatalogToolbarActionsRowCls,
  workspaceCatalogToolbarIconCls,
  workspaceCatalogToolbarMainRowCls,
  workspaceCatalogToolbarSearchFieldCls,
  workspaceCatalogToolbarSearchRowCls,
  workspaceTenantMainStackCls,
} from '@/components/portal/register-ui'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import {
  deleteChatThread,
  getChatThreadById,
  listChatThreads,
  pingChatTyping,
  replyChatThread,
  type ChatMessageRecord,
  type ChatThreadRecord,
} from '@/lib/chat-api'
import { ChatFaqsEditor } from '@/components/chat/ChatFaqsEditor'
import { ChatTimeRule } from '@/components/chat/ChatTimeRule'
import { formatChatClock, formatPhDateTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import { ConfirmDeleteDialog } from '@/components/portal/ConfirmDeleteDialog'
import { useNotifications } from '@/context/NotificationsContext'

type ThreadFilter = 'all' | 'waiting' | 'replied'
type ChatAdminView = 'inbox' | 'faqs'

function previewLabel(thread: ChatThreadRecord) {
  return thread.preview.trim() || 'New conversation'
}

function isWaiting(thread: ChatThreadRecord) {
  return thread.unread ?? thread.lastRole === 'visitor'
}

function sameThreadSnapshot(prev: ChatThreadRecord | null, next: ChatThreadRecord) {
  if (!prev || prev.id !== next.id) return false
  if (prev.visitorTyping !== next.visitorTyping) return false
  const older = prev.messages ?? []
  const newer = next.messages ?? []
  if (older.length !== newer.length) return false
  const lastOld = older[older.length - 1]
  const lastNew = newer[newer.length - 1]
  return lastOld?.id === lastNew?.id && lastOld?.body === lastNew?.body
}

function isNearBottom(node: HTMLElement) {
  return node.scrollHeight - node.scrollTop - node.clientHeight < 96
}

function roleLabel(role: ChatMessageRecord['role']) {
  if (role === 'visitor') return 'Visitor'
  if (role === 'staff') return 'Officer'
  return 'Council'
}

function OfficerAvatar({ src, name }: { src: string; name: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={32}
        height={32}
        className="size-8 shrink-0 rounded-full bg-white object-cover ring-1 ring-brand-200 dark:ring-brand-400/40"
      />
    )
  }
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-700 text-[10px] font-semibold text-white">
      {userInitials(name || 'Council')}
    </span>
  )
}

export default function ChatAdmin() {
  const { refresh: refreshAlerts, markRead } = useNotifications()
  const { items: orgs } = useOrganizations()
  const [officer, setOfficer] = useState(() => readStoredAuthUser())
  const councilLogo =
    orgs.find((org) => org.id === 'student-council')?.logo.trim() || studentCouncilLogo
  const officerPhoto = officer?.avatarUrl?.trim() || councilLogo
  const officerName = officer?.fullName.trim() || 'Council'
  const [threads, setThreads] = useState<ChatThreadRecord[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [active, setActive] = useState<ChatThreadRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadBusy, setReloadBusy] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ThreadFilter>('all')
  const [view, setView] = useState<ChatAdminView>('inbox')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ChatThreadRecord | null>(null)
  const [toast, setToast] = useState<SnackToast | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const pinToBottomRef = useRef(true)
  const forceScrollRef = useRef(false)

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  const loadThreads = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (opts?.soft) setReloadBusy(true)
      const result = await listChatThreads()
      if (!result.ok) {
        if (result.status === 401 || result.status === 403) setNeedsLogin(true)
        else showToast(result.error, 'error')
        setLoading(false)
        setReloadBusy(false)
        return
      }
      setNeedsLogin(false)
      setThreads(result.data.items)
      setLoading(false)
      setReloadBusy(false)
    },
    [showToast],
  )

  const loadThread = useCallback(async (id: number) => {
    const result = await getChatThreadById(id)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) setNeedsLogin(true)
      return
    }
    setActive((prev) => (sameThreadSnapshot(prev, result.data.item) ? prev : result.data.item))
  }, [])

  useEffect(() => {
    function syncUser() {
      setOfficer(readStoredAuthUser())
    }
    window.addEventListener(AUTH_USER_EVENT, syncUser)
    return () => window.removeEventListener(AUTH_USER_EVENT, syncUser)
  }, [])

  useEffect(() => {
    void loadThreads()
  }, [loadThreads])

  useEffect(() => {
    if (activeId == null) {
      setActive(null)
      return
    }
    pinToBottomRef.current = true
    forceScrollRef.current = true
    void loadThread(activeId)
  }, [activeId, loadThread])

  useEffect(() => {
    if (view !== 'inbox') return
    const inbox = window.setInterval(() => void loadThreads({ soft: true }), 3000)
    const live = window.setInterval(() => {
      if (activeId != null) void loadThread(activeId)
    }, 1200)
    return () => {
      window.clearInterval(inbox)
      window.clearInterval(live)
    }
  }, [activeId, loadThread, loadThreads, view])

  useEffect(() => {
    if (activeId == null) return
    const live = draft.trim().length > 0 && !sending
    if (!live) {
      void pingChatTyping({ typing: false, threadId: activeId })
      return
    }
    void pingChatTyping({ typing: true, threadId: activeId })
    const id = window.setInterval(() => void pingChatTyping({ typing: true, threadId: activeId }), 1200)
    return () => window.clearInterval(id)
  }, [activeId, draft, sending])

  useEffect(() => {
    return () => {
      if (activeId != null) void pingChatTyping({ typing: false, threadId: activeId })
    }
  }, [activeId])

  useEffect(() => {
    if (!forceScrollRef.current && !pinToBottomRef.current) return
    const node = listRef.current
    if (node) node.scrollTop = node.scrollHeight
    forceScrollRef.current = false
  }, [active?.id, active?.messages, active?.visitorTyping])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const counts = useMemo(
    () => ({
      all: threads.length,
      waiting: threads.filter((item) => isWaiting(item)).length,
      replied: threads.filter((item) => !isWaiting(item)).length,
    }),
    [threads],
  )

  const mobileOpen = activeId != null

  function selectThread(id: number) {
    setActiveId(id)
    markRead(`chat:${id}`)
  }

  function closeThread() {
    setActiveId(null)
    setActive(null)
    setDraft('')
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return threads.filter((thread) => {
      if (filter === 'waiting' && !isWaiting(thread)) return false
      if (filter === 'replied' && isWaiting(thread)) return false
      if (!needle) return true
      return `${thread.id} ${thread.preview}`.toLowerCase().includes(needle)
    })
  }, [filter, query, threads])

  async function onReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (activeId == null || sending) return
    const text = draft.trim()
    if (!text) return
    setSending(true)
    void pingChatTyping({ typing: false, threadId: activeId })
    const result = await replyChatThread(activeId, text)
    setSending(false)
    if (!result.ok) {
      showToast(result.error, 'error')
      return
    }
    setDraft('')
    pinToBottomRef.current = true
    forceScrollRef.current = true
    setActive(result.data.item)
    void loadThreads({ soft: true })
    void refreshAlerts()
  }

  if (needsLogin) return <RequireLoginRedirect />

  return (
    <div
      className={cn(
        workspaceTenantMainStackCls,
        mobileOpen && 'max-lg:h-[calc(100dvh-6.75rem)] max-lg:overflow-hidden',
        'lg:h-[calc(100dvh-9.25rem)] lg:max-h-[calc(100dvh-9.25rem)] lg:overflow-hidden',
      )}
    >
      <div className={cn('flex flex-col gap-3 sm:gap-4 md:flex-row md:items-start md:justify-between md:gap-6', mobileOpen && view === 'inbox' && 'max-lg:hidden')}>
        <div className="min-w-0 space-y-1">
          <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900 sm:text-[22px] dark:text-zinc-50">
            Chat
          </h1>
          <p className="max-w-xl text-[13px] leading-6 text-zinc-500 dark:text-zinc-400">
            {view === 'faqs'
              ? 'Edit the suggested questions shown in the help desk. Published items appear for visitors, in this order.'
              : 'Reply to visitor messages.'}
          </p>
        </div>
        <div role="radiogroup" aria-label="Chat view" className={workspaceCatalogSegTrackInlineCls}>
          {(
            [
              { key: 'inbox' as const, icon: Inbox, label: 'Inbox' },
              { key: 'faqs' as const, icon: CircleHelp, label: 'Suggested questions' },
            ] as const
          ).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={view === key}
              title={label}
              aria-label={label}
              onClick={() => {
                setView(key)
                if (key === 'faqs') closeThread()
              }}
              className={cn(catalogSegIcon(view === key), 'w-auto gap-1.5 px-3 max-sm:w-auto')}
            >
              <Icon className={`${workspaceCatalogToolbarIconCls} opacity-85`} aria-hidden />
              <span className="hidden text-[12px] font-semibold sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {view === 'faqs' ? (
        <ChatFaqsEditor showToast={showToast} />
      ) : (
        <>
      <section aria-label="Chat filters" className={cn('w-full max-w-none', mobileOpen && 'max-lg:hidden')}>
        <div className={`${workspaceCatalogShellCls} ${workspaceCatalogPadCls} w-full max-w-none`}>
          <div className="flex w-full min-w-0 flex-col gap-2.5 sm:gap-3">
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
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search conversations"
                    aria-label="Search conversations"
                    className={`${catalogInput} min-w-0 w-full pl-9`}
                  />
                </div>
                <button
                  type="button"
                  title="Reload conversations"
                  aria-label="Reload conversations"
                  onClick={() => void loadThreads({ soft: true })}
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
                  title="Reload conversations"
                  aria-label="Reload conversations"
                  onClick={() => void loadThreads({ soft: true })}
                  className={`${catalogToolbarIconBtn} max-sm:hidden`}
                >
                  <RefreshCw
                    className={`${workspaceCatalogToolbarIconCls} ${reloadBusy ? 'animate-spin' : 'opacity-85'}`}
                    aria-hidden
                  />
                </button>
                <div role="radiogroup" aria-label="Conversation filter" className={workspaceCatalogSegTrackInlineCls}>
                  {(
                    [
                      { key: 'all' as const, icon: Inbox, label: 'All' },
                      { key: 'waiting' as const, icon: Clock3, label: 'Waiting' },
                      { key: 'replied' as const, icon: Shield, label: 'Replied' },
                    ] as const
                  ).map(({ key, icon: Icon, label }) => (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={filter === key}
                      title={`${label} (${counts[key]})`}
                      aria-label={`${label} (${counts[key]})`}
                      onClick={() => setFilter(key)}
                      className={catalogSegIcon(filter === key)}
                    >
                      <Icon className={`${workspaceCatalogToolbarIconCls} opacity-85`} aria-hidden />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex min-h-[24rem] flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 lg:grid lg:min-h-0 lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)]">
        <aside
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-hidden border-zinc-100 dark:border-zinc-800',
            mobileOpen ? 'max-lg:hidden' : 'max-lg:min-h-[28rem]',
            'lg:h-full lg:flex lg:border-r',
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <p className="inline-flex items-center gap-2 text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
              <Inbox className="size-4 text-brand-700" aria-hidden />
              Inbox
            </p>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800 dark:bg-brand-500/15 dark:text-brand-200">
              {counts.waiting} waiting
            </span>
          </div>
          <div
            data-lenis-prevent
            onWheel={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            {loading ? (
              <p className="flex items-center gap-2 px-4 py-8 text-sm text-zinc-500">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading conversations…
              </p>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center px-5 py-10 text-center">
                <MessageCircle className="mb-3 size-10 text-brand-600/40" strokeWidth={1.4} aria-hidden />
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">No conversations</p>
                <p className="mt-1 text-[13px] leading-5 text-zinc-500">
                  {threads.length === 0
                    ? 'Visitor messages from the homepage will land here.'
                    : 'Nothing matches this search or filter.'}
                </p>
              </div>
            ) : (
              <ul>
                {visible.map((thread) => {
                  const selected = thread.id === activeId
                  return (
                    <li key={thread.id}>
                      <button
                        type="button"
                        onClick={() => selectThread(thread.id)}
                        className={cn(
                          'flex w-full items-start gap-3 border-b border-zinc-100 px-4 py-3.5 text-left transition-colors dark:border-zinc-800',
                          selected
                            ? 'border-l-2 border-l-brand-700 bg-brand-50 dark:border-l-brand-400 dark:bg-brand-500/10'
                            : 'border-l-2 border-l-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full',
                            isWaiting(thread)
                              ? 'bg-brand-700 text-white'
                              : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300',
                          )}
                        >
                          <CircleUser className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                              Visitor #{thread.id}
                            </span>
                            {isWaiting(thread) ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-800 dark:bg-brand-500/20 dark:text-brand-200">
                                <Clock3 className="size-2.5" aria-hidden />
                                New
                              </span>
                            ) : (
                              <CheckCircle2 className="size-3.5 text-zinc-400" aria-hidden />
                            )}
                          </span>
                          <span
                            className={cn(
                              'mt-0.5 line-clamp-2 text-[13px] leading-5',
                              thread.visitorTyping ? 'font-medium text-brand-700 dark:text-brand-300' : 'text-zinc-500',
                            )}
                          >
                            {thread.visitorTyping ? 'Visitor is typing…' : previewLabel(thread)}
                          </span>
                          <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-zinc-400">
                            <Clock3 className="size-3" aria-hidden />
                            {formatPhDateTime(thread.updatedAt ?? thread.createdAt)}
                          </span>
                        </span>
                        <ChevronRight className="mt-2 size-4 shrink-0 text-zinc-300 lg:hidden" aria-hidden />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>

        <section
          className={cn(
            'min-w-0 flex-col overflow-hidden bg-zinc-50/70 dark:bg-zinc-950',
            mobileOpen ? 'flex min-h-0 flex-1' : 'hidden',
            'lg:flex lg:h-full lg:min-h-0',
          )}
        >
          {!mobileOpen ? (
            <div className="hidden flex-1 flex-col items-center justify-center gap-3 px-6 text-center lg:flex">
              <span className="flex size-14 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-brand-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <MessageCircle className="size-6" strokeWidth={1.6} aria-hidden />
              </span>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Select a conversation</p>
              <p className="max-w-xs text-[13px] leading-5 text-zinc-500">
                Choose a visitor on the left to read the thread and send an official reply.
              </p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <header className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 bg-white px-3 py-3 sm:gap-3 sm:px-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={closeThread}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 lg:hidden"
                    aria-label="Back to inbox"
                  >
                    <ChevronLeft className="size-5" aria-hidden />
                  </button>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                    <CircleUser className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Visitor #{active?.id ?? activeId}
                    </p>
                    <p className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500">
                      {active?.visitorTyping ? (
                        'Visitor is typing…'
                      ) : (
                        <>
                          <Clock3 className="size-3" aria-hidden />
                          {active?.createdAt ? `Started ${formatPhDateTime(active.createdAt)}` : 'Loading…'}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => active && setPendingDelete(active)}
                  disabled={!active}
                  className="inline-flex size-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-maroon-700 disabled:opacity-40 dark:hover:bg-zinc-800"
                  aria-label="Delete conversation"
                  title="Delete conversation"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </header>

              <div
                ref={listRef}
                data-lenis-prevent
                onWheel={(event) => event.stopPropagation()}
                onTouchMove={(event) => event.stopPropagation()}
                onScroll={(event) => {
                  pinToBottomRef.current = isNearBottom(event.currentTarget)
                }}
                className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {!active ? (
                  <p className="flex items-center gap-2 text-sm text-zinc-500">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Opening conversation…
                  </p>
                ) : null}
                {(active?.messages ?? []).map((item, index, list) => {
                  const visitor = item.role === 'visitor'
                  const clock = formatChatClock(item.createdAt)
                  return (
                    <div key={item.id} className="w-full min-w-0">
                      <ChatTimeRule at={item.createdAt} previous={list[index - 1]?.createdAt} />
                      <div className={cn('flex items-end gap-2', visitor ? 'justify-start' : 'flex-row-reverse')}>
                        {visitor ? (
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-zinc-500 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700">
                            <CircleUser className="size-3.5" aria-hidden />
                          </span>
                        ) : (
                          <OfficerAvatar src={officerPhoto} name={officerName} />
                        )}
                        <div className={cn('min-w-0 max-w-[78%]', !visitor && 'text-right')}>
                          <p
                            className={cn(
                              'mb-1 flex items-baseline gap-2 text-[10px] font-semibold tracking-wide uppercase',
                              visitor
                                ? 'text-zinc-500'
                                : 'flex-row-reverse text-brand-700 dark:text-brand-300',
                            )}
                          >
                            <span>{roleLabel(item.role)}</span>
                            {clock ? (
                              <time
                                dateTime={item.createdAt ?? undefined}
                                className="font-medium normal-case tracking-normal text-zinc-400"
                              >
                                {clock}
                              </time>
                            ) : null}
                          </p>
                          <div
                            className={cn(
                              'rounded-2xl px-3 py-2 text-left text-[13px] leading-5 ring-1',
                              visitor
                                ? 'rounded-bl-md bg-white text-zinc-900 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700'
                                : 'rounded-br-md bg-brand-700 text-white ring-brand-800',
                            )}
                          >
                            <p>{item.body}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {active?.visitorTyping ? (
                  <div className="flex items-end gap-2" role="status" aria-live="polite" aria-label="Visitor is typing">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-zinc-500 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700">
                      <CircleUser className="size-3.5" aria-hidden />
                    </span>
                    <div className="min-w-0 max-w-[78%]">
                      <p className="mb-1 text-[10px] font-semibold tracking-wide uppercase text-zinc-500">Visitor</p>
                      <div className="rounded-2xl rounded-bl-md bg-white px-3 py-2.5 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700">
                        <span className="chat-typing" aria-hidden>
                          <i />
                          <i />
                          <i />
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <form onSubmit={onReply} className="shrink-0 border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor="chat-admin-reply">
                    Reply
                  </label>
                  <textarea
                    id="chat-admin-reply"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        event.currentTarget.form?.requestSubmit()
                      }
                    }}
                    rows={1}
                    placeholder="Write an official reply"
                    className="h-11 min-h-11 max-h-11 min-w-0 flex-1 resize-none overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm leading-5 text-brand-950 outline-none [-ms-overflow-style:none] [scrollbar-width:none] focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 [&::-webkit-scrollbar]:hidden"
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
                  >
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Send className="size-4" aria-hidden />
                    )}
                    Send
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      </div>
        </>
      )}

      {pendingDelete ? (
        <ConfirmDeleteDialog
          title={`Visitor #${pendingDelete.id}`}
          noun="conversation"
          description="This chat will be removed from the database. The visitor will start a new thread if they write again."
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            void (async () => {
              const result = await deleteChatThread(pendingDelete.id)
              setPendingDelete(null)
              if (!result.ok) {
                showToast(result.error, 'error')
                return
              }
              if (activeId === pendingDelete.id) {
                setActiveId(null)
                setActive(null)
              }
              void loadThreads({ soft: true })
              void refreshAlerts()
              showToast('Conversation deleted.', 'success')
            })()
          }}
        />
      ) : null}

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
