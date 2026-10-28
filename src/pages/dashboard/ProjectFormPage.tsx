import {
  useCallback,
  useEffect,
  useId,
  useState,
  type FormEvent,
} from 'react'
import {
  AlignLeft,
  ImagePlus,
  Loader2,
  Megaphone,
  Plus,
  Tags,
  Trash2,
} from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
import { projectIconMap, projectIconOptions } from '@/components/home/project-data'
import { Button } from '@/components/ui/button'
import { ImageCropDialog } from '@/components/ui/ImageCropDialog'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import { useImageCropUpload } from '@/hooks/useImageCropUpload'
import { portraitAspectPresets } from '@/lib/image-crop'
import {
  createProject,
  getProjectById,
  updateProject,
  uploadProjectImage,
  type ProjectIconKey,
  type ProjectInput,
  type ProjectLink,
  type ProjectRecord,
} from '@/lib/projects-api'
import {
  PROJECT_CATEGORIES,
  isProjectCategorySlug,
  type ProjectCategorySlug,
} from '@/lib/project-categories'
import { isEmptyRichText, sanitizeRichHtml } from '@/lib/rich-text'
import { cn } from '@/lib/utils'

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

type FormState = {
  title: string
  summary: string
  body: string
  slug: string
  category: ProjectCategorySlug
  icon: ProjectIconKey
  images: string[]
  sortOrder: string
  published: boolean
  links: ProjectLink[]
}

const emptyForm = (category?: ProjectCategorySlug): FormState => ({
  title: '',
  summary: '',
  body: '',
  slug: '',
  category: category ?? 'internal-affairs',
  icon: 'folder-kanban',
  images: [],
  sortOrder: '0',
  published: true,
  links: [{ label: '', to: '', href: '' }],
})

function recordToForm(item: ProjectRecord): FormState {
  const images =
    item.images?.length > 0
      ? item.images.filter(Boolean)
      : item.image
        ? [item.image]
        : []
  return {
    title: item.title,
    summary: item.summary,
    body: item.body ?? '',
    slug: item.slug,
    category: isProjectCategorySlug(item.category) ? item.category : 'internal-affairs',
    icon: item.icon,
    images,
    sortOrder: String(item.sortOrder ?? 0),
    published: item.published,
    links:
      item.links.length > 0
        ? item.links.map((link) => ({
            label: link.label,
            to: link.to ?? '',
            href: link.href ?? '',
          }))
        : [{ label: '', to: '', href: '' }],
  }
}

function formToInput(form: FormState, id?: number): ProjectInput & { id?: number } {
  const links = form.links
    .map((link) => ({
      label: link.label.trim(),
      to: link.to?.trim() || undefined,
      href: link.href?.trim() || undefined,
    }))
    .filter((link) => link.label && (link.to || link.href))

  const images = form.images.map((src) => src.trim()).filter(Boolean)
  const bodyHtml = sanitizeRichHtml(form.body)
  return {
    id,
    title: form.title.trim(),
    summary: form.summary.trim(),
    body: isEmptyRichText(bodyHtml) ? null : bodyHtml,
    slug: form.slug.trim() || undefined,
    category: form.category,
    icon: form.icon,
    image: images[0] ?? '',
    images,
    sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
    published: form.published,
    links,
  }
}

