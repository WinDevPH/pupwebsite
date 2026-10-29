import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CircleUser, MessageCircle, Send, X } from 'lucide-react'
import { ChatTimeRule } from '@/components/chat/ChatTimeRule'
import { CouncilMascot } from '@/components/home/CouncilMascot'
import studentCouncilLogo from '@/assets/org-logos/student-council.png'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useSiteContact } from '@/hooks/useSiteContact'
import { setPageScrollLocked } from '@/hooks/useLenis'
import {
  getChatThread,
  listChatFaqs,
  pingChatTyping,
  readChatSeenId,
  readChatSuggestHideDay,
  readChatToken,
  sendChatFaq,
  sendChatMessage,
  writeChatSeenId,
  writeChatSuggestHideDay,
  writeChatToken,
  type ChatFaqRecord,
  type ChatMessageRecord,
} from '@/lib/chat-api'
import { formatChatClock, formatPhDayKey } from '@/lib/datetime'
import { easeOut } from '@/lib/motion'
import { cn } from '@/lib/utils'

type ChatRole = 'bot' | 'user'
type ChatMessage = { id: string; role: ChatRole; text: string; at?: string | null }

function welcome(hours: string): ChatMessage {
  return {
    id: 'welcome',
    role: 'bot',
    text: `Welcome. This is the PUP COL SC help desk. Tell us what you need and we will point you to the right page or officer. Office hours: ${hours}.`,
    at: new Date().toISOString(),
  }
}

function isGreeting(text: string) {
  return /^(hi|hello|welcome)\b/i.test(text.trim()) && /help desk/i.test(text)
}

const FAB_GREETS = [
  'Hi, message the Council',
  'Need help? Message us',
  'Ask the help desk',
  'Got a question? Chat',
  'We are here to help',
  'Talk to an officer',
] as const

const WAIT_REPLY = 'Thank you for your message. Please wait. An officer will reply here shortly.'
const WAIT_REPLIES = [
  WAIT_REPLY,
  'Thank you for your message. Please wait — an officer will reply here shortly.',
]

function isWaitReply(body: string) {
  return WAIT_REPLIES.includes(body)
}

function dedupeWaitReplies(items: ChatMessageRecord[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (item.role === 'visitor' || !isWaitReply(item.body)) return true
    const day = (item.createdAt ?? '').slice(0, 10) || 'today'
    if (seen.has(day)) return false
    seen.add(day)
    return true
  })
}

function fromRecords(items: ChatMessageRecord[], hours: string): ChatMessage[] {
  return dedupeWaitReplies(items).map((item, index) => {
    const greeting = item.role !== 'visitor' && (index === 0 || isGreeting(item.body))
    return {
      id: String(item.id),
      role: item.role === 'visitor' ? 'user' : 'bot',
      text: greeting ? welcome(hours).text : isWaitReply(item.body) ? WAIT_REPLY : item.body,
      at: item.createdAt ?? null,
    }
  })
}

function lastThreadId(items: ChatMessageRecord[]) {
  return items.at(-1)?.id ?? 0
}

function uniqueFaqs(items: ChatFaqRecord[]) {
  const seen = new Set<string>()
  const next: ChatFaqRecord[] = []
  for (const item of items) {
    if (!item.published) continue
    const key = item.question.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    next.push(item)
  }
  return next
}

function typedOffToday(messages: ChatMessage[], faqs: ChatFaqRecord[]) {
  const today = formatPhDayKey(new Date())
  if (!today) return false
  const canned = new Set(faqs.map((item) => item.question.trim().toLowerCase()))
  return messages.some((item) => {
    if (item.role !== 'user') return false
    if (formatPhDayKey(item.at) !== today) return false
    return !canned.has(item.text.trim().toLowerCase())
  })
}

function unseenCouncilId(items: ChatMessageRecord[], seen: number) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index]
    if (item.id <= seen || item.role === 'visitor') continue
    if (isWaitReply(item.body) || isGreeting(item.body)) continue
    return item.id
  }
  return 0
}

function sameMessages(a: ChatMessage[], b: ChatMessage[]) {
  if (a.length !== b.length) return false
  return a.every((item, index) => {
    const other = b[index]
    return item.id === other.id && item.role === other.role && item.text === other.text
  })
}

function adoptThread(prev: ChatMessage[], next: ChatMessage[]) {
  const locals = prev.filter((item) => item.id.startsWith('local-') && item.role === 'user')
  let cursor = 0
  const adopted = next.map((item) => {
    if (item.role !== 'user' || cursor >= locals.length) return item
    const local = locals[cursor]
    if (local.text !== item.text) return item
    cursor += 1
    return { ...item, id: local.id }
  })
  const leftover = locals.slice(cursor)
  return leftover.length ? [...adopted, ...leftover] : adopted
}

