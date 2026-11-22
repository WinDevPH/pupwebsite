import { unreachableServerMessage } from '@/lib/unreachable-server'

export type ApiFailure = { ok: false; error: string; status: number }
export type ApiOk<T> = { ok: true; data: T }

export async function enrollmentRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiOk<T> | ApiFailure> {
  try {
    const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData
    const { headers: initHeaders, ...rest } = init ?? {}
    const response = await fetch(path, {
      credentials: 'include',
      ...rest,
      headers: {
        Accept: 'application/json',
        ...(isFormData || !init?.body ? {} : { 'Content-Type': 'application/json' }),
        ...(initHeaders ?? {}),
      },
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
