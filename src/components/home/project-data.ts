import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  CalendarCheck,
  FolderKanban,
  Megaphone,
  Printer,
  Users,
  Wifi,
} from 'lucide-react'
import type { ProjectIconKey, ProjectLink, ProjectRecord } from '@/lib/projects-api'

export type Project = {
  id?: number
  slug: string
  label: string
  image: string
  icon: LucideIcon
  iconKey: ProjectIconKey
  summary: string
  body: string | null
  links: ProjectLink[]
  sortOrder: number
  published: boolean
}

export const projectIconMap: Record<ProjectIconKey, LucideIcon> = {
  'calendar-check': CalendarCheck,
  megaphone: Megaphone,
  printer: Printer,
  wifi: Wifi,
  'book-open': BookOpen,
  users: Users,
  'folder-kanban': FolderKanban,
}

export const projectIconOptions: { id: ProjectIconKey; label: string }[] = [
  { id: 'calendar-check', label: 'Board / calendar' },
  { id: 'megaphone', label: 'Campaign' },
  { id: 'printer', label: 'Printing' },
  { id: 'wifi', label: 'Connectivity' },
  { id: 'book-open', label: 'Study' },
  { id: 'users', label: 'Community' },
  { id: 'folder-kanban', label: 'General' },
]

export function mapProjectRecord(item: ProjectRecord): Project {
  const iconKey = (item.icon in projectIconMap ? item.icon : 'folder-kanban') as ProjectIconKey
  return {
    id: item.id,
    slug: item.slug,
    label: item.title,
    image: item.image,
    icon: projectIconMap[iconKey],
    iconKey,
    summary: item.summary,
    body: item.body,
    links: item.links ?? [],
    sortOrder: item.sortOrder,
    published: item.published,
  }
}
