import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import {
  AlignLeft,
  ImagePlus,
  Images,
  Loader2,
  Trash2,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FormMediaDropzone } from '@/components/portal/FormMediaPreview'
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
import { CatalogSelect } from '@/components/ui/CatalogSelect'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import {
  buildAcademicYearOptions,
  currentAcademicYearStart,
  formatAcademicYear,
  normalizeAcademicYear,
} from '@/lib/council-members-api'
import {
  createGalleryBatch,
  getGalleryBatchById,
  listGalleryYears,
  updateGalleryBatch,
  uploadGalleryImages,
  type GalleryImageRecord,
} from '@/lib/gallery-api'
import { cn } from '@/lib/utils'

const BASE_PATH = '/admin/gallery'
const CUSTOM_YEAR = '__custom__'
const DEFAULT_IMAGE_TITLE = 'The Student Council'

type EditorTab = 'details' | 'media'

const EDITOR_TABS: {
  id: EditorTab
  label: string
  short: string
  icon: typeof AlignLeft
}[] = [
  { id: 'details', label: 'Details', short: 'Info', icon: AlignLeft },
  { id: 'media', label: 'Media', short: 'Photos', icon: ImagePlus },
]

type LocalImage = {
  key: string
  src: string
  title: string
  caption: string
  alt: string
  sortOrder: number
}

type FormState = {
  academicYear: string
  title: string
  published: boolean
}

function emptyForm(): FormState {
  return {
    academicYear: formatAcademicYear(currentAcademicYearStart()),
    title: '',
    published: true,
  }
}

function recordToForm(item: { academicYear: string; title: string; published: boolean }): FormState {
  return {
    academicYear: item.academicYear,
    title: item.title,
    published: item.published,
  }
}

function imagesFromRecords(records: GalleryImageRecord[]): LocalImage[] {
  return [...records]
    .sort((a, b) => a.sortOrder - b.sortOrder || (a.id ?? 0) - (b.id ?? 0))
    .map((img, index) => ({
      key: img.id ? `id-${img.id}` : `src-${img.src}-${index}`,
      src: img.src,
      title: img.title,
      caption: img.caption ?? '',
      alt: img.alt ?? '',
      sortOrder: img.sortOrder ?? index,
    }))
}

let localImageKey = 0
function nextImageKey() {
  localImageKey += 1
  return `new-${localImageKey}`
}

