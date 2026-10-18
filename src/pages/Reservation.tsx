import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Ban,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleUser,
  GraduationCap,
  IdCard,
  Loader2,
  LockKeyhole,
  Mail,
  MessageSquare,
  Minus,
  Package,
  Phone,
  Plus,
  Shirt,
  Tag,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { findShopItemAsync, type ShopLookup } from '@/components/portal/catalog'
import { reservationFromApi, saveReservation } from '@/components/portal/reservations'
import { siteName } from '@/components/layout/nav-data'
import { createReservation } from '@/lib/reservations-api'
import { cn } from '@/lib/utils'

const fieldClass =
  'h-10 w-full min-w-0 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100 aria-invalid:border-maroon-600 aria-invalid:focus:ring-maroon-100 sm:h-12 sm:px-3.5'

type FieldErrors = {
  name?: string
  email?: string
  mobile?: string
  studentId?: string
  year?: string
  form?: string
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function Field({
  label,
  icon: Icon,
  htmlFor,
  labelId,
  required = true,
  error,
  className,
  children,
}: {
  label: string
  icon: LucideIcon
  htmlFor?: string
  labelId?: string
  required?: boolean
  error?: string
  className?: string
  children: ReactNode
}) {
  const classes = 'inline-flex max-w-full items-center gap-2 text-sm font-medium text-zinc-800'
  const content = (
    <>
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
        <Icon className="size-3.5" aria-hidden />
      </span>
      {label}
      {required ? <span className="text-maroon-700"> *</span> : null}
    </>
  )
  return (
    <div className={cn('min-w-0', className)}>
      {htmlFor ? (
        <label htmlFor={htmlFor} id={labelId} className={classes}>
          {content}
        </label>
      ) : (
        <span id={labelId} className={classes}>
          {content}
        </span>
      )}
      <div className="mt-2 min-w-0">{children}</div>
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="mt-1.5 text-xs text-maroon-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}

const years = ['Year 1', 'Year 2', 'Year 3', 'Year 4'] as const

function YearMenu({
  id,
  value,
  labelledBy,
  invalid,
  describedBy,
  onChange,
}: {
  id: string
  value: string
  labelledBy: string
  invalid?: boolean
  describedBy?: string
  onChange: (next: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function choose(next: string) {
    onChange(next)
    setOpen(false)
    document.getElementById(id)?.focus()
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        const current = years.findIndex((level) => level === value)
        setActive(event.key === 'ArrowUp' ? years.length - 1 : Math.max(0, current))
        setOpen(true)
        return
      }
      setActive((current) =>
        event.key === 'ArrowDown' ? (current + 1) % years.length : (current - 1 + years.length) % years.length,
      )
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!open) {
        setActive(Math.max(0, years.findIndex((level) => level === value)))
        setOpen(true)
      } else {
        choose(years[active])
      }
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative w-full min-w-0" ref={rootRef}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-labelledby={labelledBy}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (open) {
            setOpen(false)
            return
          }
          setActive(Math.max(0, years.findIndex((level) => level === value)))
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
        className={cn(fieldClass, 'flex items-center pr-10 text-left')}
      >
        <span className={cn('min-w-0 flex-1 truncate', value ? 'text-zinc-900' : 'text-zinc-400')}>
          {value || 'Select year'}
        </span>
      </button>
      <ChevronDown
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-zinc-400 transition-transform',
          open && 'rotate-180',
        )}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Year level"
          className="absolute top-[calc(100%+0.375rem)] right-0 left-0 z-30 rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-[0_18px_40px_-24px_rgba(30,5,65,0.55)]"
        >
          {years.map((level, index) => {
            const selected = level === value
            return (
              <li key={level} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(level)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm',
                    index === active ? 'bg-brand-50 text-brand-800' : 'text-zinc-800',
                    selected && 'font-semibold text-brand-800',
                  )}
                >
                  {level}
                  {selected ? <Check className="size-4 shrink-0 text-brand-700" aria-hidden /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

function QuantityStepper({
  value,
  max,
  onChange,
}: {
  value: number
  max: number
  onChange: (next: number) => void
}) {
  return (
    <div
      role="group"
      aria-labelledby="quantity-label"
      className="flex h-10 w-full min-w-0 items-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 focus-within:border-brand-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-100 sm:h-12"
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
        className="flex h-full w-11 shrink-0 items-center justify-center text-zinc-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:text-zinc-300 sm:w-12"
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <span className="min-w-0 flex-1 text-center text-sm font-semibold text-zinc-900 tabular-nums">{value}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="flex h-full w-11 shrink-0 items-center justify-center text-zinc-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:text-zinc-300 sm:w-12"
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  )
}

function pesos(value: number) {
  return `₱${value.toLocaleString('en-PH')}`
}

export default function Reservation() {
  const { shop: shopParam, itemId } = useParams()
  // undefined = loading, null = not listed
  const [found, setFound] = useState<ShopLookup | null | undefined>(undefined)
  const formId = useId()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [studentId, setStudentId] = useState('')
  const [year, setYear] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [remarks, setRemarks] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [reserved, setReserved] = useState<string | null>(null)
  const [mailNotice, setMailNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setFound(undefined)
    void findShopItemAsync(shopParam, itemId).then((lookup) => {
      if (!cancelled) setFound(lookup)
    })
    return () => {
      cancelled = true
    }
  }, [shopParam, itemId])

  useEffect(() => {
    const previous = document.title
    document.title = found
      ? `Reserve ${found.item.name} · ${siteName.short} ${siteName.unit}`
      : `Reservation · ${siteName.short} ${siteName.unit}`
    return () => {
      document.title = previous
    }
  }, [found])

  if (found === undefined) {
    return (
      <main id="main-content" className="bg-[#f4f5f7]">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <p className="text-sm text-zinc-500" role="status">
            Loading item…
          </p>
        </div>
      </main>
    )
  }

  if (!found) {
    return (
      <main id="main-content" className="bg-[#f4f5f7]">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h1 className="text-xl font-semibold text-zinc-900">This item is not listed.</h1>
          <Link to="/portal" className="mt-4 inline-flex text-sm font-semibold text-brand-700">
            Back to the portal
          </Link>
        </div>
      </main>
    )
  }

  const { listing, item, shop } = found
  const count = shop === 'locker' ? 1 : Math.max(1, Number.parseInt(quantity, 10) || 1)
  const total = item.price * count

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    const next: FieldErrors = {}
    if (name.trim().length < 2) next.name = 'Enter your full name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email address.'
    const mobileDigits = mobile.replace(/\D/g, '')
    if (mobileDigits.length < 10 || mobileDigits.length > 13) next.mobile = 'Enter a valid mobile number.'
    if (!/^[A-Za-z0-9-]{4,20}$/.test(studentId.trim())) next.studentId = 'Enter a valid student ID.'
    if (!year) next.year = 'Select your year level.'
    if (item.availability === 'reserved') next.form = 'This item is reserved.'
    else if (item.availability === 'out') {
      next.form = shop === 'locker' ? 'This locker is unavailable.' : 'This item is out of stock.'
    } else if (shop !== 'locker' && count > item.stock) {
      next.form = `Only ${item.stock} in stock.`
    }
    setErrors(next)
    const first = (['name', 'email', 'mobile', 'studentId', 'year'] as const).find((key) => next[key])
    if (first) {
      document.getElementById(`${formId}-${first === 'studentId' ? 'student-id' : first}`)?.focus()
      return
    }
    if (next.form) return
    setSubmitting(true)
    await wait(280)

    const numericId = Number.parseInt(item.id, 10)
    const shopItemId = Number.isFinite(numericId) && String(numericId) === item.id ? numericId : null

    const created = await createReservation({
      shop,
      shopItemId,
      itemKey: item.id,
      itemName: item.name,
      unitPrice: item.price,
      quantity: count,
      totalAmount: total,
      name: name.trim(),
      email: email.trim(),
      mobile: mobile.trim(),
      studentId: studentId.trim(),
      year,
      remarks: remarks.trim(),
      status: 'submitted',
      public: true,
      source: 'portal',
    })

    if (!created.ok) {
      setSubmitting(false)
      setErrors({ form: created.error })
      return
    }

    const record = created.data.item
    const code = record.code
    setReserved(code)
    setMailNotice(
      created.data.mail?.confirmSent
        ? 'A confirmation email was sent to your inbox.'
        : created.data.message ||
            'Your reservation is saved. Keep this ID — email delivery may be unavailable.',
    )
    saveReservation(reservationFromApi(record))
    setSubmitting(false)
  }

  return (
    <main id="main-content" className="bg-[#f4f5f7]">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <Link
          to={`/portal#${found.shop}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-800"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {listing.title}
        </Link>

        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
          <article className="overflow-hidden rounded-2xl bg-white shadow-[0_10px_28px_-18px_rgba(30,5,65,0.45)]">
            <div className="relative bg-[#f6f6f8] px-6 py-5">
              <span
                className={cn(
                  'absolute top-3 left-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white',
                  item.availability ? 'bg-zinc-700' : 'bg-brand-700',
                )}
              >
                {item.availability === 'out' ? (
                  <Ban className="size-3" aria-hidden />
                ) : item.availability === 'reserved' ? (
                  <Bookmark className="size-3" aria-hidden />
                ) : found.shop === 'locker' ? (
                  <LockKeyhole className="size-3" aria-hidden />
                ) : (
                  <Shirt className="size-3" aria-hidden />
                )}
                {item.availability === 'reserved'
                  ? 'Reserved'
                  : item.availability === 'out'
                    ? 'Out of stock'
                    : found.shop === 'locker'
                      ? 'Locker'
                      : 'Merch'}
              </span>
              <img src={item.image} alt={item.alt} className="mx-auto h-40 w-full object-contain sm:h-48" />
            </div>
            <div className="px-4 py-4">
              <p className="text-xs text-zinc-500">
                {found.shop === 'locker' ? (item.size === 'half' ? 'Half' : 'Full') : listing.kicker}
              </p>
              <h1 className="mt-1 text-lg font-semibold text-zinc-950">
                {item.number ? `No. ${item.number}` : item.name}
              </h1>
              <p className="mt-2 text-base font-semibold text-zinc-950">
                {pesos(item.price)} <span className="text-sm font-normal text-zinc-400">{item.unit}</span>
              </p>
              <dl className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100 text-sm">
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="inline-flex items-center gap-2 text-zinc-500">
                    <span className="flex size-6 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                      <Package className="size-3.5" aria-hidden />
                    </span>
                    {found.shop === 'locker' ? 'Status' : 'In stock'}
                  </dt>
                  <dd className="font-semibold text-zinc-950">
                    {found.shop === 'locker'
                      ? item.availability === 'reserved'
                        ? 'Reserved'
                        : item.availability === 'out'
                          ? 'Unavailable'
                          : 'Available'
                      : item.stock}
                  </dd>
                </div>
                {found.shop === 'merch' ? (
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <dt className="inline-flex items-center gap-2 text-zinc-500">
                      <span className="flex size-6 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                        <Tag className="size-3.5" aria-hidden />
                      </span>
                      Quantity
                    </dt>
                    <dd className="font-semibold text-zinc-950">{count}</dd>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="inline-flex items-center gap-2 text-zinc-500">
                    <span className="flex size-6 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                      <Wallet className="size-3.5" aria-hidden />
                    </span>
                    Total
                  </dt>
                  <dd className="font-semibold text-brand-700">{pesos(total)}</dd>
                </div>
              </dl>
            </div>
          </article>

          <form onSubmit={onSubmit} noValidate className="rounded-2xl bg-white p-4 shadow-[0_10px_28px_-18px_rgba(30,5,65,0.45)] sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="inline-flex items-center gap-2 text-base font-semibold text-zinc-950">
                  <span className="flex size-6 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                    <Bookmark className="size-3.5" aria-hidden />
                  </span>
                  Reservation details
                </h2>
                <p className="mt-1 text-sm text-zinc-500">The Council confirms this by email. No payment is taken here.</p>
              </div>
              {reserved ? (
                <div className="max-w-sm text-sm text-zinc-600">
                  <p>
                    Reservation ID{' '}
                    <span className="font-semibold tracking-wide text-brand-800">{reserved}</span>.{' '}
                    <Link to="/portal#tracking" className="font-semibold text-brand-700">
                      Track it
                    </Link>
                  </p>
                  {mailNotice ? (
                    <p className="mt-1.5 text-[13px] leading-5 text-zinc-500">{mailNotice}</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Full name" icon={CircleUser} htmlFor={`${formId}-name`} error={errors.name}>
                <input
                  id={`${formId}-name`}
                  value={name}
                  autoComplete="name"
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? `${formId}-name-error` : undefined}
                  onChange={(event) => {
                    setName(event.target.value)
                    setErrors((current) => ({ ...current, name: undefined }))
                  }}
                  placeholder="Full name"
                  className={fieldClass}
                />
              </Field>
              <Field label="Email" icon={Mail} htmlFor={`${formId}-email`} error={errors.email}>
                <input
                  id={`${formId}-email`}
                  type="email"
                  value={email}
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? `${formId}-email-error` : undefined}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setErrors((current) => ({ ...current, email: undefined }))
                  }}
                  placeholder="name@example.com"
                  className={fieldClass}
                />
              </Field>
              <Field label="Mobile number" icon={Phone} htmlFor={`${formId}-mobile`} error={errors.mobile}>
                <input
                  id={`${formId}-mobile`}
                  type="tel"
                  value={mobile}
                  autoComplete="tel"
                  inputMode="tel"
                  aria-invalid={Boolean(errors.mobile)}
                  aria-describedby={errors.mobile ? `${formId}-mobile-error` : undefined}
                  onChange={(event) => {
                    setMobile(event.target.value)
                    setErrors((current) => ({ ...current, mobile: undefined }))
                  }}
                  placeholder="09XX XXX XXXX"
                  className={fieldClass}
                />
              </Field>
              <Field label="Student ID" icon={IdCard} htmlFor={`${formId}-student-id`} error={errors.studentId}>
                <input
                  id={`${formId}-student-id`}
                  value={studentId}
                  autoComplete="off"
                  aria-invalid={Boolean(errors.studentId)}
                  aria-describedby={errors.studentId ? `${formId}-student-id-error` : undefined}
                  onChange={(event) => {
                    setStudentId(event.target.value)
                    setErrors((current) => ({ ...current, studentId: undefined }))
                  }}
                  placeholder="Student ID"
                  className={fieldClass}
                />
              </Field>
              <Field
                className={found.shop === 'locker' ? 'sm:col-span-2' : undefined}
                label="Year level"
                icon={GraduationCap}
                htmlFor={`${formId}-year`}
                labelId={`${formId}-year-label`}
                error={errors.year}
              >
                <YearMenu
                  id={`${formId}-year`}
                  value={year}
                  labelledBy={`${formId}-year-label`}
                  invalid={Boolean(errors.year)}
                  describedBy={errors.year ? `${formId}-year-error` : undefined}
                  onChange={(next) => {
                    setYear(next)
                    setErrors((current) => ({ ...current, year: undefined }))
                  }}
                />
              </Field>
              {found.shop === 'merch' ? (
                <Field label="Quantity" icon={Tag} labelId="quantity-label" required={false}>
                  <QuantityStepper
                    value={count}
                    max={Math.max(1, item.stock)}
                    onChange={(next) => setQuantity(String(next))}
                  />
                </Field>
              ) : null}
              <Field label="Remarks" icon={MessageSquare} htmlFor={`${formId}-remarks`} required={false} className="sm:col-span-2">
                <textarea
                  id={`${formId}-remarks`}
                  value={remarks}
                  rows={3}
                  onChange={(event) => setRemarks(event.target.value)}
                  placeholder={found.shop === 'locker' ? 'Pickup note or other details' : 'Size, pickup note, or other details'}
                  className="w-full min-w-0 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100"
                />
              </Field>
            </div>
            {errors.form ? <p className="mt-3 text-xs text-maroon-700">{errors.form}</p> : null}
            <div className="mt-4 flex flex-col gap-3 border-t border-zinc-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="inline-flex items-center gap-2 text-sm text-zinc-500">
                <span className="flex size-6 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                  <Wallet className="size-3.5" aria-hidden />
                </span>
                Total <span className="text-base font-semibold text-brand-700">{pesos(total)}</span>
              </p>
              <button
                type="submit"
                disabled={submitting || Boolean(item.availability)}
                aria-busy={submitting}
                className={cn(
                  'inline-flex h-10 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors sm:h-12 sm:w-auto',
                  item.availability
                    ? 'cursor-not-allowed bg-zinc-200 text-zinc-500'
                    : 'bg-brand-700 text-white hover:bg-brand-800 disabled:cursor-wait disabled:opacity-80',
                )}
              >
                {submitting ? <Loader2 className="size-4 animate-spin" strokeWidth={2.25} aria-hidden /> : null}
                {submitting ? 'Submitting…' : 'Submit reservation'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
