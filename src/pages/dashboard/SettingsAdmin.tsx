import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, FileText, Loader2, Plus, Trash2 } from 'lucide-react'
import { RequireLoginRedirect } from '@/components/portal/RequireLoginRedirect'
import {
  formControlWellCls,
  formInsetPanelCls,
  formSectionHeadingCls,
  formSectionIntroCls,
  formWorkspaceCardBodyCls,
  formWorkspaceCardCls,
  formWorkspaceCardEyebrowCls,
  formWorkspaceCardEyebrowTextCls,
  formWorkspaceCardFooterCls,
  formWorkspacePrimaryBtnCls,
} from '@/components/portal/register-ui'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import { defaultSiteContact } from '@/hooks/useSiteContact'
import {
  getSiteContact,
  mergeSiteContact,
  saveSiteContact,
  type SiteContact,
  type SiteSocial,
} from '@/lib/site-settings-api'
import { cn } from '@/lib/utils'
import {
  CmsField,
  CmsLoading,
  CmsPage,
  cmsInputCls,
  cmsSecondaryBtnCls,
  cmsTextareaCls,
} from '@/pages/dashboard/cms-admin-ui'

export default function SettingsAdmin() {
  const [contact, setContact] = useState<SiteContact | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [toast, setToast] = useState<SnackToast | null>(null)

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const result = await getSiteContact()
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) setNeedsLogin(true)
      else showToast(result.error, 'error')
      setContact(defaultSiteContact)
      setLoading(false)
      return
    }
    setNeedsLogin(false)
    setContact(mergeSiteContact(defaultSiteContact, result.data.contact))
    setLoading(false)
  }, [showToast])

  useEffect(() => {
    void load()
  }, [load])

  function patch(next: Partial<SiteContact>) {
    setContact((prev) => (prev ? { ...prev, ...next } : prev))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!contact) return
    setSaving(true)
    const result = await saveSiteContact(contact)
    setSaving(false)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        setNeedsLogin(true)
        return
      }
      showToast(result.error, 'error')
      return
    }
    setContact(mergeSiteContact(defaultSiteContact, result.data.contact))
    showToast('Saved. Contact, header, and footer will use these details.', 'success')
  }

  if (needsLogin) return <RequireLoginRedirect />
  if (loading || !contact) return <CmsLoading label="Loading settings…" />

  return (
    <CmsPage
      title="Settings"
      blurb="Contact details and social links shown in the header, footer, and contact section."
    >
      <form onSubmit={(event) => void onSubmit(event)} className={formWorkspaceCardCls}>
        <div className={formWorkspaceCardEyebrowCls}>
          <p className={formWorkspaceCardEyebrowTextCls}>Site · Contact</p>
        </div>

        <div className={formWorkspaceCardBodyCls}>
          <div className={formInsetPanelCls}>
            <h4 className={formSectionHeadingCls}>Office & contact</h4>
            <p className={formSectionIntroCls}>Changes publish immediately.</p>
            <div className={cn(formControlWellCls, 'mt-4 space-y-6')}>
              <div className="grid gap-3 sm:grid-cols-2">
                <CmsField label="Official email" required>
                  <input
                    type="email"
                    required
                    value={contact.email}
                    disabled={saving}
                    onChange={(event) => patch({ email: event.target.value })}
                    className={cmsInputCls}
                  />
                </CmsField>
                <CmsField label="Office hours">
                  <input
                    type="text"
                    value={contact.hours}
                    disabled={saving}
                    onChange={(event) => patch({ hours: event.target.value })}
                    className={cmsInputCls}
                  />
                </CmsField>
                <CmsField label="Office name" required>
                  <input
                    type="text"
                    required
                    value={contact.office}
                    disabled={saving}
                    onChange={(event) => patch({ office: event.target.value })}
                    className={cmsInputCls}
                  />
                </CmsField>
                <CmsField label="SEC registration" optional>
                  <input
                    type="text"
                    value={contact.secRegistration}
                    disabled={saving}
                    onChange={(event) => patch({ secRegistration: event.target.value })}
                    className={cmsInputCls}
                  />
                </CmsField>
                <CmsField label="Address" required className="sm:col-span-2">
                  <textarea
                    required
                    rows={2}
                    value={contact.address}
                    disabled={saving}
                    onChange={(event) => patch({ address: event.target.value })}
                    className={cmsTextareaCls}
                  />
                </CmsField>
                <CmsField label="Student handbook URL" optional className="sm:col-span-2">
                  <input
                    type="url"
                    value={contact.studentHandbookUrl}
                    disabled={saving}
                    onChange={(event) => patch({ studentHandbookUrl: event.target.value })}
                    className={cmsInputCls}
                    placeholder="https://…"
                  />
                </CmsField>
              </div>

              <SocialsEditor
                heading="Social links (header & contact)"
                items={contact.socials}
                disabled={saving}
                onChange={(socials) => patch({ socials })}
              />
              <SocialsEditor
                heading="Footer social links"
                items={contact.footerSocials}
                disabled={saving}
                onChange={(footerSocials) => patch({ footerSocials })}
              />
            </div>
          </div>
        </div>

        <div className={formWorkspaceCardFooterCls}>
          <button type="submit" className={formWorkspacePrimaryBtnCls} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              'Save changes'
            )}
          </button>
        </div>
      </form>

      <Link
        to="/admin/board-resolutions"
        className="group flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-brand-300 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
          <FileText className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Transparency archives
          </span>
          <span className="block text-[12px] text-zinc-500">
            Upload files for each public transparency tab.
          </span>
        </span>
        <ArrowUpRight className="size-4 text-zinc-400 group-hover:text-brand-700" aria-hidden />
      </Link>

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </CmsPage>
  )
}

function SocialsEditor({
  heading,
  items,
  disabled,
  onChange,
}: {
  heading: string
  items: SiteSocial[]
  disabled?: boolean
  onChange: (items: SiteSocial[]) => void
}) {
  function update(index: number, patch: Partial<SiteSocial>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          {heading}{' '}
          <span className="font-mono text-[11px] font-medium text-zinc-400">{items.length}</span>
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...items, { name: '', handle: '', href: '' }])}
          className={cmsSecondaryBtnCls}
        >
          <Plus className="size-3.5" aria-hidden />
          Add
        </button>
      </div>
      <ul className="grid gap-3">
        {items.map((item, index) => (
          <li
            key={`${heading}-${index}`}
            className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-3 sm:grid-cols-[8rem_10rem_minmax(0,1fr)_auto] sm:items-end dark:border-zinc-800 dark:bg-zinc-950"
          >
            <CmsField label="Name">
              <input
                type="text"
                value={item.name}
                disabled={disabled}
                onChange={(event) => update(index, { name: event.target.value })}
                className={cmsInputCls}
                placeholder="Facebook"
              />
            </CmsField>
            <CmsField label="Handle">
              <input
                type="text"
                value={item.handle}
                disabled={disabled}
                onChange={(event) => update(index, { handle: event.target.value })}
                className={cmsInputCls}
                placeholder="/pupcl.sc"
              />
            </CmsField>
            <CmsField label="URL">
              <input
                type="url"
                value={item.href}
                disabled={disabled}
                onChange={(event) => update(index, { href: event.target.value })}
                className={cmsInputCls}
                placeholder="https://…"
              />
            </CmsField>
            <button
              type="button"
              disabled={disabled}
              aria-label={`Remove ${item.name || 'link'}`}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              className="inline-flex size-9 items-center justify-center rounded-md text-red-700 disabled:opacity-40 dark:text-red-300"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
