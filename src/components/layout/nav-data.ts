import type { LucideIcon } from 'lucide-react'
import {
  BookMarked,
  BookOpen,
  CalendarCheck,
  CircleHelp,
  ClipboardList,
  FilePenLine,
  FileText,
  FolderKanban,
  FolderOpen,
  Gavel,
  Handshake,
  House,
  Landmark,
  Library,
  Mail,
  Megaphone,
  Printer,
  Scale,
  ScrollText,
  Users,
  Wifi,
} from 'lucide-react'

/** Absolute http(s) URLs open in a new tab; everything else is an in-app route. */
export function isExternalNavTo(to: string) {
  return /^https?:\/\//i.test(to)
}

export const studentHandbookUrl =
  'https://drive.google.com/file/d/1neq3kippfsVWgFeWYepQWOx04X4TaUlE/view?usp=sharing'

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
  email: 'studentcouncil@pupcolsc.com',
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
    title: 'Resources',
    links: [
      { label: 'Student Handbook', to: studentHandbookUrl },
      { label: 'Governance & resolutions', to: '/transparency' },
      { label: 'Announcements', to: '/announcements' },
    ],
  },
] as const

export const primaryCta: NavLinkItem = {
  label: 'Login to Portal',
  to: '/login',
}

export const portalCta: NavLinkItem = {
  label: 'Student Services Portal',
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
            label: 'Announcements',
            to: '/#bulletin',
            icon: Megaphone,
            description: 'Latest issuances, events, and updates.',
          },
          {
            label: 'Calendar',
            to: '/#calendar',
            icon: CalendarCheck,
            description: 'Academic calendar and key school dates.',
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
            description: 'Officers for the public academic year.',
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
        ],
      },
    ],
  },
  {
    label: 'Resources',
    title: 'Resources',
    icon: Library,
    groups: [
      {
        title: 'Forms',
        wide: true,
        note: 'Official academic forms and templates for College of Law students.',
        links: [
          {
            label: 'Accreditation Form',
            to: 'https://drive.google.com/file/d/1QVsG7qF_f3GN1MVR19y6SuknU-ZJlsCQ/view?usp=sharing',
            icon: FileText,
          },
          {
            label: 'Affidavit of Change of Grade Format',
            to: 'https://docs.google.com/document/d/1t0JLxFS4ysLVFJpt5VmoxdQrN_m496xu/edit?usp=sharing&ouid=117853699207286348297&rtpof=true&sd=true',
            icon: FilePenLine,
          },
          {
            label: 'PUP ACE Form — Adding of Subject',
            to: 'https://drive.google.com/file/d/1WFKLhj3TWoDFALvFvXzmJO8bSMMcwai-/view?usp=sharing',
            icon: ClipboardList,
          },
          {
            label: 'PUP ACE Form — Change of Schedule/Subject',
            to: 'https://drive.google.com/file/d/1JdAriJUHTK-GnW0rYyfxu_hKSjYfB8Ko/view?usp=sharing',
            icon: ClipboardList,
          },
          {
            label: 'PUP ACE Form — Withdrawal',
            to: 'https://drive.google.com/file/d/1lv4m80iNljzCpPJzol_7ojq-5jXBAnMF/view?usp=sharing',
            icon: ClipboardList,
          },
          {
            label: 'Application for Re-Admission',
            to: 'https://drive.google.com/file/d/1iwkS1l2xkktuL3XIhK1FQWPqvlc2t0Nl/view?usp=sharing',
            icon: FileText,
          },
          {
            label: 'PUP Completion Form R-1',
            to: 'https://drive.google.com/file/d/1-U4Ah7EjhzV3Qp2zkIqx_8PUvKGkj8lH/view?usp=sharing',
            icon: FileText,
          },
          {
            label: 'R0-Form Enrollment Form for Override',
            to: 'https://docs.google.com/document/d/17wC0eEKKh9JIPH3-fsHSzNpU_3spSsYk/edit?usp=sharing&ouid=117853699207286348297&rtpof=true&sd=true',
            icon: FilePenLine,
          },
          {
            label: 'Sample Letter of Appeal — Quality Point Average System',
            to: 'https://docs.google.com/document/d/1YGstMT4iQKyT-iRLYKEwPQPSAJ9EcrP5/edit?usp=sharing&ouid=117853699207286348297&rtpof=true&sd=true',
            icon: ScrollText,
          },
          {
            label: 'Sample Letter of Appeal — Scholastic Delinquency',
            to: 'https://docs.google.com/document/d/1btguPxZR6UWCuaP6VD8tTUPc9AKXhxNg/edit?usp=sharing&ouid=117853699207286348297&rtpof=true&sd=true',
            icon: ScrollText,
          },
          {
            label: 'Sample Letter of Appeal — Two-Strike Rule',
            to: 'https://docs.google.com/document/d/1vcPmHVQ5GpXkSbcokBTZYBq0RqzQT-DO/edit?usp=sharing&ouid=117853699207286348297&rtpof=true&sd=true',
            icon: ScrollText,
          },
          {
            label: 'Promissory Notes',
            to: 'https://drive.google.com/drive/folders/1ySxUEjMevUF2eqfMQz1caG2xJ4j1NCXW?usp=sharing',
            icon: FolderOpen,
          },
        ],
      },
      {
        title: 'Student Handbook',
        links: [
          {
            label: 'Student Handbook',
            to: studentHandbookUrl,
            icon: BookMarked,
            description: 'Policies and guidelines for PUP law students.',
          },
        ],
      },
    ],
  },
  { label: 'Contact Us', to: '/#contact', icon: Mail },
]
