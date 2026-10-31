import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  Ban,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  CircleAlert,
  CircleUser,
  Copy,
  GraduationCap,
  IdCard,
  Loader2,
  LockKeyhole,
  Mail,
  MessageSquare,
  Minus,
  Phone,
  Plus,
  Shirt,
  Tag,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import {
  findShopItemAsync,
  lockerCodeFromItem,
  lockerFeeForType,
  lockerRenewalPrice,
  shopCatalogPath,
  type ShopLookup,
} from '@/components/portal/catalog'
import { reservationFromApi, saveReservation } from '@/components/portal/reservations'
import { siteName } from '@/components/layout/nav-data'
import {
  checkReservationDuplicate,
  createReservation,
  type ReservationRentalType,
} from '@/lib/reservations-api'
import { Snackbar, type SnackToast, type SnackVariant } from '@/components/ui/Snackbar'
import { cn } from '@/lib/utils'

const lockerTakenMessage = 'That locker already has an active reservation.'

function isLockerTakenError(message: string) {
  return /already has an active reservation/i.test(message)
}

function isServerError(message: string) {
  return /cannot reach the server|something went wrong|please try again/i.test(message)
}

const fieldClass =
  'h-10 w-full min-w-0 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100 aria-invalid:border-maroon-600 aria-invalid:focus:ring-maroon-100 sm:h-12 sm:px-3.5'

const successEase = [0.22, 1, 0.36, 1] as const

