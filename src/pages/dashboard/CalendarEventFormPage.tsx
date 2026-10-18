import {
  useCallback,
  useEffect,
  useId,
  useState,
  type FormEvent,
} from 'react'
import {
  AlignLeft,
  BookOpen,
  CalendarDays,
  ClipboardPen,
  GraduationCap,
  ImagePlus,
  Loader2,
  Megaphone,
  Sun,
  Tags,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FormMediaDropzone, FormMediaPreview } from '@/components/portal/FormMediaPreview'
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
import { ImageCropDialog } from '@/components/ui/ImageCropDialog'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import { useImageCropUpload } from '@/hooks/useImageCropUpload'
import { coverAspectPresets } from '@/lib/image-crop'
import { isEmptyRichText, sanitizeRichHtml } from '@/lib/rich-text'
import {
  createCalendarEvent,
  getCalendarEventById,
  updateCalendarEvent,
  uploadCalendarImage,
  type CalendarEventInput,
  type CalendarEventRecord,
  type CalendarKind,
} from '@/lib/calendar-api'
import { cn } from '@/lib/utils'

type EditorTab = 'content' | 'schedule' | 'media' | 'publish'

const EDITOR_TABS: {
  id: EditorTab
  label: string
  short: string
  icon: typeof AlignLeft
}[] = [
  { id: 'content', label: 'Content', short: 'Copy', icon: AlignLeft },
  { id: 'schedule', label: 'Schedule', short: 'Dates', icon: Tags },
  { id: 'media', label: 'Media', short: 'Image', icon: ImagePlus },
  { id: 'publish', label: 'Publish', short: 'Live', icon: Megaphone },
]

const kindOptions: { id: CalendarKind; label: string; icon: typeof Sun }[] = [
  { id: 'holiday', label: 'Holiday', icon: Sun },
  { id: 'exam', label: 'Examination', icon: GraduationCap },
  { id: 'enrollment', label: 'Enrollment', icon: ClipboardPen },
  { id: 'academic', label: 'Academic', icon: BookOpen },
]

const kindDefaultImages: Record<CalendarKind, string> = {
  holiday: '/calendar/defaults/holiday.jpg',
  exam: '/calendar/defaults/exam.jpg',
  enrollment: '/calendar/defaults/enrollment.jpg',
  academic: '/calendar/defaults/academic.jpg',
}

function isKindDefaultImage(url: string) {
  return Object.values(kindDefaultImages).includes(url)
}

type FormState = {
  title: string
  description: string
  kind: CalendarKind
  slug: string
  image: string
  start: string
  end: string
  sortOrder: string
  published: boolean
}

const emptyForm = (): FormState => ({
  title: '',
  description: '',
  kind: 'academic',
  slug: '',
  image: kindDefaultImages.academic,
  start: toLocalDateInput(new Date()),
  end: toLocalDateInput(new Date()),
  sortOrder: '0',
  published: true,
})

