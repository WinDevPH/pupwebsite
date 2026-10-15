import type { LucideIcon } from 'lucide-react'
import {
  BookMarked,
  BookOpen,
  CalendarCheck,
  CircleHelp,
  FolderKanban,
  Gavel,
  Handshake,
  House,
  Landmark,
  Mail,
  Megaphone,
  Printer,
  Scale,
  ScrollText,
  Users,
  Wifi,
} from 'lucide-react'

export type NavLinkItem = {
  label: string
  to: string
  description?: string
  icon?: LucideIcon
}

export type NavGroup = {
  title: string
  links: NavLinkItem[]
  /** Spread links over two columns (for long lists). */
  wide?: boolean
  /** Small note shown under the group's links. */
  note?: string
}

export type NavFeature = {
  eyebrow: string
  title: string
  description: string
  cta: string
  to: string
}

export type NavItem =
  | {
      label: string
      to: string
      icon?: LucideIcon
      groups?: undefined
      feature?: undefined
      /** Shown only in the mobile menu (the logo already links home on desktop). */
      mobileOnly?: boolean
    }
  | {
      label: string
      /** Full section title shown as the menu heading. */
      title?: string
      icon?: LucideIcon
      to?: undefined
      groups: NavGroup[]
      feature?: NavFeature
      mobileOnly?: undefined
    }

export const siteName = {
  short: 'PUP College of Law',
  unit: 'Student Council',
  full: 'Polytechnic University of the Philippines College of Law Student Council',
  established: 2001,
}

export const contact = {
  email: 'puplawstudentcouncilofficial@gmail.com',
  office: 'PUP College of Law Student Council Office',
  address: 'PUP Main Campus, College of Law, Anonas St., Sta. Mesa, Manila 1016.',
  secRegistration: 'SEC Reg. No. 2022030045051-05',
  hours: 'Mon–Sat, 9:00 AM–6:00 PM',
  socials: [
    {
      name: 'Facebook',
      handle: '/pupcl.sc',
      href: 'https://www.facebook.com/pupcl.sc',
    },
    { name: 'X', handle: '@pupcol_sc', href: 'https://x.com/pupcol_sc' },
    {
      name: 'Instagram',
      handle: '@pupcol_sc',
      href: 'https://www.instagram.com/pupcol_sc',
    },
  ],
}

export const footerSocials = [
  {
    name: 'Instagram',
    handle: '@pupcolsc_official',
    href: 'https://www.instagram.com/pupcolsc_official',
  },
  {
    name: 'Facebook',
    handle: '/pupcl.sc',
    href: 'https://www.facebook.com/pupcl.sc',
  },
  { name: 'X', handle: '@pupcolsc', href: 'https://x.com/pupcolsc' },
] as const

export const footerColumns = [
  {
    title: 'The Council',
    links: [
      { label: 'About the Council', to: '/about/the-council' },
      { label: 'Legislative', to: '/governance/legislative' },
      { label: 'Executive', to: '/governance/executive' },
      { label: 'Contact Us', to: '/#contact' },
    ],
  },
  {
    title: 'Student Services',
    links: [
      { label: 'Student Grievance', to: '/services/grievance' },
      { label: 'Communication', to: '/services/communication' },
      { label: 'Projects', to: '/projects/board-meetings' },
      { label: 'Services Portal', to: '/portal' },
    ],
  },
  {
    title: 'Documents',
    links: [
      { label: 'Governance & resolutions', to: '/transparency' },
      { label: 'Student Handbook', to: '/documents/student-handbook' },
      { label: 'Guidelines', to: '/documents/guidelines' },
      { label: 'Announcements', to: '/announcements' },
    ],
  },
] as const

export const primaryCta: NavLinkItem = {
  label: 'Start for free',
  description: 'Student Services Portal',
  to: '/portal',
}

export const navItems: NavItem[] = [
  { label: 'Home', to: '/', icon: House, mobileOnly: true },
  {
    label: 'About Us',
    title: 'About Us',
    icon: Landmark,
    groups: [
      {
        title: 'The Council',
        links: [
          {
            label: 'Welcome',
            to: '/',
            icon: Handshake,
            description:
              'The official website of the PUP College of Law Student Council.',
          },
          {
            label: 'About the Council',
            to: '/about/the-council',
            icon: Landmark,
            description:
              'The highest governing body representing PUP law students.',
          },
        ],
      },
      {
        title: 'Homepage',
        links: [
          {
            label: 'Officers',
            to: '/#officers',
            icon: Users,
            description: 'Featured Council officers for A.Y. 2026–2027.',
          },
          {
            label: 'Announcements',
            to: '/#bulletin',
            icon: Megaphone,
            description: 'Latest issuances, events, and updates.',
          },
          {
            label: 'Calendar',
            to: '/#calendar',
            icon: CalendarCheck,
            description: 'Academic calendar for A.Y. 2026–2027.',
          },
          {
            label: 'Organizations',
            to: '/#organizations',
            icon: Handshake,
            description: 'Accredited law student organizations.',
          },
          {
            label: 'FAQs',
            to: '/#faq',
            icon: CircleHelp,
            description: 'Contact, services, and how information is handled.',
          },
        ],
      },
    ],
    feature: {
      eyebrow: 'Who we are',
      title: siteName.full,
      description:
        'Formulating policies that protect the welfare, rights, and interests of law students.',
      cta: 'Learn more',
      to: '/about/the-council',
    },
  },
  {
    label: 'Governance',
    title: 'Governance: Legislative & Executive',
    icon: Scale,
    groups: [
      {
        title: 'Structure',
        links: [
          {
            label: 'Legislative',
            to: '/governance/legislative',
            icon: Scale,
            description: 'Board resolutions, Series of 2026.',
          },
          {
            label: 'Executive',
            to: '/governance/executive',
            icon: Gavel,
            description: 'Officers for A.Y. 2026–2027.',
          },
        ],
      },
    ],
  },
  {
    label: 'Projects',
    title: 'Projects & Initiatives',
    icon: FolderKanban,
    groups: [
      {
        title: 'Student Council in Action',
        wide: true,
        links: [
          { label: 'Board Meetings', to: '/projects/board-meetings', icon: CalendarCheck },
          { label: 'Lex in Motion', to: '/projects/lex-in-motion', icon: Megaphone },
          { label: 'Free Printing Service', to: '/projects/free-printing', icon: Printer },
          { label: 'WiFi Library', to: '/projects/wifi-library', icon: Wifi },
          { label: 'Online Study Hub', to: '/projects/online-study-hub', icon: BookOpen },
          { label: 'JD Buddies', to: '/projects/jd-buddies', icon: Users },
        ],
      },
    ],
  },
  {
    label: 'Transparency',
    title: 'Transparency & Documents',
    icon: ScrollText,
    groups: [
      {
        title: 'Quick Links',
        links: [
          {
            label: 'Governance & resolutions',
            to: '/transparency',
            icon: Scale,
            description: 'Board and Commission on Appointments resolutions, Series of 2026.',
          },
          {
            label: 'Student Handbook',
            to: '/documents/student-handbook',
            icon: BookMarked,
            description: 'Policies and guidelines for PUP law students.',
          },
          {
            label: 'Guidelines',
            to: '/documents/guidelines',
            icon: ScrollText,
            description: 'Official Council guidelines and procedures.',
          },
        ],
      },
    ],
  },
  { label: 'Contact Us', to: '/#contact', icon: Mail },
]
