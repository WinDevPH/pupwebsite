export type FormFileRecord = {
  id: number
  groupId: number
  title: string
  url: string
  sortOrder: number
  published: boolean
  createdAt?: string
  updatedAt?: string
}

export type FormGroupRecord = {
  id: number
  slug: string
  title: string
  note: string | null
  sortOrder: number
  published: boolean
  fileCount: number
  files?: FormFileRecord[]
  createdAt?: string
  updatedAt?: string
}

export type FormGroupInput = {
  id?: number
  slug?: string
  title: string
  note?: string | null
  sortOrder?: number
  published?: boolean
}

export type FormFileInput = {
  id?: number
  groupId: number
  title: string
  url: string
  sortOrder?: number
  published?: boolean
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
      error: 'Cannot reach the server. Start Apache and MySQL in XAMPP.',
      status: 0,
    }
  }
}

export async function listFormGroups(options?: { all?: boolean; withFiles?: boolean }) {
  const params = new URLSearchParams()
  if (options?.all) params.set('all', '1')
  if (options?.withFiles) params.set('withFiles', '1')
  const query = params.toString() ? `?${params.toString()}` : ''
  return request<{ items: FormGroupRecord[] }>(`/api/form-groups.php${query}`)
}

export async function getFormGroupById(id: number, options?: { withFiles?: boolean }) {
  const params = new URLSearchParams({ id: String(id) })
  if (options?.withFiles) params.set('withFiles', '1')
  return request<{ item: FormGroupRecord }>(`/api/form-groups.php?${params.toString()}`)
}

export async function createFormGroup(input: FormGroupInput) {
  return request<{ item: FormGroupRecord }>('/api/form-groups.php', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateFormGroup(input: FormGroupInput & { id: number }) {
  return request<{ item: FormGroupRecord }>('/api/form-groups.php', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteFormGroup(id: number) {
  return request<{ ok: true }>('/api/form-groups.php', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}

export async function listFormFiles(options?: { all?: boolean; groupId?: number }) {
  const params = new URLSearchParams()
  if (options?.all) params.set('all', '1')
  if (options?.groupId) params.set('groupId', String(options.groupId))
  const query = params.toString() ? `?${params.toString()}` : ''
  return request<{ items: FormFileRecord[] }>(`/api/form-files.php${query}`)
}

export async function getFormFileById(id: number) {
  return request<{ item: FormFileRecord }>(
    `/api/form-files.php?id=${encodeURIComponent(String(id))}`,
  )
}

export async function createFormFile(input: FormFileInput) {
  return request<{ item: FormFileRecord }>('/api/form-files.php', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateFormFile(input: FormFileInput & { id: number }) {
  return request<{ item: FormFileRecord }>('/api/form-files.php', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteFormFile(id: number) {
  return request<{ ok: true }>('/api/form-files.php', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}