type FieldErrors = {
  name?: string
  email?: string
  mobile?: string
  studentId?: string
  year?: string
  form?: string
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
  const [rentalType, setRentalType] = useState<ReservationRentalType>('new')
  const [remarks, setRemarks] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [reserved, setReserved] = useState<string | null>(null)
  const [mailNotice, setMailNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [existingCode, setExistingCode] = useState<string | null>(null)
  const [snack, setSnack] = useState<SnackToast | null>(null)
  const reduceMotion = useReducedMotion()
  const submittingRef = useRef(false)
  const snackTimer = useRef<number | null>(null)
  const snackId = useRef(0)

  function dismissSnack() {
    if (snackTimer.current) window.clearTimeout(snackTimer.current)
    snackTimer.current = null
    setSnack(null)
  }

  function showSnackbar(message: string, variant: SnackVariant = 'error') {
    if (snackTimer.current) window.clearTimeout(snackTimer.current)
    const id = snackId.current + 1
    snackId.current = id
    setSnack({ id, message, variant })
    snackTimer.current = window.setTimeout(() => {
      setSnack((current) => (current?.id === id ? null : current))
      snackTimer.current = null
    }, message.length > 140 ? 10_000 : 5200)
  }

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

  useEffect(() => {
    if (found?.shop !== 'locker') return
    setRentalType(found.item.availability === 'reserved' ? 'renewal' : 'new')
  }, [found])

  useEffect(() => {
    return () => {
      if (snackTimer.current) window.clearTimeout(snackTimer.current)
    }
  }, [])

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
  const lockerRow = shop === 'locker' ? lockerCodeFromItem(item).charAt(0) || 'A' : ''
  const renewalFee = shop === 'locker' ? lockerRenewalPrice(lockerRow) : 0
  const unitPrice = shop === 'locker' ? lockerFeeForType(lockerRow, rentalType) : item.price
  const total = unitPrice * count
  const lockerHeld = shop === 'locker' && item.availability === 'reserved'
  const statusLabel =
    shop === 'locker'
      ? item.availability === 'reserved'
        ? 'Reserved'
        : item.availability === 'out'
          ? 'Unavailable'
          : 'Available'
      : `${item.stock} in stock`
  const blocked = Boolean(item.availability) && !reserved && !lockerHeld
  const lockerTaken = lockerHeld

  async function copyReservationId() {
    if (!reserved) return
    try {
      await navigator.clipboard.writeText(reserved)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  function resetForm() {
    setReserved(null)
    setMailNotice(null)
    setCopied(false)
    setExistingCode(null)
    setErrors({})
    submittingRef.current = false
    setSubmitting(false)
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return
    const next: FieldErrors = {}
    if (name.trim().length < 2) next.name = 'Enter your full name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email address.'
    const mobileDigits = mobile.replace(/\D/g, '')
    if (mobileDigits.length < 10 || mobileDigits.length > 13) next.mobile = 'Enter a valid mobile number.'
    if (!/^[A-Za-z0-9-]{4,20}$/.test(studentId.trim())) next.studentId = 'Enter a valid student ID.'
    if (!year) next.year = 'Select your year level.'
    if (shop === 'merch' && item.availability === 'reserved') next.form = 'This item is reserved.'
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
    submittingRef.current = true
    setSubmitting(true)
    setExistingCode(null)

    const numericId = Number.parseInt(item.id, 10)
    const shopItemId = Number.isFinite(numericId) && String(numericId) === item.id ? numericId : null
    const payload = {
      shop,
      shopItemId,
      itemKey: item.id,
      itemName: item.name,
      rentalType: shop === 'locker' ? rentalType : 'new',
      unitPrice,
      quantity: count,
      totalAmount: total,
      name: name.trim(),
      email: email.trim(),
      mobile: mobile.trim(),
      studentId: studentId.trim(),
      year,
      remarks: remarks.trim(),
      status: 'submitted' as const,
      public: true,
      source: 'portal' as const,
    }

    const existing = await checkReservationDuplicate(payload)
    if (!existing.ok) {
      submittingRef.current = false
      setSubmitting(false)
      showSnackbar(isLockerTakenError(existing.error) ? lockerTakenMessage : existing.error)
      return
    }
    if (existing.data.duplicate) {
      const message =
        existing.data.message ||
        'You already have an active reservation. Track it in the portal instead of submitting again.'
      submittingRef.current = false
      setSubmitting(false)
      if (isLockerTakenError(message) || isServerError(message)) {
        showSnackbar(isLockerTakenError(message) ? lockerTakenMessage : message)
        return
      }
      setExistingCode(existing.data.code?.trim() || null)
      setErrors({ form: message })
      return
    }

    const created = await createReservation(payload)

    if (!created.ok) {
      submittingRef.current = false
      setSubmitting(false)
      if (isLockerTakenError(created.error) || isServerError(created.error)) {
        showSnackbar(isLockerTakenError(created.error) ? lockerTakenMessage : created.error)
        return
      }
      const codeMatch = created.error.match(/\bRSV-[A-Z0-9]+\b/i)
      setExistingCode(codeMatch ? codeMatch[0].toUpperCase() : null)
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
    submittingRef.current = false
    setSubmitting(false)
  }

  return (
    <main id="main-content" className="bg-[#f4f5f7]">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <Link
          to={shopCatalogPath(found.shop)}
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-800"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {listing.title}
        </Link>

        <div
          className={cn(
            'mt-4 grid min-w-0 items-start gap-4',
            !reserved && 'lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]',
          )}
        >
          {reserved ? null : (
          <article className="order-2 overflow-hidden rounded-2xl bg-white shadow-[0_10px_28px_-18px_rgba(30,5,65,0.45)]">
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
            <div className="px-5 py-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                    {listing.kicker}
                  </p>
                  <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-950">
                    {item.number ?? item.name}
                  </h1>
                </div>
                <span
                  className={cn(
                    'mt-0.5 inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold',
                    item.availability === 'reserved'
                      ? 'bg-zinc-100 text-zinc-700'
                      : item.availability === 'out'
                        ? 'bg-maroon-50 text-maroon-700'
                        : 'bg-emerald-50 text-emerald-800',
                  )}
                >
                  {statusLabel}
                </span>
              </div>

              {shop === 'locker' ? (
                <div className="mt-5 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Rental type">
                  {(
                    [
                      { value: 'new' as const, label: 'New rental', fee: item.price },
                      { value: 'renewal' as const, label: 'Renewal', fee: renewalFee },
                    ] as const
                  ).map((option) => {
                    const selected = rentalType === option.value
                    const locked = lockerHeld && option.value === 'new'
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={locked}
                        onClick={() => setRentalType(option.value)}
                        className={cn(
                          'rounded-xl px-3 py-3 text-left transition-colors',
                          selected
                            ? 'bg-brand-50 ring-2 ring-brand-500/30'
                            : 'bg-zinc-50 hover:bg-zinc-100',
                          locked && 'cursor-not-allowed opacity-45 hover:bg-zinc-50',
                        )}
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                          {option.label}
                        </p>
                        <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-950">
                          {pesos(option.fee)}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-4 text-zinc-500">{item.unit}</p>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="mt-5">
                  <p className="text-2xl font-semibold tabular-nums tracking-tight text-zinc-950">
                    {pesos(item.price)}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">{item.unit}</p>
                </div>
              )}

              <dl className="mt-5 space-y-2.5 border-t border-zinc-100 pt-4 text-sm">
                {shop === 'merch' ? (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-zinc-500">Quantity</dt>
                    <dd className="font-semibold tabular-nums text-zinc-950">{count}</dd>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-zinc-500">{shop === 'locker' ? 'Due now' : 'Total'}</dt>
                  <dd className="text-base font-semibold tabular-nums text-brand-700">{pesos(total)}</dd>
                </div>
              </dl>
            </div>
          </article>
          )}

          <div
            className={cn(
              'relative order-1 min-w-0 rounded-2xl bg-white shadow-[0_10px_28px_-18px_rgba(30,5,65,0.45)]',
              reserved && 'overflow-x-hidden sm:min-h-[32rem]',
              blocked && 'lg:min-h-[32rem]',
              !reserved && !blocked && 'min-h-[28rem] sm:min-h-[32rem]',
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              {reserved ? (
                <motion.div
                  key="success"
                  role="status"
                  initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
                  transition={{ duration: 0.45, ease: successEase }}
                  className="flex h-full w-full min-w-0 flex-col items-center justify-center px-5 py-8 text-center sm:min-h-[32rem] sm:px-8 sm:py-10"
                >
                  <motion.span
                    initial={reduceMotion ? false : { scale: 0.55, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, ease: successEase, delay: reduceMotion ? 0 : 0.06 }}
                    className="grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-700"
                  >
                    <CheckCircle2 className="size-7" aria-hidden />
                  </motion.span>
                  <motion.h2
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: successEase, delay: reduceMotion ? 0 : 0.14 }}
                    className="mt-4 text-lg font-semibold text-zinc-950"
                  >
                    {shop === 'locker' && rentalType === 'renewal'
                      ? 'Renewal received'
                      : 'Reservation received'}
                  </motion.h2>
                  <motion.p
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.42, ease: successEase, delay: reduceMotion ? 0 : 0.22 }}
                    className="mt-2 max-w-sm text-sm leading-6 text-zinc-500"
                  >
                    {shop === 'locker' && rentalType === 'renewal'
                      ? 'Thank you. The Council has your locker renewal on file and will confirm by email. Keep your reservation ID.'
                      : 'Thank you. The Council has this on file and will confirm by email. Keep your reservation ID.'}
                  </motion.p>
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: successEase, delay: reduceMotion ? 0 : 0.28 }}
                    className="mt-5 w-full min-w-0 max-w-sm"
                  >
                    <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-400 uppercase">
                      Reservation ID
                    </p>
                    <button
                      type="button"
                      onClick={() => void copyReservationId()}
                      className="mt-1.5 inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-brand-100 bg-brand-50 px-3 py-2.5 text-sm font-semibold tracking-wide text-brand-800 transition-colors hover:bg-brand-100"
                    >
                      <span className="min-w-0 break-all font-mono">{reserved}</span>
                      {copied ? (
                        <Check className="size-3.5" aria-hidden />
                      ) : (
                        <Copy className="size-3.5" aria-hidden />
                      )}
                      <span className="sr-only">{copied ? 'Copied' : 'Copy reservation ID'}</span>
                    </button>
                    {mailNotice ? (
                      <p className="mt-3 text-sm leading-5 text-zinc-500">{mailNotice}</p>
                    ) : null}
                  </motion.div>
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: successEase, delay: reduceMotion ? 0 : 0.36 }}
                    className="mt-6 flex w-full min-w-0 flex-col gap-3"
                  >
                    <Link
                      to="/portal#tracking"
                      className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand-700 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                    >
                      Track reservation
                    </Link>
                    {shop === 'merch' ? (
                      <button
                        type="button"
                        className="inline-flex h-12 w-full items-center justify-center rounded-full border border-zinc-200 bg-white px-5 text-[15px] font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                        onClick={resetForm}
                      >
                        Reserve another
                      </button>
                    ) : (
                      <Link
                        to={shopCatalogPath(shop)}
                        className="inline-flex h-12 w-full items-center justify-center rounded-full border border-zinc-200 bg-white px-5 text-[15px] font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                      >
                        Back to lockers
                      </Link>
                    )}
                  </motion.div>
                </motion.div>
              ) : blocked ? (
                <motion.div
                  key="unavailable"
                  role="status"
                  initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
                  transition={{ duration: 0.45, ease: successEase }}
                  className="flex h-full w-full min-w-0 flex-col items-center justify-center px-5 py-8 text-center lg:min-h-[32rem] sm:px-8 sm:py-10"
                >
                  <span className="grid size-14 place-items-center rounded-full bg-zinc-100 text-zinc-700">
                    {item.availability === 'out' ? (
                      <Ban className="size-7" aria-hidden />
                    ) : (
                      <Bookmark className="size-7" aria-hidden />
                    )}
                  </span>
                  <h2 className="mt-4 text-lg font-semibold text-zinc-950">
                    {shop === 'locker'
                      ? item.availability === 'out'
                        ? 'This locker is unavailable'
                        : 'This locker is reserved'
                      : item.availability === 'out'
                        ? 'This item is out of stock'
                        : 'This item is reserved'}
                  </h2>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                    {lockerTaken
                      ? lockerTakenMessage
                      : shop === 'locker'
                        ? 'This locker cannot be reserved right now. Choose another from the catalog.'
                        : item.availability === 'out'
                          ? 'This item is out of stock. Choose another from the catalog.'
                          : 'This item already has an active reservation.'}
                  </p>
                  <Link
                    to={shopCatalogPath(shop)}
                    className="mt-6 inline-flex h-12 w-full max-w-sm items-center justify-center rounded-full bg-brand-700 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  >
                    {shop === 'locker' ? 'Back to lockers' : 'Back to merch'}
                  </Link>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  onSubmit={(event) => void onSubmit(event)}
                  noValidate
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
                  transition={{ duration: 0.38, ease: successEase }}
                  className="h-full p-4 sm:p-6"
                >
            <div>
                <h2 className="inline-flex items-center gap-2 text-base font-semibold text-zinc-950">
                  <span className="flex size-6 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                    <Bookmark className="size-3.5" aria-hidden />
                  </span>
                  Reservation details
                </h2>
                <p className="mt-1 text-sm text-zinc-500">The Council confirms this by email. No payment is taken here.</p>
            </div>

            {shop === 'locker' ? (
              <div className="mt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  Transaction
                </p>
                <div
                  role="radiogroup"
                  aria-label="Rental type"
                  className="mt-2 grid grid-cols-2 gap-2"
                >
                  {(
                    [
                      { value: 'new' as const, label: 'New rental' },
                      { value: 'renewal' as const, label: 'Renewal' },
                    ] as const
                  ).map((option) => {
                    const selected = rentalType === option.value
                    const locked = lockerHeld && option.value === 'new'
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={locked}
                        onClick={() => setRentalType(option.value)}
                        className={cn(
                          'inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors',
                          selected
                            ? 'bg-brand-700 text-white'
                            : 'border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100',
                          locked && 'cursor-not-allowed opacity-45 hover:bg-zinc-50',
                        )}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
                {lockerHeld ? (
                  <p className="mt-2 text-sm leading-5 text-zinc-500">
                    This locker is reserved. Submit a renewal with the same email or student ID used before.
                  </p>
                ) : rentalType === 'renewal' ? (
                  <p className="mt-2 text-sm leading-5 text-zinc-500">
                    Renewal is for students who already hold this locker. The renewal fee applies.
                  </p>
                ) : null}
              </div>
            ) : null}

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
                    setExistingCode(null)
                    setErrors((current) => ({ ...current, email: undefined, form: undefined }))
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
                    setExistingCode(null)
                    setErrors((current) => ({ ...current, studentId: undefined, form: undefined }))
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
            <div className="mt-4 border-t border-zinc-100 pt-4">
              <AnimatePresence initial={false}>
                {errors.form ? (
                  <motion.div
                    key="submit-error"
                    role="alert"
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                    transition={{ duration: 0.28, ease: successEase }}
                    className="mb-3 flex items-start gap-2.5 rounded-xl border border-maroon-200 bg-maroon-50 px-3.5 py-3 text-sm leading-5 text-maroon-800"
                  >
                    <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <div className="min-w-0">
                      <p>{errors.form}</p>
                      {existingCode ? (
                        <Link
                          to="/portal#tracking"
                          className="mt-1.5 inline-flex font-semibold text-maroon-900 underline-offset-2 hover:underline"
                        >
                          Track {existingCode}
                        </Link>
                      ) : null}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="inline-flex items-center gap-2 text-sm text-zinc-500">
                <span className="flex size-6 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                  <Wallet className="size-3.5" aria-hidden />
                </span>
                Total <span className="text-base font-semibold text-brand-700">{pesos(total)}</span>
              </p>
              <button
                type="submit"
                disabled={submitting || item.availability === 'out'}
                aria-busy={submitting}
                className={cn(
                  'inline-flex h-10 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors sm:h-12 sm:w-auto',
                  item.availability === 'out'
                    ? 'cursor-not-allowed bg-zinc-200 text-zinc-500'
                    : 'bg-brand-700 text-white hover:bg-brand-800 disabled:cursor-wait disabled:opacity-80',
                )}
              >
                {submitting ? <Loader2 className="size-4 animate-spin" strokeWidth={2.25} aria-hidden /> : null}
                {submitting
                  ? 'Submitting…'
                  : shop === 'locker' && rentalType === 'renewal'
                    ? 'Submit renewal'
                    : 'Submit reservation'}
              </button>
              </div>
            </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <Snackbar toast={snack} onDismiss={dismissSnack} />
    </main>
  )
}
