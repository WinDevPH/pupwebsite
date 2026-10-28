import { parseApiDate } from '@/lib/datetime'
import {
  formatReservationMoney,
  type ReservationRecord,
  type ReservationShop,
  type ReservationStatus,
} from '@/lib/reservations-api'

export type IncomeShopFilter = 'all' | ReservationShop
export type IncomeBasisId = 'recognized' | 'pipeline' | 'booked' | 'all'
export type IncomePeriodId = 'all' | 'year' | 'last-year' | '12m' | '30d' | '7d' | 'custom'

export const INCOME_BASES: { id: IncomeBasisId; label: string; hint: string }[] = [
  { id: 'recognized', label: 'Recognized', hint: 'Confirmed and fulfilled fees' },
  { id: 'pipeline', label: 'Pipeline', hint: 'Pending and submitted' },
  { id: 'booked', label: 'Booked', hint: 'Everything except cancelled' },
  { id: 'all', label: 'All', hint: 'Includes cancelled' },
]

export const INCOME_PERIODS: { id: IncomePeriodId; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: 'year', label: 'This year' },
  { id: 'last-year', label: 'Last year' },
  { id: '12m', label: '12 months' },
  { id: '30d', label: '30 days' },
  { id: '7d', label: '7 days' },
  { id: 'custom', label: 'Custom' },
]

export const INCOME_BASIS_STATUSES: Record<IncomeBasisId, ReservationStatus[]> = {
  recognized: ['confirmed', 'fulfilled'],
  pipeline: ['pending', 'submitted'],
  booked: ['pending', 'submitted', 'confirmed', 'fulfilled'],
  all: ['pending', 'submitted', 'confirmed', 'fulfilled', 'cancelled'],
}

export type IncomeFilters = {
  shop: IncomeShopFilter
  basis: IncomeBasisId
  statuses: ReservationStatus[]
  period: IncomePeriodId
  from: string
  to: string
  query: string
}

export const DEFAULT_INCOME_FILTERS: IncomeFilters = {
  shop: 'all',
  basis: 'recognized',
  statuses: [...INCOME_BASIS_STATUSES.recognized],
  period: 'year',
  from: '',
  to: '',
  query: '',
}

export type IncomeSeriesPoint = {
  key: string
  label: string
  merch: number
  locker: number
}

export type IncomeItemRow = {
  key: string
  name: string
  shop: ReservationShop
  count: number
  quantity: number
  amount: number
}

export type IncomeKpis = {
  total: number
  count: number
  average: number
  merch: number
  locker: number
  cancelled: number
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function amountOf(item: ReservationRecord) {
  return Number(item.totalAmount) || Number(item.unitPrice) * Math.max(1, Number(item.quantity) || 1) || 0
}

export function filtersAreDefault(filters: IncomeFilters) {
  const a = DEFAULT_INCOME_FILTERS
  return (
    filters.shop === a.shop &&
    filters.basis === a.basis &&
    filters.period === a.period &&
    filters.from === a.from &&
    filters.to === a.to &&
    filters.query.trim() === '' &&
    sameStatuses(filters.statuses, a.statuses)
  )
}

function sameStatuses(left: ReservationStatus[], right: ReservationStatus[]) {
  if (left.length !== right.length) return false
  const set = new Set(right)
  return left.every((status) => set.has(status))
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

function parseDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T12:00:00+08:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function periodBounds(period: IncomePeriodId, from: string, to: string, now = new Date()) {
  if (period === 'custom') {
    const start = parseDay(from)
    const end = parseDay(to)
    return {
      start: start ? startOfDay(start) : null,
      end: end ? endOfDay(end) : null,
    }
  }
  if (period === 'all') return { start: null, end: null }
  if (period === 'year') {
    return {
      start: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0),
      end: now,
    }
  }
  if (period === 'last-year') {
    return {
      start: new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0),
      end: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999),
    }
  }
  const start = new Date(now)
  if (period === '7d') start.setDate(start.getDate() - 6)
  else if (period === '30d') start.setDate(start.getDate() - 29)
  else start.setFullYear(start.getFullYear() - 1)
  start.setHours(0, 0, 0, 0)
  return { start, end: now }
}

export function filterIncomeReservations(
  items: ReservationRecord[],
  filters: IncomeFilters,
  now = new Date(),
) {
  const needle = filters.query.trim().toLowerCase()
  const statuses = new Set(filters.statuses.length ? filters.statuses : INCOME_BASIS_STATUSES[filters.basis])
  const { start, end } = periodBounds(filters.period, filters.from, filters.to, now)

  return items.filter((item) => {
    if (filters.shop !== 'all' && item.shop !== filters.shop) return false
    if (!statuses.has(item.status)) return false
    const date = parseApiDate(item.submittedAt)
    if (!date) return false
    if (start && date < start) return false
    if (end && date > end) return false
    if (!needle) return true
    const haystack =
      `${item.code} ${item.name} ${item.email} ${item.itemName} ${item.studentId} ${item.itemKey}`.toLowerCase()
    return haystack.includes(needle)
  })
}

