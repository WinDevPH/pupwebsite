import { unreachableServerMessage } from '@/lib/unreachable-server'
export type AnnouncementKind = 'issuance' | 'event' | 'social'

export type AnnouncementRecord = {
  id: number
  slug: string
  kind: AnnouncementKind
  title: string
  summary: string
  body: string | null
  image: string
  href: string
  external: boolean
  source: string | null
  date: string
  published: boolean
  createdAt: string
  updatedAt: string
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

export async function listAnnouncements(options?: { all?: boolean }) {
  const query = options?.all ? '?all=1' : ''
  return request<{ items: AnnouncementRecord[] }>(`/api/announcements.php${query}`)
}

export async function getAnnouncementBySlug(slug: string) {
  return request<{ item: AnnouncementRecord }>(
    `/api/announcements.php?slug=${encodeURIComponent(slug)}`,
  )
}

export async function getAnnouncementById(id: number) {
  return request<{ item: AnnouncementRecord }>(
    `/api/announcements.php?id=${encodeURIComponent(String(id))}`,
  )
}

export type AnnouncementInput = {
  id?: number
  slug?: string
  kind: AnnouncementKind
  title: string
  summary: string
  body?: string | null
  image: string
  href?: string | null
  external?: boolean
  source?: string | null
  date: string
  published?: boolean
}

export async function createAnnouncement(input: AnnouncementInput) {
  return request<{ item: AnnouncementRecord }>('/api/announcements.php', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateAnnouncement(input: AnnouncementInput & { id: number }) {
  return request<{ item: AnnouncementRecord }>('/api/announcements.php', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteAnnouncement(id: number) {
  return request<{ ok: true }>('/api/announcements.php', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}

export async function uploadAnnouncementImage(file: File) {
  const body = new FormData()
  body.append('image', file)
  return request<{ url: string; image: string; filename: string }>(
    '/api/announcements-upload.php',
    {
      method: 'POST',
      body,
    },
  )
}
