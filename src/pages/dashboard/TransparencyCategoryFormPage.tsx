import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { AlignLeft, Eye, Landmark, Loader2, Plus, RotateCcw, Settings2, X } from 'lucide-react'
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
import { CatalogSelect } from '@/components/ui/CatalogSelect'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import {
  createTransparencyCategory,
  getTransparencyCategoryById,
  updateTransparencyCategory,
  type TransparencyCategoryInput,
  type TransparencyCategoryRecord,
  type TransparencyInnerTab,
} from '@/lib/transparency-categories-api'
import { TRANSPARENCY_ICON_OPTIONS, transparencyIcon } from '@/lib/transparency-icons'

type EditorTab = 'content' | 'details' | 'publish'

const BASE_PATH = '/admin/transparency'

const EDITOR_TABS: {
  id: EditorTab
  label: string
  short: string
  icon: typeof AlignLeft
}[] = [
  { id: 'content', label: 'Content', short: 'Copy', icon: AlignLeft },
  { id: 'details', label: 'Details', short: 'More', icon: Settings2 },
  { id: 'publish', label: 'Publish', short: 'Live', icon: Eye },
]

type FormState = {
  label: string
  title: string
  accent: string
  kicker: string
  note: string
  tabs: TransparencyInnerTab[]
  folder: string
  seriesLabel: string
  icon: string
  slug: string
  sortOrder: string
  published: boolean
}

const emptyForm = (): FormState => ({
  label: '',
  title: '',
  accent: '',
  kicker: '',
  note: '',
  tabs: [],
  folder: '',
  seriesLabel: '',
  icon: 'file-text',
  slug: '',
  sortOrder: '0',
  published: true,
})

function recordToForm(record: TransparencyCategoryRecord): FormState {
  return {
    label: record.label,
    title: record.title,
    accent: record.accent,
    kicker: record.kicker,
    note: record.note,
    tabs: record.tabs ?? [],
    folder: record.folder,
    seriesLabel: record.seriesLabel,
    icon: record.icon || 'file-text',
    slug: record.slug,
    sortOrder: String(record.sortOrder),
    published: record.published,
  }
}

function formToInput(form: FormState): TransparencyCategoryInput {
  return {
    slug: form.slug.trim() || undefined,
    label: form.label.trim(),
    title: form.title.trim() || form.label.trim(),
    accent: form.accent.trim(),
    kicker: form.kicker.trim(),
    note: form.note.trim(),
    tabs: form.tabs
      .map((item) => ({
        slug: item.slug.trim(),
        label: item.label.trim(),
      }))
      .filter((item) => item.label !== ''),
    folder: form.folder.trim(),
    seriesLabel: form.seriesLabel.trim(),
    icon: form.icon,
    sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
    published: form.published,
  }
}

