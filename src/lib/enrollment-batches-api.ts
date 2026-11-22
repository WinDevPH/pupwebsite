import { enrollmentRequest } from '@/lib/enrollment-api-shared'

export type EnrollmentAppointmentBatch = {
  id: number
  label: string
  windowLabel: string
  scheduledCount: number
  status: 'Serving' | 'Up next' | 'Closed' | string
  sortOrder: number
  published: boolean
}

export type AppointmentBatchInput = {
  id?: number
  label: string
  windowLabel: string
  scheduledCount?: number
  status?: string
  sortOrder?: number
  published?: boolean
}

export type BatchStudent = {
  id: number
  trackingCode: string
  fullName: string
  studentNumber: string
  yearLevel: string
  enrollmentDate: string
  enrollmentDateLabel: string
  timeSlot: string
  timeSlotLabel: string
  slotId: number | null
  status: 'pending' | 'approved' | 'rejected' | string
  createdAt: string | null
}

export type BatchSlotSummary = {
  id: number
  value: string
  label: string
  capacity: number
  bookedCount: number
  remaining: number
  full: boolean
}

export type BatchRoster = {
  item: EnrollmentAppointmentBatch
  students: BatchStudent[]
  assignable: BatchStudent[]
  slots: BatchSlotSummary[]
  autoNote?: string
}

export async function listAppointmentBatches(options?: { all?: boolean }) {
  const q = options?.all ? '?all=1' : ''
  return enrollmentRequest<{ items: EnrollmentAppointmentBatch[]; walkIn: string }>(
    `/api/enrollment-batches.php${q}`,
  )
}

export async function getAppointmentBatch(id: number) {
  return enrollmentRequest<{ item: EnrollmentAppointmentBatch }>(
    `/api/enrollment-batches.php?id=${id}`,
  )
}

export async function getAppointmentBatchRoster(id: number) {
  return enrollmentRequest<BatchRoster>(`/api/enrollment-batches.php?id=${id}&resource=roster`)
}

export async function assignAppointmentToBatch(input: {
  batchId: number
  appointmentId: number
  slotId?: number
}) {
  return enrollmentRequest<
    BatchRoster & { student: BatchStudent }
  >('/api/enrollment-batches.php', {
    method: 'PUT',
    body: JSON.stringify({
      resource: 'assign',
      batchId: input.batchId,
      appointmentId: input.appointmentId,
      ...(input.slotId != null ? { slotId: input.slotId } : {}),
    }),
  })
}

export async function assignAllApprovedToBatch(batchId: number) {
  return enrollmentRequest<
    BatchRoster & { assigned: number; failed: number }
  >('/api/enrollment-batches.php', {
    method: 'PUT',
    body: JSON.stringify({ resource: 'assign-all', batchId }),
  })
}

export async function createAppointmentBatch(input: AppointmentBatchInput) {
  return enrollmentRequest<{ item: EnrollmentAppointmentBatch }>('/api/enrollment-batches.php', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateAppointmentBatch(input: AppointmentBatchInput & { id: number }) {
  return enrollmentRequest<{ item: EnrollmentAppointmentBatch }>('/api/enrollment-batches.php', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteAppointmentBatch(id: number) {
  return enrollmentRequest<{ ok: true }>('/api/enrollment-batches.php', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}

export async function updateEnrollmentWalkIn(walkIn: 'OPEN' | 'CLOSED') {
  return enrollmentRequest<{ ops: { walkIn: string } }>('/api/enrollment-batches.php', {
    method: 'PUT',
    body: JSON.stringify({ resource: 'ops', walkIn }),
  })
}
