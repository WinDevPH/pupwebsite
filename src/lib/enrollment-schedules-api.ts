import { enrollmentRequest } from '@/lib/enrollment-api-shared'

export type ScheduleStatus = 'pending' | 'approved' | 'rejected'

export type ScheduleOfferingSnapshot = {
  id: string
  code: string
  title: string
  section: string
  units: number
  days: string[]
  startHour: number
  endHour: number
  timeLabel: string
}

export type EnrollmentSchedule = {
  id: number
  trackingCode: string
  studentName: string
  studentNumber: string
  offerings: ScheduleOfferingSnapshot[]
  totalUnits: number
  status: ScheduleStatus
  adminNote: string | null
  reviewedAt: string | null
  reviewedBy: number | null
  createdAt: string
  updatedAt: string
}

export type ScheduleCounts = {
  all: number
  pending: number
  approved: number
  rejected: number
}

export type ScheduleSubmitInput = {
  studentName: string
  studentNumber: string
  offerings: ScheduleOfferingSnapshot[]
}

export async function submitSchedule(input: ScheduleSubmitInput) {
  return enrollmentRequest<{
    item: { id: number; trackingCode: string; status: ScheduleStatus; totalUnits: number }
  }>('/api/enrollment-schedules.php', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function createSchedule(
  input: ScheduleSubmitInput & { status?: ScheduleStatus; adminNote?: string },
) {
  return enrollmentRequest<{ item: EnrollmentSchedule }>('/api/enrollment-schedules.php', {
    method: 'POST',
    body: JSON.stringify({ ...input, adminCreate: true }),
  })
}

export async function listSchedules(options?: { status?: ScheduleStatus | 'all' }) {
  const params = new URLSearchParams()
  if (options?.status && options.status !== 'all') {
    params.set('status', options.status)
  }
  const q = params.toString()
  return enrollmentRequest<{ items: EnrollmentSchedule[]; counts: ScheduleCounts }>(
    `/api/enrollment-schedules.php${q ? `?${q}` : ''}`,
  )
}

export async function getSchedule(id: number) {
  return enrollmentRequest<{ item: EnrollmentSchedule }>(`/api/enrollment-schedules.php?id=${id}`)
}

export async function updateScheduleStatus(input: {
  id: number
  status: ScheduleStatus
  adminNote?: string
}) {
  return enrollmentRequest<{ item: EnrollmentSchedule }>('/api/enrollment-schedules.php', {
    method: 'PUT',
    body: JSON.stringify({
      id: input.id,
      resource: 'status',
      status: input.status,
      adminNote: input.adminNote ?? '',
    }),
  })
}

export async function updateScheduleDetails(input: {
  id: number
  studentName: string
  studentNumber: string
  offerings: ScheduleOfferingSnapshot[]
  status?: ScheduleStatus
  adminNote?: string
}) {
  return enrollmentRequest<{ item: EnrollmentSchedule }>('/api/enrollment-schedules.php', {
    method: 'PUT',
    body: JSON.stringify({
      id: input.id,
      resource: 'details',
      studentName: input.studentName,
      studentNumber: input.studentNumber,
      offerings: input.offerings,
      status: input.status,
      adminNote: input.adminNote,
    }),
  })
}

export async function deleteSchedule(id: number) {
  return enrollmentRequest<{ ok: true }>('/api/enrollment-schedules.php', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}
