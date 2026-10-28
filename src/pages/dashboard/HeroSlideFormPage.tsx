import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { ImagePlus, ImagePlay, Loader2, Megaphone } from 'lucide-react'
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
  workspaceTenantMainStackCls,
} from '@/components/portal/register-ui'
import { Button } from '@/components/ui/button'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import {
  createHeroSlide,
  getHeroSlideById,
  updateHeroSlide,
  uploadHeroImage,
  type HeroSlideRecord,
} from '@/lib/hero-slides-api'
import { cn } from '@/lib/utils'

type EditorTab = 'media' | 'publish'

const EDITOR_TABS = [
  { id: 'media' as const, label: 'Image', short: 'Photo', icon: ImagePlus },
  { id: 'publish' as const, label: 'Publish', short: 'Live', icon: Megaphone },
]

type FormState = {
  image: string
  alt: string
  sortOrder: string
  published: boolean
}

const emptyForm = (): FormState => ({
  image: '',
  alt: '',
  sortOrder: '0',
  published: true,
})

function recordToForm(item: HeroSlideRecord): FormState {
  return {
    image: item.image,
    alt: item.alt,
    sortOrder: String(item.sortOrder ?? 0),
    published: item.published,
  }
}

export default function HeroSlideFormPage() {
  const navigate = useNavigate()
  const { id: idParam } = useParams()
  const editId = idParam ? Number(idParam) : NaN
  const mode: 'create' | 'edit' = Number.isFinite(editId) && editId > 0 ? 'edit' : 'create'
  const backTo = '/admin/hero-slides'
  const fileInputId = useId()

  const [form, setForm] = useState<FormState>(emptyForm)
  const [tab, setTab] = useState<EditorTab>('media')
  const [loading, setLoading] = useState(mode === 'edit')
  const [loadError, setLoadError] = useState('')
  const [needsLogin, setNeedsLogin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
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
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError('')
    void getHeroSlideById(editId).then((result) => {
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

  async function handleImageFile(file: File | null | undefined) {
    if (!file || saving || uploading) return
    if (!file.type.startsWith('image/')) {
      showToast('Use a JPG, PNG, WEBP, or GIF image.', 'error')
      return
    }
    setUploading(true)
    const result = await uploadHeroImage(file)
    setUploading(false)
    if (!result.ok) {
      showToast(result.error, 'error')
      return
    }
    set('image', result.data.url)
    showToast('Image uploaded.', 'success')
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.image.trim()) {
      setTab('media')
      showToast('Upload a hero image.', 'error')
      return
    }
    setSaving(true)
    const payload = {
      image: form.image.trim(),
      alt: form.alt.trim(),
      sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
      published: form.published,
    }
    const result =
      mode === 'edit'
        ? await updateHeroSlide({ ...payload, id: editId })
        : await createHeroSlide(payload)
    setSaving(false)
    if (!result.ok) {
      showToast(result.error, 'error')
      return
    }
    navigate(backTo, {
      state: {
        toast: {
          message: mode === 'edit' ? 'Hero slide updated.' : 'Hero slide created.',
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
          Loading hero slide…
        </div>
      </div>
    )
  }

  if (needsLogin) return <RequireLoginRedirect />

  if (loadError) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <FormWorkspaceBackLink to={backTo} label="hero carousel" />
        <div className="rounded-xl border border-zinc-200 bg-white px-5 py-8 shadow-sm">
          <p className="text-sm font-medium text-zinc-900">{loadError}</p>
          <Button asChild size="lg" variant="outline" className="mt-4">
            <Link to={backTo}>Back to slides</Link>
          </Button>
        </div>
      </div>
    )
  }

  const disabled = saving || uploading
  const canSave = !disabled && form.image.trim() !== ''

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to={backTo} label="hero carousel" />
      <section aria-label="Hero slide" className="w-full max-w-none">
        <form onSubmit={(event) => void onSubmit(event)} className={formWorkspaceCardCls}>
          <div className={formWorkspaceCardEyebrowCls}>
            <p className={formWorkspaceCardEyebrowTextCls}>Homepage carousel</p>
          </div>
          <div className={formWorkspaceCardBodyCls}>
            <div className={formInsetPanelCls}>
              <div className={formTabChromeCardCls}>
                <div className="flex w-full min-w-0 items-start gap-2.5">
                  <span className={formSectionIconWrapCls}>
                    <ImagePlay className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h4 className={formSectionHeadingCls}>
                      {mode === 'edit' ? 'Edit slide' : 'New slide'}
                    </h4>
                    <p className={formSectionIntroCls}>
                      Landscape 16:9 photos look best in the homepage hero.
                    </p>
                  </div>
                </div>
                <div className={formTabListCls} role="tablist" aria-label="Hero slide sections">
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
                          alert={item.id === 'media' && !form.image.trim()}
                        />
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className={formControlWellCls}>
                {tab === 'media' ? (
                  <div className="space-y-4">
                    <input
                      id={fileInputId}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                      disabled={disabled}
                      onChange={(event) => {
                        void handleImageFile(event.target.files?.[0])
                        event.target.value = ''
                      }}
                    />
                    {form.image ? (
                      <FormMediaPreview
                        src={form.image}
                        frame="landscape"
                        uploading={uploading}
                        disabled={disabled}
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
                        disabled={disabled}
                        title="Upload hero photo"
                        hint="16:9 landscape. JPG, PNG, WEBP, or GIF up to 20 MB."
                        onDragEnter={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          if (!disabled) setDragOver(true)
                        }}
                        onDragOver={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          if (!disabled) setDragOver(true)
                        }}
                        onDragLeave={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          setDragOver(false)
                        }}
                        onDrop={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          setDragOver(false)
                          void handleImageFile(event.dataTransfer.files?.[0])
                        }}
                      />
                    )}
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="hero-alt">
                        Alt text <span className={workspaceFormOptionalBadgeCls}>optional</span>
                      </label>
                      <input
                        id="hero-alt"
                        className={catalogInput}
                        value={form.alt}
                        onChange={(event) => set('alt', event.target.value)}
                        placeholder="Describe the photo for screen readers"
                        disabled={disabled}
                      />
                    </div>
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="hero-sort">
                        Sort order
                      </label>
                      <input
                        id="hero-sort"
                        type="number"
                        className={catalogInput}
                        value={form.sortOrder}
                        onChange={(event) => set('sortOrder', event.target.value)}
                        disabled={disabled}
                      />
                    </div>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-3">
                    <input
                      type="checkbox"
                      className={cn(tableCheckboxCls, 'mt-0.5')}
                      checked={form.published}
                      disabled={disabled}
                      onChange={(event) => set('published', event.target.checked)}
                    />
                    <span>
                      <span className="block text-[13px] font-semibold text-zinc-900">
                        Published on the homepage
                      </span>
                      <span className="mt-1 block text-[12px] leading-5 text-zinc-500">
                        Draft slides stay in admin only.
                      </span>
                    </span>
                  </label>
                )}
              </div>
            </div>
          </div>
          <div className={formWorkspaceCardFooterCls}>
            <button type="submit" className={formWorkspacePrimaryBtnCls} disabled={!canSave}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {mode === 'edit' ? 'Save changes' : 'Create slide'}
            </button>
          </div>
        </form>
      </section>
      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
