import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  CalendarCheck,
  Check,
  FileText,
  Loader2,
  Lock,
  Minus,
  Package,
  Plus,
  Search,
  Shirt,
  UserRound,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
  RESERVATION_SHOPS,
  RESERVATION_STATUSES,
  createReservation,
  formatReservationMoney,
  getReservationById,
  updateReservation,
  type ReservationInput,
  type ReservationRecord,
  type ReservationShop,
  type ReservationStatus,
} from '@/lib/reservations-api'
import { listShopItems, type ShopItemRecord } from '@/lib/shop-api'
import { PH_TIMEZONE, parseApiDate } from '@/lib/datetime'
import { cn } from '@/lib/utils'

type EditorTab = 'content' | 'customer' | 'details'

const EDITOR_TABS: {
  id: EditorTab
  label: string
  short: string
  icon: typeof Package
}[] = [
  { id: 'content', label: 'Item', short: 'Item', icon: Package },
  { id: 'customer', label: 'Customer', short: 'Who', icon: UserRound },
  { id: 'details', label: 'Details', short: 'Meta', icon: FileText },
]

const SHOP_LABEL: Record<ReservationShop, string> = { merch: 'Merch', locker: 'Locker' }

const SHOP_OPTIONS = [...RESERVATION_SHOPS]
  .sort((a, b) => (a === 'merch' ? -1 : b === 'merch' ? 1 : 0))
  .map((id) => ({
    value: id,
    label: SHOP_LABEL[id],
    Icon: id === 'locker' ? Lock : Shirt,
  }))

const STATUS_OPTIONS = RESERVATION_STATUSES.map((s) => ({ value: s.value, label: s.label }))

const YEAR_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'Year 1', label: 'Year 1' },
  { value: 'Year 2', label: 'Year 2' },
  { value: 'Year 3', label: 'Year 3' },
  { value: 'Year 4', label: 'Year 4' },
]

type FormState = {
  shop: ReservationShop
  itemName: string
  quantity: string
  unitPrice: string
  status: ReservationStatus
  name: string
  email: string
  mobile: string
  studentId: string
  year: string
  code: string
  itemKey: string
  shopItemId: string
  remarks: string
  submittedAt: string
}

