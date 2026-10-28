import { useEffect, useMemo, useState } from 'react'
import { navItems, type NavItem } from '@/components/layout/nav-data'
import {
  getResourceLibrary,
  type ResourceLibrary,
  type ResourceLinkRecord,
} from '@/lib/resource-library-api'

export const defaultResourceLibrary: ResourceLibrary = {
  items: [],
}

export function useResourceLibrary() {
  const [library, setLibrary] = useState<ResourceLibrary>(defaultResourceLibrary)

  useEffect(() => {
    let cancelled = false
    void getResourceLibrary().then((result) => {
      if (cancelled || !result.ok) return
      setLibrary({
        items: result.data.items ?? [],
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  return library
}

export function applyResourceLibrary(items: NavItem[], links: ResourceLinkRecord[]): NavItem[] {
  if (links.length === 0) return items
  const bySlug = new Map(links.filter((item) => item.published).map((item) => [item.slug, item]))

  return items.map((item) => {
    if (!('groups' in item) || !item.groups) return item
    return {
      ...item,
      groups: item.groups.map((group) => ({
        ...group,
        links: group.links.map((link) => {
          if (!link.slug) return link
          const match = bySlug.get(link.slug)
          if (!match) return link
          return { ...link, label: match.title, to: match.url }
        }),
      })),
    }
  })
}

export function useNavItems() {
  const library = useResourceLibrary()
  return useMemo(() => applyResourceLibrary(navItems, library.items), [library.items])
}
