import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { AlignLeft, Flag, Gavel, Loader2, Settings2, Target } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
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
  workspaceFormFieldGroupCls,
  workspaceFormLabelCls,
  workspaceFormOptionalBadgeCls,
  workspaceFormRequiredMarkCls,
  workspaceTenantMainStackCls,
} from '@/components/portal/register-ui'
import { Button } from '@/components/ui/button'
import { CatalogSelect } from '@/components/ui/CatalogSelect'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import { ABOUT_ICON_OPTIONS, aboutIcon } from '@/lib/about-content-icons'
import {
  emptyHistoryItem,
  emptyListItem,
  getAboutContent,
  saveAboutSections,
  type AboutHistoryItem,
  type AboutListItem,
  type AboutSections,
} from '@/lib/about-content-api'
import {
  ABOUT_BASE_PATH,
  ABOUT_KIND_LABEL,
  type AboutAdminPage,
  type AboutRowKind,
} from '@/lib/about-admin-routes'
import { isEmptyRichText, sanitizeRichHtml } from '@/lib/rich-text'

type EditorTab = 'content' | 'details'

type FormState = {
  text: string
  title: string
  icon: string
  when: string
  note: string
}

const emptyForm = (): FormState => ({
  text: '',
  title: '',
  icon: 'scale',
  when: '',
  note: '',
})

const PAGE_ICON: Record<AboutAdminPage, typeof AlignLeft> = {
  mvvg: AlignLeft,
  mandate: Gavel,
  agenda: Target,
  history: Flag,
}

function parseIndex(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const n = Number(raw)
  return Number.isInteger(n) && n >= 0 ? n : null
}

function defaultIconForKind(kind: AboutRowKind) {
  switch (kind) {
    case 'goals':
      return 'flag'
    case 'mandate':
      return 'workflow'
    case 'agenda':
      return 'megaphone'
    default:
      return 'scale'
  }
}

