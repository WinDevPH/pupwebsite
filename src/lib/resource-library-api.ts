import { unreachableServerMessage } from '@/lib/unreachable-server'
export type ResourceLinkRecord = {
  id: number
  slug: string
  title: string
  url: string
  sortOrder: number
  published: boolean
  createdAt?: string
  updatedAt?: string
}

export type ResourceLinkInput = {
  id?: number
  slug?: string
  title: string
  url: string
  sortOrder?: number
  published?: boolean
}

export type ResourceLibrary = {
  items: ResourceLinkRecord[]
}

type ApiFailure = { ok: false; error: string; status: number }
type ApiOk<T> = { ok: true; data: T }

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

export async function getResourceLibrary(options?: { all?: boolean }) {
  const query = options?.all ? '?all=1' : ''
  return request<ResourceLibrary>(`/api/resource-library.php${query}`)
}

export async function getResourceLinkById(id: number) {
  return request<{ item: ResourceLinkRecord }>(
    `/api/resource-library.php?id=${encodeURIComponent(String(id))}`,
  )
}

export async function createResourceLink(input: ResourceLinkInput) {
  return request<{ item: ResourceLinkRecord }>('/api/resource-library.php', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateResourceLink(input: ResourceLinkInput & { id: number }) {
  return request<{ item: ResourceLinkRecord }>('/api/resource-library.php', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteResourceLink(id: number) {
  return request<{ ok: true }>('/api/resource-library.php', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}
