export type AuthUser = {
  id: number
  email: string
  fullName: string
  studentNumber: string | null
  yearLevel: number | null
  avatarUrl: string | null
  role: string
}

const AUTH_USER_KEY = 'pup-col-sc-user'
export const AUTH_USER_EVENT = 'pup-auth-user'

export function isManagerRole(role: string | null | undefined) {
  const normalized = (role ?? '').trim().toLowerCase()
  return normalized === 'admin' || normalized === 'officer'
}

export function readStoredAuthUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(AUTH_USER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AuthUser>
    if (!parsed || typeof parsed.email !== 'string' || typeof parsed.fullName !== 'string') {
      return null
    }
    const avatarUrl =
      typeof parsed.avatarUrl === 'string' && parsed.avatarUrl.trim() !== ''
        ? parsed.avatarUrl.trim()
        : null
    return {
      id: Number(parsed.id) || 0,
      email: parsed.email,
      fullName: parsed.fullName,
      studentNumber: parsed.studentNumber ?? null,
      yearLevel: parsed.yearLevel ?? null,
      avatarUrl,
      role: String(parsed.role ?? ''),
    }
  } catch {
    return null
  }
}

export function writeStoredAuthUser(user: AuthUser) {
  try {
    sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(AUTH_USER_EVENT, { detail: user }))
  } catch {
    /* ignore */
  }
}

export function patchStoredAuthUser(patch: Partial<AuthUser>) {
  const current = readStoredAuthUser()
  if (!current) return null
  const next: AuthUser = {
    ...current,
    ...patch,
    avatarUrl:
      patch.avatarUrl === undefined
        ? current.avatarUrl
        : patch.avatarUrl && patch.avatarUrl.trim() !== ''
          ? patch.avatarUrl.trim()
          : null,
  }
  writeStoredAuthUser(next)
  return next
}

export function clearStoredAuthUser() {
  try {
    sessionStorage.removeItem(AUTH_USER_KEY)
  } catch {
    /* ignore */
  }
}

export function loginPathWithNext(nextPath?: string | null) {
  const next = nextPath && nextPath.startsWith('/') ? nextPath : '/admin'
  return `/login?next=${encodeURIComponent(next)}`
}

export type LoginFailure = {
  ok: false
  error: string
  status: number
  retryAfter?: number
  remaining?: number
  locked?: boolean
}

type ApiResult<T> = { ok: true; data: T } | LoginFailure

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
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
      | ({
          ok?: boolean
          error?: string
          retryAfter?: number
          remaining?: number
          locked?: boolean
        } & T)
      | null

    if (!response.ok || !payload?.ok) {
      const headerRetry = Number(response.headers.get('Retry-After') || 0)
      return {
        ok: false,
        error: payload?.error || 'Something went wrong. Please try again.',
        status: response.status,
        retryAfter: payload?.retryAfter ?? (Number.isFinite(headerRetry) ? headerRetry : undefined),
        remaining: payload?.remaining,
        locked: Boolean(payload?.locked) || response.status === 429,
      }
    }

    return { ok: true, data: payload as T }
  } catch {
    return {
      ok: false,
      error: 'Cannot reach the login server. Start Apache in XAMPP and try again.',
      status: 0,
    }
  }
}

export async function loginRequest(input: {
  email: string
  password: string
  remember: boolean
}) {
  return request<{ user: AuthUser }>('/api/login.php', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function logoutRequest() {
  return request<{ ok: true }>('/api/logout.php', { method: 'POST' })
}

export async function meRequest() {
  return request<{ user: AuthUser }>('/api/me.php')
}
