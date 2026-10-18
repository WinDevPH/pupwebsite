import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { FileText, Loader2, Megaphone, Tags } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
  DOCUMENT_CATEGORIES,
  createDocument,
  getDocumentById,
  updateDocument,
  type DocumentCategory,
  type DocumentInput,
  type DocumentRecord,
} from '@/lib/documents-api'

type EditorTab = 'content' | 'details' | 'publish'

const EDITOR_TABS: {
  id: EditorTab
  label: string
  short: string
  icon: typeof FileText
}[] = [
  { id: 'content', label: 'Content', short: 'Doc', icon: FileText },
  { id: 'details', label: 'Details', short: 'Meta', icon: Tags },
  { id: 'publish', label: 'Publish', short: 'Live', icon: Megaphone },
]

const SERIES_HINT: Record<DocumentCategory, string> = {
  board_resolution: 'Board Resolution',
  appointment_resolution: 'Resolution',
  memorandum: 'Memorandum',
  report: 'Report',
}

type FormState = {
  category: DocumentCategory
  number: string
  title: string
  url: string
  seriesLabel: string
  sortOrder: string
  published: boolean
}

function parseCategory(raw: string | null): DocumentCategory | null {
  if (!raw) return null
  return DOCUMENT_CATEGORIES.some((item) => item.value === raw) ? (raw as DocumentCategory) : null
}

function emptyForm(category: DocumentCategory = 'board_resolution', withHint = false): FormState {
  return {
    category,
    number: '',
    title: '',
    url: '',
    seriesLabel: withHint ? SERIES_HINT[category] : '',
    sortOrder: '0',
    published: true,
  }
}

function recordToForm(record: DocumentRecord): FormState {
  return {
    category: record.category,
    number: record.number,
    title: record.title,
    url: record.url || record.href,
    seriesLabel: record.seriesLabel,
    sortOrder: String(record.sortOrder),
    published: record.published,
  }
}

function formToInput(form: FormState): DocumentInput {
  return {
    category: form.category,
    number: form.number.trim(),
    title: form.title.trim(),
    url: form.url.trim(),
    seriesLabel: form.seriesLabel.trim(),
    sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
    published: form.published,
  }
}

