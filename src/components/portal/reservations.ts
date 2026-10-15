export type StoredReservation = {
  id: string
  shop: 'locker' | 'merch'
  item: string
  quantity: number
  total: string
  name: string
  year: string
  submittedAt: string
  status: 'Submitted' | 'Not sent'
}

const reservationStoreKey = 'pup-col-sc-reservations'

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
