import { useEffect, useState } from 'react'
import { organizations, organizationsYear } from '@/components/home/org-directory'
import { formatOrganizationsYear, listOrganizations } from '@/lib/organizations-api'

export type OrgCard = {
  id: string
  short: string
  name: string
  facebook: string
  logo: string
}

const fallbackOrganizations: OrgCard[] = organizations.map((org) => ({ ...org }))

/** Recognized organizations from the CMS API; bundled directory is the initial/fallback list. */
export function useOrganizations() {
  const [items, setItems] = useState<OrgCard[]>(fallbackOrganizations)
  const [year, setYear] = useState<string>(organizationsYear)

  useEffect(() => {
    let cancelled = false
    void listOrganizations().then((result) => {
      if (cancelled || !result.ok) return
      setItems(
        result.data.items.map((item) => ({
          id: item.slug,
          short: item.short,
          name: item.name,
          facebook: item.facebook,
          logo: item.logo,
        })),
      )
      setYear(formatOrganizationsYear(result.data.items[0]?.academicYear))
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { items, year }
}