export default function DocumentFormPage() {
  const navigate = useNavigate()
  const { id: idParam } = useParams()
  const [searchParams] = useSearchParams()
  const editId = idParam ? Number(idParam) : NaN
  const mode: 'create' | 'edit' = Number.isFinite(editId) && editId > 0 ? 'edit' : 'create'
  const queryCategory = parseCategory(searchParams.get('category'))

  const [form, setForm] = useState<FormState>(() =>
    emptyForm(queryCategory ?? 'board_resolution', queryCategory !== null),
  )
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
      setForm(emptyForm(queryCategory ?? 'board_resolution', queryCategory !== null))
      setLoading(false)
      setLoadError('')
      setNeedsLogin(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError('')
    void getDocumentById(editId).then((result) => {
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
      setForm(recordToForm(result.data.item))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [mode, editId, queryCategory])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function changeCategory(next: DocumentCategory) {
    setForm((prev) => {
      if (prev.category === next) return prev
      // Keep the series label in sync only while it still holds the previous hint (or is blank).
      const followsHint = !prev.seriesLabel.trim() || prev.seriesLabel === SERIES_HINT[prev.category]
      return {
        ...prev,
        category: next,
        seriesLabel: followsHint ? SERIES_HINT[next] : prev.seriesLabel,
      }
    })
  }

  const contentIncomplete = !form.title.trim() || !form.url.trim()
  const tabAlert: Record<EditorTab, boolean> = {
    content: contentIncomplete,
    details: false,
    publish: false,
  }
  const canSave = !saving && !loading && !contentIncomplete

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.title.trim()) {
      setTab('content')
      showToast('Title is required.', 'error')
      return
    }
    if (!form.url.trim()) {
      setTab('content')
      showToast('Document URL is required.', 'error')
      return
    }

    setSaving(true)
    const payload = formToInput(form)
    const result =
      mode === 'edit'
        ? await updateDocument({ ...payload, id: editId })
        : await createDocument(payload)
    setSaving(false)

    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        setNeedsLogin(true)
        return
      }
      showToast(result.error, 'error')
      return
    }

    navigate('/admin/documents', {
      state: {
        toast: {
          message: mode === 'edit' ? 'Document updated.' : 'Document created.',
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
          Loading document…
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
              <Link to="/admin/documents">Back to documents</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const disabled = saving
  const categoryLabel =
    DOCUMENT_CATEGORIES.find((item) => item.value === form.category)?.label ?? 'Document'

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to="/admin/documents" label="documents" />

      <section aria-label="Document form" className="w-full max-w-none">
        <form onSubmit={(event) => void onSubmit(event)} className={formWorkspaceCardCls}>
          <div className={formWorkspaceCardEyebrowCls}>
            <p className={formWorkspaceCardEyebrowTextCls}>Documents · {categoryLabel}</p>
          </div>

          <div className={formWorkspaceCardBodyCls}>
            <div className={formInsetPanelCls}>
              <div className={formTabChromeCardCls}>
                <div className="flex w-full min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3">
                    <span className={formSectionIconWrapCls}>
                      <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h4 className={formSectionHeadingCls}>
                        {mode === 'edit' ? 'Edit document' : 'New document'}
                      </h4>
                      <p className={formSectionIntroCls}>
                        Content, details, and publish use separate tabs. Required fields are marked
                        with{' '}
                        <span className="font-semibold text-brand-700 dark:text-brand-400">*</span>.
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  role="tablist"
                  aria-label="Document form sections"
                  className={formTabListCls}
                >
                  {EDITOR_TABS.map((item) => {
                    const Icon = item.icon
                    const selected = tab === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        className={formTabBtnCls(selected)}
                        disabled={saving}
                        onClick={() => setTab(item.id)}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
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

              <div className="mt-3 space-y-4 sm:mt-4 sm:space-y-5">
                {tab === 'content' ? (
                  <section role="tabpanel" aria-label="Content" className="space-y-4">
                    <SectionIntro
                      icon={<FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />}
                      title="Content"
                      body="Title and link shown on the transparency and Legislative pages."
                    />
                    <div className={`${formControlWellCls} grid gap-3 sm:grid-cols-2 sm:gap-4`}>
                      <div className="sm:col-span-2">
                        <Field label="Title" required>
                          <input
                            type="text"
                            value={form.title}
                            onChange={(e) => set('title', e.target.value)}
                            placeholder="Resolution approving the annual budget"
                            className={catalogInput}
                            disabled={disabled}
                          />
                        </Field>
                      </div>
                      <div className="sm:col-span-2">
                        <Field label="Document URL" required>
                          <input
                            type="text"
                            value={form.url}
                            onChange={(e) => set('url', e.target.value)}
                            placeholder="https://drive.google.com/…"
                            className={catalogInput}
                            disabled={disabled}
                          />
                        </Field>
                      </div>
                      <Field label="Number" optional>
                        <input
                          type="text"
                          value={form.number}
                          onChange={(e) => set('number', e.target.value)}
                          placeholder="001"
                          className={catalogInput}
                          disabled={disabled}
                        />
                      </Field>
                      <Field label="Series label" optional>
                        <input
                          type="text"
                          value={form.seriesLabel}
                          onChange={(e) => set('seriesLabel', e.target.value)}
                          placeholder={SERIES_HINT[form.category]}
                          className={catalogInput}
                          disabled={disabled}
                        />
                      </Field>
                    </div>
                  </section>
                ) : null}

                {tab === 'details' ? (
                  <section role="tabpanel" aria-label="Details" className="space-y-4">
                    <SectionIntro
                      icon={<Tags className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />}
                      title="Details"
                      body="Category and display order for the public document lists."
                    />
                    <div className={`${formControlWellCls} grid gap-3 sm:grid-cols-2 sm:gap-4`}>
                      <Field label="Category" required>
                        <CatalogSelect
                          aria-label="Document category"
                          required
                          disabled={disabled}
                          value={form.category}
                          options={DOCUMENT_CATEGORIES.map((item) => ({
                            value: item.value,
                            label: item.label,
                          }))}
                          onChange={(value) => changeCategory(value as DocumentCategory)}
                        />
                      </Field>
                      <Field label="Sort order">
                        <input
                          type="number"
                          value={form.sortOrder}
                          onChange={(e) => set('sortOrder', e.target.value)}
                          className={catalogInput}
                          disabled={disabled}
                        />
                      </Field>
                    </div>
                  </section>
                ) : null}

                {tab === 'publish' ? (
                  <section role="tabpanel" aria-label="Publish" className="space-y-4">
                    <SectionIntro
                      icon={<Megaphone className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />}
                      title="Publish"
                      body="Control whether this document is visible on the public site."
                    />
                    <div className={formControlWellCls}>
                      <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200/90 bg-white px-3 text-[12px] font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                        <input
                          type="checkbox"
                          checked={form.published}
                          onChange={(e) => set('published', e.target.checked)}
                          className={tableCheckboxCls}
                          disabled={disabled}
                        />
                        Published on public site
                      </label>
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
          </div>

          <footer className={formWorkspaceCardFooterCls}>
            <button type="submit" className={formWorkspacePrimaryBtnCls} disabled={!canSave}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                'Save'
              )}
            </button>
          </footer>
        </form>
      </section>

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

function SectionIntro({
  icon,
  title,
  body,
}: {
  icon: ReactNode
  title: string
  body: string
}) {
  return (
    <div className="flex items-start gap-2.5 sm:gap-3">
      <span className={formSectionIconWrapCls}>{icon}</span>
      <div className="min-w-0">
        <h4 className={formSectionHeadingCls}>{title}</h4>
        <p className={formSectionIntroCls}>{body}</p>
      </div>
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
