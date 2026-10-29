import { unreachableServerMessage } from '@/lib/unreachable-server'
export type ReservationShop = 'locker' | 'merch'

export type ReservationStatus =
  | 'pending'
  | 'submitted'
  | 'confirmed'
  | 'fulfilled'
  | 'cancelled'

export const RESERVATION_SHOPS: ReservationShop[] = ['locker', 'merch']

export const RESERVATION_STATUSES: { value: ReservationStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'cancelled', label: 'Cancelled' },
]

export type ReservationRecord = {
  id: number
  code: string
  shop: ReservationShop
  shopItemId: number | null
  itemKey: string
  itemName: string
  unitPrice: number
  quantity: number
  totalAmount: number
  total: string
  name: string
  email: string
  mobile: string
  studentId: string
  year: string
  yearLevel: string
  remarks: string
  status: ReservationStatus
  image: string
  submittedAt: string
  createdAt?: string
  updatedAt?: string
}

export type ReservationInput = {
  id?: number
  code?: string
  shop: ReservationShop
  shopItemId?: number | null
  itemKey?: string
  itemName: string
  unitPrice?: number
  quantity: number
  totalAmount?: number
  name: string
  email?: string
  mobile?: string
  studentId?: string
  year?: string
  remarks?: string
  status?: ReservationStatus
  submittedAt?: string
  /** Portal public create */
  public?: boolean
  source?: 'portal'
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

export async function listReservations(options?: {
  shop?: ReservationShop
  status?: ReservationStatus
  all?: boolean
}) {
  const params = new URLSearchParams()
  if (options?.shop) params.set('shop', options.shop)
  if (options?.status) params.set('status', options.status)
  if (options?.all) params.set('all', '1')
  const query = params.toString()
  return request<{
    items: ReservationRecord[]
    shops: ReservationShop[]
    statuses: ReservationStatus[]
  }>(`/api/reservations.php${query ? `?${query}` : ''}`)
}

export async function getReservationById(id: number) {
  return request<{ item: ReservationRecord }>(`/api/reservations.php?id=${id}`)
}

export async function getReservationByCode(code: string) {
  return request<{ item: ReservationRecord }>(
    `/api/reservations.php?code=${encodeURIComponent(code.trim())}`,
  )
}

export type ReservationMailResult = {
  councilSent?: boolean
  confirmSent?: boolean
  statusSent?: boolean
  statusChanged?: boolean
  councilError?: string | null
  confirmError?: string | null
  statusError?: string | null
}

export async function createReservation(input: ReservationInput) {
  return request<{
    item: ReservationRecord
    mail?: ReservationMailResult
    message?: string
  }>('/api/reservations.php', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateReservation(input: ReservationInput & { id: number }) {
  return request<{
    item: ReservationRecord
    mail?: ReservationMailResult
    message?: string
  }>('/api/reservations.php', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteReservation(id: number) {
  return request<{ ok: true }>('/api/reservations.php', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}

export function formatReservationMoney(amount: number) {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}
