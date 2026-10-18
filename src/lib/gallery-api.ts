export type GalleryImageRecord = {
  id?: number
  batchId?: number
  src: string
  title: string
  caption: string
  alt: string
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

export type GalleryBatchRecord = {
  id: number
  academicYear: string
  title: string
  published: boolean
  sortOrder: number
  imageCount: number
  coverImage?: string | null
  createdAt: string
  updatedAt: string
}

export type GalleryBatchInput = {
  id?: number
  academicYear: string
  title?: string
  published?: boolean
  sortOrder?: number
  images: Array<{
    src: string
    title: string
    caption?: string
    alt?: string
    sortOrder?: number
  }>
}

export type GalleryDisplaySettings = {
  pinnedYear: string | null
  publicYear: string | null
  mode: 'auto' | 'pinned'
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

export function normalizeAcademicYear(value: string) {
  return value.trim().replace(/[-—–]/g, '–').replace(/\s+/g, '')
}

export async function listGalleryBatches() {
  return request<{
    items: GalleryBatchRecord[]
    pinnedYear?: string | null
    publicYear?: string | null
    displayMode?: 'auto' | 'pinned'
  }>('/api/gallery.php?all=1')
}

export async function listGalleryYears(options?: { all?: boolean }) {
  const params = new URLSearchParams({ years: '1' })
  if (options?.all) params.set('all', '1')
  return request<{ years: string[] }>(`/api/gallery.php?${params}`)
}

export async function getGalleryDisplaySettings() {
  return request<GalleryDisplaySettings>('/api/gallery.php?display=1')
}

export async function setGalleryDisplayYear(pinnedYear: string | null) {
  return request<GalleryDisplaySettings>('/api/gallery.php', {
    method: 'PUT',
    body: JSON.stringify({
      action: 'pin_display_year',
      pinnedYear,
    }),
  })
}

/** Public gallery for The Council — uses pinned A.Y. or latest published. */
export async function listPublicGallery(options?: { year?: string }) {
  const params = new URLSearchParams()
  if (options?.year) params.set('year', normalizeAcademicYear(options.year))
  const query = params.toString()
  return request<{
    academicYear: string | null
    pinnedYear?: string | null
    displayMode?: 'auto' | 'pinned'
    batch: GalleryBatchRecord | null
    images: GalleryImageRecord[]
  }>(`/api/gallery.php${query ? `?${query}` : ''}`)
}

export async function getGalleryBatchById(id: number) {
  return request<{ item: GalleryBatchRecord; images: GalleryImageRecord[] }>(
    `/api/gallery.php?id=${encodeURIComponent(String(id))}`,
  )
}

export async function createGalleryBatch(input: GalleryBatchInput) {
  return request<{ item: GalleryBatchRecord; images: GalleryImageRecord[] }>('/api/gallery.php', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateGalleryBatch(input: GalleryBatchInput & { id: number }) {
  return request<{ item: GalleryBatchRecord; images: GalleryImageRecord[] }>('/api/gallery.php', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteGalleryBatch(id: number) {
  return request<{ ok: true }>('/api/gallery.php', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}

export async function deleteGalleryBatches(ids: number[]) {
  return request<{ deleted: number }>('/api/gallery.php', {
    method: 'DELETE',
    body: JSON.stringify({ ids }),
  })
}

export async function uploadGalleryImages(files: File[]) {
  const payload = new FormData()
  for (const file of files) {
    payload.append('images[]', file)
  }

  return request<{
    items: Array<{ url: string; image: string; src: string; filename: string; name: string }>
  }>('/api/gallery-upload.php', {
    method: 'POST',
    body: payload,
  })
}

export async function uploadGalleryImage(file: File) {
  const body = new FormData()
  body.append('image', file)
  return request<{ url: string; image: string; src: string }>('/api/gallery-upload.php', {
    method: 'POST',
    body,
  })
}
