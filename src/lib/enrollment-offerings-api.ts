import { enrollmentRequest } from '@/lib/enrollment-api-shared'

export type EnrollmentOffering = {
  id: number
  code: string
  title: string
  section: string
  year: string
  units: number
  days: string[]
  startHour: number
  endHour: number
  timeLabel: string
  scheduleLabel: string
  availability: 'OPEN' | 'FULL' | string
  capacity: number
  takenCount: number
  remaining: number
  full: boolean
  sortOrder: number
  published: boolean
}

export type OfferingInput = {
  id?: number
  code: string
  title: string
  section: string
  year?: string
  units?: number
  days?: string[]
  startHour?: number
  endHour?: number
  timeLabel?: string
  scheduleLabel?: string
  availability?: string
  capacity?: number
  sortOrder?: number
  published?: boolean
}

export async function listOfferings(options?: { all?: boolean }) {
  const q = options?.all ? '?all=1' : ''
  return enrollmentRequest<{ items: EnrollmentOffering[] }>(`/api/enrollment-offerings.php${q}`)
}

export async function getOffering(id: number) {
  return enrollmentRequest<{ item: EnrollmentOffering }>(`/api/enrollment-offerings.php?id=${id}`)
}

export async function createOffering(input: OfferingInput) {
  return enrollmentRequest<{ item: EnrollmentOffering }>('/api/enrollment-offerings.php', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateOffering(input: OfferingInput & { id: number }) {
  return enrollmentRequest<{ item: EnrollmentOffering }>('/api/enrollment-offerings.php', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteOffering(id: number) {
  return enrollmentRequest<{ ok: true }>('/api/enrollment-offerings.php', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}
