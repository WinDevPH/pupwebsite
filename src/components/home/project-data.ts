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
import {
  isProjectCategorySlug,
  type ProjectCategorySlug,
} from '@/lib/project-categories'

export type Project = {
  id?: number
  slug: string
  category: ProjectCategorySlug
  label: string
  image: string
  images: string[]
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
  const images =
    item.images?.length > 0
      ? item.images.filter(Boolean)
      : item.image
        ? [item.image]
        : []
  return {
    id: item.id,
    slug: item.slug,
    category: isProjectCategorySlug(item.category) ? item.category : 'internal-affairs',
    label: item.title,
    image: images[0] ?? item.image ?? '',
    images,
    icon: projectIconMap[iconKey],
    iconKey,
    summary: item.summary,
    body: item.body,
    links: item.links ?? [],
    sortOrder: item.sortOrder,
    published: item.published,
  }
}
