export type ProjectIconKey =
  | 'calendar-check'
  | 'megaphone'
  | 'printer'
  | 'wifi'
  | 'book-open'
  | 'users'
  | 'folder-kanban'

export type ProjectLink = {
  label: string
  to?: string
  href?: string
}

export type ProjectRecord = {
  id: number
  slug: string
  category: string
  title: string
  summary: string
  body: string | null
  image: string
  images: string[]
  icon: ProjectIconKey
  links: ProjectLink[]
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

export async function listProjects(options?: { all?: boolean; category?: string }) {
  const params = new URLSearchParams()
  if (options?.all) params.set('all', '1')
  if (options?.category) params.set('category', options.category)
  const query = params.toString() ? `?${params.toString()}` : ''
  return request<{ items: ProjectRecord[] }>(`/api/projects.php${query}`)
}

export async function getProjectBySlug(slug: string) {
  return request<{ item: ProjectRecord }>(
    `/api/projects.php?slug=${encodeURIComponent(slug)}`,
  )
}

export async function getProjectById(id: number) {
  return request<{ item: ProjectRecord }>(
    `/api/projects.php?id=${encodeURIComponent(String(id))}`,
  )
}

export type ProjectInput = {
  id?: number
  slug?: string
  category: string
  title: string
  summary: string
  body?: string | null
  image: string
  images?: string[]
  icon: ProjectIconKey
  links?: ProjectLink[]
  sortOrder?: number
  published?: boolean
}

export async function createProject(input: ProjectInput) {
  return request<{ item: ProjectRecord }>('/api/projects.php', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateProject(input: ProjectInput & { id: number }) {
  return request<{ item: ProjectRecord }>('/api/projects.php', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteProject(id: number) {
  return request<{ ok: true }>('/api/projects.php', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}

export async function uploadProjectImage(file: File) {
  const body = new FormData()
  body.append('image', file)
  return request<{ url: string; image: string; filename: string }>('/api/projects-upload.php', {
    method: 'POST',
    body,
  })
}