function isNearBottom(node: HTMLElement) {
  return node.scrollHeight - node.scrollTop - node.clientHeight < 80
}

function typingDelay(text: string, reduce: boolean) {
  if (reduce) return 0
  return Math.min(1400, 520 + Math.min(text.length, 90) * 16)
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

const panelEase = easeOut

export function CouncilChat() {
  const contact = useSiteContact()
  const { items: orgs } = useOrganizations()
  const councilLogo =
    orgs.find((org) => org.id === 'student-council')?.logo.trim() || studentCouncilLogo
  const reduce = useReducedMotion() === true
  const labelId = useId()
  const inputId = useId()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [typing, setTyping] = useState(false)
  const [staffTyping, setStaffTyping] = useState(false)
  const [intro, setIntro] = useState(true)
  const [unread, setUnread] = useState(false)
  const [greetIndex, setGreetIndex] = useState(0)
  const [token, setToken] = useState(() => readChatToken())
  const [messages, setMessages] = useState<ChatMessage[]>(() => [welcome(contact.hours)])
  const [faqs, setFaqs] = useState<ChatFaqRecord[]>([])
  const [suggestHideDay, setSuggestHideDay] = useState(() => readChatSuggestHideDay())
  const listRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const typingLock = useRef(false)
  const sendGen = useRef(0)
  const stickToBottom = useRef(true)
  const showTyping = typing || staffTyping

  const applyThread = useCallback(
    (items: ChatMessageRecord[]) => {
      if (items.length === 0) return
      const next = fromRecords(items, contact.hours)
      setIntro(false)
      setMessages((prev) => {
        const merged = adoptThread(prev, next)
        return sameMessages(prev, merged) ? prev : merged
      })
    },
    [contact.hours],
  )

  useEffect(() => {
    if (!open) {
      typingLock.current = false
      setTyping(false)
      setStaffTyping(false)
    }
  }, [open])

  useEffect(() => {
    if (open || unread || !reduce) return
    const id = window.setInterval(() => {
      setGreetIndex((index) => (index + 1) % FAB_GREETS.length)
    }, 7500)
    return () => window.clearInterval(id)
  }, [open, reduce, unread])

  useEffect(() => {
    if (!open || token || !intro) return
    setTyping(true)
    const delay = reduce ? 0 : 720
    const id = window.setTimeout(() => {
      setTyping(false)
      setIntro(false)
    }, delay)
    return () => window.clearTimeout(id)
  }, [intro, open, reduce, token])

  useEffect(() => {
    if (token) setIntro(false)
  }, [token])

  useEffect(() => {
    const key = token || readChatToken()
    if (!key) {
      setUnread(false)
      return
    }
    let cancelled = false

    async function pull() {
      const result = await getChatThread(key)
      if (cancelled || !result.ok || !result.data.item) return
      const thread = result.data.item.messages ?? []
      if (open) {
        setStaffTyping(result.data.item.staffTyping === true)
        setUnread(false)
        if (thread.length) {
          writeChatSeenId(lastThreadId(thread))
          if (!typingLock.current) applyThread(thread)
        }
        return
      }
      setUnread(unseenCouncilId(thread, readChatSeenId()) > 0)
    }

    void pull()
    const id = window.setInterval(() => void pull(), open ? 1200 : 2500)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [applyThread, open, token])

  useEffect(() => {
    if (!open) return
    const key = token || readChatToken()
    if (!key) return
    const live = draft.trim().length > 0 && !sending
    if (!live) {
      void pingChatTyping({ typing: false, token: key })
      return
    }
    void pingChatTyping({ typing: true, token: key })
    const id = window.setInterval(() => void pingChatTyping({ typing: true, token: key }), 1200)
    return () => window.clearInterval(id)
  }, [draft, open, sending, token])

  useEffect(() => {
    if (open) return
    const key = token || readChatToken()
    if (key) void pingChatTyping({ typing: false, token: key })
  }, [open, token])

  useEffect(() => {
    if (open) stickToBottom.current = true
  }, [open])

  useEffect(() => {
    let ignore = false
    void listChatFaqs().then((result) => {
      if (ignore) return
      if (!result.ok) {
        setFaqs([])
        return
      }
      setFaqs(uniqueFaqs(result.data.items ?? []))
    })
    return () => {
      ignore = true
    }
  }, [open])

  useEffect(() => {
    const node = listRef.current
    if (!node || !open || !stickToBottom.current) return
    const id = window.requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight
    })
    return () => window.cancelAnimationFrame(id)
  }, [messages, open, showTyping])

  useEffect(() => {
    if (open) panelRef.current?.focus({ preventScroll: true })
    setPageScrollLocked(open)
    return () => setPageScrollLocked(false)
  }, [open])

  async function send(text: string) {
    const value = text.trim()
    if (!value || sending) return
    const gen = ++sendGen.current
    const today = formatPhDayKey(new Date())
    const alreadyHidden = suggestHideDay === today
    if (today && !alreadyHidden) {
      writeChatSuggestHideDay(today)
      setSuggestHideDay(today)
    }
    setSending(true)
    setDraft('')
    setIntro(false)
    stickToBottom.current = true
    const session = token || readChatToken()
    if (session) void pingChatTyping({ typing: false, token: session })
    const optimistic: ChatMessage = {
      id: `local-${gen}`,
      role: 'user',
      text: value,
      at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    typingLock.current = true
    setTyping(true)

    const result = await sendChatMessage(value, token || readChatToken())
    if (sendGen.current !== gen) return

    if (!result.ok) {
      typingLock.current = false
      setTyping(false)
      setSending(false)
      setMessages((prev) => prev.filter((item) => item.id !== optimistic.id))
      setDraft(value)
      if (!alreadyHidden) {
        writeChatSuggestHideDay('')
        setSuggestHideDay('')
      }
      return
    }

    const nextToken = result.data.item.token ?? token
    if (nextToken) {
      writeChatToken(nextToken)
      setToken(nextToken)
    }

    const thread = result.data.item.messages ?? []
    const last = thread[thread.length - 1]
    const botReplied = last != null && last.role !== 'visitor'
    await wait(botReplied ? typingDelay(last.body, reduce) : reduce ? 0 : 160)
    if (sendGen.current !== gen) return

    applyThread(thread)
    writeChatSeenId(lastThreadId(thread))
    setUnread(false)
    typingLock.current = false
    setTyping(false)
    setSending(false)
  }

  async function sendFaq(faq: ChatFaqRecord) {
    if (sending) return
    const gen = ++sendGen.current
    setSending(true)
    setIntro(false)
    stickToBottom.current = true
    const session = token || readChatToken()
    if (session) void pingChatTyping({ typing: false, token: session })
    const optimistic: ChatMessage = {
      id: `local-${gen}`,
      role: 'user',
      text: faq.question,
      at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    typingLock.current = true
    setTyping(true)

    const result = await sendChatFaq(faq.id, token || readChatToken())
    if (sendGen.current !== gen) return

    if (!result.ok) {
      typingLock.current = false
      setTyping(false)
      setSending(false)
      setMessages((prev) => prev.filter((item) => item.id !== optimistic.id))
      return
    }

    const nextToken = result.data.item.token ?? token
    if (nextToken) {
      writeChatToken(nextToken)
      setToken(nextToken)
    }

    const thread = result.data.item.messages ?? []
    const last = thread[thread.length - 1]
    const botReplied = last != null && last.role !== 'visitor'
    await wait(botReplied ? typingDelay(last.body, reduce) : reduce ? 0 : 160)
    if (sendGen.current !== gen) return

    applyThread(thread)
    writeChatSeenId(lastThreadId(thread))
    setUnread(false)
    typingLock.current = false
    setTyping(false)
    setSending(false)
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void send(draft)
  }

  const visibleMessages = intro ? messages.filter((item) => item.id !== 'welcome') : messages
  const asked = new Set(messages.map((item) => item.text.trim().toLowerCase()))
  const hideSuggestions =
    intro || suggestHideDay === formatPhDayKey(new Date()) || typedOffToday(messages, faqs)
  const suggestions = hideSuggestions
    ? []
    : faqs.filter((item) => item.published && !asked.has(item.question.trim().toLowerCase()))

  return createPortal(
    <div
      data-council-chat
      className="fixed bottom-5 left-[max(1rem,calc((100vw-80rem)/2+1rem))] z-50 sm:bottom-6 sm:left-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))] lg:left-[max(2rem,calc((100vw-80rem)/2+2rem))]"
    >
      <AnimatePresence>
        {open ? (
          <motion.div
            key="council-chat-panel"
            ref={panelRef}
            id={`${labelId}-panel`}
            role="dialog"
            aria-labelledby={labelId}
            tabIndex={-1}
            initial={reduce ? false : { opacity: 0, y: 18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: 14, scale: 0.96 }}
            transition={{ duration: 0.32, ease: panelEase }}
            style={{ transformOrigin: 'bottom left' }}
            className="mb-3 flex h-[min(28rem,70svh)] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_20px_48px_-24px_rgba(30,5,65,0.45)] outline-none dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-brand-800 bg-brand-900 px-3 py-2.5 text-white">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="relative shrink-0">
                  <img
                    src={councilLogo}
                    alt=""
                    width={36}
                    height={36}
                    className="size-9 rounded-full border border-white/25 bg-white object-contain p-0.5"
                  />
                  <span
                    className={cn(
                      'absolute right-0 bottom-0 size-2 rounded-full ring-2 ring-brand-900',
                      showTyping ? 'bg-brand-300' : 'bg-emerald-400',
                    )}
                  />
                </span>
                <div className="min-w-0">
                  <p id={labelId} className="truncate text-sm font-semibold">
                    PUP COL SC
                  </p>
                  <p className="text-[11px] text-white/65 transition-colors duration-200">
                    {showTyping ? 'Council is typing…' : 'Council help desk'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close chat"
                onClick={() => setOpen(false)}
                className="inline-flex size-8 items-center justify-center rounded-full text-white/80 transition-colors duration-200 hover:bg-white/10 hover:text-white"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div
              ref={listRef}
              onScroll={() => {
                const node = listRef.current
                if (node) stickToBottom.current = isNearBottom(node)
              }}
              onWheel={(event) => event.stopPropagation()}
              onTouchMove={(event) => event.stopPropagation()}
              className="flex min-h-0 flex-1 flex-col space-y-2 overflow-y-scroll overscroll-contain px-3 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {visibleMessages.map((item, index) => (
                <ChatBubble
                  key={item.id}
                  item={item}
                  previousAt={visibleMessages[index - 1]?.at}
                  logo={councilLogo}
                />
              ))}
              <AnimatePresence>
                {showTyping ? <TypingIndicator key="typing" logo={councilLogo} reduce={reduce} /> : null}
              </AnimatePresence>
              {suggestions.length > 0 ? (
                <div
                  role="group"
                  aria-label="Suggested questions"
                  className="mt-auto flex flex-col items-end gap-2 pt-6"
                >
                  {suggestions.map((faq) => (
                    <button
                      key={faq.id}
                      type="button"
                      disabled={sending}
                      onClick={() => void sendFaq(faq)}
                      className="flex w-fit max-w-full cursor-pointer items-center gap-2 rounded-full bg-brand-800 px-3.5 py-2 text-white shadow-[0_6px_16px_-10px_rgba(30,5,65,0.55)] outline-none transition hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-400/70 disabled:cursor-wait disabled:opacity-55 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                    >
                      <span className="min-w-0 text-[13px] font-medium leading-5">
                        {faq.question}
                      </span>
                      <Send className="size-3.5 shrink-0 text-brand-200 dark:text-zinc-300" aria-hidden />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <form onSubmit={onSubmit} className="shrink-0 border-t border-zinc-100 p-2.5 dark:border-zinc-800">
              <div className="flex items-center gap-1.5">
                <label htmlFor={inputId} className="sr-only">
                  Message
                </label>
                <input
                  id={inputId}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Type a message"
                  disabled={sending}
                  className="h-10 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-base text-brand-950 outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-zinc-400 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 disabled:opacity-70 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:bg-zinc-900"
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  disabled={sending || !draft.trim()}
                  className="inline-flex size-10 items-center justify-center rounded-full bg-brand-700 text-white transition-[transform,background-color,opacity] duration-200 hover:bg-brand-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="size-4" aria-hidden />
                </button>
              </div>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="relative">
        <AnimatePresence>
          {!open ? (
            <motion.div
              key={unread ? 'council-chat-unread' : 'council-chat-greet'}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.22, ease: panelEase }}
            >
              <span
                aria-hidden
                className="chat-wave pointer-events-none absolute inset-0 rounded-full bg-brand-500/35"
              />
              <span
                aria-hidden
                className="chat-wave chat-wave-delay pointer-events-none absolute inset-0 rounded-full bg-brand-400/25"
              />
              <div
                className="chat-greet pointer-events-none absolute -top-1 left-[3.15rem] flex items-end gap-1"
                onAnimationIteration={(event) => {
                  if (unread || event.animationName !== 'chat-greet-cycle') return
                  setGreetIndex((index) => (index + 1) % FAB_GREETS.length)
                }}
              >
                <CouncilMascot className="chat-mascot h-[3.35rem] w-11 shrink-0 drop-shadow-[0_8px_14px_rgba(30,5,65,0.28)]" />
                <p className="chat-bubble-pop relative mb-3 w-max rounded-2xl rounded-bl-md bg-brand-900 px-3 py-1.5 text-[12px] font-semibold text-white shadow-[0_10px_22px_-12px_rgba(30,5,65,0.55)]">
                  {unread ? 'Read the new message' : FAB_GREETS[greetIndex]}
                  <span className="absolute bottom-2 -left-1.5 size-2.5 rotate-45 bg-brand-900" aria-hidden />
                </p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? `${labelId}-panel` : undefined}
          aria-label={
            open ? 'Close council chat' : unread ? 'Read the new message' : 'Message the Council'
          }
          onClick={() => {
            setOpen((value) => !value)
            if (!open) setUnread(false)
          }}
          className="relative flex size-12 items-center justify-center rounded-full bg-brand-700 text-white shadow-[0_12px_28px_-12px_rgba(95,24,184,0.8)] transition-[transform,background-color] duration-200 hover:bg-brand-800 hover:scale-[1.04] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          <MessageCircle
            aria-hidden
            className={cn(
              'absolute size-5 transition-[opacity,transform] duration-200 ease-out',
              open ? 'scale-50 rotate-45 opacity-0' : 'scale-100 rotate-0 opacity-100',
            )}
          />
          <X
            aria-hidden
            className={cn(
              'absolute size-5 transition-[opacity,transform] duration-200 ease-out',
              open ? 'scale-100 rotate-0 opacity-100' : 'scale-50 -rotate-45 opacity-0',
            )}
          />
          {unread && !open ? (
            <span className="absolute -top-0.5 -right-0.5 z-10 flex size-3" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-70" />
              <span className="relative inline-flex size-3 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-950" />
            </span>
          ) : null}
        </button>
      </div>
    </div>,
    document.body,
  )
}

function ChatBubble({
  item,
  previousAt,
  logo,
}: {
  item: ChatMessage
  previousAt?: string | null
  logo: string
}) {
  const fromCouncil = item.role === 'bot'
  const clock = formatChatClock(item.at)
  return (
    <div className="w-full min-w-0">
      <ChatTimeRule at={item.at} previous={previousAt} />
      <div className={cn('flex items-end gap-2', fromCouncil ? 'justify-start' : 'flex-row-reverse')}>
        {fromCouncil ? (
          <img
            src={logo}
            alt=""
            width={28}
            height={28}
            className="size-7 shrink-0 rounded-full border border-brand-100 bg-white object-contain p-0.5"
          />
        ) : (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white">
            <CircleUser className="size-4" aria-hidden />
          </span>
        )}
        <div className="min-w-0 max-w-[78%]">
          <p
            className={cn(
              'mb-1 flex items-baseline gap-2 text-[10px] font-semibold tracking-wide uppercase',
              fromCouncil ? 'text-brand-700' : 'flex-row-reverse text-zinc-400',
            )}
          >
            <span>{fromCouncil ? 'Council' : 'You'}</span>
            {clock ? (
              <time dateTime={item.at ?? undefined} className="font-medium normal-case tracking-normal text-zinc-400">
                {clock}
              </time>
            ) : null}
          </p>
          <div
            className={cn(
              'rounded-2xl px-3 py-2 text-[13px] leading-5 ring-1',
              fromCouncil
                ? 'rounded-bl-md bg-brand-50 text-brand-950 ring-brand-100 dark:bg-zinc-900 dark:text-zinc-50 dark:ring-zinc-700'
                : 'rounded-br-md bg-brand-700 text-white ring-brand-800',
            )}
          >
            <p>{item.text}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function TypingIndicator({ logo, reduce }: { logo: string; reduce: boolean }) {
  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label="Council is typing"
      initial={reduce ? false : { opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? undefined : { opacity: 0, y: 6, scale: 0.96 }}
      transition={{ duration: 0.22, ease: panelEase }}
      className="flex items-end gap-2"
    >
      <img
        src={logo}
        alt=""
        width={28}
        height={28}
        className="size-7 shrink-0 rounded-full border border-brand-100 bg-white object-contain p-0.5"
      />
      <div className="rounded-2xl rounded-bl-md bg-brand-50 px-3 py-2.5 ring-1 ring-brand-100 dark:bg-zinc-800 dark:ring-zinc-700">
        <span className="chat-typing" aria-hidden>
          <i />
          <i />
          <i />
        </span>
      </div>
    </motion.div>
  )
}