export default function TransparencyCategoryFormPage() {
  const navigate = useNavigate()
  const { id: idParam } = useParams()
  const editId = idParam ? Number(idParam) : NaN
  const mode: 'create' | 'edit' = Number.isFinite(editId) && editId > 0 ? 'edit' : 'create'

  const [form, setForm] = useState<FormState>(emptyForm)
  const [baseline, setBaseline] = useState<FormState>(emptyForm)
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
    setTab('content')
    if (mode !== 'edit') {
      const blank = emptyForm()
      setForm(blank)
      setBaseline(blank)
      setLoading(false)
      setLoadError('')
      setNeedsLogin(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError('')
    void getTransparencyCategoryById(editId).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        if (result.status === 401 || result.status === 403) {
          setNeedsLogin(true)
          setLoadError('')
        } else {
          setNeedsLogin(false)
          setLoadError(result.error)
        }
        setLoading(false)
        return
      }
      setNeedsLogin(false)
      const next = recordToForm(result.data.item)
      setForm(next)
      setBaseline(next)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [mode, editId])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function resetForm() {
    setForm(baseline)
    setTab('content')
  }

  const contentIncomplete = !form.label.trim()
  const tabAlert: Record<EditorTab, boolean> = {
    content: contentIncomplete,
    details: false,
    publish: false,
  }

  const canSave = !saving && !loading && !contentIncomplete

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (contentIncomplete) {
      setTab('content')
      showToast('Tab label is required.', 'error')
      return
    }

    setSaving(true)
    const payload = formToInput(form)
    const result =
      mode === 'edit'
        ? await updateTransparencyCategory({ ...payload, id: editId })
        : await createTransparencyCategory(payload)
    setSaving(false)

    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        setNeedsLogin(true)
        return
      }
      showToast(result.error, 'error')
      return
    }

    navigate(BASE_PATH, {
      state: {
        toast: {
          message: mode === 'edit' ? 'Tab updated.' : 'Tab created.',
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
          Loading tab…
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
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="lg" variant="outline">
              <Link to={BASE_PATH}>Back to transparency</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const heading = mode === 'edit' ? 'Edit tab' : 'New tab'
  const disabled = saving

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to={BASE_PATH} label="transparency" />

      <section aria-label="Transparency tab form" className="w-full max-w-none">
        <form onSubmit={(event) => void onSubmit(event)} className={formWorkspaceCardCls}>
          <div className={formWorkspaceCardEyebrowCls}>
            <p className={formWorkspaceCardEyebrowTextCls}>Transparency · Tab</p>
          </div>

          <div className={formWorkspaceCardBodyCls}>
            <div className={formInsetPanelCls}>
              <div className={formTabChromeCardCls}>
                <div className="flex w-full min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3">
                    <span className={formSectionIconWrapCls}>
                      <Landmark className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h4 className={formSectionHeadingCls}>{heading}</h4>
                      <p className={formSectionIntroCls}>
                        Label, heading, and description shown on the public transparency page.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Reset transparency tab form"
                    title="Reset"
                    disabled={saving}
                    className="mt-[1px] inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-[12px] font-semibold text-zinc-700 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition hover:border-zinc-300 hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-50 sm:min-h-9 sm:px-3 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-900"
                    onClick={resetForm}
                  >
                    <RotateCcw
                      className="h-4 w-4 shrink-0 text-zinc-600 dark:text-zinc-300"
                      aria-hidden
                    />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                </div>

                <div className={formTabListCls} role="tablist" aria-label="Tab editor sections">
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
                          alert={tabAlert[item.id]}
                        />
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className={formControlWellCls}>
                {tab === 'content' ? (
                  <div className="space-y-4">
                    <Field label="Tab label" required>
                      <input
                        type="text"
                        className={catalogInput}
                        value={form.label}
                        onChange={(e) => set('label', e.target.value)}
                        placeholder="Board Resolutions"
                        disabled={disabled}
                      />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Heading">
                        <input
                          type="text"
                          className={catalogInput}
                          value={form.title}
                          onChange={(e) => set('title', e.target.value)}
                          placeholder="Board Resolutions"
                          disabled={disabled}
                        />
                      </Field>
                      <Field label="Accent" optional>
                        <input
                          type="text"
                          className={catalogInput}
                          value={form.accent}
                          onChange={(e) => set('accent', e.target.value)}
                          placeholder="and En Banc Issuances"
                          disabled={disabled}
                        />
                      </Field>
                    </div>
                    <Field label="Description" optional>
                      <textarea
                        className={`${catalogInput} min-h-24 py-2.5`}
                        value={form.note}
                        onChange={(e) => set('note', e.target.value)}
                        placeholder="What this archive contains."
                        disabled={disabled}
                      />
                    </Field>
                  </div>
                ) : null}

                {tab === 'details' ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Kicker" optional>
                        <input
                          type="text"
                          className={catalogInput}
                          value={form.kicker}
                          onChange={(e) => set('kicker', e.target.value)}
                          placeholder="Secretariat"
                          disabled={disabled}
                        />
                      </Field>
                      <Field label="Series label" optional>
                        <input
                          type="text"
                          className={catalogInput}
                          value={form.seriesLabel}
                          onChange={(e) => set('seriesLabel', e.target.value)}
                          placeholder="Board Resolution"
                          disabled={disabled}
                        />
                      </Field>
                    </div>
                    <Field label="Folder label" optional>
                      <input
                        type="text"
                        className={catalogInput}
                        value={form.folder}
                        onChange={(e) => set('folder', e.target.value)}
                        placeholder="01 Board Resolution & Memoranda"
                        disabled={disabled}
                      />
                    </Field>
                    <div className={workspaceFormFieldGroupCls}>
                      <span className={workspaceFormLabelCls}>
                        Inner tabs
                        <span className={workspaceFormOptionalBadgeCls}>Optional</span>
                      </span>
                      <p className={formSectionIntroCls}>
                        Shown under this archive on the public page. Used for Financial Reports
                        groups such as quarterly liquidations.
                      </p>
                      <div className="mt-2 space-y-2">
                        {form.tabs.map((item, index) => (
                          <div key={`${item.slug}-${index}`} className="flex gap-2">
                            <input
                              type="text"
                              className={catalogInput}
                              value={item.label}
                              onChange={(e) => {
                                const label = e.target.value
                                set(
                                  'tabs',
                                  form.tabs.map((tab, i) =>
                                    i === index ? { ...tab, label } : tab,
                                  ),
                                )
                              }}
                              placeholder="Quarterly liquidations"
                              disabled={disabled}
                            />
                            <button
                              type="button"
                              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:border-rose-200 hover:text-rose-700 dark:border-zinc-700"
                              aria-label={`Remove ${item.label || 'tab'}`}
                              disabled={disabled}
                              onClick={() =>
                                set(
                                  'tabs',
                                  form.tabs.filter((_, i) => i !== index),
                                )
                              }
                            >
                              <X className="h-4 w-4" aria-hidden />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 text-[12px] font-semibold text-zinc-600 hover:border-brand-200 hover:text-brand-800 dark:border-zinc-700 dark:text-zinc-300"
                          disabled={disabled}
                          onClick={() =>
                            set('tabs', [...form.tabs, { slug: '', label: '' }])
                          }
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                          Add tab
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Icon">
                        <CatalogSelect
                          aria-label="Icon"
                          disabled={disabled}
                          value={form.icon}
                          options={TRANSPARENCY_ICON_OPTIONS.map((option) => {
                            const Icon = transparencyIcon(option.value)
                            return {
                              ...option,
                              icon: <Icon className="size-4" aria-hidden />,
                            }
                          })}
                          onChange={(value) => set('icon', value)}
                        />
                      </Field>
                      <Field label="Sort order">
                        <input
                          type="number"
                          className={catalogInput}
                          value={form.sortOrder}
                          onChange={(e) => set('sortOrder', e.target.value)}
                          disabled={disabled}
                        />
                      </Field>
                    </div>
                    <Field label="Slug" optional>
                      <input
                        type="text"
                        className={catalogInput}
                        value={form.slug}
                        onChange={(e) => set('slug', e.target.value)}
                        placeholder="auto from label"
                        disabled={disabled}
                      />
                    </Field>
                  </div>
                ) : null}

                {tab === 'publish' ? (
                  <div className="space-y-4">
                    <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200/90 bg-white px-3 text-[12px] font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                      <input
                        type="checkbox"
                        checked={form.published}
                        onChange={(e) => set('published', e.target.checked)}
                        className={tableCheckboxCls}
                        disabled={disabled}
                      />
                      Published on the public transparency page
                    </label>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className={formWorkspaceCardFooterCls}>
            <button type="submit" className={formWorkspacePrimaryBtnCls} disabled={!canSave}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Save
            </button>
          </div>
        </form>
      </section>

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

function Field({
  label,
  optional,
  required,
  children,
}: {
  label: string
  optional?: boolean
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className={workspaceFormFieldGroupCls}>
      <span className={workspaceFormLabelCls}>
        {label}
        {required ? (
          <span aria-hidden className={workspaceFormRequiredMarkCls}>
            {' '}
            *
          </span>
        ) : null}
        {optional ? <span className={workspaceFormOptionalBadgeCls}>Optional</span> : null}
      </span>
      {children}
    </label>
  )
}