function toLocalDateInput(date: Date) {
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function recordToForm(item: CalendarEventRecord): FormState {
  return {
    title: item.title,
    description: item.description ?? '',
    kind: item.kind,
    slug: item.slug,
    image: item.image?.trim() || kindDefaultImages[item.kind],
    start: item.start,
    end: item.end,
    sortOrder: String(item.sortOrder ?? 0),
    published: item.published,
  }
}

function formToInput(form: FormState, id?: number): CalendarEventInput & { id?: number } {
  return {
    id,
    title: form.title.trim(),
    description: (() => {
      const html = sanitizeRichHtml(form.description)
      return isEmptyRichText(html) ? null : html
    })(),
    kind: form.kind,
    slug: form.slug.trim() || undefined,
    image: form.image.trim() || null,
    start: form.start.trim(),
    end: form.end.trim() || form.start.trim(),
    sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
    published: form.published,
  }
}

export default function CalendarEventFormPage() {
  const navigate = useNavigate()
  const { id: idParam } = useParams()
  const editId = idParam ? Number(idParam) : NaN
  const mode: 'create' | 'edit' = Number.isFinite(editId) && editId > 0 ? 'edit' : 'create'

  const fileInputId = useId()
  const [form, setForm] = useState<FormState>(emptyForm)
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
      setForm(emptyForm())
      setLoading(false)
      setLoadError('')
      setNeedsLogin(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError('')
    void getCalendarEventById(editId).then((result) => {
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
  }, [mode, editId])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const tabAlert = {
    content: !form.title.trim(),
    schedule: !form.start.trim() || !form.end.trim() || form.end < form.start,
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
    const result = await uploadCalendarImage(file)
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
    if (!form.title.trim()) {
      setTab('content')
      showToast('Title is required.', 'error')
      return
    }
    if (!form.start.trim() || !form.end.trim()) {
      setTab('schedule')
      showToast('Start and end dates are required.', 'error')
      return
    }
    if (form.end < form.start) {
      setTab('schedule')
      showToast('End date must be on or after the start date.', 'error')
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
        ? await updateCalendarEvent({ ...payload, id: editId })
        : await createCalendarEvent(payload)
    setSaving(false)

    if (!result.ok) {
      showToast(result.error, 'error')
      return
    }

    navigate('/admin/calendar', {
      state: {
        toast: {
          message: mode === 'edit' ? 'Calendar event updated.' : 'Calendar event created.',
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
    form.start.trim() !== '' &&
    form.end.trim() !== '' &&
    form.end >= form.start &&
    form.image.trim() !== ''

  if (loading) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300/90 bg-zinc-50/80 px-5 py-16 text-[13px] text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-hidden />
          Loading calendar event…
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
              <Link to="/admin/calendar">Back to calendar</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to="/admin/calendar" label="calendar" />

      <section aria-label="Calendar event form" className="w-full max-w-none">
        <form onSubmit={(event) => void onSubmit(event)} className={formWorkspaceCardCls}>
          <div className={formWorkspaceCardEyebrowCls}>
            <p className={formWorkspaceCardEyebrowTextCls}>Calendar · Academic event</p>
          </div>

          <div className={formWorkspaceCardBodyCls}>
            <div className={formInsetPanelCls}>
              <div className={formTabChromeCardCls}>
                <div className="flex w-full min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3">
                    <span className={formSectionIconWrapCls}>
                      <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h4 className={formSectionHeadingCls}>
                        {mode === 'edit' ? 'Edit event' : 'New event'}
                      </h4>
                      <p className={formSectionIntroCls}>
                        Content, schedule, media, and publish use separate tabs. Required fields
                        show a red dot when incomplete.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={formTabListCls} role="tablist" aria-label="Event editor sections">
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
                        disabled={saving || uploading}
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
                      <label className={workspaceFormLabelCls} htmlFor="cal-title">
                        Title <span className={workspaceFormRequiredMarkCls}>*</span>
                      </label>
                      <input
                        id="cal-title"
                        className={catalogInput}
                        value={form.title}
                        onChange={(e) => set('title', e.target.value)}
                        placeholder="Midterm examinations"
                        disabled={saving || uploading}
                        required
                      />
                    </div>
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="cal-description">
                        Description{' '}
                        <span className={workspaceFormOptionalBadgeCls}>Optional</span>
                      </label>
                      <RichTextEditor
                        value={form.description}
                        onChange={(html) => set('description', html)}
                        placeholder="Short note shown in the calendar detail panel."
                        disabled={saving || uploading}
                        aria-label="Event description"
                        minHeightClassName="min-h-[6.5rem]"
                      />
                    </div>
                    <div className={workspaceFormFieldGroupCls}>
                      <p className={workspaceFormLabelCls}>Type</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {kindOptions.map((option) => {
                          const Icon = option.icon
                          const active = form.kind === option.id
                          return (
                            <button
                              key={option.id}
                              type="button"
                              disabled={saving || uploading}
                              onClick={() => {
                                setForm((prev) => ({
                                  ...prev,
                                  kind: option.id,
                                  image:
                                    !prev.image.trim() || isKindDefaultImage(prev.image)
                                      ? kindDefaultImages[option.id]
                                      : prev.image,
                                }))
                              }}
                              className={cn(
                                'inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium transition',
                                active
                                  ? 'border-brand-600 bg-brand-50 text-brand-900 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-100'
                                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200',
                              )}
                            >
                              <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                              {option.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="cal-slug">
                        Slug <span className={workspaceFormOptionalBadgeCls}>Optional</span>
                      </label>
                      <input
                        id="cal-slug"
                        className={catalogInput}
                        value={form.slug}
                        onChange={(e) => set('slug', e.target.value)}
                        placeholder="auto-from-title"
                        disabled={saving || uploading}
                      />
                    </div>
                  </div>
                ) : null}

                {tab === 'schedule' ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className={workspaceFormFieldGroupCls}>
                        <label className={workspaceFormLabelCls} htmlFor="cal-start">
                          Start date <span className={workspaceFormRequiredMarkCls}>*</span>
                        </label>
                        <input
                          id="cal-start"
                          type="date"
                          className={catalogInput}
                          value={form.start}
                          disabled={saving || uploading}
                          onChange={(e) => {
                            const next = e.target.value
                            set('start', next)
                            if (form.end && form.end < next) set('end', next)
                          }}
                          required
                        />
                      </div>
                      <div className={workspaceFormFieldGroupCls}>
                        <label className={workspaceFormLabelCls} htmlFor="cal-end">
                          End date <span className={workspaceFormRequiredMarkCls}>*</span>
                        </label>
                        <input
                          id="cal-end"
                          type="date"
                          className={catalogInput}
                          value={form.end}
                          min={form.start || undefined}
                          disabled={saving || uploading}
                          onChange={(e) => set('end', e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="cal-sort">
                        Sort order <span className={workspaceFormOptionalBadgeCls}>Optional</span>
                      </label>
                      <input
                        id="cal-sort"
                        type="number"
                        className={catalogInput}
                        value={form.sortOrder}
                        disabled={saving || uploading}
                        onChange={(e) => set('sortOrder', e.target.value)}
                      />
                      <p className="mt-1.5 text-[12px] text-zinc-500 dark:text-zinc-400">
                        Lower numbers appear earlier when dates match.
                      </p>
                    </div>
                  </div>
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
                          Upload a cover image for the calendar event detail panel.
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
                          label={
                            isKindDefaultImage(form.image)
                              ? 'Using type default image'
                              : 'Custom image ready'
                          }
                          primaryAction={{
                            label: isKindDefaultImage(form.image) ? 'Upload' : 'Replace',
                            onClick: () => document.getElementById(fileInputId)?.click(),
                          }}
                          secondaryAction={
                            isKindDefaultImage(form.image)
                              ? undefined
                              : {
                                  label: 'Use default',
                                  tone: 'muted',
                                  onClick: () => set('image', kindDefaultImages[form.kind]),
                                }
                          }
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
                  <div className="space-y-4">
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-700 dark:bg-zinc-950">
                      <input
                        type="checkbox"
                        className={cn(tableCheckboxCls, 'mt-0.5')}
                        checked={form.published}
                        disabled={saving || uploading}
                        onChange={(e) => set('published', e.target.checked)}
                      />
                      <span>
                        <span className="block text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
                          Published on the public calendar
                        </span>
                        <span className="mt-1 block text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">
                          Unpublished events stay in the admin list only.
                        </span>
                      </span>
                    </label>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className={formWorkspaceCardFooterCls}>
            <button type="submit" className={formWorkspacePrimaryBtnCls} disabled={!canSave}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {mode === 'edit' ? 'Save changes' : 'Create event'}
            </button>
          </div>
        </form>
      </section>

      {cropSession ? (
        <ImageCropDialog
          open
          imageSrc={cropSession.url}
          fileName={cropSession.name}
          mime={cropSession.mime}
          title="Crop calendar image"
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
