export type CouncilBoard = 'officers' | 'commissioners' | 'advisory'

export type CouncilSection =
  | 'executive'
  | 'year_reps'
  | 'associates'
  | 'commission'
  | 'advisory'

export type CouncilMemberRecord = {
  id: number
  academicYear: string
  board: CouncilBoard
  section: CouncilSection
  role: string
  name: string
  photo: string | null
  vacant: boolean
  sortOrder: number
  published: boolean
  createdAt: string
  updatedAt: string
}

export type CouncilMemberInput = {
  id?: number
  academicYear: string
  board: CouncilBoard
  section: CouncilSection
  role: string
  name: string
  photo?: string | null
  vacant?: boolean
  sortOrder?: number
  published?: boolean
}

export const councilBoardMeta: Record<
  CouncilBoard,
  { label: string; path: string; sections: { id: CouncilSection; label: string }[] }
> = {
  officers: {
    label: 'Officers',
    path: 'officers',
    sections: [
      { id: 'executive', label: 'Executive Board' },
      { id: 'year_reps', label: 'Year Level Representatives' },
      { id: 'associates', label: 'Associates' },
    ],
  },
  commissioners: {
    label: 'Commissioners',
    path: 'commissioners',
    sections: [{ id: 'commission', label: 'Commission on Appointments' }],
  },
  advisory: {
    label: 'Advisory Board',
    path: 'advisory-board',
    sections: [{ id: 'advisory', label: 'Faculty Advisory Board' }],
  },
}

/** Canonical role titles available per section. */
export const councilRoleOptions: Record<CouncilSection, string[]> = {
  executive: [
    'President',
    'Vice President Internal',
    'Vice President External',
    'Secretary-General',
    'Finance Officer',
    'Auditor',
    'Communications Officer',
  ],
  year_reps: ['Year 1', 'Year 2', 'Year 3', 'Year 4'],
  associates: [
    'Presidential Affairs',
    'Internal Affairs',
    'Secretariat',
    'External Affairs',
    'Social Media Management',
  ],
  commission: [
    'Chairperson',
    'Commissioner',
    'Commissioner and Clerk to the Commission',
  ],
  advisory: ['Dean, PUP College of Law', 'Lead Faculty Adviser'],
}

export function councilRolesForSection(section: CouncilSection) {
  return councilRoleOptions[section] ?? []
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
      error: 'Cannot reach the server. Start Apache and MySQL in XAMPP.',
      status: 0,
    }
  }
}

export function normalizeAcademicYear(value: string) {
  return value.trim().replace(/[-—–]/g, '–').replace(/\s+/g, '')
}

/** Current A.Y. start year (June–May cycle). */
export function currentAcademicYearStart(date = new Date()) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  return month >= 6 ? year : year - 1
}

export function formatAcademicYear(startYear: number) {
  return `${startYear}–${startYear + 1}`
}

export function parseAcademicYearStart(value: string): number | null {
  const normalized = normalizeAcademicYear(value)
  const match = /^(\d{4})–(\d{4})$/u.exec(normalized)
  if (!match) return null
  const start = Number(match[1])
  const end = Number(match[2])
  if (!Number.isFinite(start) || end !== start + 1) return null
  return start
}

/**
 * Academic-year choices from the latest known year through future years,
 * including any existing roster years. Newest-first.
 */
export function buildAcademicYearOptions(
  existing: string[] = [],
  futureCount = 6,
): string[] {
  const starts = new Set<number>()
  const current = currentAcademicYearStart()
  starts.add(current)

  for (const year of existing) {
    const start = parseAcademicYearStart(year)
    if (start !== null) starts.add(start)
  }

  const latest = Math.max(...starts, current)
  for (let i = 0; i <= futureCount; i += 1) {
    starts.add(latest + i)
  }

  return [...starts]
    .sort((a, b) => b - a)
    .map((start) => formatAcademicYear(start))
}

export async function listCouncilMembers(options?: {
  board?: CouncilBoard
  year?: string
  all?: boolean
}) {
  const params = new URLSearchParams()
  if (options?.all) params.set('all', '1')
  if (options?.board) params.set('board', options.board)
  if (options?.year) params.set('year', normalizeAcademicYear(options.year))
  const query = params.toString()
  return request<{
    items: CouncilMemberRecord[]
    academicYear?: string | null
    pinnedYear?: string | null
    displayMode?: 'auto' | 'pinned'
  }>(`/api/council-members.php${query ? `?${query}` : ''}`)
}

export async function listCouncilAcademicYears(options?: {
  board?: CouncilBoard
  all?: boolean
}) {
  const params = new URLSearchParams({ years: '1' })
  if (options?.all) params.set('all', '1')
  if (options?.board) params.set('board', options.board)
  return request<{ years: string[] }>(`/api/council-members.php?${params}`)
}

export type CouncilDisplaySettings = {
  board: CouncilBoard
  pinnedYear: string | null
  publicYear: string | null
  mode: 'auto' | 'pinned'
}

export async function getCouncilDisplaySettings(board: CouncilBoard) {
  const params = new URLSearchParams({ display: '1', board })
  return request<CouncilDisplaySettings>(`/api/council-members.php?${params}`)
}

/** Pin which academic year appears on The Council for this board. Pass null for Auto (latest). */
export async function setCouncilDisplayYear(
  board: CouncilBoard,
  pinnedYear: string | null,
) {
  return request<CouncilDisplaySettings>('/api/council-members.php', {
    method: 'PUT',
    body: JSON.stringify({
      action: 'pin_display_year',
      board,
      pinnedYear,
    }),
  })
}

export async function getCouncilMemberById(id: number) {
  return request<{ item: CouncilMemberRecord }>(
    `/api/council-members.php?id=${encodeURIComponent(String(id))}`,
  )
}

export async function createCouncilMember(input: CouncilMemberInput) {
  return request<{ item: CouncilMemberRecord }>('/api/council-members.php', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateCouncilMember(input: CouncilMemberInput & { id: number }) {
  return request<{ item: CouncilMemberRecord }>('/api/council-members.php', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteCouncilMember(id: number) {
  return request<{ ok: true }>('/api/council-members.php', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}

export async function deleteCouncilMembers(ids: number[]) {
  return request<{ deleted: number }>('/api/council-members.php', {
    method: 'DELETE',
    body: JSON.stringify({ ids }),
  })
}

export async function uploadCouncilMemberPhoto(file: File) {
  const body = new FormData()
  body.append('image', file)
  return request<{ url: string; image: string }>('/api/council-members-upload.php', {
    method: 'POST',
    body,
  })
}
