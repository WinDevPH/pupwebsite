import { unreachableServerMessage } from '@/lib/unreachable-server'
export type SiteSocial = {
  name: string
  handle: string
  href: string
}

export type SiteContact = {
  email: string
  office: string
  address: string
  secRegistration: string
  hours: string
  socials: SiteSocial[]
  footerSocials: SiteSocial[]
  studentHandbookUrl: string
  grievanceFormUrl: string
  grievanceGuidelinesUrl: string
}

type ApiFailure = { ok: false; error: string; status: number }
type ApiOk<T> = { ok: true; data: T }

async function request<T>(path: string, init?: RequestInit): Promise<ApiOk<T> | ApiFailure> {
  try {
    const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData
    const response = await fetch(path, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(isFormData || !init?.body ? {} : { 'Content-Type': 'application/json' }),
        ...(init?.headers ?? {}),
      },
      ...init,
    })
    const payload = (await response.json().catch(() => null)) as
      | ({ ok?: boolean; error?: string } & T)
      | null

    if (!response.ok || !payload?.ok) {
      return {
        ok: false,
        error: payload?.error || 'Something went wrong. Please try again.',
        status: response.status,
      }
    }

    return { ok: true, data: payload as T }
  } catch {
    return {
      ok: false,
      error: unreachableServerMessage(),
      status: 0,
    }
  }
}

function cleanSocials(value: unknown): SiteSocial[] {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => {
      const item = (row ?? {}) as Partial<SiteSocial>
      return {
        name: String(item.name ?? '').trim(),
        handle: String(item.handle ?? '').trim(),
        href: String(item.href ?? '').trim(),
      }
    })
    .filter((row) => row.name && row.href)
}

/** Merge an API payload over fallback defaults so partial rows never blank the UI. */
export function mergeSiteContact(
  fallback: SiteContact,
  partial: Partial<SiteContact> | null | undefined,
): SiteContact {
  if (!partial) return fallback
  const socials = cleanSocials(partial.socials)
  const footerSocials = cleanSocials(partial.footerSocials)
  return {
    email: partial.email?.trim() || fallback.email,
    office: partial.office?.trim() || fallback.office,
    address: partial.address?.trim() || fallback.address,
    secRegistration: partial.secRegistration?.trim() ?? fallback.secRegistration,
    hours: partial.hours?.trim() || fallback.hours,
    socials: socials.length ? socials : fallback.socials,
    footerSocials: footerSocials.length ? footerSocials : fallback.footerSocials,
    studentHandbookUrl: partial.studentHandbookUrl?.trim() || fallback.studentHandbookUrl,
    grievanceFormUrl: partial.grievanceFormUrl?.trim() || fallback.grievanceFormUrl,
    grievanceGuidelinesUrl: partial.grievanceGuidelinesUrl?.trim() || fallback.grievanceGuidelinesUrl,
  }
}

export async function getSiteContact() {
  const result = await request<{ contact: Partial<SiteContact> | null }>('/api/site-settings.php')
  if (!result.ok) return result
  return { ok: true as const, data: { contact: result.data.contact } }
}

export async function saveSiteContact(contact: SiteContact) {
  return request<{ contact: SiteContact }>('/api/site-settings.php', {
    method: 'PUT',
    body: JSON.stringify({ key: 'contact', payload: contact }),
  })
}
