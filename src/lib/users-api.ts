import { unreachableServerMessage } from '@/lib/unreachable-server'
import { formatPhDateTime } from '@/lib/datetime'

export type UserRole = 'admin' | 'officer' | 'student'

export const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'officer', label: 'Officer' },
  { value: 'student', label: 'Student' },
]

export type UserRecord = {
  id: number
  email: string
  fullName: string
  studentNumber: string | null
  yearLevel: number | null
  avatarUrl: string | null
  role: UserRole
  active: boolean
  lastLoginAt: string | null
  createdAt?: string
  updatedAt?: string
}

export type UserInput = {
  id?: number
  email: string
  fullName: string
  studentNumber?: string | null
  yearLevel?: number | null
  avatarUrl?: string | null
  role: UserRole
  active?: boolean
  password?: string
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

export async function listUsers(options?: { role?: UserRole; active?: boolean }) {
  const params = new URLSearchParams()
  if (options?.role) params.set('role', options.role)
  if (options?.active === true) params.set('active', '1')
  if (options?.active === false) params.set('active', '0')
  const query = params.toString()
  return request<{ items: UserRecord[]; roles: UserRole[]; meId: number }>(
    `/api/users.php${query ? `?${query}` : ''}`,
  )
}

export async function getUserById(id: number) {
  return request<{ item: UserRecord; meId: number }>(`/api/users.php?id=${id}`)
}

export async function createUser(input: UserInput) {
  return request<{ item: UserRecord }>('/api/users.php', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateUser(input: UserInput & { id: number }) {
  return request<{ item: UserRecord }>('/api/users.php', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteUser(id: number) {
  return request<{ ok: true }>('/api/users.php', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}

export async function uploadUserAvatar(file: File) {
  const body = new FormData()
  body.append('image', file)
  return request<{ url: string; image: string; avatarUrl: string }>('/api/users-upload.php', {
    method: 'POST',
    body,
  })
}

export function userRoleLabel(role: string) {
  const match = USER_ROLES.find((entry) => entry.value === role)
  return match?.label ?? role
}

export function formatLastLogin(iso: string | null | undefined) {
  if (!iso) return 'Never'
  const label = formatPhDateTime(iso)
  return label === '—' ? '—' : label
}

export function userInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}
