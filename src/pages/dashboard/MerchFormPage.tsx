import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { ImagePlus, Loader2, Megaphone, Package, Tags } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { ShopId } from '@/components/portal/catalog'
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
import { CatalogSelect } from '@/components/ui/CatalogSelect'
import { ImageCropDialog } from '@/components/ui/ImageCropDialog'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import { useImageCropUpload } from '@/hooks/useImageCropUpload'
import { coverAspectPresets } from '@/lib/image-crop'
import {
  SHOP_IDS,
  SHOP_META,
  createShopItem,
  getShopItemById,
  updateShopItem,
  uploadShopImage,
  type ShopAvailability,
  type ShopItemInput,
  type ShopItemRecord,
} from '@/lib/shop-api'
import { cn } from '@/lib/utils'

type EditorTab = 'content' | 'details' | 'media' | 'publish'

const CUSTOM_UNIT = '__custom__'

const EDITOR_TABS: {
  id: EditorTab
  label: string
  short: string
  icon: typeof Package
}[] = [
  { id: 'content', label: 'Content', short: 'Item', icon: Package },
  { id: 'details', label: 'Details', short: 'Meta', icon: Tags },
  { id: 'media', label: 'Media', short: 'Image', icon: ImagePlus },
  { id: 'publish', label: 'Publish', short: 'Live', icon: Megaphone },
]

const MERCH_UNIT_OPTIONS = [
  { value: 'each', label: 'Each' },
  { value: 'per piece', label: 'Per piece' },
  { value: 'per set', label: 'Per set' },
  { value: 'pair', label: 'Pair' },
]

const LOCKER_UNIT_OPTIONS = [
  { value: 'per semester', label: 'Per semester' },
  { value: 'per year', label: 'Per year' },
  { value: 'per term', label: 'Per term' },
]

type FormState = {
  shop: ShopId
  itemKey: string
  name: string
  price: string
  unit: string
  stock: string
  image: string
  alt: string
  number: string
  availability: '' | ShopAvailability
  sortOrder: string
  published: boolean
}

const SHOP_LABEL: Record<ShopId, string> = { merch: 'Merch', locker: 'Locker' }

const SHOP_OPTIONS = [...SHOP_IDS]
  .sort((a, b) => (a === 'merch' ? -1 : b === 'merch' ? 1 : 0))
  .map((id) => ({ value: id, label: `${SHOP_LABEL[id]} · ${SHOP_META[id].kicker}` }))

const AVAILABILITY_OPTIONS_MERCH = [
  { value: '', label: 'Available' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'out', label: 'Out of stock' },
]

const AVAILABILITY_OPTIONS_LOCKER = [
  { value: '', label: 'Available' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'out', label: 'Unavailable' },
]

function emptyForm(shop: ShopId = 'merch'): FormState {
  const locker = shop === 'locker'
  return {
    shop,
    itemKey: '',
    name: '',
    price: '0',
    unit: locker ? 'per rental period' : 'each',
    stock: locker ? '1' : '0',
    image: '',
    alt: '',
    number: '',
    availability: '',
    sortOrder: '0',
    published: true,
  }
}

function recordToForm(record: ShopItemRecord): FormState {
  return {
    shop: record.shop,
    itemKey: record.itemKey,
    name: record.name,
    price: String(record.price),
    unit: record.unit,
    stock: String(record.stock),
    image: record.image,
    alt: record.alt,
    number: record.number ?? '',
    availability: record.availability ?? '',
    sortOrder: String(record.sortOrder),
    published: record.published,
  }
}

function formToInput(form: FormState): ShopItemInput {
  return {
    shop: form.shop,
    itemKey: form.itemKey.trim() || undefined,
    name: form.name.trim(),
    price: Number.parseFloat(form.price) || 0,
    unit: form.unit.trim(),
    stock: form.shop === 'locker' ? 1 : Math.max(0, Number.parseInt(form.stock, 10) || 0),
    image: form.image.trim(),
    alt: form.alt.trim(),
    number: form.shop === 'locker' && form.number.trim() ? form.number.trim() : null,
    availability: form.availability || null,
    sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
    published: form.published,
  }
}

