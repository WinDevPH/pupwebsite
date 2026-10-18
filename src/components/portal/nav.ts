import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  Bookmark,
  CalendarDays,
  CircleHelp,
  Compass,
  FileText,
  FolderKanban,
  Gavel,
  Images,
  Landmark,
  LayoutDashboard,
  Megaphone,
  Scale,
  Settings2,
  Shirt,
  Target,
  UserCog,
  Users,
  UserRoundCog,
} from 'lucide-react'

export type PortalNavItem = {
  id: string
  label: string
  Icon: LucideIcon
  to: string
  exact?: boolean
}

export type PortalNavGroup = {
  id: string
  heading: string
  items: PortalNavItem[]
  /**
   * When false, items render as a flat list under a static heading.
   * Default is collapsible when the group has more than one item.
   */
  collapsible?: boolean
}

const adminBase = '/admin'

export const portalNavGroups: PortalNavGroup[] = [
  {
    id: 'main',
    heading: 'Main navigation',
    collapsible: false,
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        Icon: LayoutDashboard,
        to: adminBase,
        exact: true,
      },
      {
        id: 'requests',
        label: 'Requests',
        Icon: FileText,
        to: `${adminBase}/requests`,
      },
      {
        id: 'announcements',
        label: 'Announcements',
        Icon: Megaphone,
        to: `${adminBase}/announcements`,
      },
      {
        id: 'calendar',
        label: 'Calendar',
        Icon: CalendarDays,
        to: `${adminBase}/calendar`,
      },
      {
        id: 'projects',
        label: 'Projects',
        Icon: FolderKanban,
        to: `${adminBase}/projects`,
      },
    ],
  },
  {
    id: 'council',
    heading: 'The Council',
    items: [
      {
        id: 'officers',
        label: 'Officers',
        Icon: Users,
        to: `${adminBase}/officers`,
      },
      {
        id: 'commissioners',
        label: 'Commissioners',
        Icon: Scale,
        to: `${adminBase}/commissioners`,
      },
      {
        id: 'advisory-board',
        label: 'Advisory Board',
        Icon: UserRoundCog,
        to: `${adminBase}/advisory-board`,
      },
      {
        id: 'gallery',
        label: 'Gallery',
        Icon: Images,
        to: `${adminBase}/gallery`,
      },
    ],
  },
  {
    id: 'about',
    heading: 'About',
    items: [
      {
        id: 'mission-vision-values-goals',
        label: 'Mission, Vision, Values & Goals',
        Icon: Compass,
        to: `${adminBase}/mission-vision-values-goals`,
      },
      {
        id: 'mandate',
        label: 'Mandate',
        Icon: Gavel,
        to: `${adminBase}/mandate`,
      },
      {
        id: 'agenda',
        label: 'Term agenda',
        Icon: Target,
        to: `${adminBase}/agenda`,
      },
      {
        id: 'history',
        label: 'History',
        Icon: Landmark,
        to: `${adminBase}/history`,
      },
    ],
  },
  {
    id: 'campus',
    heading: 'Campus',
    items: [
      {
        id: 'organizations',
        label: 'Organizations',
        Icon: BookOpen,
        to: `${adminBase}/organizations`,
      },
      {
        id: 'merch',
        label: 'Merch',
        Icon: Shirt,
        to: `${adminBase}/merch`,
      },
      {
        id: 'reservations',
        label: 'Reservations',
        Icon: Bookmark,
        to: `${adminBase}/reservations`,
      },
      {
        id: 'faq',
        label: 'FAQ',
        Icon: CircleHelp,
        to: `${adminBase}/faq`,
      },
      {
        id: 'documents',
        label: 'Documents',
        Icon: FileText,
        to: `${adminBase}/documents`,
      },
    ],
  },
  {
    id: 'system',
    heading: 'System',
    collapsible: false,
    items: [
      {
        id: 'users',
        label: 'Users',
        Icon: UserCog,
        to: `${adminBase}/users`,
      },
      {
        id: 'settings',
        label: 'Settings',
        Icon: Settings2,
        to: `${adminBase}/settings`,
      },
    ],
  },
]

export function breadcrumbsFor(pathname: string): { label: string; to: string }[] {
  const crumbs = [{ label: 'Admin', to: adminBase }]
  if (pathname === adminBase) {
    crumbs.push({ label: 'Dashboard', to: adminBase })
    return crumbs
  }

  const requestsBase = `${adminBase}/requests`
  if (pathname.startsWith(`${requestsBase}/`) && pathname !== requestsBase) {
    crumbs.push({ label: 'Requests', to: requestsBase })
    crumbs.push({ label: 'Details', to: pathname })
    return crumbs
  }

  const announcementsBase = `${adminBase}/announcements`
  if (pathname === `${announcementsBase}/new`) {
    crumbs.push({ label: 'Announcements', to: announcementsBase })
    crumbs.push({ label: 'New', to: pathname })
    return crumbs
  }
  if (pathname.startsWith(`${announcementsBase}/`) && pathname.endsWith('/edit')) {
    crumbs.push({ label: 'Announcements', to: announcementsBase })
    crumbs.push({ label: 'Edit', to: pathname })
    return crumbs
  }

  const calendarBase = `${adminBase}/calendar`
  if (pathname === `${calendarBase}/new`) {
    crumbs.push({ label: 'Calendar', to: calendarBase })
    crumbs.push({ label: 'New', to: pathname })
    return crumbs
  }
  if (pathname.startsWith(`${calendarBase}/`) && pathname.endsWith('/edit')) {
    crumbs.push({ label: 'Calendar', to: calendarBase })
    crumbs.push({ label: 'Edit', to: pathname })
    return crumbs
  }

  const projectsBase = `${adminBase}/projects`
  if (pathname === `${projectsBase}/new`) {
    crumbs.push({ label: 'Projects', to: projectsBase })
    crumbs.push({ label: 'New', to: pathname })
    return crumbs
  }
  if (pathname.startsWith(`${projectsBase}/`) && pathname.endsWith('/edit')) {
    crumbs.push({ label: 'Projects', to: projectsBase })
    crumbs.push({ label: 'Edit', to: pathname })
    return crumbs
  }

  const usersBase = `${adminBase}/users`
  if (pathname === `${usersBase}/new`) {
    crumbs.push({ label: 'Users', to: usersBase })
    crumbs.push({ label: 'New', to: pathname })
    return crumbs
  }
  if (pathname.startsWith(`${usersBase}/`) && pathname.endsWith('/edit')) {
    crumbs.push({ label: 'Users', to: usersBase })
    crumbs.push({ label: 'Edit', to: pathname })
    return crumbs
  }

  for (const [label, path] of [
    ['Officers', 'officers'],
    ['Commissioners', 'commissioners'],
    ['Advisory Board', 'advisory-board'],
  ] as const) {
    const base = `${adminBase}/${path}`
    if (pathname === `${base}/new`) {
      crumbs.push({ label, to: base })
      crumbs.push({ label: 'New', to: pathname })
      return crumbs
    }
    if (pathname.startsWith(`${base}/`) && pathname.endsWith('/edit')) {
      crumbs.push({ label, to: base })
      crumbs.push({ label: 'Edit', to: pathname })
      return crumbs
    }
  }

  for (const group of portalNavGroups) {
    for (const item of group.items) {
      if (item.to === adminBase) continue
      if (pathname === item.to || pathname.startsWith(`${item.to}/`)) {
        crumbs.push({ label: item.label, to: item.to })
        return crumbs
      }
    }
  }
  return crumbs
}
