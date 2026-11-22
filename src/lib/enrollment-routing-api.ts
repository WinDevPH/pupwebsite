import { enrollmentRequest } from '@/lib/enrollment-api-shared'

export type EnrollmentRoutingSettings = {
  termBanner: string
  scFeeLabel: string
  yearLevels: { value: string; label: string; description?: string }[]
}

export type EnrollmentDate = {
  id: number
  value: string
  label: string
  description: string
  sortOrder: number
  published: boolean
}

export type EnrollmentTimeSlot = {
  id: number
  value: string
  label: string
  description: string
  capacity: number
  batchId: number | null
  bookedCount: number
  remaining: number
  full: boolean
  sortOrder: number
  published: boolean
}

export type EnrollmentPaymentChannel = {
  id: number
  key: string
  title: string
  lines: string[]
  copyValue: string
  sortOrder: number
  published: boolean
}

export type EnrollmentRoutingStep = {
  id: number
  step: string
  office: string
  signatureNote: string | null
  sortOrder: number
  published: boolean
}

export type EnrollmentRoutingBundle = {
  settings: EnrollmentRoutingSettings
  dates: EnrollmentDate[]
  slots: EnrollmentTimeSlot[]
  channels: EnrollmentPaymentChannel[]
  steps: EnrollmentRoutingStep[]
}

export async function getRoutingBundle(options?: { all?: boolean }) {
  const q = options?.all ? '?resource=bundle&all=1' : '?resource=bundle'
  return enrollmentRequest<EnrollmentRoutingBundle>(`/api/enrollment-routing.php${q}`)
}

export async function updateRoutingSettings(input: Partial<EnrollmentRoutingSettings>) {
  return enrollmentRequest<{ settings: EnrollmentRoutingSettings }>('/api/enrollment-routing.php', {
    method: 'PUT',
    body: JSON.stringify({ ...input, resource: 'settings' }),
  })
}

export async function listRoutingDates(options?: { all?: boolean }) {
  const q = options?.all ? '?resource=dates&all=1' : '?resource=dates'
  return enrollmentRequest<{ items: EnrollmentDate[] }>(`/api/enrollment-routing.php${q}`)
}

export async function createRoutingDate(input: Omit<EnrollmentDate, 'id' | 'published'> & { published?: boolean }) {
  return enrollmentRequest<{ item: EnrollmentDate }>('/api/enrollment-routing.php', {
    method: 'POST',
    body: JSON.stringify({ ...input, resource: 'dates' }),
  })
}

export async function updateRoutingDate(input: EnrollmentDate) {
  return enrollmentRequest<{ item: EnrollmentDate }>('/api/enrollment-routing.php', {
    method: 'PUT',
    body: JSON.stringify({ ...input, resource: 'dates' }),
  })
}

export async function deleteRoutingDate(id: number) {
  return enrollmentRequest<{ ok: true }>('/api/enrollment-routing.php', {
    method: 'DELETE',
    body: JSON.stringify({ id, resource: 'dates' }),
  })
}

export async function listRoutingSlots(options?: { all?: boolean }) {
  const q = options?.all ? '?resource=slots&all=1' : '?resource=slots'
  return enrollmentRequest<{ items: EnrollmentTimeSlot[] }>(`/api/enrollment-routing.php${q}`)
}

export async function createRoutingSlot(input: {
  value: string
  description?: string
  capacity?: number
  batchId?: number | null
  sortOrder?: number
  label?: string
  published?: boolean
}) {
  return enrollmentRequest<{ item: EnrollmentTimeSlot }>('/api/enrollment-routing.php', {
    method: 'POST',
    body: JSON.stringify({ ...input, resource: 'slots' }),
  })
}

export async function updateRoutingSlot(input: EnrollmentTimeSlot) {
  return enrollmentRequest<{ item: EnrollmentTimeSlot }>('/api/enrollment-routing.php', {
    method: 'PUT',
    body: JSON.stringify({ ...input, resource: 'slots' }),
  })
}

export async function deleteRoutingSlot(id: number) {
  return enrollmentRequest<{ ok: true }>('/api/enrollment-routing.php', {
    method: 'DELETE',
    body: JSON.stringify({ id, resource: 'slots' }),
  })
}

export async function listPaymentChannels(options?: { all?: boolean }) {
  const q = options?.all ? '?resource=channels&all=1' : '?resource=channels'
  return enrollmentRequest<{ items: EnrollmentPaymentChannel[] }>(`/api/enrollment-routing.php${q}`)
}

export async function createPaymentChannel(
  input: Omit<EnrollmentPaymentChannel, 'id' | 'published'> & { published?: boolean },
) {
  return enrollmentRequest<{ item: EnrollmentPaymentChannel }>('/api/enrollment-routing.php', {
    method: 'POST',
    body: JSON.stringify({ ...input, resource: 'channels' }),
  })
}

export async function updatePaymentChannel(input: EnrollmentPaymentChannel) {
  return enrollmentRequest<{ item: EnrollmentPaymentChannel }>('/api/enrollment-routing.php', {
    method: 'PUT',
    body: JSON.stringify({ ...input, resource: 'channels' }),
  })
}

export async function deletePaymentChannel(id: number) {
  return enrollmentRequest<{ ok: true }>('/api/enrollment-routing.php', {
    method: 'DELETE',
    body: JSON.stringify({ id, resource: 'channels' }),
  })
}

export async function listRoutingSteps(options?: { all?: boolean }) {
  const q = options?.all ? '?resource=steps&all=1' : '?resource=steps'
  return enrollmentRequest<{ items: EnrollmentRoutingStep[] }>(`/api/enrollment-routing.php${q}`)
}

export async function createRoutingStep(
  input: Omit<EnrollmentRoutingStep, 'id' | 'published'> & { published?: boolean },
) {
  return enrollmentRequest<{ item: EnrollmentRoutingStep }>('/api/enrollment-routing.php', {
    method: 'POST',
    body: JSON.stringify({ ...input, resource: 'steps' }),
  })
}

export async function updateRoutingStep(input: EnrollmentRoutingStep) {
  return enrollmentRequest<{ item: EnrollmentRoutingStep }>('/api/enrollment-routing.php', {
    method: 'PUT',
    body: JSON.stringify({ ...input, resource: 'steps' }),
  })
}

export async function deleteRoutingStep(id: number) {
  return enrollmentRequest<{ ok: true }>('/api/enrollment-routing.php', {
    method: 'DELETE',
    body: JSON.stringify({ id, resource: 'steps' }),
  })
}