export function buildIncomeKpis(items: ReservationRecord[]): IncomeKpis {
  let total = 0
  let merch = 0
  let locker = 0
  let cancelled = 0
  for (const item of items) {
    const amount = amountOf(item)
    total += amount
    if (item.shop === 'merch') merch += amount
    else if (item.shop === 'locker') locker += amount
    if (item.status === 'cancelled') cancelled += amount
  }
  return {
    total,
    count: items.length,
    average: items.length ? total / items.length : 0,
    merch,
    locker,
    cancelled,
  }
}

export function buildIncomeStatusSlices(items: ReservationRecord[]) {
  const amounts = new Map<ReservationStatus, number>()
  for (const item of items) {
    amounts.set(item.status, (amounts.get(item.status) || 0) + amountOf(item))
  }
  return [...amounts.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([status, value]) => ({ status, value }))
}

export function buildIncomeTopItems(items: ReservationRecord[], limit = 6): IncomeItemRow[] {
  const map = new Map<string, IncomeItemRow>()
  for (const item of items) {
    const key = `${item.shop}:${item.itemKey || item.itemName}`
    const current = map.get(key)
    const amount = amountOf(item)
    if (current) {
      current.count += 1
      current.quantity += Math.max(1, item.quantity || 1)
      current.amount += amount
    } else {
      map.set(key, {
        key,
        name: item.itemName || item.itemKey || 'Item',
        shop: item.shop,
        count: 1,
        quantity: Math.max(1, item.quantity || 1),
        amount,
      })
    }
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount).slice(0, limit)
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function buildIncomeSeries(
  items: ReservationRecord[],
  filters: IncomeFilters,
  now = new Date(),
): IncomeSeriesPoint[] {
  const { start, end } = periodBounds(filters.period, filters.from, filters.to, now)
  const to = end ?? now
  const from = start ?? (items.reduce<Date | null>((earliest, item) => {
    const date = parseApiDate(item.submittedAt)
    if (!date) return earliest
    return !earliest || date < earliest ? date : earliest
  }, null) ?? new Date(now.getFullYear(), now.getMonth() - 11, 1))

  const spanDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1)
  const daily = filters.period === '7d' || filters.period === '30d' || (filters.period === 'custom' && spanDays <= 45)

  const buckets = new Map<string, IncomeSeriesPoint & { order: number }>()
  if (daily) {
    const cursor = startOfDay(from)
    const last = startOfDay(to)
    while (cursor <= last) {
      const key = dayKey(cursor)
      buckets.set(key, {
        key,
        label: `${MONTHS[cursor.getMonth()]} ${cursor.getDate()}`,
        merch: 0,
        locker: 0,
        order: cursor.getTime(),
      })
      cursor.setDate(cursor.getDate() + 1)
    }
  } else {
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1)
    const last = new Date(to.getFullYear(), to.getMonth(), 1)
    while (cursor <= last) {
      const key = monthKey(cursor)
      buckets.set(key, {
        key,
        label: MONTHS[cursor.getMonth()] ?? key,
        merch: 0,
        locker: 0,
        order: cursor.getTime(),
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }
  }

  for (const item of items) {
    const date = parseApiDate(item.submittedAt)
    if (!date) continue
    const key = daily ? dayKey(date) : monthKey(date)
    const row = buckets.get(key)
    if (!row) continue
    const amount = amountOf(item)
    if (item.shop === 'merch') row.merch += amount
    else row.locker += amount
  }

  return [...buckets.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, ...rest }) => rest)
}

export function incomeCsv(items: ReservationRecord[]) {
  const header = [
    'Code',
    'Shop',
    'Item',
    'Quantity',
    'Unit price',
    'Total',
    'Status',
    'Name',
    'Email',
    'Student ID',
    'Submitted',
  ]
  const lines = items.map((item) =>
    [
      item.code,
      item.shop,
      item.itemName,
      String(item.quantity),
      String(item.unitPrice),
      String(amountOf(item)),
      item.status,
      item.name,
      item.email,
      item.studentId,
      item.submittedAt,
    ]
      .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
      .join(','),
  )
  return [header.join(','), ...lines].join('\n')
}

export function pesosCompact(value: number) {
  const n = Math.abs(value)
  if (n >= 1_000_000) return `₱${(value / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `₱${Math.round(value / 1000)}k`
  if (n >= 1000) return `₱${(value / 1000).toFixed(1)}k`
  return formatReservationMoney(value)
}
