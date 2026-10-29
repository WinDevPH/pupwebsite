/** Philippine Time — used for all portal date/time display and parsing. */
export const PH_TIMEZONE = 'Asia/Manila'

const dateTimeOpts: Intl.DateTimeFormatOptions = {
  timeZone: PH_TIMEZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
}

const dateOpts: Intl.DateTimeFormatOptions = {
  timeZone: PH_TIMEZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}

const shortDateOpts: Intl.DateTimeFormatOptions = {
  timeZone: PH_TIMEZONE,
  month: 'short',
  day: 'numeric',
}

const timeOpts: Intl.DateTimeFormatOptions = {
  timeZone: PH_TIMEZONE,
  hour: 'numeric',
  minute: '2-digit',
}

const headingOpts: Intl.DateTimeFormatOptions = {
  timeZone: PH_TIMEZONE,
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
}

const longDateOpts: Intl.DateTimeFormatOptions = {
  timeZone: PH_TIMEZONE,
  month: 'long',
  day: 'numeric',
  year: 'numeric',
}

export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const raw = value.trim()
  if (!raw) return null

  // MySQL DATETIME without zone → treat as Asia/Manila wall time.
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(raw) && !/[zZ]|[+-]\d{2}:\d{2}$/.test(raw)) {
    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T')
    const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)
      ? `${normalized}:00`
      : normalized
    const date = new Date(`${withSeconds}+08:00`)
    return Number.isNaN(date.getTime()) ? null : date
  }

  // Date-only calendar values (events) — noon Manila to avoid day-boundary shifts.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T12:00:00+08:00`)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatPhDateTime(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseApiDate(value ?? null)
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-PH', dateTimeOpts).format(date)
}

export function formatPhDate(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseApiDate(value ?? null)
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-PH', dateOpts).format(date)
}

export function formatPhShortDate(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseApiDate(value ?? null)
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-PH', shortDateOpts).format(date)
}

export function formatPhTime(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseApiDate(value ?? null)
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-PH', timeOpts).format(date)
}

export function formatChatClock(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseApiDate(value ?? null)
  if (!date) return ''
  return new Intl.DateTimeFormat('en-PH', timeOpts).format(date)
}

const dayKeyOpts: Intl.DateTimeFormatOptions = {
  timeZone: PH_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}

export function formatPhDayKey(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseApiDate(value ?? null)
  if (!date) return ''
  return new Intl.DateTimeFormat('en-CA', dayKeyOpts).format(date)
}

function shiftDayKey(ymd: string, delta: number): string {
  const [year, month, day] = ymd.split('-').map(Number)
  if (!year || !month || !day) return ''
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10)
}

export function formatChatDayLabel(value: string | Date | null | undefined, now = new Date()): string {
  const date = value instanceof Date ? value : parseApiDate(value ?? null)
  if (!date) return ''
  const day = formatPhDayKey(date)
  const today = formatPhDayKey(now)
  if (!day || !today) return ''
  if (day === today) return 'Today'
  if (day === shiftDayKey(today, -1)) return 'Yesterday'
  return day.startsWith(`${today.slice(0, 4)}-`) ? formatPhShortDate(date) : formatPhDate(date)
}

export function chatStampBreaks(
  previous: string | Date | null | undefined,
  next: string | Date | null | undefined,
  gapMs = 5 * 60 * 1000,
) {
  const later = next instanceof Date ? next : parseApiDate(next ?? null)
  if (!later) return false
  const earlier = previous instanceof Date ? previous : parseApiDate(previous ?? null)
  if (!earlier) return true
  if (formatPhDayKey(earlier) !== formatPhDayKey(later)) return true
  return later.getTime() - earlier.getTime() >= gapMs
}

export function formatChatDivider(
  value: string | Date | null | undefined,
  previous?: string | Date | null,
  now = new Date(),
): string {
  const date = value instanceof Date ? value : parseApiDate(value ?? null)
  if (!date) return ''
  const prev = previous instanceof Date ? previous : parseApiDate(previous ?? null)
  const newDay = !prev || formatPhDayKey(prev) !== formatPhDayKey(date)
  if (newDay) return formatChatDayLabel(date, now)
  return formatChatClock(date)
}

export function formatPhLongDate(value: string | Date | null | undefined = new Date()): string {
  const date = value instanceof Date ? value : parseApiDate(value ?? null)
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', longDateOpts).format(date)
}

export function formatPhDayHeading(value: string | Date | null | undefined = new Date()): string {
  const date = value instanceof Date ? value : parseApiDate(value ?? null)
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-PH', headingOpts).format(date)
}

export function formatPhRelative(value: string | Date | null | undefined, now = Date.now()): string {
  const date = value instanceof Date ? value : parseApiDate(value ?? null)
  if (!date) return ''
  const diffMs = now - date.getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatPhShortDate(date)
}
