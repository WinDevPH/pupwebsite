export type CalendarKind = 'holiday' | 'exam' | 'enrollment' | 'academic'

export type CalendarEventRecord = {
  id: number
  slug: string
  kind: CalendarKind
  title: string
  description: string | null
  image: string | null
  start: string
  end: string
  sortOrder: number
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
      error: 'Cannot reach the server. Start Apache and MySQL in XAMPP.',
      status: 0,
    }
  }
}

export async function listCalendarEvents(options?: { all?: boolean }) {
  const query = options?.all ? '?all=1' : ''
  return request<{ items: CalendarEventRecord[] }>(`/api/calendar.php${query}`)
}

export async function getCalendarEventById(id: number) {
  return request<{ item: CalendarEventRecord }>(
    `/api/calendar.php?id=${encodeURIComponent(String(id))}`,
  )
}

export type CalendarEventInput = {
  id?: number
  slug?: string
  kind: CalendarKind
  title: string
  description?: string | null
  image?: string | null
  start: string
  end: string
  sortOrder?: number
  published?: boolean
}

export async function createCalendarEvent(input: CalendarEventInput) {
  return request<{ item: CalendarEventRecord }>('/api/calendar.php', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateCalendarEvent(input: CalendarEventInput & { id: number }) {
  return request<{ item: CalendarEventRecord }>('/api/calendar.php', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteCalendarEvent(id: number) {
  return request<{ ok: true }>('/api/calendar.php', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}

export async function uploadCalendarImage(file: File) {
  const body = new FormData()
  body.append('image', file)
  return request<{ url: string; image: string; filename: string }>('/api/calendar-upload.php', {
    method: 'POST',
    body,
  })
}
