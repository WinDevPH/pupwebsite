import type { AnnouncementRecord } from '@/lib/announcements-api'
import type { CalendarEventRecord } from '@/lib/calendar-api'
import { parseApiDate } from '@/lib/datetime'
import type { PortalRequestRecord } from '@/lib/requests-api'
import type { ReservationRecord } from '@/lib/reservations-api'

export const CHART_RANGES = [
  { id: 'all', label: 'All time' },
  { id: '12m', label: '12 Months' },
  { id: '30d', label: '30 days' },
  { id: '7d', label: '7 days' },
  { id: '24h', label: '24 hours' },
] as const

export type ChartRangeId = (typeof CHART_RANGES)[number]['id']

/** Brand-purple chart palette aligned with PUP COL-SC tokens. */
export const THEME_CHART = {
  requests: { from: '#dbc6ff', mid: '#8a3cf5', to: '#7524db' },
  reservations: { from: '#bf9aff', mid: '#5f18b8', to: '#330c69' },
  requestDonut: ['#7524db', '#8a3cf5', '#a066ff', '#bf9aff', '#491293'],
  reservationDonut: ['#330c69', '#5f18b8', '#8a3cf5', '#a066ff', '#dbc6ff'],
}

export type ChartSeriesPoint = {
  key: string
  label: string
  requests: number
  reservations: number
}

export type DonutSlice = {
  key: string
  label: string
  value: number
  color: string
}

export type DashboardKpis = {
  openRequests: number
  pendingReservations: number
  upcomingEvents: number
  publishedAnnouncements: number
  totalRequests: number
  totalReservations: number
  announcementTotal: number
}

export type QueueRow = {
  id: string
  kind: 'request' | 'reservation'
  title: string
  meta: string
  status: string
  href: string
  at: number
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const OPEN_REQUEST = new Set(['Submitted', 'Received', 'In review'])
const OPEN_RESERVATION = new Set(['pending', 'submitted'])

function startOfToday(now = new Date()) {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d
}

function rangeStart(range: ChartRangeId, now = new Date()): Date | null {
  if (range === 'all') return null
  const d = new Date(now)
  if (range === '24h') {
    d.setHours(d.getHours() - 24)
    return d
  }
  if (range === '7d') {
    d.setDate(d.getDate() - 7)
    return d
  }
  if (range === '30d') {
    d.setDate(d.getDate() - 30)
    return d
  }
  d.setFullYear(d.getFullYear() - 1)
  return d
}

function inRange(date: Date | null, from: Date | null, year: string) {
  if (!date) return false
  if (year !== 'all' && String(date.getFullYear()) !== year) return false
  if (from && date.getTime() < from.getTime()) return false
  return true
}

function bucketKey(date: Date, range: ChartRangeId): { key: string; label: string; order: number } {
  if (range === '24h') {
    const hour = date.getHours()
    return {
      key: `h-${hour}`,
      label: `${hour.toString().padStart(2, '0')}:00`,
      order: hour,
    }
  }
  if (range === '7d' || range === '30d') {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return {
      key,
      label: `${MONTHS[date.getMonth()]} ${date.getDate()}`,
      order: date.getTime(),
    }
  }
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  return {
    key,
    label: MONTHS[date.getMonth()] ?? key,
    order: date.getFullYear() * 100 + date.getMonth(),
  }
}

function emptyBuckets(range: ChartRangeId, now = new Date()): Map<string, ChartSeriesPoint & { order: number }> {
  const map = new Map<string, ChartSeriesPoint & { order: number }>()
  if (range === '24h') {
    for (let h = 0; h < 24; h += 1) {
      const key = `h-${h}`
      map.set(key, {
        key,
        label: `${String(h).padStart(2, '0')}:00`,
        requests: 0,
        reservations: 0,
        order: h,
      })
    }
    return map
  }
  if (range === '7d') {
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const b = bucketKey(d, range)
      map.set(b.key, { ...b, requests: 0, reservations: 0 })
    }
    return map
  }
  if (range === '30d') {
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const b = bucketKey(d, range)
      map.set(b.key, { ...b, requests: 0, reservations: 0 })
    }
    return map
  }
  // 12m / all → last 12 months
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const b = bucketKey(d, '12m')
    map.set(b.key, { ...b, requests: 0, reservations: 0 })
  }
  return map
}

export function yearOptions(now = new Date()) {
  const y = now.getFullYear()
  return [
    { value: 'all', label: 'All time' },
    { value: String(y), label: `This year (${y})` },
    { value: String(y - 1), label: `Last year (${y - 1})` },
  ]
}

export function periodOptions() {
  return [
    { value: 'all', label: 'All time' },
    { value: '30d', label: '30 days' },
    { value: '7d', label: '7 days' },
  ]
}