function isValidPrice(raw: string) {
  const n = Number.parseFloat(raw)
  return raw.trim() !== '' && Number.isFinite(n) && n >= 0
}

export default function MerchFormPage() {
  const navigate = useNavigate()
  const { id: idParam } = useParams()
  const [searchParams] = useSearchParams()
  const editId = idParam ? Number(idParam) : NaN
  const mode: 'create' | 'edit' = Number.isFinite(editId) && editId > 0 ? 'edit' : 'create'
  const initialShop: ShopId = searchParams.get('shop') === 'locker' ? 'locker' : 'merch'

  const fileInputId = useId()
  const [form, setForm] = useState<FormState>(() => emptyForm(initialShop))
  const [tab, setTab] = useState<EditorTab>('content')
  const [loading, setLoading] = useState(mode === 'edit')
  const [loadError, setLoadError] = useState('')
  const [needsLogin, setNeedsLogin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [unitMode, setUnitMode] = useState<'preset' | 'custom'>('preset')
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
    setTab('content')
    if (mode !== 'edit') {
      const blank = emptyForm(initialShop)
      setForm(blank)
      setUnitMode('preset')
      setLoading(false)
      setLoadError('')
      setNeedsLogin(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError('')
    void getShopItemById(editId).then((result) => {
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
      const presets =
        next.shop === 'locker'
          ? LOCKER_UNIT_OPTIONS.map((o) => o.value)
          : MERCH_UNIT_OPTIONS.map((o) => o.value)
      setUnitMode(presets.includes(next.unit.trim().toLowerCase()) ? 'preset' : 'custom')
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [mode, editId, initialShop])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function changeShop(next: ShopId) {
    setForm((prev) => {
      if (prev.shop === next) return prev
      if (next === 'locker') {
        const unit =
          !prev.unit.trim() || MERCH_UNIT_OPTIONS.some((o) => o.value === prev.unit)
            ? 'per semester'
            : prev.unit
        setUnitMode(
          LOCKER_UNIT_OPTIONS.some((o) => o.value === unit) ? 'preset' : 'custom',
        )
        return {
          ...prev,
          shop: next,
          unit,
          stock: prev.stock === '0' || !prev.stock.trim() ? '1' : prev.stock,
        }
      }
      const unit =
        !prev.unit.trim() || LOCKER_UNIT_OPTIONS.some((o) => o.value === prev.unit)
          ? 'each'
          : prev.unit
      setUnitMode(MERCH_UNIT_OPTIONS.some((o) => o.value === unit) ? 'preset' : 'custom')
      return {
        ...prev,
        shop: next,
        unit,
      }
    })
  }

  function handleImageFile(file: File | null | undefined) {
    openCrop(file, {
      busy: uploading || saving,
      onInvalid: (message) => showToast(message, 'error'),
    })
  }

  async function handleCroppedUpload(file: File) {
    setUploading(true)
    const result = await uploadShopImage(file)
    setUploading(false)
    if (!result.ok) {
      showToast(result.error, 'error')
      return
    }
    closeCrop()
    set('image', result.data.url)
    if (!form.alt.trim()) set('alt', form.name.trim() || 'Shop item')
    showToast('Image uploaded.', 'success')
  }

  const isLocker = form.shop === 'locker'
  const noun = isLocker ? 'locker' : 'merch item'
  const unitPresets = useMemo(
    () => (isLocker ? LOCKER_UNIT_OPTIONS : MERCH_UNIT_OPTIONS),
    [isLocker],
  )
  const unitPresetValues = useMemo(
    () => unitPresets.map((option) => option.value),
    [unitPresets],
  )

  const contentIncomplete = !form.name.trim() || !isValidPrice(form.price)
  const mediaIncomplete = !form.image.trim()
  const tabAlert: Record<EditorTab, boolean> = {
    content: contentIncomplete,
    details: false,
    media: mediaIncomplete,
    publish: false,
  }
  const canSave = !saving && !uploading && !loading && !contentIncomplete && !mediaIncomplete

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.name.trim()) {
      setTab('content')
      showToast('Name is required.', 'error')
      return
    }
    if (!isValidPrice(form.price)) {
      setTab('content')
      showToast('Enter a valid price.', 'error')
      return
    }
    if (!form.image.trim()) {
      setTab('media')
      showToast('Upload an image to continue.', 'error')
      return
    }

    setSaving(true)
    const payload = formToInput(form)
    const result =
      mode === 'edit'
        ? await updateShopItem({ ...payload, id: editId })
        : await createShopItem(payload)
    setSaving(false)

    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        setNeedsLogin(true)
        return
      }
      showToast(result.error, 'error')
      return
    }

    navigate('/admin/merch', {
      state: {
        toast: {
          message: mode === 'edit' ? 'Item updated.' : 'Item created.',
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
          Loading item…
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
              <Link to="/admin/merch">Back to merch &amp; lockers</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const disabled = saving || uploading

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to="/admin/merch" label="merch & lockers" />

      <section aria-label="Merch form" className="w-full max-w-none">
        <form onSubmit={(event) => void onSubmit(event)} className={formWorkspaceCardCls}>
          <div className={formWorkspaceCardEyebrowCls}>
            <p className={formWorkspaceCardEyebrowTextCls}>
              Merch &amp; Lockers · {SHOP_LABEL[form.shop]}
            </p>
          </div>

          <div className={formWorkspaceCardBodyCls}>
            <div className={formInsetPanelCls}>
              <div className={formTabChromeCardCls}>
                <div className="flex w-full min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3">
                    <span className={formSectionIconWrapCls}>
                      <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h4 className={formSectionHeadingCls}>
                        {mode === 'edit' ? `Edit ${noun}` : `New ${noun}`}
                      </h4>
                      <p className={formSectionIntroCls}>
                        Content, details, media, and publish use separate tabs. Required fields are
                        marked with{' '}
                        <span className="font-semibold text-brand-700 dark:text-brand-400">*</span>.
                      </p>
                    </div>
                  </div>
                </div>

                <div role="tablist" aria-label="Merch form sections" className={formTabListCls}>
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
                        disabled={disabled}
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
                      icon={<Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />}
                      title="Content"
                      body={
                        isLocker
                          ? 'Name, price, unit, and locker number shown on the locker page.'
                          : 'Name, price, unit, and stock shown in the portal shop.'
                      }
                    />
                    <div className={`${formControlWellCls} grid gap-3 sm:grid-cols-2 sm:gap-4`}>
                      <div className="sm:col-span-2">
                        <Field label="Name" required>
                          <input
                            type="text"
                            value={form.name}
                            onChange={(e) => set('name', e.target.value)}
                            placeholder={isLocker ? 'Locker A-12' : 'College shirt'}
                            className={catalogInput}
                            disabled={disabled}
                          />
                        </Field>
                      </div>
                      <Field label="Price (₱)" required>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={form.price}
                          onChange={(e) => set('price', e.target.value)}
                          className={catalogInput}
                          disabled={disabled}
                        />
                      </Field>
                      <Field label="Unit" custom>
                        <CatalogSelect
                          aria-label="Unit"
                          disabled={disabled}
                          value={
                            unitMode === 'custom'
                              ? CUSTOM_UNIT
                              : unitPresetValues.includes(form.unit)
                                ? form.unit
                                : CUSTOM_UNIT
                          }
                          options={[
                            ...unitPresets,
                            {
                              value: CUSTOM_UNIT,
                              label: 'Custom…',
                              description: 'Enter a custom unit label',
                            },
                          ]}
                          onChange={(value) => {
                            if (value === CUSTOM_UNIT) {
                              setUnitMode('custom')
                              return
                            }
                            setUnitMode('preset')
                            set('unit', value)
                          }}
                        />
                        {unitMode === 'custom' || !unitPresetValues.includes(form.unit) ? (
                          <input
                            type="text"
                            className={cn(catalogInput, 'mt-2')}
                            value={form.unit}
                            onChange={(e) => {
                              setUnitMode('custom')
                              set('unit', e.target.value)
                            }}
                            placeholder={isLocker ? 'per semester' : 'each'}
                            disabled={disabled}
                            aria-label="Custom unit"
                          />
                        ) : null}
                      </Field>
                      {isLocker ? (
                        <Field label="Locker no." optional>
                          <input
                            type="text"
                            value={form.number}
                            onChange={(e) => set('number', e.target.value)}
                            placeholder="A-12"
                            className={catalogInput}
                            disabled={disabled}
                          />
                        </Field>
                      ) : (
                        <Field label="Stock">
                          <input
                            type="number"
                            min={0}
                            value={form.stock}
                            onChange={(e) => set('stock', e.target.value)}
                            className={catalogInput}
                            disabled={disabled}
                          />
                        </Field>
                      )}
                    </div>
                  </section>
                ) : null}

                {tab === 'details' ? (
                  <section role="tabpanel" aria-label="Details" className="space-y-4">
                    <SectionIntro
                      icon={<Tags className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />}
                      title="Details"
                      body="Shop, availability, ordering, and optional keys for portal lookups."
                    />
                    <div className={`${formControlWellCls} grid gap-3 sm:grid-cols-2 sm:gap-4`}>
                      <Field label="Shop" required custom>
                        <CatalogSelect
                          aria-label="Shop"
                          required
                          disabled={disabled}
                          value={form.shop}
                          options={SHOP_OPTIONS}
                          onChange={(value) => changeShop(value as ShopId)}
                        />
                      </Field>
                      <Field label="Availability" custom>
                        <CatalogSelect
                          aria-label="Availability"
                          disabled={disabled}
                          value={form.availability}
                          options={isLocker ? AVAILABILITY_OPTIONS_LOCKER : AVAILABILITY_OPTIONS_MERCH}
                          onChange={(value) =>
                            set('availability', value as FormState['availability'])
                          }
                        />
                      </Field>
                      <Field label="Item key" optional>
                        <input
                          type="text"
                          value={form.itemKey}
                          onChange={(e) => set('itemKey', e.target.value)}
                          placeholder="auto from name"
                          className={catalogInput}
                          disabled={disabled}
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

                {tab === 'media' ? (
                  <section role="tabpanel" aria-label="Media" className="space-y-4">
                    <SectionIntro
                      icon={<ImagePlus className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />}
                      title="Media"
                      body="Upload a product image for the portal shop card."
                    />
                    <div className={`${formControlWellCls} space-y-4`}>
                      <input
                        id={fileInputId}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        disabled={disabled}
                        onChange={(e) => {
                          void handleImageFile(e.target.files?.[0])
                          e.target.value = ''
                        }}
                      />
                      {form.image ? (
                        <FormMediaPreview
                          src={form.image}
                          frame="square"
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
                          onDragEnter={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (!disabled) setDragOver(true)
                          }}
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (!disabled) setDragOver(true)
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
                      <Field label="Image alt text" optional>
                        <input
                          type="text"
                          value={form.alt}
                          onChange={(e) => set('alt', e.target.value)}
                          placeholder="Describe the image"
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
                      body="Control whether this item is live in the portal shop."
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
                        Published in portal shop
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

      {cropSession ? (
        <ImageCropDialog
          open
          imageSrc={cropSession.url}
          fileName={cropSession.name}
          mime={cropSession.mime}
          title="Crop shop image"
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
  custom,
  children,
}: {
  label: string
  optional?: boolean
  required?: boolean
  /** Wrapper is a div (not label) so custom controls like CatalogSelect aren't double-labelled. */
  custom?: boolean
  children: ReactNode
}) {
  const head = (
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
  )
  if (custom) {
    return (
      <div className={workspaceFormFieldGroupCls}>
        {head}
        {children}
      </div>
    )
  }
  return (
    <label className={workspaceFormFieldGroupCls}>
      {head}
      {children}
    </label>
  )
}
