import type { ReservationRecord, ReservationStatus } from '@/lib/reservations-api'
import { RESERVATION_STATUSES } from '@/lib/reservations-api'

export type StoredReservation = {
  id: string
  shop: 'locker' | 'merch'
  item: string
  quantity: number
  total: string
  name: string
  year: string
  submittedAt: string
  status: string
  rentalType?: 'new' | 'renewal'
}

const reservationStoreKey = 'pup-col-sc-reservations'

const STATUS_LABEL: Record<ReservationStatus, string> = Object.fromEntries(
  RESERVATION_STATUSES.map((entry) => [entry.value, entry.label]),
) as Record<ReservationStatus, string>

export function reservationStatusLabel(status: string) {
  const key = status.trim().toLowerCase() as ReservationStatus
  if (STATUS_LABEL[key]) return STATUS_LABEL[key]
  if (status === 'Submitted' || status === 'Not sent') return status
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function reservationFromApi(record: ReservationRecord): StoredReservation {
  return {
    id: record.code,
    shop: record.shop,
    item: record.itemName,
    quantity: record.quantity,
    total: record.total,
    name: record.name,
    year: record.year || record.yearLevel,
    submittedAt: record.submittedAt,
    status: reservationStatusLabel(record.status),
    rentalType: record.shop === 'locker' && record.rentalType === 'renewal' ? 'renewal' : 'new',
  }
}

export function readReservations(): StoredReservation[] {
  try {
    const raw = localStorage.getItem(reservationStoreKey)
    const parsed = raw ? (JSON.parse(raw) as StoredReservation[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveReservation(entry: StoredReservation) {
  const next = [entry, ...readReservations().filter((item) => item.id !== entry.id)]
  localStorage.setItem(reservationStoreKey, JSON.stringify(next))
}

export function findReservation(id: string) {
  const needle = id.trim().toUpperCase()
  return readReservations().find((item) => item.id.toUpperCase() === needle) ?? null
}
