import type { PortalRequestRecord } from '@/lib/requests-api'
import type { ReservationRecord } from '@/lib/reservations-api'

export type CustomerRecord = {
  key: string
  name: string
  email: string
  mobile: string
  studentId: string
  year: string
  reservations: ReservationRecord[]
  requests: PortalRequestRecord[]
  lockerCount: number
  merchCount: number
  requestCount: number
  totalAmount: number
  activeTotal: number
  lastAt: string
}

function norm(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

export function submittedSortValue(value: string) {
  const t = new Date(value.includes('T') ? value : value.replace(' ', 'T')).getTime()
  return Number.isNaN(t) ? 0 : t
}

function toBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(raw: string) {
  const padded = raw.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))
}

export function encodeCustomerKey(key: string) {
  return toBase64Url(key)
}

export function decodeCustomerKey(raw: string | undefined) {
  if (!raw) return ''
  try {
    if (/^[A-Za-z0-9_-]+$/.test(raw)) {
      const decoded = fromBase64Url(raw)
      if (/^[esrq]:/.test(decoded)) return decoded
    }
  } catch {
    /* fall through to legacy keys */
  }
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export function customerInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function reservationTokens(item: ReservationRecord) {
  const tokens: string[] = []
  const email = norm(item.email)
  const studentId = norm(item.studentId)
  if (email) tokens.push(`e:${email}`)
  if (studentId) tokens.push(`s:${studentId}`)
  if (tokens.length === 0) tokens.push(`r:${item.id}`)
  return tokens
}

function requestTokens(item: PortalRequestRecord) {
  const email = norm(item.email)
  return email ? [`e:${email}`] : [`q:${item.id}`]
}

function pickLatestValue(
  reservations: ReservationRecord[],
  read: (item: ReservationRecord) => string,
) {
  for (const item of reservations) {
    const value = read(item).trim()
    if (value) return value
  }
  return ''
}

export function buildCustomers(
  reservations: ReservationRecord[],
  requests: PortalRequestRecord[] = [],
): CustomerRecord[] {
  const parent = new Map<string, string>()

  function find(id: string): string {
    const seen = new Set<string>()
    let cur = id
    while (parent.get(cur) && parent.get(cur) !== cur && !seen.has(cur)) {
      seen.add(cur)
      cur = parent.get(cur) as string
    }
    if (!parent.has(cur)) parent.set(cur, cur)
    return cur
  }

  function union(a: string, b: string) {
    const pa = find(a)
    const pb = find(b)
    if (pa !== pb) parent.set(pb, pa)
  }

  function link(tokens: string[]) {
    tokens.forEach((token) => find(token))
    for (let i = 1; i < tokens.length; i += 1) union(tokens[0], tokens[i])
  }

  for (const item of reservations) link(reservationTokens(item))
  for (const item of requests) link(requestTokens(item))

  const buckets = new Map<string, { reservations: ReservationRecord[]; requests: PortalRequestRecord[] }>()

  function bucketFor(tokens: string[]) {
    const key = find(tokens[0])
    let node = buckets.get(key)
    if (!node) {
      node = { reservations: [], requests: [] }
      buckets.set(key, node)
    }
    return node
  }

  for (const item of reservations) bucketFor(reservationTokens(item)).reservations.push(item)
  for (const item of requests) bucketFor(requestTokens(item)).requests.push(item)

  const customers: CustomerRecord[] = []
  for (const [root, node] of buckets) {
    const reservationsByDate = [...node.reservations].sort(
      (a, b) => submittedSortValue(b.submittedAt) - submittedSortValue(a.submittedAt),
    )
    const requestsByDate = [...node.requests].sort(
      (a, b) => submittedSortValue(b.submittedAt) - submittedSortValue(a.submittedAt),
    )
    const latestReservation = reservationsByDate[0]
    const latestRequest = requestsByDate[0]
    const name =
      pickLatestValue(reservationsByDate, (item) => item.name) || latestRequest?.name.trim() || 'Unknown'
    const email = pickLatestValue(reservationsByDate, (item) => item.email) || latestRequest?.email.trim() || ''
    const studentId = pickLatestValue(reservationsByDate, (item) => item.studentId)
    const mobile = pickLatestValue(reservationsByDate, (item) => item.mobile)
    const year = pickLatestValue(reservationsByDate, (item) => item.year || item.yearLevel)
    const lastAt = [latestReservation?.submittedAt, latestRequest?.submittedAt]
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => submittedSortValue(b) - submittedSortValue(a))[0] ?? ''

    customers.push(
      finalizeCustomer({
        key: email ? `e:${norm(email)}` : studentId ? `s:${norm(studentId)}` : root,
        name,
        email,
        mobile,
        studentId,
        year,
        reservations: reservationsByDate,
        requests: requestsByDate,
        lastAt,
      }),
    )
  }

  const byEmail = new Map<string, CustomerRecord>()
  const merged: CustomerRecord[] = []
  for (const customer of customers) {
    const email = norm(customer.email)
    if (!email) {
      merged.push(customer)
      continue
    }
    const existing = byEmail.get(email)
    if (!existing) {
      byEmail.set(email, customer)
      merged.push(customer)
      continue
    }
    const reservations = [...existing.reservations, ...customer.reservations].sort(
      (a, b) => submittedSortValue(b.submittedAt) - submittedSortValue(a.submittedAt),
    )
    const requests = [...existing.requests, ...customer.requests].sort(
      (a, b) => submittedSortValue(b.submittedAt) - submittedSortValue(a.submittedAt),
    )
    Object.assign(
      existing,
      finalizeCustomer({
        ...existing,
        name: existing.name !== 'Unknown' ? existing.name : customer.name,
        mobile: existing.mobile || customer.mobile,
        studentId: existing.studentId || customer.studentId,
        year: existing.year || customer.year,
        reservations,
        requests,
        lastAt:
          submittedSortValue(customer.lastAt) > submittedSortValue(existing.lastAt)
            ? customer.lastAt
            : existing.lastAt,
      }),
    )
  }

  return merged.sort(
    (a, b) => submittedSortValue(b.lastAt) - submittedSortValue(a.lastAt) || a.name.localeCompare(b.name),
  )
}

function finalizeCustomer(
  input: Pick<
    CustomerRecord,
    'key' | 'name' | 'email' | 'mobile' | 'studentId' | 'year' | 'reservations' | 'requests' | 'lastAt'
  >,
): CustomerRecord {
  const locker = input.reservations.filter((item) => item.shop === 'locker')
  const merch = input.reservations.filter((item) => item.shop === 'merch')
  const active = input.reservations.filter((item) => item.status !== 'cancelled')
  return {
    ...input,
    lockerCount: locker.length,
    merchCount: merch.length,
    requestCount: input.requests.length,
    totalAmount: input.reservations.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0),
    activeTotal: active.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0),
  }
}

export function findCustomer(customers: CustomerRecord[], key: string) {
  if (!key) return null
  return (
    customers.find((item) => item.key === key) ??
    customers.find((item) => encodeCustomerKey(item.key) === key) ??
    null
  )
}
