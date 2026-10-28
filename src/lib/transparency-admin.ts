export type TransparencyArchive = {
  id: string
  slug: string
  label: string
  path: string
  icon: string
  noun: string
}

export const TRANSPARENCY_ARCHIVES: TransparencyArchive[] = [
  {
    id: 'board-resolutions',
    slug: 'board_resolution',
    label: 'Board Resolutions',
    path: '/admin/board-resolutions',
    icon: 'landmark',
    noun: 'resolution',
  },
  {
    id: 'commission-resolutions',
    slug: 'appointment_resolution',
    label: 'Commission Resolutions',
    path: '/admin/commission-resolutions',
    icon: 'gavel',
    noun: 'resolution',
  },
  {
    id: 'memoranda',
    slug: 'memorandum',
    label: 'Memoranda & Requests',
    path: '/admin/memoranda',
    icon: 'mail',
    noun: 'memorandum',
  },
  {
    id: 'accomplishment-reports',
    slug: 'report',
    label: 'Accomplishment Reports',
    path: '/admin/accomplishment-reports',
    icon: 'clipboard-check',
    noun: 'report',
  },
  {
    id: 'financial-reports',
    slug: 'financial',
    label: 'Financial Reports',
    path: '/admin/financial-reports',
    icon: 'wallet',
    noun: 'report',
  },
]

export function transparencyArchiveByPath(pathname: string): TransparencyArchive | null {
  return (
    TRANSPARENCY_ARCHIVES.find(
      (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
    ) ?? null
  )
}
