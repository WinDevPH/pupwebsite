import { unreachableServerMessage } from '@/lib/unreachable-server'
export type OrganizationRecord = {
  id: number
  slug: string
  short: string
  name: string
  facebook: string
  logo: string
  academicYear: string
  sortOrder: number
  published: boolean
  createdAt?: string
  updatedAt?: string
}

export type OrganizationInput = {
  id?: number
  slug?: string
  short: string
  name: string
  facebook?: string
  logo?: string
  academicYear?: string
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
      error: unreachableServerMessage(),
      status: 0,
    }
  }
}

export const DEFAULT_ORGANIZATIONS_YEAR = 'A.Y. 2026–2027'

/** Backend stores `2026–2027`; the public site shows `A.Y. 2026–2027`. */
export function formatOrganizationsYear(academicYear?: string | null) {
  const value = academicYear?.trim()
  if (!value) return DEFAULT_ORGANIZATIONS_YEAR
  return /^a\.?y\.?/i.test(value) ? value : `A.Y. ${value}`
}

export async function listOrganizations(options?: { all?: boolean }) {
  const query = options?.all ? '?all=1' : ''
  return request<{ items: OrganizationRecord[] }>(`/api/organizations.php${query}`)
}

export async function getOrganizationById(id: number) {
  return request<{ item: OrganizationRecord }>(`/api/organizations.php?id=${id}`)
}

export async function createOrganization(input: OrganizationInput) {
  return request<{ item: OrganizationRecord }>('/api/organizations.php', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateOrganization(input: OrganizationInput & { id: number }) {
  return request<{ item: OrganizationRecord }>('/api/organizations.php', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteOrganization(id: number) {
  return request<{ ok: true }>('/api/organizations.php', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}
