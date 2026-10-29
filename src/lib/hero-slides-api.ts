import { unreachableServerMessage } from '@/lib/unreachable-server'
export type HeroSlideRecord = {
  id: number
  image: string
  alt: string
  sortOrder: number
  published: boolean
  createdAt?: string
  updatedAt?: string
}

export type HeroSlideInput = {
  id?: number
  image: string
  alt?: string
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

export async function listHeroSlides(options?: { all?: boolean }) {
  const query = options?.all ? '?all=1' : ''
  return request<{ items: HeroSlideRecord[] }>(`/api/hero-slides.php${query}`)
}

export async function getHeroSlideById(id: number) {
  return request<{ item: HeroSlideRecord }>(`/api/hero-slides.php?id=${encodeURIComponent(String(id))}`)
}

export async function createHeroSlide(input: HeroSlideInput) {
  return request<{ item: HeroSlideRecord }>('/api/hero-slides.php', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateHeroSlide(input: HeroSlideInput & { id: number }) {
  return request<{ item: HeroSlideRecord }>('/api/hero-slides.php', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteHeroSlide(id: number) {
  return request<{ ok: true }>('/api/hero-slides.php', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}

export async function uploadHeroImage(file: File) {
  const body = new FormData()
  body.append('image', file)
  return request<{ url: string; image: string; filename: string }>('/api/hero-upload.php', {
    method: 'POST',
    body,
  })
}
