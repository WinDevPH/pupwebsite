import type { LucideIcon } from 'lucide-react'
import {
  BookMarked,
  CalendarCheck,
  CircleHelp,
  ClipboardList,
  FileText,
  FolderKanban,
  FolderOpen,
  Handshake,
  House,
  Landmark,
  Library,
  LockKeyhole,
  Mail,
  Megaphone,
  Scale,
  ScrollText,
  Shirt,
} from 'lucide-react'
import {
  PROJECT_CATEGORIES,
  projectCategoryFromSlug,
  type ProjectCategory,
} from '@/lib/project-categories'
import { DEFAULT_TRANSPARENCY_CATEGORIES } from '@/lib/transparency-categories-api'
import { transparencyIcon } from '@/lib/transparency-icons'

export { projectCategoryFromSlug }

/** Absolute http(s) URLs open in a new tab; everything else is an in-app route. */
export function isExternalNavTo(to: string) {
  return /^https?:\/\//i.test(to)
}

export const studentHandbookUrl =
  'https://drive.google.com/file/d/1neq3kippfsVWgFeWYepQWOx04X4TaUlE/view?usp=sharing'

export const enrollmentGuidelinesUrl =
  'https://drive.google.com/drive/folders/133QcxmFnf5taCTjdLKPDUO4fAD8HGR-J?usp=sharing'
export const jdCurriculumUrl =
  'https://drive.google.com/drive/folders/1wX2DUTuWIhfmhpQC9J0kwX22oMz59iqf?usp=sharing'
export const miscellaneousResourcesUrl =
  'https://drive.google.com/drive/folders/1y2apA30VR-cbCyZc01yPxJNVy7KeDa0f?usp=sharing'
export const merchGuidelinesUrl =
  'https://drive.google.com/drive/folders/1VPzGaGuRS82JZf1x4Gp_nOaIdiktLdBH?usp=sharing'
export const lockerGuidelinesUrl =
  'https://drive.google.com/file/d/1-Htb0iYsk0TTFAd2pGiziwfIUqwkpVg9/view?usp=sharing'
export const grievanceFormUrl =
  'https://docs.google.com/forms/d/e/1FAIpQLSdRdEa0MJPgriEsmIOKDi9Q70B25wnR3Ll_sjUT0O2rPiRjQg/viewform'
export const grievanceGuidelinesUrl =
  'https://drive.google.com/drive/folders/1_A1TJ_jdZXQhWOd5qd4nJmVw8Jr5scMk?usp=sharing'

export const formsPageDescription =
  'A centralized digital library of essential student documents, featuring official academic forms, enrollment guidelines, the Juris Doctor curriculum, and regulatory resources for easy reference.'

export const transparencyPageDescription =
  'Official board resolutions, commission issuances, memoranda, accomplishment reports, and financial records of the Student Council, arranged for public download.'

export const councilPageDescription =
  'The highest governing body of PUP College of Law students, their primary voice in administrative and academic affairs, and the body that forms policies for student welfare, rights, and interests.'

export type NavLinkItem = {
  label: string
  to: string
  slug?: string
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
    { name: 'X', handle: '@pupcolsc', href: 'https://x.com/pupcolsc' },
    {
      name: 'Instagram',
      handle: '@pupcolsc_official',
      href: 'https://www.instagram.com/pupcolsc_official/',
    },
  ],
}

export const footerSocials = [
  {
    name: 'Instagram',
    handle: '@pupcolsc_official',
    href: 'https://www.instagram.com/pupcolsc_official/',
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
      { label: 'Transparency', to: '/transparency' },
      { label: 'How It Works', to: '/how-it-works' },
      { label: 'Contact Us', to: '/#contact' },
    ],
  },
  {
    title: 'Student Services',
    links: [
      { label: 'Student Grievance', to: '/portal#grievance' },
      { label: 'Projects', to: '/projects' },
      { label: 'Services Portal', to: '/portal' },
      { label: 'Locker Reservation', to: '/lockers' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Student Handbook', to: studentHandbookUrl },
      { label: 'Forms', to: '/forms' },
      { label: 'Announcements', to: '/#bulletin' },
      { label: 'FAQs', to: '/#faq' },
    ],
  },
] as const

export const primaryCta: NavLinkItem = {
  label: 'Admin Panel',
  to: '/login',
}

export const portalCta: NavLinkItem = {
  label: 'Student Services Portal',
  to: '/portal',
}

export const projectPillars = PROJECT_CATEGORIES

export type ProjectPillar = ProjectCategory

export function projectPillarFromSlug(slug: string | undefined) {
  return projectCategoryFromSlug(slug)
}

export function transparencyNavLinks(
  categories: { slug: string; label: string; icon: string }[] = DEFAULT_TRANSPARENCY_CATEGORIES,
): NavLinkItem[] {
  return categories.map((item) => ({
    label: item.label,
    to: `/transparency#${item.slug}`,
    icon: transparencyIcon(item.icon),
  }))
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
    title: 'Governance & Transparency',
    icon: Scale,
    groups: [
      {
        title: 'Official documents and issuances',
        links: transparencyNavLinks(),
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
        links: projectPillars.map((item) => ({
          label: item.label,
          to: item.to,
          icon: item.icon,
        })),
      },
    ],
  },
  {
    label: 'Services & Store',
    title: 'Services & Store',
    icon: Shirt,
    groups: [
      {
        title: 'Reservations',
        links: [
          {
            label: 'Merchandise Reservation',
            to: '/merch',
            icon: Shirt,
            description: 'Reserve official Student Council merchandise.',
          },
          {
            label: 'Locker Reservation',
            to: '/lockers',
            icon: LockKeyhole,
            description: 'Reserve a locker for the semester.',
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
        title: 'Documents',
        links: [
          {
            slug: 'student-handbook',
            label: 'Student Handbook',
            to: studentHandbookUrl,
            icon: BookMarked,
          },
          {
            label: 'Forms',
            to: '/forms',
            icon: FolderOpen,
          },
          {
            slug: 'enrollment-guidelines',
            label: 'Enrollment Guidelines',
            to: enrollmentGuidelinesUrl,
            icon: ClipboardList,
          },
          {
            slug: 'jd-curriculum',
            label: 'Juris Doctor Curriculum',
            to: jdCurriculumUrl,
            icon: ScrollText,
          },
          {
            slug: 'miscellaneous',
            label: 'Miscellaneous',
            to: miscellaneousResourcesUrl,
            icon: FileText,
          },
        ],
      },
    ],
  },
  { label: 'Contact Us', to: '/#contact', icon: Mail },
]
