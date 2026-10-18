export type NotificationKind = 'request' | 'reservation'

export type AdminNotification = {
  id: string
  kind: NotificationKind
  title: string
  body: string
  href: string
  status: string
  createdAt: string
}

type ApiFailure = { ok: false; error: string; status: number }
type ApiOk<T> = { ok: true; data: T }

async function request<T>(path: string): Promise<ApiOk<T> | ApiFailure> {
  try {
    const response = await fetch(path, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
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

export async function listAdminNotifications() {
  return request<{
    items: AdminNotification[]
    counts: { request: number; reservation: number; total: number }
  }>('/api/notifications.php')
}

export { formatPhRelative as formatNotificationTime } from '@/lib/datetime'