function toLocalInput(value: string) {
  if (!value) return ''
  const date = parseApiDate(value)
  if (!date) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

function emptyForm(): FormState {
  return {
    shop: 'merch',
    itemName: '',
    quantity: '1',
    unitPrice: '0',
    status: 'submitted',
    name: '',
    email: '',
    mobile: '',
    studentId: '',
    year: '',
    code: '',
    itemKey: '',
    shopItemId: '',
    remarks: '',
    submittedAt: toLocalInput(new Date().toISOString()),
  }
}

function recordToForm(record: ReservationRecord): FormState {
  return {
    shop: record.shop,
    itemName: record.itemName,
    quantity: String(record.quantity),
    unitPrice: String(record.unitPrice),
    status: record.status,
    name: record.name,
    email: record.email,
    mobile: record.mobile,
    studentId: record.studentId,
    year: record.year || record.yearLevel || '',
    code: record.code,
    itemKey: record.itemKey,
    shopItemId: record.shopItemId != null ? String(record.shopItemId) : '',
    remarks: record.remarks,
    submittedAt: toLocalInput(record.submittedAt),
  }
}

function parseQuantity(raw: string) {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : 0
}

function parseUnitPrice(raw: string) {
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function isValidPrice(raw: string) {
  const n = Number.parseFloat(raw)
  return raw.trim() !== '' && Number.isFinite(n) && n >= 0
}

function computeTotal(form: FormState) {
  const quantity = form.shop === 'locker' ? 1 : parseQuantity(form.quantity)
  return Math.round(quantity * parseUnitPrice(form.unitPrice) * 100) / 100
}

function formToInput(form: FormState): ReservationInput {
  const shopItemId = Number.parseInt(form.shopItemId, 10)
  const quantity = form.shop === 'locker' ? 1 : parseQuantity(form.quantity)
  const unitPrice = parseUnitPrice(form.unitPrice)
  return {
    shop: form.shop,
    code: form.code.trim() || undefined,
    itemName: form.itemName.trim(),
    itemKey: form.itemKey.trim() || undefined,
    shopItemId: Number.isFinite(shopItemId) && shopItemId > 0 ? shopItemId : null,
    quantity,
    unitPrice,
    totalAmount: Math.round(quantity * unitPrice * 100) / 100,
    name: form.name.trim(),
    email: form.email.trim(),
    mobile: form.mobile.trim(),
    studentId: form.studentId.trim(),
    year: form.year.trim(),
    remarks: form.remarks.trim(),
    status: form.status,
    submittedAt: form.submittedAt || undefined,
  }
}

function availabilityLabel(item: ShopItemRecord) {
  if (item.shop === 'locker') {
    if (item.availability === 'out') return 'Unavailable'
    if (item.availability === 'reserved') return 'Reserved'
    return 'Available'
  }
  if (item.availability === 'out') return 'Out of stock'
  if (item.availability === 'reserved') return 'Reserved'
  if (item.stock <= 0) return 'No stock'
  return `${item.stock} in stock`
}

function itemSelectable(item: ShopItemRecord) {
  if (item.availability === 'out' || item.availability === 'reserved') return false
  if (item.shop === 'locker') return true
  return item.stock > 0
}

function matchesSelected(item: ShopItemRecord, form: FormState) {
  if (form.shopItemId && String(item.id) === form.shopItemId) return true
  if (form.itemKey && item.itemKey && item.itemKey === form.itemKey) return true
  return false
}

export default function ReservationFormPage() {
  const navigate = useNavigate()
  const { id: idParam } = useParams()
  const editId = idParam ? Number(idParam) : NaN
  const mode: 'create' | 'edit' = Number.isFinite(editId) && editId > 0 ? 'edit' : 'create'

  const [form, setForm] = useState<FormState>(() => emptyForm())
  const [tab, setTab] = useState<EditorTab>('content')
  const [loading, setLoading] = useState(mode === 'edit')
  const [loadError, setLoadError] = useState('')
  const [needsLogin, setNeedsLogin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<SnackToast | null>(null)
  const [catalog, setCatalog] = useState<ShopItemRecord[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [itemQuery, setItemQuery] = useState('')

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
      setForm(emptyForm())
      setLoading(false)
      setLoadError('')
      setNeedsLogin(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError('')
    void getReservationById(editId).then((result) => {
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

  useEffect(() => {
    let cancelled = false
    setCatalogLoading(true)
    setCatalogError('')
    void listShopItems({ shop: form.shop, all: true }).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        if (result.status === 401 || result.status === 403) {
          setNeedsLogin(true)
        }
        setCatalog([])
        setCatalogError(result.error)
        setCatalogLoading(false)
        return
      }
      setCatalog(result.data.items)
      setCatalogLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [form.shop])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function selectShop(shop: ReservationShop) {
    if (shop === form.shop) return
    setForm((prev) => ({
      ...prev,
      shop,
      itemName: '',
      itemKey: '',
      shopItemId: '',
      unitPrice: '0',
      quantity: '1',
    }))
    setItemQuery('')
  }

  function selectCatalogItem(item: ShopItemRecord) {
    if (!itemSelectable(item) && !matchesSelected(item, form)) {
      showToast(availabilityLabel(item), 'error')
      return
    }
    const isLocker = item.shop === 'locker'
    setForm((prev) => ({
      ...prev,
      shop: item.shop as ReservationShop,
      itemName: item.name,
      itemKey: item.itemKey || '',
      shopItemId: String(item.id),
      unitPrice: String(item.price),
      quantity: isLocker
        ? '1'
        : prev.quantity && parseQuantity(prev.quantity) >= 1
          ? prev.quantity
          : '1',
    }))
  }

  function bumpQuantity(delta: number) {
    const next = Math.max(1, parseQuantity(form.quantity) + delta)
    set('quantity', String(next))
  }

  const total = computeTotal(form)

  const selectedItem = useMemo(
    () => catalog.find((item) => matchesSelected(item, form)) ?? null,
    [catalog, form],
  )

  const filteredCatalog = useMemo(() => {
    const q = itemQuery.trim().toLowerCase()
    const rows = [...catalog].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    if (!q) return rows
    return rows.filter((item) => {
      const hay = [item.name, item.itemKey, item.number, item.unit]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [catalog, itemQuery])

  const yearOptions = useMemo(() => {
    if (!form.year || YEAR_OPTIONS.some((o) => o.value === form.year)) return YEAR_OPTIONS
    return [...YEAR_OPTIONS, { value: form.year, label: form.year }]
  }, [form.year])

  const contentIncomplete =
    !form.itemName.trim() ||
    (form.shop !== 'locker' && parseQuantity(form.quantity) < 1) ||
    !isValidPrice(form.unitPrice)
  const customerIncomplete = !form.name.trim()
  const tabAlert: Record<EditorTab, boolean> = {
    content: contentIncomplete,
    customer: customerIncomplete,
    details: false,
  }
  const canSave = !saving && !loading && !contentIncomplete && !customerIncomplete

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.itemName.trim()) {
      setTab('content')
      showToast('Select an item from the catalog.', 'error')
      return
    }
    if (form.shop !== 'locker' && parseQuantity(form.quantity) < 1) {
      setTab('content')
      showToast('Quantity must be at least 1.', 'error')
      return
    }
    if (!isValidPrice(form.unitPrice)) {
      setTab('content')
      showToast('Enter a valid unit price.', 'error')
      return
    }
    if (!form.name.trim()) {
      setTab('customer')
      showToast('Customer name is required.', 'error')
      return
    }

    setSaving(true)
    const payload = formToInput(form)
    const result =
      mode === 'edit'
        ? await updateReservation({ ...payload, id: editId })
        : await createReservation(payload)
    setSaving(false)

    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        setNeedsLogin(true)
        return
      }
      showToast(result.error, 'error')
      return
    }

    const fallback =
      mode === 'edit' ? 'Reservation updated.' : 'Reservation created.'
    navigate('/admin/reservations', {
      state: {
        toast: {
          message: result.data.message || fallback,
          variant: 'success' as const,
        },
      },
    })
  }

  if (loading) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300/90 bg-zinc-50/80 px-5 py-16 text-[13px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-hidden />
          Loading reservation…
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
            <Button asChild size="lg" variant="outline">
              <Link to="/admin/reservations">Back to reservations</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const disabled = saving
  const qty = form.shop === 'locker' ? 1 : Math.max(1, parseQuantity(form.quantity))

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to="/admin/reservations" label="reservations" />

      <section aria-label="Reservation form" className="w-full max-w-none">
        <form onSubmit={(event) => void onSubmit(event)} className={formWorkspaceCardCls}>
          <div className={formWorkspaceCardEyebrowCls}>
            <p className={formWorkspaceCardEyebrowTextCls}>
              Reservations · {SHOP_LABEL[form.shop]}
            </p>
          </div>

          <div className={formWorkspaceCardBodyCls}>
            <div className={formInsetPanelCls}>
              <div className={formTabChromeCardCls}>
                <div className="flex w-full min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3">
                    <span className={formSectionIconWrapCls}>
                      <CalendarCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h4 className={formSectionHeadingCls}>
                        {mode === 'edit' ? 'Edit reservation' : 'New reservation'}
                      </h4>
                      <p className={formSectionIntroCls}>
                        Pick a catalog item
                        {form.shop === 'merch' ? ', set quantity,' : ''} then add the customer.
                        Required fields are marked with{' '}
                        <span className="font-semibold text-brand-700 dark:text-brand-400">*</span>.
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  role="tablist"
                  aria-label="Reservation form sections"
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
                  <section role="tabpanel" aria-label="Item" className="space-y-4">
                    <SectionIntro
                      icon={<Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />}
                      title="Reserve an item"
                      body="Choose Merch or Locker, then select a product from the catalog."
                    />

                    <div className="space-y-3">
                      <div
                        role="tablist"
                        aria-label="Shop"
                        className="inline-flex w-full rounded-xl border border-zinc-200/90 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-950 sm:w-auto"
                      >
                        {SHOP_OPTIONS.map((option) => {
                          const selected = form.shop === option.value
                          const Icon = option.Icon
                          return (
                            <button
                              key={option.value}
                              type="button"
                              role="tab"
                              aria-selected={selected}
                              disabled={disabled}
                              onClick={() => selectShop(option.value)}
                              className={cn(
                                'inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-[10px] px-3.5 text-[13px] font-semibold transition sm:flex-none sm:px-4',
                                selected
                                  ? 'bg-brand-700 text-white shadow-sm dark:bg-brand-600'
                                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50',
                              )}
                            >
                              <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                              {option.label}
                            </button>
                          )
                        })}
                      </div>

                      {form.itemName ? (
                        <SelectedItemCard
                          form={form}
                          selected={selectedItem}
                          qty={qty}
                          total={total}
                          disabled={disabled}
                          onBump={bumpQuantity}
                          onQuantityChange={(value) => set('quantity', value)}
                          onPriceChange={(value) => set('unitPrice', value)}
                          onStatusChange={(value) => set('status', value)}
                          onClear={() =>
                            setForm((prev) => ({
                              ...prev,
                              itemName: '',
                              itemKey: '',
                              shopItemId: '',
                              unitPrice: '0',
                              quantity: '1',
                            }))
                          }
                        />
                      ) : null}

                      <div className={cn(formControlWellCls, 'space-y-3')}>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-[12px] font-semibold text-zinc-800 dark:text-zinc-100">
                            {SHOP_LABEL[form.shop]} catalog
                            <span className={workspaceFormRequiredMarkCls}> *</span>
                          </p>
                          <label className="relative block w-full sm:max-w-[16rem]">
                            <span className="sr-only">Search catalog</span>
                            <Search
                              className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
                              aria-hidden
                            />
                            <input
                              type="search"
                              value={itemQuery}
                              onChange={(e) => setItemQuery(e.target.value)}
                              placeholder="Search items…"
                              className={cn(catalogInput, 'h-9 pl-8')}
                              disabled={disabled || catalogLoading}
                            />
                          </label>
                        </div>

                        {catalogLoading ? (
                          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300/90 bg-white/70 px-4 py-10 text-[13px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            Loading {SHOP_LABEL[form.shop].toLowerCase()} items…
                          </div>
                        ) : catalogError ? (
                          <div className="rounded-xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-[13px] text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                            {catalogError}
                          </div>
                        ) : filteredCatalog.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-zinc-300/90 bg-white/70 px-4 py-10 text-center text-[13px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400">
                            {catalog.length === 0
                              ? `No ${SHOP_LABEL[form.shop].toLowerCase()} items in the catalog yet.`
                              : 'No items match your search.'}
                          </div>
                        ) : (
                          <ul
                            className="grid max-h-[min(52vh,28rem)] gap-2.5 overflow-y-auto overscroll-contain pr-0.5 sm:grid-cols-2 xl:grid-cols-3"
                            data-lenis-prevent
                            aria-label={`${SHOP_LABEL[form.shop]} items`}
                          >
                            {filteredCatalog.map((item) => {
                              const selected = matchesSelected(item, form)
                              const available = itemSelectable(item)
                              return (
                                <li key={item.id} className="min-w-0">
                                  <button
                                    type="button"
                                    disabled={disabled || (!available && !selected)}
                                    onClick={() => selectCatalogItem(item)}
                                    aria-pressed={selected}
                                    className={cn(
                                      'group flex h-full w-full min-w-0 flex-col overflow-hidden rounded-2xl border text-left transition outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                                      selected
                                        ? 'border-brand-500 bg-brand-50/70 ring-2 ring-brand-500/25 dark:border-brand-400 dark:bg-brand-500/10 dark:ring-brand-400/20'
                                        : available
                                          ? 'border-zinc-200/90 bg-white hover:border-brand-300/70 hover:bg-brand-50/40 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-brand-500/35 dark:hover:bg-brand-500/5'
                                          : 'cursor-not-allowed border-zinc-200/70 bg-zinc-50/80 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/40',
                                    )}
                                  >
                                    <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                                      {item.image ? (
                                        <img
                                          src={item.image}
                                          alt=""
                                          className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                                          loading="lazy"
                                        />
                                      ) : (
                                        <span className="flex size-full items-center justify-center text-zinc-400">
                                          {form.shop === 'locker' ? (
                                            <Lock className="h-7 w-7" aria-hidden />
                                          ) : (
                                            <Shirt className="h-7 w-7" aria-hidden />
                                          )}
                                        </span>
                                      )}
                                      {selected ? (
                                        <span className="absolute top-2 right-2 inline-flex size-6 items-center justify-center rounded-full bg-brand-700 text-white shadow-sm dark:bg-brand-500">
                                          <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                                        </span>
                                      ) : null}
                                      {!item.published ? (
                                        <span className="absolute top-2 left-2 rounded-md bg-amber-100/95 px-1.5 py-0.5 text-[10px] font-semibold text-amber-950 dark:bg-amber-500/20 dark:text-amber-100">
                                          Draft
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="flex flex-1 flex-col gap-1.5 p-3">
                                      <p
                                        className="line-clamp-2 text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
                                        title={item.name}
                                      >
                                        {item.name}
                                      </p>
                                      <p className="text-[12px] font-medium text-zinc-800 dark:text-zinc-100">
                                        {formatReservationMoney(item.price)}
                                        <span className="ml-1 text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                                          / {item.unit || 'each'}
                                        </span>
                                      </p>
                                      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                                        {item.number ? <MetaChip>#{item.number}</MetaChip> : null}
                                        <MetaChip tone={available ? 'ok' : 'warn'}>
                                          {availabilityLabel(item)}
                                        </MetaChip>
                                      </div>
                                    </div>
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    </div>
                  </section>
                ) : null}

                {tab === 'customer' ? (
                  <section role="tabpanel" aria-label="Customer" className="space-y-4">
                    <SectionIntro
                      icon={<UserRound className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />}
                      title="Customer"
                      body="Who reserved this item and how to reach them."
                    />
                    <div className={`${formControlWellCls} grid gap-3 sm:grid-cols-2 sm:gap-4`}>
                      <div className="sm:col-span-2">
                        <Field label="Name" required>
                          <input
                            type="text"
                            value={form.name}
                            onChange={(e) => set('name', e.target.value)}
                            placeholder="Juan Dela Cruz"
                            className={catalogInput}
                            disabled={disabled}
                          />
                        </Field>
                      </div>
                      <Field label="Email" optional>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => set('email', e.target.value)}
                          placeholder="name@example.com"
                          className={catalogInput}
                          disabled={disabled}
                        />
                      </Field>
                      <Field label="Mobile" optional>
                        <input
                          type="tel"
                          value={form.mobile}
                          onChange={(e) => set('mobile', e.target.value)}
                          placeholder="09XX XXX XXXX"
                          className={catalogInput}
                          disabled={disabled}
                        />
                      </Field>
                      <Field label="Student ID" optional>
                        <input
                          type="text"
                          value={form.studentId}
                          onChange={(e) => set('studentId', e.target.value)}
                          placeholder="2024-00000-MN-0"
                          className={catalogInput}
                          disabled={disabled}
                        />
                      </Field>
                      <Field label="Year" optional custom>
                        <CatalogSelect
                          aria-label="Year level"
                          disabled={disabled}
                          value={form.year}
                          options={yearOptions}
                          onChange={(value) => set('year', value)}
                        />
                      </Field>
                    </div>
                  </section>
                ) : null}

                {tab === 'details' ? (
                  <section role="tabpanel" aria-label="Details" className="space-y-4">
                    <SectionIntro
                      icon={<FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />}
                      title="Details"
                      body="Reservation code, catalog link, remarks, and submission time."
                    />
                    <div className={`${formControlWellCls} grid gap-3 sm:grid-cols-2 sm:gap-4`}>
                      <Field label="Code" optional>
                        <input
                          type="text"
                          value={form.code}
                          onChange={(e) => set('code', e.target.value)}
                          placeholder={mode === 'create' ? 'auto if blank' : 'Reservation code'}
                          className={cn(catalogInput, 'font-mono')}
                          disabled={disabled}
                        />
                      </Field>
                      <Field label="Submitted at">
                        <input
                          type="datetime-local"
                          value={form.submittedAt}
                          onChange={(e) => set('submittedAt', e.target.value)}
                          className={catalogInput}
                          disabled={disabled}
                        />
                      </Field>
                      <Field label="Linked item key" optional>
                        <input
                          type="text"
                          value={form.itemKey}
                          readOnly
                          className={cn(catalogInput, 'cursor-default bg-zinc-50 font-mono dark:bg-zinc-900')}
                          placeholder="Set when you pick a catalog item"
                        />
                      </Field>
                      <Field label="Shop item ID" optional>
                        <input
                          type="text"
                          value={form.shopItemId}
                          readOnly
                          className={cn(catalogInput, 'cursor-default bg-zinc-50 font-mono dark:bg-zinc-900')}
                          placeholder="Set when you pick a catalog item"
                        />
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label="Remarks" optional>
                          <textarea
                            value={form.remarks}
                            onChange={(e) => set('remarks', e.target.value)}
                            rows={4}
                            placeholder="Notes about this reservation."
                            className={catalogTextarea}
                            disabled={disabled}
                          />
                        </Field>
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
                'Save reservation'
              )}
            </button>
          </footer>
        </form>
      </section>

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

function SelectedItemCard({
  form,
  selected,
  qty,
  total,
  disabled,
  onBump,
  onQuantityChange,
  onPriceChange,
  onStatusChange,
  onClear,
}: {
  form: FormState
  selected: ShopItemRecord | null
  qty: number
  total: number
  disabled: boolean
  onBump: (delta: number) => void
  onQuantityChange: (value: string) => void
  onPriceChange: (value: string) => void
  onStatusChange: (value: ReservationStatus) => void
  onClear: () => void
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-brand-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-brand-500/25 dark:bg-zinc-950 dark:shadow-none">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-stretch sm:gap-4 sm:p-4">
        <div className="flex min-w-0 flex-1 gap-3">
          <span className="inline-flex h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 sm:h-[4.5rem] sm:w-[4.5rem]">
            {selected?.image ? (
              <img src={selected.image} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-zinc-400">
                {form.shop === 'locker' ? (
                  <Lock className="h-5 w-5" aria-hidden />
                ) : (
                  <Shirt className="h-5 w-5" aria-hidden />
                )}
              </span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-brand-700 uppercase dark:text-brand-300">
              Selected · {SHOP_LABEL[form.shop]}
            </p>
            <h5 className="mt-0.5 truncate text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {form.itemName}
            </h5>
            <p className="mt-1 text-[12px] text-zinc-500 dark:text-zinc-400">
              {selected ? availabilityLabel(selected) : 'Catalog link may be outdated'}
              {selected?.unit ? ` · ${selected.unit}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="h-8 shrink-0 self-start rounded-lg px-2 text-[12px] font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          >
            Change
          </button>
        </div>

        <div
          className={cn(
            'grid min-w-0 flex-[1.15] gap-2',
            form.shop === 'locker' ? 'sm:grid-cols-2' : 'sm:grid-cols-3',
          )}
        >
          {form.shop === 'merch' ? (
            <div className="min-w-0">
              <p className="mb-1 text-[10px] font-semibold tracking-wide text-zinc-400 uppercase">
                Qty
              </p>
              <div className="inline-flex h-10 w-full items-center rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={disabled || qty <= 1}
                  onClick={() => onBump(-1)}
                  className="inline-flex h-full w-9 items-center justify-center text-zinc-500 hover:text-zinc-800 disabled:opacity-40 dark:hover:text-zinc-200"
                >
                  <Minus className="h-3.5 w-3.5" aria-hidden />
                </button>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={form.quantity}
                  onChange={(e) => onQuantityChange(e.target.value)}
                  className="h-full min-w-0 flex-1 border-0 bg-transparent text-center text-[13px] font-semibold tabular-nums text-zinc-900 outline-none dark:text-zinc-50"
                  disabled={disabled}
                />
                <button
                  type="button"
                  aria-label="Increase quantity"
                  disabled={disabled}
                  onClick={() => onBump(1)}
                  className="inline-flex h-full w-9 items-center justify-center text-zinc-500 hover:text-zinc-800 disabled:opacity-40 dark:hover:text-zinc-200"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-semibold tracking-wide text-zinc-400 uppercase">
              {form.shop === 'locker' ? 'Fee ₱' : 'Unit ₱'}
            </p>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.unitPrice}
              onChange={(e) => onPriceChange(e.target.value)}
              className={cn(catalogInput, 'h-10')}
              disabled={disabled}
            />
          </div>
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-semibold tracking-wide text-zinc-400 uppercase">
              Status
            </p>
            <CatalogSelect
              aria-label="Status"
              disabled={disabled}
              value={form.status}
              options={STATUS_OPTIONS}
              onChange={(value) => onStatusChange(value as ReservationStatus)}
            />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-zinc-100 bg-zinc-50/90 px-3 py-2.5 sm:px-4 dark:border-zinc-800 dark:bg-zinc-900/60">
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
          {form.shop === 'locker'
            ? 'One locker reservation'
            : `${qty} × ${formatReservationMoney(parseUnitPrice(form.unitPrice))}`}
        </p>
        <p className="text-[14px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Total {formatReservationMoney(total)}
        </p>
      </div>
    </div>
  )
}

function MetaChip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'ok' | 'warn'
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full truncate rounded-md border px-1.5 py-0.5 text-[10px] font-semibold',
        tone === 'ok' &&
          'border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200',
        tone === 'warn' &&
          'border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100',
        tone === 'neutral' &&
          'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
      )}
    >
      {children}
    </span>
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