export default function AboutContentFormPage({
  page,
  kind,
}: {
  page: AboutAdminPage
  kind: AboutRowKind
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { index: indexParam } = useParams()

  const isStatement = kind === 'mission' || kind === 'vision'
  const isHistory = kind === 'history'
  const editIndex = parseIndex(indexParam)
  const isNewPath = /\/new(\/|$)/.test(location.pathname)
  const mode: 'create' | 'edit' = isStatement
    ? 'edit'
    : !isNewPath && editIndex !== null
      ? 'edit'
      : 'create'

  const basePath = ABOUT_BASE_PATH[page]
  const kindLabel = ABOUT_KIND_LABEL[kind]
  const PageIcon = PAGE_ICON[page]

  const [form, setForm] = useState<FormState>(() => ({
    ...emptyForm(),
    icon: defaultIconForKind(kind),
  }))
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
      setForm({ ...emptyForm(), icon: defaultIconForKind(kind) })
      setLoading(false)
      setLoadError('')
      setNeedsLogin(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError('')
    void getAboutContent().then((result) => {
      if (cancelled) return
      if (!result.ok) {
        if (result.status === 401 || result.status === 403) {
          setNeedsLogin(true)
        } else {
          setNeedsLogin(false)
          setLoadError(result.error)
        }
        setLoading(false)
        return
      }
      setNeedsLogin(false)
      const loaded = sectionsToForm(result.data.sections, kind, editIndex)
      if (!loaded) {
        setLoadError(`This ${kindLabel.toLowerCase()} entry no longer exists.`)
        setLoading(false)
        return
      }
      setForm(loaded)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [mode, kind, editIndex, kindLabel])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const bodyEmpty = isEmptyRichText(sanitizeRichHtml(form.text))
  const contentIncomplete = isStatement
    ? bodyEmpty
    : !form.title.trim() || bodyEmpty
  const detailsIncomplete = isHistory ? !form.when.trim() : false

  const tabs: { id: EditorTab; label: string; short: string; icon: typeof AlignLeft }[] = [
    { id: 'content', label: 'Content', short: 'Copy', icon: AlignLeft },
    ...(isStatement
      ? []
      : [{ id: 'details' as const, label: 'Details', short: 'More', icon: Settings2 }]),
  ]
  const tabAlert: Record<EditorTab, boolean> = {
    content: contentIncomplete,
    details: detailsIncomplete,
  }

  const canSave = !saving && !loading && !contentIncomplete && !detailsIncomplete

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (contentIncomplete) {
      setTab('content')
      showToast(
        isStatement ? 'Editorial content is required.' : 'Title and editorial content are required.',
        'error',
      )
      return
    }
    if (detailsIncomplete) {
      setTab('details')
      showToast('“When” is required.', 'error')
      return
    }

    setSaving(true)
    const fresh = await getAboutContent()
    if (!fresh.ok) {
      setSaving(false)
      if (fresh.status === 401 || fresh.status === 403) {
        setNeedsLogin(true)
        return
      }
      showToast(fresh.error, 'error')
      return
    }

    const built = buildPayload(fresh.data.sections, kind, mode, editIndex, form)
    if (!built.ok) {
      setSaving(false)
      showToast(built.error, 'error')
      return
    }

    const result = await saveAboutSections(built.payload)
    setSaving(false)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        setNeedsLogin(true)
        return
      }
      showToast(result.error, 'error')
      return
    }

    navigate(basePath, {
      state: {
        toast: {
          message: mode === 'edit' ? `${kindLabel} updated.` : `${kindLabel} created.`,
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
          Loading {kindLabel.toLowerCase()}…
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
              <Link to={basePath}>Back to list</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const heading = isStatement
    ? `Edit ${kindLabel.toLowerCase()}`
    : mode === 'edit'
      ? `Edit ${kindLabel.toLowerCase()}`
      : `New ${kindLabel.toLowerCase()}`

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to={basePath} label="list" />

      <section aria-label="About content form" className="w-full max-w-none">
        <form onSubmit={(event) => void onSubmit(event)} className={formWorkspaceCardCls}>
          <div className={formWorkspaceCardEyebrowCls}>
            <p className={formWorkspaceCardEyebrowTextCls}>About · {kindLabel}</p>
          </div>

          <div className={formWorkspaceCardBodyCls}>
            <div className={formInsetPanelCls}>
              <div className={formTabChromeCardCls}>
                <div className="flex w-full min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3">
                    <span className={formSectionIconWrapCls}>
                      <PageIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h4 className={formSectionHeadingCls}>{heading}</h4>
                      <p className={formSectionIntroCls}>
                        Changes publish immediately on the public Council page. Required fields
                        show a red dot when incomplete.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={formTabListCls} role="tablist" aria-label="About editor sections">
                  {tabs.map((item) => {
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
                    {!isStatement ? (
                      <div className={workspaceFormFieldGroupCls}>
                        <label className={workspaceFormLabelCls} htmlFor="about-title">
                          Title <span className={workspaceFormRequiredMarkCls}>*</span>
                        </label>
                        <input
                          id="about-title"
                          type="text"
                          className={catalogInput}
                          value={form.title}
                          onChange={(e) => set('title', e.target.value)}
                          disabled={saving}
                          required
                        />
                      </div>
                    ) : null}
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} id="about-body-label">
                        {isStatement ? kindLabel : 'Body'}{' '}
                        <span className={workspaceFormRequiredMarkCls}>*</span>
                      </label>
                      <RichTextEditor
                        value={form.text}
                        onChange={(html) => set('text', html)}
                        placeholder={
                          isStatement
                            ? `Write the ${kindLabel.toLowerCase()} shown on The Council.`
                            : 'Editorial details shown on The Council.'
                        }
                        disabled={saving}
                        aria-labelledby="about-body-label"
                      />
                    </div>
                  </div>
                ) : null}

                {tab === 'details' && !isStatement ? (
                  <div className="space-y-4">
                    {isHistory ? (
                      <>
                        <div className={workspaceFormFieldGroupCls}>
                          <label className={workspaceFormLabelCls} htmlFor="about-when">
                            When <span className={workspaceFormRequiredMarkCls}>*</span>
                          </label>
                          <input
                            id="about-when"
                            type="text"
                            className={catalogInput}
                            value={form.when}
                            onChange={(e) => set('when', e.target.value)}
                            placeholder="May 25, 2001"
                            disabled={saving}
                            required
                          />
                        </div>
                        <div className={workspaceFormFieldGroupCls}>
                          <label className={workspaceFormLabelCls} htmlFor="about-note">
                            Note <span className={workspaceFormOptionalBadgeCls}>Optional</span>
                          </label>
                          <input
                            id="about-note"
                            type="text"
                            className={catalogInput}
                            value={form.note}
                            onChange={(e) => set('note', e.target.value)}
                            placeholder="PUP College of Law"
                            disabled={saving}
                          />
                        </div>
                      </>
                    ) : (
                      <div className={workspaceFormFieldGroupCls}>
                        <label className={workspaceFormLabelCls} htmlFor="about-icon">
                          Icon
                        </label>
                        <CatalogSelect
                          id="about-icon"
                          aria-label="Icon"
                          disabled={saving}
                          value={form.icon || 'scale'}
                          options={ABOUT_ICON_OPTIONS.map((option) => {
                            const Icon = aboutIcon(option.value)
                            return {
                              ...option,
                              icon: <Icon className="size-4" aria-hidden />,
                            }
                          })}
                          onChange={(value) => set('icon', value)}
                        />
                      </div>
                    )}
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

function sectionsToForm(
  sections: AboutSections,
  kind: AboutRowKind,
  index: number | null,
): FormState | null {
  if (kind === 'mission') return { ...emptyForm(), text: sections.mission.text }
  if (kind === 'vision') return { ...emptyForm(), text: sections.vision.text }
  if (index === null) return null
  if (kind === 'history') {
    const item = sections.history.items[index]
    if (!item) return null
    return { ...emptyForm(), title: item.title, text: item.text, when: item.when, note: item.note }
  }
  const item: AboutListItem | undefined = sections[kind].items[index]
  if (!item) return null
  return { ...emptyForm(), title: item.title, text: item.text, icon: item.icon || 'scale' }
}

type BuildResult =
  | { ok: true; payload: Partial<AboutSections> }
  | { ok: false; error: string }

function patchItems<T>(
  items: T[],
  mode: 'create' | 'edit',
  index: number | null,
  item: T,
): T[] | null {
  const next = [...items]
  if (mode === 'create') {
    next.push(item)
    return next
  }
  if (index === null || index < 0 || index >= next.length) return null
  next[index] = item
  return next
}

function editorialHtml(raw: string) {
  return sanitizeRichHtml(raw)
}

function buildPayload(
  current: AboutSections,
  kind: AboutRowKind,
  mode: 'create' | 'edit',
  index: number | null,
  form: FormState,
): BuildResult {
  const missing: BuildResult = { ok: false, error: 'This entry no longer exists. Go back and reload.' }
  const body = editorialHtml(form.text)

  if (kind === 'mission') return { ok: true, payload: { mission: { text: body } } }
  if (kind === 'vision') return { ok: true, payload: { vision: { text: body } } }

  if (kind === 'history') {
    const item: AboutHistoryItem = {
      ...emptyHistoryItem(),
      when: form.when.trim(),
      title: form.title.trim(),
      text: body,
      note: form.note.trim(),
    }
    const items = patchItems(current.history.items, mode, index, item)
    if (!items) return missing
    return { ok: true, payload: { history: { items } } }
  }

  const item: AboutListItem = {
    ...emptyListItem(form.icon || 'scale'),
    icon: form.icon || 'scale',
    title: form.title.trim(),
    text: body,
  }
  const items = patchItems(current[kind].items, mode, index, item)
  if (!items) return missing
  return { ok: true, payload: { [kind]: { items } } as Partial<AboutSections> }
}
