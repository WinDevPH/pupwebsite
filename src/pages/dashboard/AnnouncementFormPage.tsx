import {
  useCallback,
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  AlignLeft,
  ImagePlus,
  Link2,
  Loader2,
  Megaphone,
  RotateCcw,
  Tags,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FormMediaDropzone, FormMediaPreview } from '@/components/portal/FormMediaPreview'
import { RequireLoginRedirect } from '@/components/portal/RequireLoginRedirect'
import {
  catalogInput,
  catalogTextarea,
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
import { ImageCropDialog } from '@/components/ui/ImageCropDialog'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import { useImageCropUpload } from '@/hooks/useImageCropUpload'
import { coverAspectPresets } from '@/lib/image-crop'
import { isEmptyRichText, sanitizeRichHtml } from '@/lib/rich-text'
import {
  createAnnouncement,
  getAnnouncementById,
  updateAnnouncement,
  uploadAnnouncementImage,
  type AnnouncementInput,
  type AnnouncementKind,
  type AnnouncementRecord,
} from '@/lib/announcements-api'

type EditorTab = 'content' | 'details' | 'media' | 'publish'

const EDITOR_TABS: {
  id: EditorTab
  label: string
  short: string
  icon: typeof AlignLeft
}[] = [
  { id: 'content', label: 'Content', short: 'Copy', icon: AlignLeft },
  { id: 'details', label: 'Details', short: 'Meta', icon: Tags },
  { id: 'media', label: 'Media', short: 'Image', icon: ImagePlus },
  { id: 'publish', label: 'Publish', short: 'Live', icon: Megaphone },
]

const kindMeta: Record<AnnouncementKind, { label: string }> = {
  issuance: { label: 'Issuance' },
  event: { label: 'Event' },
  social: { label: 'Social' },
}

type FormState = {
  title: string
  summary: string
  body: string
  kind: AnnouncementKind
  slug: string
  image: string
  href: string
  external: boolean
  source: string
  date: string
  published: boolean
}

const emptyForm = (): FormState => ({
  title: '',
  summary: '',
  body: '',
  kind: 'issuance',
  slug: '',
  image: '',
  href: '',
  external: false,
  source: '',
  date: toLocalDateInput(new Date()),
  published: true,
})

function toLocalDateInput(date: Date) {
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function recordToForm(item: AnnouncementRecord): FormState {
  return {
    title: item.title,
    summary: item.summary,
    body: item.body ?? '',
    kind: item.kind,
    slug: item.slug,
    image: item.image,
    href: item.external || item.href.startsWith('http') ? item.href : '',
    external: item.external,
    source: item.source ?? '',
    date: toLocalDateInput(new Date(item.date)),
    published: item.published,
  }
}

function formToInput(form: FormState, id?: number): AnnouncementInput & { id?: number } {
  return {
    id,
    title: form.title.trim(),
    summary: form.summary.trim(),
    body: (() => {
      const html = sanitizeRichHtml(form.body)
      return isEmptyRichText(html) ? null : html
    })(),
    kind: form.kind,
    slug: form.slug.trim() || undefined,
    image: form.image.trim(),
    href: form.href.trim() || null,
    external: form.external,
    source: form.source.trim() || null,
    date: form.date.trim() || toLocalDateInput(new Date()),
    published: form.published,
  }
}

export default function AnnouncementFormPage() {
  const navigate = useNavigate()
  const { id: idParam } = useParams()
  const editId = idParam ? Number(idParam) : NaN
  const mode: 'create' | 'edit' = Number.isFinite(editId) && editId > 0 ? 'edit' : 'create'

  const fileInputId = useId()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [baseline, setBaseline] = useState<FormState>(emptyForm)
  const [tab, setTab] = useState<EditorTab>('content')
  const [loading, setLoading] = useState(mode === 'edit')
  const [loadError, setLoadError] = useState('')
  const [needsLogin, setNeedsLogin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [toast, setToast] = useState<SnackToast | null>(null)
  const { cropSession, openCrop, closeCrop } = useImageCropUpload()

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
    void getAnnouncementById(editId).then((result) => {
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

  const tabAlert = {
    content: !form.title.trim() || !form.summary.trim(),
    details: !form.date.trim(),
    media: !form.image.trim(),
    publish: false,
  } as const

  function handleImageFile(file: File | null | undefined) {
    openCrop(file, {
      busy: uploading || saving,
      onInvalid: (message) => showToast(message, 'error'),
    })
  }

  async function handleCroppedUpload(file: File) {
    setUploading(true)
    const result = await uploadAnnouncementImage(file)
    setUploading(false)
    if (!result.ok) {
      showToast(result.error, 'error')
      return
    }
    closeCrop()
    set('image', result.data.url)
    showToast('Image uploaded.', 'success')
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.title.trim() || !form.summary.trim()) {
      setTab('content')
      showToast('Title and summary are required.', 'error')
      return
    }
    if (!form.date.trim()) {
      setTab('details')
      showToast('Publish date is required.', 'error')
      return
    }
    if (!form.image.trim()) {
      setTab('media')
      showToast('Upload an image to continue.', 'error')
      return
    }

    setSaving(true)
    const payload = formToInput(form, mode === 'edit' ? editId : undefined)
    const result =
      mode === 'edit'
        ? await updateAnnouncement({ ...payload, id: editId })
        : await createAnnouncement(payload)
    setSaving(false)

    if (!result.ok) {
      showToast(result.error, 'error')
      return
    }

    navigate('/admin/announcements', {
      state: {
        toast: {
          message: mode === 'edit' ? 'Announcement updated.' : 'Announcement created.',
          variant: 'success' as const,
        },
      },
    })
  }

  const canSave =
    !saving &&
    !uploading &&
    !loading &&
    form.title.trim() !== '' &&
    form.summary.trim() !== '' &&
    form.date.trim() !== '' &&
    form.image.trim() !== ''

  if (loading) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300/90 bg-zinc-50/80 px-5 py-16 text-[13px] text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-hidden />
          Loading announcement…
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
              <Link to="/admin/announcements">Back to announcements</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to="/admin/announcements" label="announcements" />

      <section aria-label="Announcement form" className="w-full max-w-none">
        <form
          onSubmit={(event) => void onSubmit(event)}
          className={formWorkspaceCardCls}
        >
          <div className={formWorkspaceCardEyebrowCls}>
            <p className={formWorkspaceCardEyebrowTextCls}>
              Announcement · Bulletin post
            </p>
          </div>

          <div className={formWorkspaceCardBodyCls}>
            <div className={formInsetPanelCls}>
              <div className={formTabChromeCardCls}>
                <div className="flex w-full min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3">
                    <span className={formSectionIconWrapCls}>
                      <Megaphone className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h4 className={formSectionHeadingCls}>Announcement</h4>
                      <p className={`${formSectionIntroCls} hidden sm:block`}>
                        Content, details, media, and publish use separate tabs. Required
                        fields are marked with{' '}
                        <span className="font-semibold text-brand-700 dark:text-brand-400">
                          *
                        </span>
                        .
                      </p>
                      <p className={`${formSectionIntroCls} sm:hidden`}>
                        Content · Details · Media · Publish.{' '}
                        <span className="font-semibold text-brand-700 dark:text-brand-400">
                          *
                        </span>{' '}
                        = required.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Reset announcement form"
                    title="Reset"
                    disabled={saving || uploading}
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

                <div
                  role="tablist"
                  aria-label="Announcement form sections"
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
                    <div className="flex items-start gap-2.5 sm:gap-3">
                      <span className={formSectionIconWrapCls}>
                        <AlignLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <h4 className={formSectionHeadingCls}>Content</h4>
                        <p className={formSectionIntroCls}>
                          Title and summary appear on the public bulletin cards.
                        </p>
                      </div>
                    </div>
                    <div className={`${formControlWellCls} grid gap-3 sm:gap-4`}>
                      <Field label="Title" required>
                        <input
                          value={form.title}
                          onChange={(e) => set('title', e.target.value)}
                          placeholder="General Assembly for the first semester"
                          className={catalogInput}
                          disabled={saving || uploading}
                        />
                      </Field>
                      <Field label="Summary" required>
                        <textarea
                          value={form.summary}
                          onChange={(e) => set('summary', e.target.value)}
                          rows={3}
                          placeholder="Short bulletin summary shown on the homepage."
                          className={catalogTextarea}
                          disabled={saving || uploading}
                        />
                      </Field>
                      <Field label="Body" optional>
                        <RichTextEditor
                          value={form.body}
                          onChange={(html) => set('body', html)}
                          placeholder="Optional longer details for the announcement page."
                          disabled={saving || uploading}
                          aria-label="Announcement body"
                        />
                      </Field>
                    </div>
                  </section>
                ) : null}

                {tab === 'details' ? (
                  <section role="tabpanel" aria-label="Details" className="space-y-4">
                    <div className="flex items-start gap-2.5 sm:gap-3">
                      <span className={formSectionIconWrapCls}>
                        <Tags className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <h4 className={formSectionHeadingCls}>Details</h4>
                        <p className={formSectionIntroCls}>
                          Type, date, and URL slug for bulletin filtering and deep links.
                        </p>
                      </div>
                    </div>
                    <div className={`${formControlWellCls} grid gap-3 sm:grid-cols-2 sm:gap-4`}>
                      <Field label="Type" required>
                        <CatalogSelect
                          aria-label="Announcement type"
                          required
                          disabled={saving || uploading}
                          value={form.kind}
                          options={(Object.keys(kindMeta) as AnnouncementKind[]).map((kind) => ({
                            value: kind,
                            label: kindMeta[kind].label,
                          }))}
                          onChange={(value) => set('kind', value as AnnouncementKind)}
                        />
                      </Field>
                      <Field label="Publish date" required>
                        <input
                          type="date"
                          value={form.date}
                          onChange={(e) => set('date', e.target.value)}
                          className={catalogInput}
                          disabled={saving || uploading}
                        />
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label="Slug" optional>
                          <input
                            value={form.slug}
                            onChange={(e) => set('slug', e.target.value)}
                            placeholder="general-assembly"
                            className={catalogInput}
                            disabled={saving || uploading}
                          />
                        </Field>
                        <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                          Leave blank to auto-generate from the title.
                        </p>
                      </div>
                    </div>
                  </section>
                ) : null}

                {tab === 'media' ? (
                  <section role="tabpanel" aria-label="Media" className="space-y-4">
                    <div className="flex items-start gap-2.5 sm:gap-3">
                      <span className={formSectionIconWrapCls}>
                        <ImagePlus className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <h4 className={formSectionHeadingCls}>Media</h4>
                        <p className={formSectionIntroCls}>
                          Upload a cover image for the bulletin card and detail page.
                        </p>
                      </div>
                    </div>
                    <div className={formControlWellCls}>
                      <input
                        id={fileInputId}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        disabled={saving || uploading}
                        onChange={(e) => {
                          void handleImageFile(e.target.files?.[0])
                          e.target.value = ''
                        }}
                      />
                      {form.image ? (
                        <FormMediaPreview
                          src={form.image}
                          frame="landscape"
                          uploading={uploading}
                          disabled={saving || uploading}
                          label="Image ready"
                          primaryAction={{
                            label: 'Replace',
                            onClick: () => document.getElementById(fileInputId)?.click(),
                          }}
                          secondaryAction={{
                            label: 'Remove',
                            tone: 'danger',
                            onClick: () => set('image', ''),
                          }}
                        />
                      ) : (
                        <FormMediaDropzone
                          htmlFor={fileInputId}
                          dragOver={dragOver}
                          uploading={uploading}
                          disabled={saving || uploading}
                          onDragEnter={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (!saving && !uploading) setDragOver(true)
                          }}
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (!saving && !uploading) setDragOver(true)
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setDragOver(false)
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setDragOver(false)
                            void handleImageFile(e.dataTransfer.files?.[0])
                          }}
                        />
                      )}
                    </div>
                  </section>
                ) : null}

                {tab === 'publish' ? (
                  <section role="tabpanel" aria-label="Publish" className="space-y-4">
                    <div className="flex items-start gap-2.5 sm:gap-3">
                      <span className={formSectionIconWrapCls}>
                        <Link2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <h4 className={formSectionHeadingCls}>Publish</h4>
                        <p className={formSectionIntroCls}>
                          External source links and whether this post is live on the bulletin.
                        </p>
                      </div>
                    </div>
                    <div className={`${formControlWellCls} grid gap-3 sm:grid-cols-2 sm:gap-4`}>
                      <Field label="External link" optional>
                        <input
                          value={form.href}
                          onChange={(e) => set('href', e.target.value)}
                          placeholder="https://…"
                          className={catalogInput}
                          disabled={saving || uploading}
                        />
                      </Field>
                      <Field label="Source label" optional>
                        <input
                          value={form.source}
                          onChange={(e) => set('source', e.target.value)}
                          placeholder="Facebook /pupcl.sc"
                          className={catalogInput}
                          disabled={saving || uploading}
                        />
                      </Field>
                      <div className="grid gap-2.5 sm:col-span-2 sm:grid-cols-2">
                        <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200/90 bg-white px-3 text-[12px] font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                          <input
                            type="checkbox"
                            checked={form.external}
                            onChange={(e) => set('external', e.target.checked)}
                            className={tableCheckboxCls}
                            disabled={saving || uploading}
                          />
                          Open as external link
                        </label>
                        <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200/90 bg-white px-3 text-[12px] font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                          <input
                            type="checkbox"
                            checked={form.published}
                            onChange={(e) => set('published', e.target.checked)}
                            className={tableCheckboxCls}
                            disabled={saving || uploading}
                          />
                          Published on bulletin
                        </label>
                      </div>
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
                'Save announcement'
              )}
            </button>
          </footer>
        </form>
      </section>

      {cropSession ? (
        <ImageCropDialog
          open
          imageSrc={cropSession.url}
          fileName={cropSession.name}
          mime={cropSession.mime}
          title="Crop announcement image"
          aspect={16 / 9}
          presets={coverAspectPresets}
          onCancel={closeCrop}
          onConfirm={handleCroppedUpload}
        />
      ) : null}

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
