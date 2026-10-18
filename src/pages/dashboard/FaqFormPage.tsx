import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { AlignLeft, CircleHelp, Eye, Loader2, RotateCcw, Settings2 } from 'lucide-react'
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
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import {
  createFaq,
  getFaqById,
  updateFaq,
  type FaqInput,
  type FaqRecord,
} from '@/lib/faq-api'
import { isEmptyRichText, sanitizeRichHtml } from '@/lib/rich-text'

type EditorTab = 'content' | 'details' | 'publish'

const BASE_PATH = '/admin/faq'

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
  question: string
  answerHtml: string
  slug: string
  sortOrder: string
  published: boolean
}

const emptyForm = (): FormState => ({
  question: '',
  answerHtml: '',
  slug: '',
  sortOrder: '0',
  published: true,
})

function recordToForm(record: FaqRecord): FormState {
  return {
    question: record.question,
    answerHtml: record.answerHtml || record.answer,
    slug: record.slug,
    sortOrder: String(record.sortOrder),
    published: record.published,
  }
}

function formToInput(form: FormState): FaqInput {
  return {
    slug: form.slug.trim() || undefined,
    question: form.question.trim(),
    answerHtml: sanitizeRichHtml(form.answerHtml),
    sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
    published: form.published,
  }
}

export default function FaqFormPage() {
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
    void getFaqById(editId).then((result) => {
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

  const answerEmpty = isEmptyRichText(sanitizeRichHtml(form.answerHtml))
  const contentIncomplete = !form.question.trim() || answerEmpty
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
      showToast('Question and answer are required.', 'error')
      return
    }

    setSaving(true)
    const payload = formToInput(form)
    const result =
      mode === 'edit'
        ? await updateFaq({ ...payload, id: editId })
        : await createFaq(payload)
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
          message: mode === 'edit' ? 'Question updated.' : 'Question created.',
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
          Loading question…
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
              <Link to={BASE_PATH}>Back to FAQ</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const heading = mode === 'edit' ? 'Edit question' : 'New question'

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to={BASE_PATH} label="FAQ" />

      <section aria-label="FAQ form" className="w-full max-w-none">
        <form onSubmit={(event) => void onSubmit(event)} className={formWorkspaceCardCls}>
          <div className={formWorkspaceCardEyebrowCls}>
            <p className={formWorkspaceCardEyebrowTextCls}>FAQ · Question</p>
          </div>

          <div className={formWorkspaceCardBodyCls}>
            <div className={formInsetPanelCls}>
              <div className={formTabChromeCardCls}>
                <div className="flex w-full min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3">
                    <span className={formSectionIconWrapCls}>
                      <CircleHelp className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h4 className={formSectionHeadingCls}>{heading}</h4>
                      <p className={formSectionIntroCls}>
                        Shown on the home page and the portal. Required fields show a red dot when
                        incomplete.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Reset FAQ form"
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

                <div className={formTabListCls} role="tablist" aria-label="FAQ editor sections">
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
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="faq-question">
                        Question <span className={workspaceFormRequiredMarkCls}>*</span>
                      </label>
                      <input
                        id="faq-question"
                        type="text"
                        className={catalogInput}
                        value={form.question}
                        onChange={(e) => set('question', e.target.value)}
                        disabled={saving}
                        required
                      />
                    </div>
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} id="faq-answer-label">
                        Answer <span className={workspaceFormRequiredMarkCls}>*</span>
                      </label>
                      <RichTextEditor
                        value={form.answerHtml}
                        onChange={(html) => set('answerHtml', html)}
                        placeholder="Write the answer shown on the public site."
                        disabled={saving}
                        aria-labelledby="faq-answer-label"
                      />
                    </div>
                  </div>
                ) : null}

                {tab === 'details' ? (
                  <div className="space-y-4">
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="faq-slug">
                        Slug <span className={workspaceFormOptionalBadgeCls}>Optional</span>
                      </label>
                      <input
                        id="faq-slug"
                        type="text"
                        className={catalogInput}
                        value={form.slug}
                        onChange={(e) => set('slug', e.target.value)}
                        placeholder="auto from question"
                        disabled={saving}
                      />
                    </div>
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="faq-sort">
                        Sort order
                      </label>
                      <input
                        id="faq-sort"
                        type="number"
                        className={catalogInput}
                        value={form.sortOrder}
                        onChange={(e) => set('sortOrder', e.target.value)}
                        disabled={saving}
                      />
                    </div>
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
                        disabled={saving}
                      />
                      Published on home page and portal
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
