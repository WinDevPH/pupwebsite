import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { FolderOpen, Loader2, Megaphone } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { RequireLoginRedirect } from '@/components/portal/RequireLoginRedirect'
import {
  catalogInput,
  formControlWellCls,
  formInsetPanelCls,
  formSectionHeadingCls,
  formSectionIconWrapCls,
  formSectionIntroCls,
  FormSectionTabLabel,
  formTabBtnCls,
  formTabChromeCardCls,
  formTabListCls,
  FormWorkspaceBackLink,
  formWorkspaceCardBodyCls,
  formWorkspaceCardCls,
  formWorkspaceCardEyebrowCls,
  formWorkspaceCardEyebrowTextCls,
  formWorkspaceCardFooterCls,
  formWorkspacePrimaryBtnCls,
  tableCheckboxCls,
  workspaceFormFieldGroupCls,
  workspaceFormLabelCls,
  workspaceFormOptionalBadgeCls,
  workspaceFormRequiredMarkCls,
  workspaceTenantMainStackCls,
} from '@/components/portal/register-ui'
import { Button } from '@/components/ui/button'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import {
  createFormGroup,
  getFormGroupById,
  updateFormGroup,
  type FormGroupRecord,
} from '@/lib/forms-api'
import { cn } from '@/lib/utils'

type EditorTab = 'content' | 'publish'

const EDITOR_TABS = [
  { id: 'content' as const, label: 'Content', short: 'Copy', icon: FolderOpen },
  { id: 'publish' as const, label: 'Publish', short: 'Live', icon: Megaphone },
]

type FormState = {
  title: string
  note: string
  slug: string
  sortOrder: string
  published: boolean
}

const emptyForm = (): FormState => ({
  title: '',
  note: '',
  slug: '',
  sortOrder: '0',
  published: true,
})

function recordToForm(item: FormGroupRecord): FormState {
  return {
    title: item.title,
    note: item.note ?? '',
    slug: item.slug,
    sortOrder: String(item.sortOrder ?? 0),
    published: item.published,
  }
}

