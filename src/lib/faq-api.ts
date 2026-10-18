export type FaqRecord = {
  id: number
  slug: string
  question: string
  answerHtml: string
  answer: string
  sortOrder: number
  published: boolean
  createdAt?: string
  updatedAt?: string
}

export type FaqInput = {
  id?: number
  slug?: string
  question: string
  answerHtml: string
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

export async function listFaq(options?: { all?: boolean }) {
  const query = options?.all ? '?all=1' : ''
  return request<{ items: FaqRecord[] }>(`/api/faq.php${query}`)
}

export async function getFaqById(id: number) {
  return request<{ item: FaqRecord }>(`/api/faq.php?id=${id}`)
}

export async function createFaq(input: FaqInput) {
  return request<{ item: FaqRecord }>('/api/faq.php', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateFaq(input: FaqInput & { id: number }) {
  return request<{ item: FaqRecord }>('/api/faq.php', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteFaq(id: number) {
  return request<{ ok: true }>('/api/faq.php', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}