export default function ProjectFormPage() {
  const navigate = useNavigate()
  const { id: idParam } = useParams()
  const [searchParams] = useSearchParams()
  const editId = idParam ? Number(idParam) : NaN
  const mode: 'create' | 'edit' = Number.isFinite(editId) && editId > 0 ? 'edit' : 'create'
  const presetCategory = isProjectCategorySlug(searchParams.get('category') ?? '')
    ? (searchParams.get('category') as ProjectCategorySlug)
    : undefined

  const fileInputId = useId()
  const [form, setForm] = useState<FormState>(() => emptyForm(presetCategory))
  const [tab, setTab] = useState<EditorTab>('content')
  const [loading, setLoading] = useState(mode === 'edit')
  const [loadError, setLoadError] = useState('')
  const [needsLogin, setNeedsLogin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null)
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
      setForm(emptyForm(presetCategory))
      setLoading(false)
      setLoadError('')
      setNeedsLogin(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError('')
    void getProjectById(editId).then((result) => {
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
  }, [mode, editId, presetCategory])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateLink(index: number, key: keyof ProjectLink, value: string) {
    setForm((prev) => ({
      ...prev,
      links: prev.links.map((link, i) => (i === index ? { ...link, [key]: value } : link)),
    }))
  }

  const tabAlert = {
    content: !form.title.trim() || !form.summary.trim(),
    details: false,
    media: form.images.length === 0,
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
    const result = await uploadProjectImage(file)
    setUploading(false)
    if (!result.ok) {
      showToast(result.error, 'error')
      return
    }
    closeCrop()
    setForm((prev) => {
      const next = [...prev.images]
      if (replaceIndex !== null && replaceIndex >= 0 && replaceIndex < next.length) {
        next[replaceIndex] = result.data.url
      } else {
        next.push(result.data.url)
      }
      return { ...prev, images: next }
    })
    setReplaceIndex(null)
    showToast('Image uploaded.', 'success')
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.title.trim() || !form.summary.trim()) {
      setTab('content')
      showToast('Title and summary are required.', 'error')
      return
    }
    if (form.images.length === 0) {
      setTab('media')
      showToast('Upload at least one image to continue.', 'error')
      return
    }

    setSaving(true)
    const payload = formToInput(form, mode === 'edit' ? editId : undefined)
    const result =
      mode === 'edit'
        ? await updateProject({ ...payload, id: editId })
        : await createProject(payload)
    setSaving(false)

    if (!result.ok) {
      showToast(result.error, 'error')
      return
    }

    navigate('/admin/projects', {
      state: {
        toast: {
          message: mode === 'edit' ? 'Project updated.' : 'Project created.',
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
    form.images.length > 0

  if (loading) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300/90 bg-zinc-50/80 px-5 py-16 text-[13px] text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-hidden />
          Loading project…
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
              <Link to="/admin/projects">Back to projects</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to="/admin/projects" label="projects" />

      <section aria-label="Project form" className="w-full max-w-none">
        <form onSubmit={(event) => void onSubmit(event)} className={formWorkspaceCardCls}>
          <div className={formWorkspaceCardEyebrowCls}>
            <p className={formWorkspaceCardEyebrowTextCls}>Projects · Initiative</p>
          </div>

          <div className={formWorkspaceCardBodyCls}>
            <div className={formInsetPanelCls}>
              <div className={formTabChromeCardCls}>
                <div className="flex w-full min-w-0 items-start gap-2.5 sm:gap-3">
                  <span className={formSectionIconWrapCls}>
                    <Megaphone className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h4 className={formSectionHeadingCls}>
                      {mode === 'edit' ? 'Edit project' : 'New project'}
                    </h4>
                    <p className={formSectionIntroCls}>
                      Each project belongs to one Student Council in Action program
                      and appears on that public page.
                    </p>
                  </div>
                </div>

                <div className={formTabListCls} role="tablist" aria-label="Project editor sections">
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
                      <label className={workspaceFormLabelCls} htmlFor="proj-title">
                        Title <span className={workspaceFormRequiredMarkCls}>*</span>
                      </label>
                      <input
                        id="proj-title"
                        className={catalogInput}
                        value={form.title}
                        onChange={(e) => set('title', e.target.value)}
                        placeholder="Board Meetings"
                        disabled={saving || uploading}
                        required
                      />
                    </div>
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="proj-summary">
                        Description <span className={workspaceFormRequiredMarkCls}>*</span>
                      </label>
                      <textarea
                        id="proj-summary"
                        className={cn(catalogInput, 'h-auto min-h-[5rem] py-2.5')}
                        rows={3}
                        value={form.summary}
                        onChange={(e) => set('summary', e.target.value)}
                        placeholder="Short description shown on the program page."
                        disabled={saving || uploading}
                        required
                      />
                    </div>
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls}>
                        Body <span className={workspaceFormOptionalBadgeCls}>Optional</span>
                      </label>
                      <RichTextEditor
                        value={form.body}
                        onChange={(html) => set('body', html)}
                        placeholder="Optional longer details for the project page."
                        disabled={saving || uploading}
                        aria-label="Project body"
                      />
                    </div>
                  </div>
                ) : null}

                {tab === 'details' ? (
                  <div className="space-y-4">
                    <div className={workspaceFormFieldGroupCls}>
                      <p className={workspaceFormLabelCls}>
                        Category <span className={workspaceFormRequiredMarkCls}>*</span>
                      </p>
                      <div className="grid gap-2">
                        {PROJECT_CATEGORIES.map((option) => {
                          const Icon = option.icon
                          const active = form.category === option.slug
                          return (
                            <button
                              key={option.slug}
                              type="button"
                              disabled={saving || uploading}
                              onClick={() => set('category', option.slug)}
                              className={cn(
                                'inline-flex items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition',
                                active
                                  ? 'border-brand-600 bg-brand-50 text-brand-900 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-100'
                                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200',
                              )}
                            >
                              <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
                              <span className="min-w-0">
                                <span className="block text-[13px] font-semibold">{option.label}</span>
                                <span className="mt-0.5 block text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">
                                  {option.description}
                                </span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className={workspaceFormFieldGroupCls}>
                        <label className={workspaceFormLabelCls} htmlFor="proj-slug">
                          Slug <span className={workspaceFormOptionalBadgeCls}>Optional</span>
                        </label>
                        <input
                          id="proj-slug"
                          className={catalogInput}
                          value={form.slug}
                          onChange={(e) => set('slug', e.target.value)}
                          placeholder="auto-from-title"
                          disabled={saving || uploading}
                        />
                      </div>
                      <div className={workspaceFormFieldGroupCls}>
                        <label className={workspaceFormLabelCls} htmlFor="proj-sort">
                          Sort order
                        </label>
                        <input
                          id="proj-sort"
                          type="number"
                          className={catalogInput}
                          value={form.sortOrder}
                          onChange={(e) => set('sortOrder', e.target.value)}
                          disabled={saving || uploading}
                        />
                      </div>
                    </div>

                    <div className={workspaceFormFieldGroupCls}>
                      <p className={workspaceFormLabelCls}>Icon</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {projectIconOptions.map((option) => {
                          const Icon = projectIconMap[option.id]
                          const active = form.icon === option.id
                          return (
                            <button
                              key={option.id}
                              type="button"
                              disabled={saving || uploading}
                              onClick={() => set('icon', option.id)}
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
                      <div className="flex items-center justify-between gap-2">
                        <p className={workspaceFormLabelCls}>
                          Link <span className={workspaceFormOptionalBadgeCls}>Optional</span>
                        </p>
                        <button
                          type="button"
                          disabled={saving || uploading}
                          onClick={() =>
                            set('links', [...form.links, { label: '', to: '', href: '' }])
                          }
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700 dark:text-brand-300"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                          Add link
                        </button>
                      </div>
                      <div className="mt-2 space-y-3">
                        {form.links.map((link, index) => (
                          <div
                            key={index}
                            className="grid gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700"
                          >
                            <input
                              className={catalogInput}
                              value={link.label}
                              onChange={(e) => updateLink(index, 'label', e.target.value)}
                              placeholder="Link label"
                              disabled={saving || uploading}
                            />
                            <input
                              className={catalogInput}
                              value={link.to ?? ''}
                              onChange={(e) => updateLink(index, 'to', e.target.value)}
                              placeholder="Internal path (e.g. /#bulletin)"
                              disabled={saving || uploading}
                            />
                            <div className="flex gap-2">
                              <input
                                className={cn(catalogInput, 'flex-1')}
                                value={link.href ?? ''}
                                onChange={(e) => updateLink(index, 'href', e.target.value)}
                                placeholder="External URL (optional)"
                                disabled={saving || uploading}
                              />
                              <button
                                type="button"
                                disabled={saving || uploading || form.links.length <= 1}
                                onClick={() =>
                                  set(
                                    'links',
                                    form.links.filter((_, i) => i !== index),
                                  )
                                }
                                className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:text-maroon-700 dark:border-zinc-700"
                                aria-label="Remove link"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {tab === 'media' ? (
                  <div className="space-y-4">
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
                    {form.images.map((src, index) => (
                      <FormMediaPreview
                        key={`${src}-${index}`}
                        src={src}
                        frame="landscape"
                        uploading={uploading && replaceIndex === index}
                        disabled={saving || uploading}
                        label={index === 0 ? 'Cover image' : `Image ${index + 1}`}
                        primaryAction={{
                          label: 'Replace',
                          onClick: () => {
                            setReplaceIndex(index)
                            document.getElementById(fileInputId)?.click()
                          },
                        }}
                        secondaryAction={{
                          label: 'Remove',
                          tone: 'danger',
                          onClick: () =>
                            set(
                              'images',
                              form.images.filter((_, i) => i !== index),
                            ),
                        }}
                      />
                    ))}
                    <FormMediaDropzone
                      htmlFor={fileInputId}
                      title={form.images.length > 0 ? 'Add another image' : 'Upload image'}
                      dragOver={dragOver}
                      uploading={uploading && replaceIndex === null}
                      disabled={saving || uploading}
                      onClick={() => setReplaceIndex(null)}
                      onDragEnter={(e) => {
                        e.preventDefault()
                        if (!saving && !uploading) setDragOver(true)
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        if (!saving && !uploading) setDragOver(true)
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault()
                        setDragOver(false)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        setDragOver(false)
                        setReplaceIndex(null)
                        void handleImageFile(e.dataTransfer.files?.[0])
                      }}
                    />
                  </div>
                ) : null}

                {tab === 'publish' ? (
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
                        Published on the public site
                      </span>
                      <span className="mt-1 block text-[12px] leading-5 text-zinc-500">
                        Unpublished projects stay in the admin list only.
                      </span>
                    </span>
                  </label>
                ) : null}
              </div>
            </div>
          </div>

          <div className={formWorkspaceCardFooterCls}>
            <button type="submit" className={formWorkspacePrimaryBtnCls} disabled={!canSave}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {mode === 'edit' ? 'Save changes' : 'Create project'}
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
          title="Crop project image"
          aspect={3 / 4}
          presets={portraitAspectPresets}
          onCancel={() => {
            setReplaceIndex(null)
            closeCrop()
          }}
          onConfirm={handleCroppedUpload}
        />
      ) : null}

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
