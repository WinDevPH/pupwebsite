import { useEffect, useState } from 'react'
import { contact, footerSocials, studentHandbookUrl } from '@/components/layout/nav-data'
import { getSiteContact, mergeSiteContact, type SiteContact } from '@/lib/site-settings-api'

/** Bundled defaults from nav-data; used until (or unless) the CMS API responds. */
export const defaultSiteContact: SiteContact = {
  email: contact.email,
  office: contact.office,
  address: contact.address,
  secRegistration: contact.secRegistration,
  hours: contact.hours,
  socials: contact.socials.map((item) => ({ ...item })),
  footerSocials: footerSocials.map((item) => ({ ...item })),
  studentHandbookUrl,
}

export function useSiteContact() {
  const [siteContact, setSiteContact] = useState<SiteContact>(defaultSiteContact)

  useEffect(() => {
    let cancelled = false
    void getSiteContact().then((result) => {
      if (cancelled || !result.ok) return
      setSiteContact(mergeSiteContact(defaultSiteContact, result.data.contact))
    })
    return () => {
      cancelled = true
    }
  }, [])

  return siteContact
}