export default function FormGroupFormPage() {
  const navigate = useNavigate()
  const { id: idParam } = useParams()
  const editId = idParam ? Number(idParam) : NaN
  const mode: 'create' | 'edit' = Number.isFinite(editId) && editId > 0 ? 'edit' : 'create'
  const [form, setForm] = useState<FormState>(emptyForm)
  const [tab, setTab] = useState<EditorTab>('content')
  const [loading, setLoading] = useState(mode === 'edit')
  const [loadError, setLoadError] = useState('')
  const [needsLogin, setNeedsLogin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<SnackToast | null>(null)

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (mode !== 'edit') {
      setForm(emptyForm())
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void getFormGroupById(editId).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setNeedsLogin(result.status === 401 || result.status === 403)
        setLoadError(result.status === 401 || result.status === 403 ? '' : result.error)
        setLoading(false)
        return
      }
      setForm(recordToForm(result.data.item))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [mode, editId])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.title.trim()) {
      setTab('content')
      showToast('Title is required.', 'error')
      return
    }
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      note: form.note.trim() || null,
      slug: form.slug.trim() || undefined,
      sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
      published: form.published,
    }
    const result =
      mode === 'edit'
        ? await updateFormGroup({ ...payload, id: editId })
        : await createFormGroup(payload)
    setSaving(false)
    if (!result.ok) {
      showToast(result.error, 'error')
      return
    }
    navigate('/admin/forms', {
      state: {
        toast: {
          message: mode === 'edit' ? 'Form group updated.' : 'Form group created.',
          variant: 'success' as const,
        },
      },
    })
  }

  if (loading) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300/90 bg-zinc-50/80 px-5 py-16 text-[13px] text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-hidden />
          Loading form group…
        </div>
      </div>
    )
  }

  if (needsLogin) return <RequireLoginRedirect />

  if (loadError) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <div className="rounded-xl border border-zinc-200 bg-white px-5 py-8 shadow-sm">
          <p className="text-sm font-medium text-zinc-900">{loadError}</p>
          <Button asChild size="lg" variant="outline" className="mt-4">
            <Link to="/admin/forms">Back to forms</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to="/admin/forms" label="forms" />
      <section aria-label="Form group" className="w-full max-w-none">
        <form onSubmit={(event) => void onSubmit(event)} className={formWorkspaceCardCls}>
          <div className={formWorkspaceCardEyebrowCls}>
            <p className={formWorkspaceCardEyebrowTextCls}>Forms · Group</p>
          </div>
          <div className={formWorkspaceCardBodyCls}>
            <div className={formInsetPanelCls}>
              <div className={formTabChromeCardCls}>
                <div className="flex w-full min-w-0 items-start gap-2.5">
                  <span className={formSectionIconWrapCls}>
                    <FolderOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h4 className={formSectionHeadingCls}>
                      {mode === 'edit' ? 'Edit group' : 'New group'}
                    </h4>
                    <p className={formSectionIntroCls}>
                      A heading on the public Forms page. Add download links after saving.
                    </p>
                  </div>
                </div>
                <div className={formTabListCls} role="tablist" aria-label="Form group sections">
                  {EDITOR_TABS.map((item) => {
                    const Icon = item.icon
                    const active = tab === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        className={formTabBtnCls(active)}
                        disabled={saving}
                        onClick={() => setTab(item.id)}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                        <FormSectionTabLabel
                          label={item.label}
                          short={item.short}
                          alert={item.id === 'content' && !form.title.trim()}
                        />
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className={formControlWellCls}>
                {tab === 'content' ? (
                  <div className="space-y-4">
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="fg-title">
                        Title <span className={workspaceFormRequiredMarkCls}>*</span>
                      </label>
                      <input
                        id="fg-title"
                        className={catalogInput}
                        value={form.title}
                        onChange={(event) => set('title', event.target.value)}
                        placeholder="PUP ACE Forms"
                        disabled={saving}
                        required
                      />
                    </div>
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="fg-note">
                        Note <span className={workspaceFormOptionalBadgeCls}>Optional</span>
                      </label>
                      <textarea
                        id="fg-note"
                        className={cn(catalogInput, 'h-auto min-h-[4.5rem] py-2.5')}
                        rows={3}
                        value={form.note}
                        onChange={(event) => set('note', event.target.value)}
                        placeholder="Short line under the heading."
                        disabled={saving}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className={workspaceFormFieldGroupCls}>
                        <label className={workspaceFormLabelCls} htmlFor="fg-slug">
                          Slug <span className={workspaceFormOptionalBadgeCls}>Optional</span>
                        </label>
                        <input
                          id="fg-slug"
                          className={catalogInput}
                          value={form.slug}
                          onChange={(event) => set('slug', event.target.value)}
                          placeholder="auto-from-title"
                          disabled={saving}
                        />
                      </div>
                      <div className={workspaceFormFieldGroupCls}>
                        <label className={workspaceFormLabelCls} htmlFor="fg-sort">
                          Sort order
                        </label>
                        <input
                          id="fg-sort"
                          type="number"
                          className={catalogInput}
                          value={form.sortOrder}
                          onChange={(event) => set('sortOrder', event.target.value)}
                          disabled={saving}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-3">
                    <input
                      type="checkbox"
                      className={cn(tableCheckboxCls, 'mt-0.5')}
                      checked={form.published}
                      disabled={saving}
                      onChange={(event) => set('published', event.target.checked)}
                    />
                    <span>
                      <span className="block text-[13px] font-semibold text-zinc-900">
                        Published on the public site
                      </span>
                      <span className="mt-1 block text-[12px] leading-5 text-zinc-500">
                        Hidden groups stay in admin only.
                      </span>
                    </span>
                  </label>
                )}
              </div>
            </div>
          </div>
          <div className={formWorkspaceCardFooterCls}>
            <button
              type="submit"
              className={formWorkspacePrimaryBtnCls}
              disabled={saving || !form.title.trim()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {mode === 'edit' ? 'Save changes' : 'Create group'}
            </button>
          </div>
        </form>
      </section>
      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
