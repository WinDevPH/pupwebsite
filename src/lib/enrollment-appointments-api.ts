import { enrollmentRequest } from '@/lib/enrollment-api-shared'

export type AppointmentStatus = 'pending' | 'approved' | 'rejected'

export type EnrollmentAppointment = {
  id: number
  trackingCode: string
  fullName: string
  studentNumber: string
  yearLevel: string
  classification: 'regular' | 'irregular' | string
  enrollmentDate: string
  enrollmentDateLabel: string
  dateId?: number | null
  timeSlot: string
  timeSlotLabel: string
  slotId?: number | null
  checkStanding: boolean
  checkSchedule: boolean
  checkPetition: boolean
  paymentMode: string
  referenceNo: string
  proofName: string
  hasProof: boolean
  proofUrl?: string
  proofDownloadUrl?: string
  status: AppointmentStatus
  adminNote: string | null
  reviewedAt: string | null
  reviewedBy: number | null
  createdAt: string
  updatedAt: string
}

export type AppointmentSubmitResult = {
  id: number
  trackingCode: string
  status: AppointmentStatus
  createdAt: string | null
}

export type AppointmentCounts = {
  all: number
  pending: number
  approved: number
  rejected: number
}

export type AppointmentDetailsInput = {
  fullName: string
  studentNumber: string
  yearLevel: string
  classification: 'regular' | 'irregular' | string
  enrollmentDate: string
  enrollmentDateLabel?: string
  dateId?: number
  timeSlot: string
  timeSlotLabel?: string
  slotId?: number
  checkStanding?: boolean
  checkSchedule?: boolean
  checkPetition?: boolean
  paymentMode: string
  referenceNo?: string
  status?: AppointmentStatus
  adminNote?: string
}

export async function submitAppointment(form: FormData) {
  return enrollmentRequest<{ item: AppointmentSubmitResult }>('/api/enrollment-appointments.php', {
    method: 'POST',
    body: form,
  })
}

function appendAppointmentFields(form: FormData, input: AppointmentDetailsInput) {
  form.set('fullName', input.fullName)
  form.set('studentNumber', input.studentNumber)
  form.set('yearLevel', input.yearLevel)
  form.set('classification', input.classification)
  form.set('enrollmentDate', input.enrollmentDate)
  form.set('enrollmentDateLabel', input.enrollmentDateLabel ?? '')
  if (input.dateId != null) form.set('dateId', String(input.dateId))
  form.set('timeSlot', input.timeSlot)
  form.set('timeSlotLabel', input.timeSlotLabel ?? '')
  if (input.slotId != null) form.set('slotId', String(input.slotId))
  form.set('checkStanding', input.checkStanding ? '1' : '0')
  form.set('checkSchedule', input.checkSchedule ? '1' : '0')
  form.set('checkPetition', input.checkPetition ? '1' : '0')
  form.set('paymentMode', input.paymentMode)
  form.set('referenceNo', input.referenceNo ?? '')
  if (input.status) form.set('status', input.status)
  if (input.adminNote !== undefined) form.set('adminNote', input.adminNote)
}

export async function createAppointment(
  input: AppointmentDetailsInput,
  proofFile?: File | null,
) {
  if (proofFile) {
    const form = new FormData()
    appendAppointmentFields(form, input)
    form.set('proof', proofFile)
    return enrollmentRequest<{ item: EnrollmentAppointment }>('/api/enrollment-appointments.php', {
      method: 'POST',
      body: form,
    })
  }
  return enrollmentRequest<{ item: EnrollmentAppointment }>('/api/enrollment-appointments.php', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function listAppointments(options?: { status?: AppointmentStatus | 'all' }) {
  const params = new URLSearchParams({ all: '1' })
  if (options?.status && options.status !== 'all') {
    params.set('status', options.status)
  }
  return enrollmentRequest<{ items: EnrollmentAppointment[]; counts: AppointmentCounts }>(
    `/api/enrollment-appointments.php?${params.toString()}`,
  )
}

export async function getAppointment(id: number) {
  return enrollmentRequest<{ item: EnrollmentAppointment }>(
    `/api/enrollment-appointments.php?id=${id}`,
  )
}

export async function updateAppointmentStatus(input: {
  id: number
  status: AppointmentStatus
  adminNote?: string
}) {
  // POST + _method so shared hosts that block PUT still accept approve/reject.
  const form = new FormData()
  form.set('_method', 'PUT')
  form.set('id', String(input.id))
  form.set('resource', 'status')
  form.set('status', input.status)
  form.set('adminNote', input.adminNote ?? '')
  return enrollmentRequest<{ item: EnrollmentAppointment }>('/api/enrollment-appointments.php', {
    method: 'POST',
    body: form,
  })
}

export async function updateAppointmentDetails(
  input: AppointmentDetailsInput & { id: number },
  proofFile?: File | null,
) {
  if (proofFile) {
    const form = new FormData()
    form.set('_method', 'PUT')
    form.set('id', String(input.id))
    form.set('resource', 'details')
    appendAppointmentFields(form, input)
    form.set('proof', proofFile)
    return enrollmentRequest<{ item: EnrollmentAppointment }>('/api/enrollment-appointments.php', {
      method: 'POST',
      body: form,
    })
  }
  return enrollmentRequest<{ item: EnrollmentAppointment }>('/api/enrollment-appointments.php', {
    method: 'PUT',
    body: JSON.stringify({
      ...input,
      resource: 'details',
    }),
  })
}

export async function deleteAppointment(id: number) {
  return enrollmentRequest<{ ok: true }>('/api/enrollment-appointments.php', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}

export function appointmentProofUrl(id: number, opts?: { download?: boolean }) {
  if (opts?.download) {
    return `/api/enrollment-appointments.php?download=1&id=${id}`
  }
  return `/api/enrollment-appointments.php?download=1&id=${id}&inline=1`
}