export function buildActivitySeries(
  requests: PortalRequestRecord[],
  reservations: ReservationRecord[],
  opts: { year: string; range: ChartRangeId },
  now = new Date(),
): ChartSeriesPoint[] {
  const from = rangeStart(opts.range, now)
  const buckets = emptyBuckets(opts.range === 'all' ? '12m' : opts.range, now)

  for (const item of requests) {
    const date = parseApiDate(item.submittedAt)
    if (!inRange(date, from, opts.year) || !date) continue
    const b = bucketKey(date, opts.range === 'all' ? '12m' : opts.range)
    const row = buckets.get(b.key)
    if (row) row.requests += 1
    else buckets.set(b.key, { ...b, requests: 1, reservations: 0 })
  }

  for (const item of reservations) {
    const date = parseApiDate(item.submittedAt)
    if (!inRange(date, from, opts.year) || !date) continue
    const b = bucketKey(date, opts.range === 'all' ? '12m' : opts.range)
    const row = buckets.get(b.key)
    if (row) row.reservations += 1
    else buckets.set(b.key, { ...b, requests: 0, reservations: 1 })
  }

  return [...buckets.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, ...rest }) => rest)
}

export function buildKpis(
  requests: PortalRequestRecord[],
  reservations: ReservationRecord[],
  events: CalendarEventRecord[],
  announcements: AnnouncementRecord[],
  now = new Date(),
): DashboardKpis {
  const today = startOfToday(now)
  return {
    openRequests: requests.filter((r) => OPEN_REQUEST.has(r.status)).length,
    pendingReservations: reservations.filter((r) => OPEN_RESERVATION.has(r.status)).length,
    upcomingEvents: events.filter((e) => {
      if (!e.published) return false
      const end = parseApiDate(e.end || e.start)
      return end ? end.getTime() >= today.getTime() : false
    }).length,
    publishedAnnouncements: announcements.filter((a) => a.published).length,
    totalRequests: requests.length,
    totalReservations: reservations.length,
    announcementTotal: announcements.length,
  }
}

export function buildRequestStatusSlices(requests: PortalRequestRecord[]): DonutSlice[] {
  const counts = new Map<string, number>()
  for (const item of requests) {
    const key = item.status || 'Other'
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const colors = THEME_CHART.requestDonut
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value], i) => ({
      key: label,
      label,
      value,
      color: colors[i % colors.length]!,
    }))
}

export function buildReservationMixSlices(reservations: ReservationRecord[]): DonutSlice[] {
  const counts = { locker: 0, merch: 0, other: 0 }
  for (const item of reservations) {
    if (item.shop === 'locker') counts.locker += 1
    else if (item.shop === 'merch') counts.merch += 1
    else counts.other += 1
  }
  const colors = THEME_CHART.reservationDonut
  return [
    { key: 'merch', label: 'Merch', value: counts.merch, color: colors[0]! },
    { key: 'locker', label: 'Locker', value: counts.locker, color: colors[1]! },
    ...(counts.other
      ? [{ key: 'other', label: 'Other', value: counts.other, color: colors[2]! }]
      : []),
  ].filter((s) => s.value > 0)
}

export function buildQueueRows(
  requests: PortalRequestRecord[],
  reservations: ReservationRecord[],
  limit = 8,
): QueueRow[] {
  const rows: QueueRow[] = []

  for (const item of requests) {
    if (!OPEN_REQUEST.has(item.status)) continue
    const at = parseApiDate(item.submittedAt)?.getTime() ?? 0
    rows.push({
      id: `request-${item.dbId ?? item.id}`,
      kind: 'request',
      title: item.subject || 'Untitled request',
      meta: item.name,
      status: item.status,
      href: item.dbId ? `/admin/requests/${item.dbId}` : '/admin/requests',
      at,
    })
  }

  for (const item of reservations) {
    if (!OPEN_RESERVATION.has(item.status)) continue
    const at = parseApiDate(item.submittedAt)?.getTime() ?? 0
    rows.push({
      id: `reservation-${item.id}`,
      kind: 'reservation',
      title: `${item.itemName} × ${item.quantity}`,
      meta: `${item.name} · ${item.shop}`,
      status: item.status,
      href: `/admin/reservations/${item.id}/edit`,
      at,
    })
  }

  return rows.sort((a, b) => b.at - a.at).slice(0, limit)
}

export function filterByPeriod<T extends { at?: number; submittedAt?: string }>(
  items: T[],
  period: string,
  getDate: (item: T) => Date | null,
  now = new Date(),
): T[] {
  if (period === 'all') return items
  const from = rangeStart(period as ChartRangeId, now)
  if (!from) return items
  return items.filter((item) => {
    const date = getDate(item)
    return date ? date.getTime() >= from.getTime() : false
  })
}

export function countCompact(value: number) {
  return Math.round(value).toLocaleString('en-PH')
}
