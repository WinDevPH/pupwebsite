export type AboutAdminPage = 'mvvg' | 'mandate' | 'agenda' | 'history'

export type AboutRowKind =
  | 'mission'
  | 'vision'
  | 'values'
  | 'goals'
  | 'mandate'
  | 'agenda'
  | 'history'

export const ABOUT_BASE_PATH: Record<AboutAdminPage, string> = {
  mvvg: '/admin/mission-vision-values-goals',
  mandate: '/admin/mandate',
  agenda: '/admin/agenda',
  history: '/admin/history',
}

export const ABOUT_KIND_LABEL: Record<AboutRowKind, string> = {
  mission: 'Mission',
  vision: 'Vision',
  values: 'Value',
  goals: 'Goal',
  mandate: 'Mandate',
  agenda: 'Agenda',
  history: 'History',
}

export function aboutEditPath(page: AboutAdminPage, kind: AboutRowKind, index?: number) {
  const base = ABOUT_BASE_PATH[page]
  if (kind === 'mission' || kind === 'vision') return `${base}/edit/${kind}`
  if (page === 'mvvg') return `${base}/edit/${kind}/${index ?? 0}`
  return `${base}/edit/${index ?? 0}`
}

export function aboutNewPath(page: AboutAdminPage, kind?: AboutRowKind) {
  const base = ABOUT_BASE_PATH[page]
  if (page === 'mvvg') return `${base}/new/${kind === 'goals' ? 'goals' : 'values'}`
  return `${base}/new`
}
