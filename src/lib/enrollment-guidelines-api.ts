import { enrollmentRequest } from '@/lib/enrollment-api-shared'

export type EnrollmentScheduleDay = {
  id: number
  dateLabel: string
  groupLabel: string
  dayLabel: string
  muted: boolean
  sortOrder: number
  published: boolean
}

export type EnrollmentBatchWindow = {
  id: number
  label: string
  timeLabel: string
  detail: string
  tone: 'active' | 'pause' | string
  sortOrder: number
  published: boolean
}

export type ScheduleDayInput = {
  id?: number
  dateLabel: string
  groupLabel: string
  dayLabel: string
  muted?: boolean
  sortOrder?: number
  published?: boolean
}

export type BatchWindowInput = {
  id?: number
  label: string
  timeLabel: string
  detail?: string
  tone?: string
  sortOrder?: number
  published?: boolean
}

export async function listScheduleDays(options?: { all?: boolean }) {
  const q = options?.all ? '?resource=schedule&all=1' : '?resource=schedule'
  return enrollmentRequest<{ items: EnrollmentScheduleDay[] }>(`/api/enrollment-guidelines.php${q}`)
}

export async function getScheduleDay(id: number) {
  return enrollmentRequest<{ item: EnrollmentScheduleDay }>(
    `/api/enrollment-guidelines.php?resource=schedule&id=${id}`,
  )
}

export async function createScheduleDay(input: ScheduleDayInput) {
  return enrollmentRequest<{ item: EnrollmentScheduleDay }>('/api/enrollment-guidelines.php', {
    method: 'POST',
    body: JSON.stringify({ ...input, resource: 'schedule' }),
  })
}

export async function updateScheduleDay(input: ScheduleDayInput & { id: number }) {
  return enrollmentRequest<{ item: EnrollmentScheduleDay }>('/api/enrollment-guidelines.php', {
    method: 'PUT',
    body: JSON.stringify({ ...input, resource: 'schedule' }),
  })
}

export async function deleteScheduleDay(id: number) {
  return enrollmentRequest<{ ok: true }>('/api/enrollment-guidelines.php', {
    method: 'DELETE',
    body: JSON.stringify({ id, resource: 'schedule' }),
  })
}

export async function listBatchWindows(options?: { all?: boolean }) {
  const q = options?.all ? '?resource=windows&all=1' : '?resource=windows'
  return enrollmentRequest<{ items: EnrollmentBatchWindow[] }>(`/api/enrollment-guidelines.php${q}`)
}

export async function getBatchWindow(id: number) {
  return enrollmentRequest<{ item: EnrollmentBatchWindow }>(
    `/api/enrollment-guidelines.php?resource=windows&id=${id}`,
  )
}

export async function createBatchWindow(input: BatchWindowInput) {
  return enrollmentRequest<{ item: EnrollmentBatchWindow }>('/api/enrollment-guidelines.php', {
    method: 'POST',
    body: JSON.stringify({ ...input, resource: 'windows' }),
  })
}

export async function updateBatchWindow(input: BatchWindowInput & { id: number }) {
  return enrollmentRequest<{ item: EnrollmentBatchWindow }>('/api/enrollment-guidelines.php', {
    method: 'PUT',
    body: JSON.stringify({ ...input, resource: 'windows' }),
  })
}

export async function deleteBatchWindow(id: number) {
  return enrollmentRequest<{ ok: true }>('/api/enrollment-guidelines.php', {
    method: 'DELETE',
    body: JSON.stringify({ id, resource: 'windows' }),
  })
}
