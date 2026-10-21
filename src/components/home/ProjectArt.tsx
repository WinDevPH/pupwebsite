import calendarArt from '@/assets/projects/calendar.jpg'
import megaphoneArt from '@/assets/projects/megaphone.jpg'
import printerArt from '@/assets/projects/printer.jpg'
import wifiArt from '@/assets/projects/wifi.jpg'
import booksArt from '@/assets/projects/books.jpg'
import badgesArt from '@/assets/projects/badges.jpg'
import foldersArt from '@/assets/projects/folders.jpg'
import type { ProjectIconKey } from '@/lib/projects-api'
import { cn } from '@/lib/utils'

const art: Record<ProjectIconKey, string> = {
  'calendar-check': calendarArt,
  megaphone: megaphoneArt,
  printer: printerArt,
  wifi: wifiArt,
  'book-open': booksArt,
  users: badgesArt,
  'folder-kanban': foldersArt,
}

export function projectArtSrc(icon: ProjectIconKey) {
  return art[icon] ?? foldersArt
}

export function ProjectArt({
  icon,
  src,
  live = true,
}: {
  icon: ProjectIconKey
  src?: string | null
  live?: boolean
}) {
  const image = src?.trim() || projectArtSrc(icon)

  return (
    <img
      src={image}
      alt=""
      width={768}
      height={1024}
      draggable={false}
      className={cn('project-art-photo size-full object-cover', live && 'is-live')}
    />
  )
}
