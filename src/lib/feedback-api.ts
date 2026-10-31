import { unreachableServerMessage } from '@/lib/unreachable-server'

export const FEEDBACK_KINDS = ['suggestion', 'concern', 'compliment', 'other'] as const
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]

export const FEEDBACK_KIND_LABEL: Record<FeedbackKind, string> = {
  suggestion: 'Suggestion',
  concern: 'Concern',
  compliment: 'Compliment',
  other: 'Something else',
}

export type FeedbackStatus = 'new' | 'read'

export type FeedbackRecord = {
  id: number
  name: string
  email: string
  kind: FeedbackKind
  message: string
  status: FeedbackStatus
  createdAt?: string
  updatedAt?: string
}

export type FeedbackInput = {
  name: string
  email: string
  kind: FeedbackKind
  message: string
  website?: string
}

type ApiFailure = { ok: false; error: string; status: number }
type ApiOk<T> = { ok: true; data: T }

async function request<T>(path: string, init?: RequestInit): Promise<ApiOk<T> | ApiFailure> {
  try {
    const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData
    const response = await fetch(path, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(isFormData || !init?.body ? {} : { 'Content-Type': 'application/json' }),
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

export async function createFeedback(input: FeedbackInput) {
  return request<{ item: FeedbackRecord | null }>('/api/feedback.php', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function listFeedback() {
  return request<{ items: FeedbackRecord[] }>('/api/feedback.php')
}

export async function updateFeedbackStatus(id: number, status: FeedbackStatus) {
  return request<{ item: FeedbackRecord }>('/api/feedback.php', {
    method: 'PUT',
    body: JSON.stringify({ id, status }),
  })
}

export async function deleteFeedback(id: number) {
  return request<{ ok: true }>('/api/feedback.php', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}
