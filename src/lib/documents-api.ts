export type DocumentCategory = string

export type DocumentCategoryOption = { value: DocumentCategory; label: string }

export const DOCUMENT_CATEGORIES: DocumentCategoryOption[] = [
  { value: 'board_resolution', label: 'Board Resolutions' },
  { value: 'appointment_resolution', label: 'Commission Resolutions' },
  { value: 'memorandum', label: 'Memoranda & Requests' },
  { value: 'report', label: 'Accomplishment Reports' },
  { value: 'financial', label: 'Financial Reports' },
]

export type DocumentRecord = {
  id: number
  category: DocumentCategory
  number: string
  title: string
  url: string
  href: string
  seriesLabel: string
  sortOrder: number
  published: boolean
  createdAt?: string
  updatedAt?: string
}

export type DocumentInput = {
  id?: number
  category: DocumentCategory
  number?: string
  title: string
  url: string
  seriesLabel?: string
  sortOrder?: number
  published?: boolean
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

export async function listDocuments(options?: { category?: DocumentCategory; all?: boolean }) {
  const params = new URLSearchParams()
  if (options?.category) params.set('category', options.category)
  if (options?.all) params.set('all', '1')
  const query = params.toString()
  return request<{ items: DocumentRecord[]; categories?: DocumentCategoryOption[] }>(
    `/api/documents.php${query ? `?${query}` : ''}`,
  )
}

export async function getDocumentById(id: number) {
  return request<{ item: DocumentRecord }>(`/api/documents.php?id=${id}`)
}

export async function createDocument(input: DocumentInput) {
  return request<{ item: DocumentRecord }>('/api/documents.php', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateDocument(input: DocumentInput & { id: number }) {
  return request<{ item: DocumentRecord }>('/api/documents.php', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteDocument(id: number) {
  return request<{ ok: true }>('/api/documents.php', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}
