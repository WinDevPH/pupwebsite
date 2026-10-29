import { unreachableServerMessage } from '@/lib/unreachable-server'
export type TransparencyInnerTab = {
  slug: string
  label: string
}

export type TransparencyCategoryRecord = {
  id: number
  slug: string
  label: string
  title: string
  accent: string
  kicker: string
  note: string
  tabs: TransparencyInnerTab[]
  folder: string
  seriesLabel: string
  icon: string
  sortOrder: number
  published: boolean
  createdAt?: string
  updatedAt?: string
}

export type TransparencyCategoryInput = {
  id?: number
  slug?: string
  label: string
  title?: string
  accent?: string
  kicker?: string
  note?: string
  tabs?: TransparencyInnerTab[]
  folder?: string
  seriesLabel?: string
  icon?: string
  sortOrder?: number
  published?: boolean
}

export const DEFAULT_TRANSPARENCY_CATEGORIES: TransparencyCategoryRecord[] = [
  {
    id: 0,
    slug: 'board_resolution',
    label: 'Board Resolutions',
    title: 'Board Resolutions',
    accent: 'and En Banc Issuances',
    kicker: 'Secretariat',
    note: 'Organized archive of resolutions arranged by Series/Academic Year. Downloadable PDF links provided.',
    tabs: [],
    folder: '01 Board Resolution & Memoranda',
    seriesLabel: 'Board Resolution',
    icon: 'landmark',
    sortOrder: 10,
    published: true,
  },
  {
    id: 0,
    slug: 'appointment_resolution',
    label: 'Commission Resolutions',
    title: 'Commission on Appointments',
    accent: 'Resolutions',
    kicker: 'Secretariat',
    note: 'Resolutions issued by the Commission on Appointments.',
    tabs: [],
    folder: '',
    seriesLabel: 'Resolution',
    icon: 'gavel',
    sortOrder: 20,
    published: true,
  },
  {
    id: 0,
    slug: 'memorandum',
    label: 'Memoranda & Requests',
    title: 'Memoranda and',
    accent: 'Administrative Requests',
    kicker: 'Secretariat',
    note: 'Repository of formal communications sent to and memorandas received from the Office of the Dean',
    tabs: [],
    folder: '',
    seriesLabel: 'Memorandum',
    icon: 'mail',
    sortOrder: 30,
    published: true,
  },
  {
    id: 0,
    slug: 'report',
    label: 'Accomplishment Reports',
    title: 'Accomplishment',
    accent: 'Reports',
    kicker: 'Secretariat',
    note: 'Semester-end and annual records of Council programs and outputs.',
    tabs: [],
    folder: '',
    seriesLabel: 'Report',
    icon: 'clipboard-check',
    sortOrder: 40,
    published: true,
  },
  {
    id: 0,
    slug: 'financial',
    label: 'Financial Reports',
    title: 'Financial',
    accent: 'Reports',
    kicker: 'Finance & Audit',
    note: 'Monthly and semestral financial statements, liquidations, budget allocations, and audit reports.',
    tabs: [
      { slug: 'quarterly-liquidations', label: 'Quarterly liquidations' },
      { slug: 'budget-allocations', label: 'Budget allocations' },
      { slug: 'financial-statements', label: 'Financial statements' },
    ],
    folder: '',
    seriesLabel: 'Financial Report',
    icon: 'wallet',
    sortOrder: 50,
    published: true,
  },
]

export const TRANSPARENCY_TAB_ALIASES: Record<string, string> = {
  board: 'board_resolution',
  appointments: 'appointment_resolution',
  memoranda: 'memorandum',
  reports: 'report',
}

type ApiFailure = { ok: false; error: string; status: number }
type ApiOk<T> = { ok: true; data: T }

async function request<T>(path: string, init?: RequestInit): Promise<ApiOk<T> | ApiFailure> {
  try {
    const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData
    const response = await fetch(path, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(isFormData || !init?.body ? {} : { 'Content-Type': 'application/json' }),
        ...(init?.headers ?? {}),
      },
      ...init,
    })
    const payload = (await response.json().catch(() => null)) as
      | ({ ok?: boolean; error?: string } & T)
      | null

    if (!response.ok || !payload?.ok) {
      return {
        ok: false,
        error: payload?.error || 'Something went wrong. Please try again.',
        status: response.status,
      }
    }

    return { ok: true, data: payload as T }
  } catch {
    return {
      ok: false,
      error: unreachableServerMessage(),
      status: 0,
    }
  }
}

export async function listTransparencyCategories(options?: { all?: boolean }) {
  const query = options?.all ? '?all=1' : ''
  return request<{ items: TransparencyCategoryRecord[] }>(
    `/api/transparency-categories.php${query}`,
  )
}

export async function getTransparencyCategoryById(id: number) {
  return request<{ item: TransparencyCategoryRecord }>(`/api/transparency-categories.php?id=${id}`)
}

export async function createTransparencyCategory(input: TransparencyCategoryInput) {
  return request<{ item: TransparencyCategoryRecord }>('/api/transparency-categories.php', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateTransparencyCategory(input: TransparencyCategoryInput & { id: number }) {
  return request<{ item: TransparencyCategoryRecord }>('/api/transparency-categories.php', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteTransparencyCategory(id: number) {
  return request<{ ok: true }>('/api/transparency-categories.php', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}

export function resolveTransparencyTabSlug(
  raw: string,
  categories: Pick<TransparencyCategoryRecord, 'slug'>[],
): string | null {
  const id = raw.replace('#', '').trim().split('/')[0] ?? ''
  if (!id) return null
  const mapped = TRANSPARENCY_TAB_ALIASES[id] ?? id
  return categories.some((item) => item.slug === mapped) ? mapped : null
}

export function resolveTransparencyInnerTab(
  raw: string,
  category: Pick<TransparencyCategoryRecord, 'slug' | 'tabs'> | null,
): string {
  const tabs = category?.tabs ?? []
  if (tabs.length === 0) return ''
  const parts = raw.replace('#', '').trim().split('/')
  const inner = parts.slice(1).join('/')
  if (!inner || inner === 'all') return 'all'
  return tabs.some((item) => item.slug === inner) ? inner : 'all'
}