export default function GalleryBatchFormPage() {
  const navigate = useNavigate()
  const { id: idParam } = useParams()
  const editId = idParam ? Number(idParam) : NaN
  const mode: 'create' | 'edit' = Number.isFinite(editId) && editId > 0 ? 'edit' : 'create'
  const fileInputId = useId()

  const [form, setForm] = useState<FormState>(() => emptyForm())
  const [images, setImages] = useState<LocalImage[]>([])
  const [tab, setTab] = useState<EditorTab>('details')
  const [loading, setLoading] = useState(mode === 'edit')
  const [loadError, setLoadError] = useState('')
  const [needsLogin, setNeedsLogin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [toast, setToast] = useState<SnackToast | null>(null)
  const [knownYears, setKnownYears] = useState<string[]>([])
  const [yearMode, setYearMode] = useState<'preset' | 'custom'>('preset')

  const yearOptions = useMemo(
    () => buildAcademicYearOptions(knownYears, 6),
    [knownYears],
  )

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    let cancelled = false
    void listGalleryYears({ all: true }).then((result) => {
      if (cancelled || !result.ok) return
      setKnownYears(result.data.years)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (mode !== 'edit') {
      const next = emptyForm()
      setForm(next)
      setImages([])
      setYearMode(yearOptions.includes(next.academicYear) ? 'preset' : 'custom')
      setLoading(false)
      setLoadError('')
      setNeedsLogin(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError('')
    void getGalleryBatchById(editId).then((result) => {
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
      const nextForm = recordToForm(result.data.item)
      setForm(nextForm)
      setImages(imagesFromRecords(result.data.images))
      setYearMode(
        yearOptions.includes(normalizeAcademicYear(nextForm.academicYear)) ? 'preset' : 'custom',
      )
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [mode, editId, yearOptions])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const academicYearOk = /^\d{4}–\d{4}$/u.test(normalizeAcademicYear(form.academicYear))
  const imagesOk = images.length > 0 && images.every((img) => img.title.trim() !== '')

  const tabAlert: Record<EditorTab, boolean> = {
    details: !academicYearOk,
    media: !imagesOk,
  }

  async function handleImageFiles(fileList: FileList | File[] | null | undefined) {
    if (!fileList || saving || uploading) return
    const files = [...fileList].filter((file) => file.type.startsWith('image/'))
    if (files.length === 0) {
      showToast('Choose one or more image files.', 'error')
      return
    }
    setUploading(true)
    const result = await uploadGalleryImages(files)
    setUploading(false)
    if (!result.ok) {
      showToast(result.error, 'error')
      return
    }
    setImages((prev) => {
      let order = prev.length > 0 ? Math.max(...prev.map((img) => img.sortOrder)) + 1 : 0
      const added: LocalImage[] = result.data.items.map((item) => {
        const entry: LocalImage = {
          key: nextImageKey(),
          src: item.src || item.url || item.image,
          title: DEFAULT_IMAGE_TITLE,
          caption: '',
          alt: '',
          sortOrder: order,
        }
        order += 1
        return entry
      })
      return [...prev, ...added]
    })
    setTab('media')
  }

  function updateImage(key: string, patch: Partial<LocalImage>) {
    setImages((prev) => prev.map((img) => (img.key === key ? { ...img, ...patch } : img)))
  }

  function removeImage(key: string) {
    setImages((prev) => prev.filter((img) => img.key !== key))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!academicYearOk) {
      showToast('Enter a valid academic year (YYYY–YYYY).', 'error')
      setTab('details')
      return
    }
    if (images.length === 0) {
      showToast('Add at least one image.', 'error')
      setTab('media')
      return
    }
    const missingTitle = images.find((img) => !img.title.trim())
    if (missingTitle) {
      showToast('Each image needs a title.', 'error')
      setTab('media')
      return
    }

    setSaving(true)
    const payload = {
      academicYear: normalizeAcademicYear(form.academicYear),
      title: form.title.trim() || undefined,
      published: form.published,
      images: images.map((img) => ({
        src: img.src,
        title: img.title.trim(),
        caption: img.caption.trim(),
        alt: img.alt.trim(),
        sortOrder: img.sortOrder,
      })),
    }

    const result =
      mode === 'edit'
        ? await updateGalleryBatch({ ...payload, id: editId })
        : await createGalleryBatch(payload)
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
          message: mode === 'edit' ? 'Batch updated.' : 'Batch created.',
          variant: 'success' as const,
        },
      },
    })
  }

  const canSave =
    !saving && !uploading && !loading && academicYearOk && imagesOk

  if (loading) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300/90 bg-zinc-50/80 px-5 py-16 text-[13px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-hidden />
          Loading batch…
        </div>
      </div>
    )
  }

  if (needsLogin) return <RequireLoginRedirect />

  if (loadError) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <div className="rounded-xl border border-zinc-200 bg-white px-5 py-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{loadError}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to={BASE_PATH}
              className="text-[13px] font-semibold text-brand-700 hover:text-brand-600 dark:text-brand-300"
            >
              Back to gallery
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to={BASE_PATH} label="gallery" />

      <section aria-label="Gallery batch form" className="w-full max-w-none">
        <form onSubmit={(event) => void onSubmit(event)} className={formWorkspaceCardCls}>
          <div className={formWorkspaceCardEyebrowCls}>
            <p className={formWorkspaceCardEyebrowTextCls}>Gallery · Batch</p>
          </div>

          <div className={formWorkspaceCardBodyCls}>
            <div className={formInsetPanelCls}>
              <div className={formTabChromeCardCls}>
                <div className="flex w-full min-w-0 items-start gap-2.5 sm:gap-3">
                  <span className={formSectionIconWrapCls}>
                    <Images className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h4 className={formSectionHeadingCls}>
                      {mode === 'edit' ? 'Edit batch' : 'New batch'}
                    </h4>
                    <p className={formSectionIntroCls}>
                      Set the academic year, batch title, and upload photos for The Council gallery.
                    </p>
                  </div>
                </div>

                <div className={formTabListCls} role="tablist" aria-label="Batch editor sections">
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
                {tab === 'details' ? (
                  <div className="space-y-4">
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="gallery-year">
                        Academic year <span className={workspaceFormRequiredMarkCls}>*</span>
                      </label>
                      <CatalogSelect
                        id="gallery-year"
                        aria-label="Academic year"
                        required
                        disabled={saving || uploading}
                        value={
                          yearMode === 'custom'
                            ? CUSTOM_YEAR
                            : yearOptions.includes(normalizeAcademicYear(form.academicYear))
                              ? normalizeAcademicYear(form.academicYear)
                              : CUSTOM_YEAR
                        }
                        options={[
                          ...yearOptions.map((year) => ({
                            value: year,
                            label: `A.Y. ${year}`,
                          })),
                          { value: CUSTOM_YEAR, label: 'Custom…', description: 'Enter YYYY–YYYY' },
                        ]}
                        onChange={(value) => {
                          if (value === CUSTOM_YEAR) {
                            setYearMode('custom')
                            return
                          }
                          setYearMode('preset')
                          set('academicYear', value)
                        }}
                      />
                      {yearMode === 'custom' ||
                      !yearOptions.includes(normalizeAcademicYear(form.academicYear)) ? (
                        <input
                          id="gallery-year-custom"
                          className={cn(catalogInput, 'mt-2')}
                          value={form.academicYear}
                          onChange={(e) => {
                            setYearMode('custom')
                            set('academicYear', e.target.value)
                          }}
                          placeholder="2026–2027"
                          disabled={saving || uploading}
                          aria-label="Custom academic year"
                          required
                        />
                      ) : null}
                    </div>

                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="gallery-title">
                        Batch title{' '}
                        <span className={workspaceFormOptionalBadgeCls}>Optional</span>
                      </label>
                      <input
                        id="gallery-title"
                        className={catalogInput}
                        value={form.title}
                        onChange={(e) => set('title', e.target.value)}
                        placeholder="Gallery batch label"
                        disabled={saving || uploading}
                      />
                    </div>

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
                          Published
                        </span>
                        <span className="mt-1 block text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">
                          Unpublished batches stay in the admin catalog only.
                        </span>
                      </span>
                    </label>
                  </div>
                ) : null}

                {tab === 'media' ? (
                  <section role="tabpanel" aria-label="Media" className="space-y-4">
                    <input
                      id={fileInputId}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      className="sr-only"
                      disabled={saving || uploading}
                      onChange={(e) => {
                        void handleImageFiles(e.target.files)
                        e.target.value = ''
                      }}
                    />

                    <FormMediaDropzone
                      htmlFor={fileInputId}
                      dragOver={dragOver}
                      uploading={uploading}
                      disabled={saving || uploading}
                      title="Add images"
                      hint={
                        <>
                          <span className="sm:hidden">
                            Tap to choose photos. Multiple files OK. JPG, PNG, WEBP, or GIF.
                          </span>
                          <span className="hidden sm:inline">
                            Drag and drop or click to browse. Select multiple files. JPG, PNG, WEBP,
                            or GIF.
                          </span>
                        </>
                      }
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
                        void handleImageFiles(e.dataTransfer.files)
                      }}
                    />

                    {images.length === 0 ? (
                      <p className="text-center text-[12px] text-zinc-500 dark:text-zinc-400">
                        At least one image is required before saving.
                      </p>
                    ) : (
                      <ul className="grid gap-3 sm:grid-cols-2">
                        {images.map((img) => (
                          <li
                            key={img.key}
                            className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950"
                          >
                            <div className="relative flex min-h-[10rem] items-center justify-center bg-zinc-100 px-2 py-3 sm:min-h-[12rem] dark:bg-zinc-900">
                              <img
                                src={img.src}
                                alt=""
                                className="max-h-[min(14rem,42vh)] w-full object-contain sm:max-h-[min(16rem,46vh)]"
                              />
                            </div>
                            <div className="space-y-2.5 p-3">
                              <div className={workspaceFormFieldGroupCls}>
                                <label className={workspaceFormLabelCls}>
                                  Title <span className={workspaceFormRequiredMarkCls}>*</span>
                                </label>
                                <input
                                  className={catalogInput}
                                  value={img.title}
                                  disabled={saving || uploading}
                                  onChange={(e) => updateImage(img.key, { title: e.target.value })}
                                  required
                                />
                              </div>
                              <div className={workspaceFormFieldGroupCls}>
                                <label className={workspaceFormLabelCls}>Caption / label</label>
                                <input
                                  className={catalogInput}
                                  value={img.caption}
                                  disabled={saving || uploading}
                                  onChange={(e) => updateImage(img.key, { caption: e.target.value })}
                                />
                              </div>
                              <div className={workspaceFormFieldGroupCls}>
                                <label className={workspaceFormLabelCls}>
                                  Alt text{' '}
                                  <span className={workspaceFormOptionalBadgeCls}>Optional</span>
                                </label>
                                <input
                                  className={catalogInput}
                                  value={img.alt}
                                  disabled={saving || uploading}
                                  onChange={(e) => updateImage(img.key, { alt: e.target.value })}
                                />
                              </div>
                              <div className={workspaceFormFieldGroupCls}>
                                <label className={workspaceFormLabelCls}>Sort order</label>
                                <input
                                  type="number"
                                  className={catalogInput}
                                  value={img.sortOrder}
                                  disabled={saving || uploading}
                                  onChange={(e) =>
                                    updateImage(img.key, {
                                      sortOrder: Number.parseInt(e.target.value, 10) || 0,
                                    })
                                  }
                                />
                              </div>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-800 hover:text-red-700 dark:text-red-300"
                                disabled={saving || uploading}
                                onClick={() => removeImage(img.key)}
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                Remove
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ) : null}
              </div>
            </div>
          </div>

          <div className={formWorkspaceCardFooterCls}>
            <button type="submit" className={formWorkspacePrimaryBtnCls} disabled={!canSave}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {mode === 'edit' ? 'Save changes' : 'Create batch'}
            </button>
          </div>
        </form>
      </section>

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
