import type { LucideIcon } from 'lucide-react'
import { Handshake, HeartHandshake, Landmark } from 'lucide-react'

export const PROJECT_CATEGORY_SLUGS = [
  'internal-affairs',
  'external-linkages',
  'institutional-sustainability',
] as const

export type ProjectCategorySlug = (typeof PROJECT_CATEGORY_SLUGS)[number]

export type ProjectCategory = {
  slug: ProjectCategorySlug
  label: string
  description: string
  to: string
  icon: LucideIcon
}

export const PROJECT_CATEGORIES: ProjectCategory[] = [
  {
    slug: 'internal-affairs',
    label: 'Internal Affairs and Student Welfare',
    description:
      'Core initiatives and support programs dedicated to improving daily student life, academic resources, campus welfare, and student-to-council relations within the college.',
    to: '/projects/internal-affairs',
    icon: HeartHandshake,
  },
  {
    slug: 'external-linkages',
    label: 'External Linkages, Advocacies, Community and Partnerships',
    description:
      'Collaborative programs, inter-school networks, legal aid outreaches, and public service advocacies bridging the PUP College of Law with the wider legal community and society.',
    to: '/projects/external-linkages',
    icon: Handshake,
  },
  {
    slug: 'institutional-sustainability',
    label: 'Institutional Sustainability',
    description:
      'Long-term developmental projects, digital infrastructure upgrades, and administrative policy frameworks designed to secure the enduring growth and operational stability of the Student Council.',
    to: '/projects/institutional-sustainability',
    icon: Landmark,
  },
]

export function isProjectCategorySlug(value: string | undefined | null): value is ProjectCategorySlug {
  return PROJECT_CATEGORY_SLUGS.includes(value as ProjectCategorySlug)
}

export function projectCategoryFromSlug(slug: string | undefined) {
  if (!slug) return undefined
  return PROJECT_CATEGORIES.find((item) => item.slug === slug)
}

export function projectCategoryLabel(slug: string | undefined) {
  return projectCategoryFromSlug(slug)?.label ?? 'Uncategorized'
}
