import { unreachableServerMessage } from '@/lib/unreachable-server'
export type ChatRole = 'visitor' | 'bot' | 'staff'

export type ChatMessageRecord = {
  id: number
  role: ChatRole
  body: string
  createdAt?: string | null
}

export type ChatThreadRecord = {
  id: number
  token?: string
  preview: string
  lastRole: ChatRole
  unread?: boolean
  visitorTyping?: boolean
  staffTyping?: boolean
  createdAt?: string | null
  updatedAt?: string | null
  messages?: ChatMessageRecord[]
}

type ApiFailure = { ok: false; error: string; status: number }
type ApiOk<T> = { ok: true; data: T }

const TOKEN_KEY = 'pup-col-sc-chat-token'
const SEEN_KEY = 'pup-col-sc-chat-seen'
const SUGGEST_HIDE_KEY = 'pup-col-sc-chat-suggest-hide'

export function readChatToken() {
  try {
    const value = localStorage.getItem(TOKEN_KEY)?.trim() ?? ''
    return /^[a-f0-9]{32}$/.test(value) ? value : ''
  } catch {
    return ''
  }
}

export function writeChatToken(token: string) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* ignore */
  }
}

export function readChatSeenId() {
  try {
    const value = Number(localStorage.getItem(SEEN_KEY) ?? '')
    return Number.isInteger(value) && value > 0 ? value : 0
  } catch {
    return 0
  }
}

export function writeChatSeenId(id: number) {
  try {
    if (id > 0) localStorage.setItem(SEEN_KEY, String(id))
  } catch {
    /* ignore */
  }
}

export function readChatSuggestHideDay() {
  try {
    const value = localStorage.getItem(SUGGEST_HIDE_KEY)?.trim() ?? ''
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
  } catch {
    return ''
  }
}

export function writeChatSuggestHideDay(day: string) {
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) localStorage.setItem(SUGGEST_HIDE_KEY, day)
    else localStorage.removeItem(SUGGEST_HIDE_KEY)
  } catch {
    /* ignore */
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiOk<T> | ApiFailure> {
  try {
    const response = await fetch(path, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
      ...init,
    })
    const payload = (await response.json().catch(() => null)) as
      | ({ ok?: boolean; error?: string } & T)
      | null

    if (!response.ok || !payload?.ok) {
      return {
        ok: false,
        error: payload?.error || 'Something went wrong. Please try again.',
        status: response.status,
      }
    }

    return { ok: true, data: payload as T }
  } catch {
    return {
      ok: false,
      error: unreachableServerMessage(),
      status: 0,
    }
  }
}

export async function getChatThread(token: string) {
  return request<{ item: ChatThreadRecord | null }>(
    `/api/chat.php?token=${encodeURIComponent(token)}`,
  )
}

export async function sendChatMessage(body: string, token?: string) {
  return request<{ item: ChatThreadRecord }>('/api/chat.php', {
    method: 'POST',
    body: JSON.stringify({ body, token: token || undefined }),
  })
}

export async function pingChatTyping(input: { typing: boolean; token?: string; threadId?: number }) {
  return request<{ typing: boolean }>('/api/chat.php', {
    method: 'POST',
    body: JSON.stringify({
      typing: input.typing,
      token: input.token || undefined,
      threadId: input.threadId || undefined,
    }),
  })
}

export async function listChatThreads() {
  return request<{ items: ChatThreadRecord[] }>('/api/chat.php?all=1')
}

export async function getChatThreadById(id: number) {
  return request<{ item: ChatThreadRecord }>(`/api/chat.php?id=${id}`)
}

export async function replyChatThread(threadId: number, body: string) {
  return request<{ item: ChatThreadRecord }>('/api/chat.php', {
    method: 'POST',
    body: JSON.stringify({ threadId, body }),
  })
}

export async function deleteChatThread(id: number) {
  return request<{ ok: true }>('/api/chat.php', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}

export type ChatFaqRecord = {
  id: number
  question: string
  answer: string
  sortOrder: number
  published: boolean
  createdAt?: string | null
  updatedAt?: string | null
}

export async function listChatFaqs(all = false) {
  return request<{ items: ChatFaqRecord[] }>(`/api/chat.php?faqs=1${all ? '&all=1' : ''}`)
}

export async function saveChatFaq(input: {
  id?: number
  question: string
  answer: string
  sortOrder?: number
  published?: boolean
}) {
  return request<{ item: ChatFaqRecord }>('/api/chat.php', {
    method: 'POST',
    body: JSON.stringify({ faq: input }),
  })
}

export async function deleteChatFaq(id: number) {
  return request<{ ok: true }>('/api/chat.php', {
    method: 'DELETE',
    body: JSON.stringify({ faqId: id }),
  })
}

export async function sendChatFaq(faqId: number, token?: string) {
  return request<{ item: ChatThreadRecord }>('/api/chat.php', {
    method: 'POST',
    body: JSON.stringify({ faqId, token: token || undefined }),
  })
}
