import type { LucideIcon } from 'lucide-react'
import { BookOpen, CalendarCheck, Megaphone, Printer, Users, Wifi } from 'lucide-react'
import boardMeetings from '@/assets/projects/board-meetings.jpg'
import freePrinting from '@/assets/projects/free-printing.jpg'
import jdBuddies from '@/assets/projects/jd-buddies.jpg'
import lexInMotion from '@/assets/projects/lex-in-motion.jpg'
import onlineStudyHub from '@/assets/projects/online-study-hub.jpg'
import wifiLibrary from '@/assets/projects/wifi-library.jpg'

export type ProjectLink = {
  label: string
  to?: string
  href?: string
}

export type Project = {
  slug: string
  label: string
  image: string
  icon: LucideIcon
  summary: string
  links: ProjectLink[]
}

export const projects: Project[] = [
  {
    slug: 'board-meetings',
    label: 'Board Meetings',
    image: boardMeetings,
    icon: CalendarCheck,
    summary:
      'Policy Guidelines on the Conduct of Board Meetings and other Assemblies is Board Resolution No. 005, Series of 2026.',
    links: [
      {
        label: 'Board Resolution No. 005',
        href: 'https://bit.ly/BoardResolution005s2026',
      },
      { label: 'Legislative', to: '/governance/legislative' },
    ],
  },
  {
    slug: 'lex-in-motion',
    label: 'Lex in Motion',
    image: lexInMotion,
    icon: Megaphone,
    summary: 'Updates for this project are posted on the bulletin and the official Facebook page.',
    links: [
      { label: 'Bulletin', to: '/#bulletin' },
      { label: 'Contact the Council', to: '/#contact' },
    ],
  },
  {
    slug: 'free-printing',
    label: 'Free Printing Service',
    image: freePrinting,
    icon: Printer,
    summary: 'Open days, hours, and the page limit for the council’s free printing service.',
    links: [
      { label: 'Free printing service schedule', to: '/announcements/printing-schedule' },
      { label: 'Contact the Council', to: '/#contact' },
    ],
  },
  {
    slug: 'wifi-library',
    label: 'WiFi Library',
    image: wifiLibrary,
    icon: Wifi,
    summary: 'Updates for this project are posted on the bulletin and the official Facebook page.',
    links: [
      { label: 'Bulletin', to: '/#bulletin' },
      { label: 'Contact the Council', to: '/#contact' },
    ],
  },
  {
    slug: 'online-study-hub',
    label: 'Online Study Hub',
    image: onlineStudyHub,
    icon: BookOpen,
    summary: 'Updates for this project are posted on the bulletin and the official Facebook page.',
    links: [
      { label: 'Bulletin', to: '/#bulletin' },
      { label: 'Contact the Council', to: '/#contact' },
    ],
  },
  {
    slug: 'jd-buddies',
    label: 'JD Buddies',
    image: jdBuddies,
    icon: Users,
    summary: 'Updates for this project are posted on the bulletin and the official Facebook page.',
    links: [
      { label: 'Bulletin', to: '/#bulletin' },
      { label: 'Contact the Council', to: '/#contact' },
    ],
  },
]

export function getProject(slug: string) {
  return projects.find((project) => project.slug === slug)
}
