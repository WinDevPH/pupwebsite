import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronsRight, Clock, Eye, EyeOff, Loader2, Lock, Mail, X } from 'lucide-react'
import logo from '@/assets/pup-col-sc-logo.png'
import { Button } from '@/components/ui/button'
import { Snackbar, type SnackToast, type SnackVariant } from '@/components/ui/Snackbar'
import { siteName } from '@/components/layout/nav-data'
import { setPageScrollLocked } from '@/hooks/useLenis'
import { isManagerRole, loginRequest, writeStoredAuthUser } from '@/lib/auth-api'
import { cn } from '@/lib/utils'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function formatCountdown(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function useSheetDrag(onClose: () => void) {
  const [ty, setTy] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startY = useRef(0)
  const lastY = useRef(0)
  const active = useRef(false)

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    active.current = true
    startY.current = event.clientY
    lastY.current = 0
    setDragging(true)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!active.current) return
    const dy = Math.max(0, event.clientY - startY.current)
    lastY.current = dy
    setTy(dy)
  }

  function finish() {
    if (!active.current) return
    active.current = false
    setDragging(false)
    if (lastY.current > 88) {
      setTy(window.innerHeight)
      window.setTimeout(onClose, 160)
      return
    }
    setTy(0)
  }

  return {
    dragging,
    sheetStyle: {
      transform: ty ? `translateY(${ty}px)` : undefined,
      transition: dragging ? 'none' : 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
    },
    overlayStyle: {
      opacity: ty ? Math.max(0.25, 1 - ty / 380) : undefined,
    },
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
    },
  }
}

function lockProgress(seconds: number, total: number) {
  return total > 0 ? Math.min(1, Math.max(0, seconds / total)) : 0
}

function isMobileViewport() {
  return window.matchMedia('(max-width: 639px)').matches
}

function LockoutCountdown({ seconds, total }: { seconds: number; total: number }) {
  const progress = lockProgress(seconds, total)
  return (
    <div className="mx-auto flex w-full max-w-[17.5rem] flex-col items-center text-center">
      <p className="text-[13px] leading-5 text-zinc-500">
        You can try signing in again when this timer ends.
      </p>
      <p
        className="mt-5 inline-flex items-center gap-2 font-hero text-[2.75rem] leading-none tracking-tight tabular-nums text-brand-950"
        aria-live="polite"
        aria-atomic="true"
      >
        <Clock className="size-5 shrink-0 text-brand-600" aria-hidden />
        {formatCountdown(seconds)}
      </p>
      <p className="mt-2 text-[11px] tracking-wide text-zinc-400">time remaining</p>
      <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100" aria-hidden>
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-1000 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  )
}

/** Mobile-only bottom sheet. Desktop uses the inline banner. */
function LockoutDialog({
  open,
  seconds,
  total,
  onClose,
}: {
  open: boolean
  seconds: number
  total: number
  onClose: () => void
}) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const { dragging, sheetStyle, overlayStyle, handleProps } = useSheetDrag(onClose)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setPageScrollLocked(true)
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    function onResize() {
      if (!isMobileViewport()) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      document.body.style.overflow = previous
      setPageScrollLocked(false)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-brand-950/45"
        style={overlayStyle}
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-lenis-prevent
        style={sheetStyle}
        className={cn(
          'relative flex max-h-[min(78dvh,100dvh-env(safe-area-inset-bottom))] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_24px_60px_-28px_rgba(30,5,65,0.55)] outline-none',
          dragging ? '' : 'sheet-up',
        )}
      >
        <div
          className="flex cursor-grab touch-none justify-center pt-2.5 pb-2 select-none active:cursor-grabbing"
          role="button"
          tabIndex={0}
          aria-label="Drag down to close"
          {...handleProps}
        >
          <span className="block h-1.5 w-12 rounded-full bg-zinc-300" />
        </div>

        <div className="flex shrink-0 items-center gap-3 border-b border-zinc-100 px-4 pt-1 pb-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Lock className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[15px] font-semibold text-brand-950">
              Sign-in locked
            </h2>
            <p className="text-xs leading-5 text-zinc-500">Protection after too many tries</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-brand-950"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="flex flex-col px-4 pt-5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <LockoutCountdown seconds={seconds} total={total} />
          <div className="mt-6 space-y-2.5">
            <Button type="button" size="lg" onClick={onClose} className="h-11 w-full rounded-xl">
              Got it
            </Button>
            <Link
              to="/login/forgot"
              onClick={onClose}
              className="block py-1 text-center text-sm font-semibold text-brand-700 transition-colors hover:text-brand-600"
            >
              Forgot password?
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function Login() {
  const navigate = useNavigate()
  const formId = useId()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [lockSeconds, setLockSeconds] = useState(0)
  const [lockTotal, setLockTotal] = useState(0)
  const [lockDialogOpen, setLockDialogOpen] = useState(false)
  const [snack, setSnack] = useState<SnackToast | null>(null)
  const snackTimer = useRef<number | null>(null)
  const snackId = useRef(0)

  const locked = lockSeconds > 0

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
    const previous = document.title
    document.title = `Login · ${siteName.short} ${siteName.unit}`
    return () => {
      document.title = previous
      if (snackTimer.current) window.clearTimeout(snackTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!locked) {
      setLockDialogOpen(false)
      setLockTotal(0)
      return
    }
    const timer = window.setInterval(() => {
      setLockSeconds((current) => Math.max(0, current - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [locked])

  function validate() {
    const next: { email?: string; password?: string } = {}
    if (!email.trim()) next.email = 'Enter your email address.'
    else if (!emailPattern.test(email.trim())) next.email = 'Enter a valid email address.'
    if (!password) next.password = 'Enter your password.'
    setErrors(next)
    return !next.email && !next.password
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (locked) {
      if (isMobileViewport()) setLockDialogOpen(true)
      return
    }
    if (submitting || !validate()) return
    setSubmitting(true)

    const result = await loginRequest({
      email: email.trim(),
      password,
      remember,
    })

    setSubmitting(false)

    if (!result.ok) {
      if (result.locked && result.retryAfter) {
        setLockSeconds(result.retryAfter)
        setLockTotal(result.retryAfter)
        if (isMobileViewport()) setLockDialogOpen(true)
        dismissSnack()
        return
      }

      const remaining = typeof result.remaining === 'number' ? result.remaining : null
      const triesNote =
        remaining === null
          ? ''
          : remaining === 1
            ? ' 1 try left.'
            : remaining > 0
              ? ` ${remaining} tries left.`
              : ''
      showSnackbar(`${result.error}${triesNote}`, 'error')
      return
    }

    writeStoredAuthUser(result.data.user)

    if (!isManagerRole(result.data.user.role)) {
      showSnackbar('This account cannot access the admin portal. Use an admin or officer account.', 'error')
      return
    }

    const nextRaw = searchParams.get('next')
    const next =
      nextRaw && nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/admin'

    showSnackbar(`Welcome, ${result.data.user.fullName}.`, 'success')
    window.setTimeout(() => {
      navigate(next, { replace: true })
    }, 700)
  }

  const lockProgressValue = lockProgress(lockSeconds, lockTotal || lockSeconds)

  return (
    <main
      id="main-content"
      className="relative isolate flex min-h-[calc(100dvh-8.5rem)] items-center justify-center bg-white px-4 py-10 sm:px-6 dark:bg-zinc-950"
    >
      <div aria-hidden className="auth-wash pointer-events-none absolute inset-0" />

      <div className="relative w-full max-w-md">
        <div className="auth-card relative rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-[0_24px_60px_-36px_rgba(30,5,65,0.45)] sm:p-8 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/50">
          <div className="flex flex-col items-center text-center">
            <Link to="/" aria-label={`${siteName.short} ${siteName.unit}, home`}>
              <img
                src={logo}
                alt=""
                width={56}
                height={56}
                className="size-14 rounded-full object-contain ring-2 ring-gold-400"
              />
            </Link>
            <h1 className="mt-5 font-hero text-[clamp(1.85rem,1.3rem+1.4vw,2.5rem)] leading-[0.95] font-normal tracking-tight text-brand-950 dark:text-zinc-50">
              Login to <span className="text-brand-600 dark:text-brand-400">Portal</span>
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              Sign in with your student email and password.
            </p>
            {locked ? (
              <button
                type="button"
                onClick={() => {
                  if (isMobileViewport()) setLockDialogOpen(true)
                }}
                className="mt-4 flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-left transition-colors hover:bg-zinc-100 sm:cursor-default sm:hover:bg-zinc-50"
                role="status"
                aria-live="polite"
                aria-atomic="true"
                aria-label={`Sign-in locked. Try again in ${formatCountdown(lockSeconds)}.`}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Lock className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-brand-950">Sign-in locked</p>
                  <div className="mt-1 h-1 w-full max-w-[9rem] overflow-hidden rounded-full bg-zinc-200/80" aria-hidden>
                    <div
                      className="h-full rounded-full bg-brand-600 transition-[width] duration-1000 ease-linear"
                      style={{ width: `${lockProgressValue * 100}%` }}
                    />
                  </div>
                </div>
                <p className="inline-flex shrink-0 items-center gap-1 text-sm font-medium tabular-nums text-brand-950">
                  <Clock className="size-3.5 text-brand-600" aria-hidden />
                  {formatCountdown(lockSeconds)}
                </p>
              </button>
            ) : null}
          </div>

          <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4" aria-busy={locked || undefined}>
          <div>
            <label htmlFor={`${formId}-email`} className="block text-sm font-medium text-brand-950">
              Email
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-zinc-400">
                <Mail className="size-4" aria-hidden />
              </span>
              <input
                id={`${formId}-email`}
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                placeholder="you@email.com"
                disabled={locked || submitting}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? `${formId}-email-error` : undefined}
                onChange={(event) => {
                  setEmail(event.target.value)
                  if (errors.email) setErrors((current) => ({ ...current, email: undefined }))
                }}
                className={cn(
                  'auth-input h-12 w-full rounded-xl border bg-white pr-4 pl-11 text-sm text-brand-950 outline-none transition-colors placeholder:text-zinc-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60',
                  errors.email ? 'border-maroon-600' : 'border-zinc-200',
                )}
              />
            </div>
            {errors.email ? (
              <p id={`${formId}-email-error`} className="mt-1.5 text-xs leading-5 text-maroon-700">
                {errors.email}
              </p>
            ) : null}
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor={`${formId}-password`}
                className="block text-sm font-medium text-brand-950"
              >
                Password
              </label>
              <Link
                to="/login/forgot"
                className="text-xs font-semibold text-brand-700 transition-colors hover:text-brand-600"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-zinc-400">
                <Lock className="size-4" aria-hidden />
              </span>
              <input
                id={`${formId}-password`}
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                placeholder="Enter your password"
                disabled={locked || submitting}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? `${formId}-password-error` : undefined}
                onChange={(event) => {
                  setPassword(event.target.value)
                  if (errors.password) setErrors((current) => ({ ...current, password: undefined }))
                }}
                className={cn(
                  'auth-input h-12 w-full rounded-xl border bg-white pr-12 pl-11 text-sm text-brand-950 outline-none transition-colors placeholder:text-zinc-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60',
                  errors.password ? 'border-maroon-600' : 'border-zinc-200',
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                disabled={locked || submitting}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-zinc-400 transition-colors hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            </div>
            {errors.password ? (
              <p id={`${formId}-password-error`} className="mt-1.5 text-xs leading-5 text-maroon-700">
                {errors.password}
              </p>
            ) : null}
          </div>

          <label className="flex items-center gap-2.5 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={remember}
              disabled={locked || submitting}
              onChange={(event) => setRemember(event.target.checked)}
              className="size-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500 disabled:cursor-not-allowed"
            />
            Keep me signed in on this device
          </label>

          <Button
            type="submit"
            size="lg"
            disabled={submitting || locked}
            aria-busy={submitting}
            className="h-12 w-full rounded-xl px-6 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2.25} aria-hidden />
            ) : null}
            {submitting ? 'Signing in…' : 'Login to Portal'}
            {submitting ? null : <ChevronsRight className="size-4" aria-hidden />}
          </Button>
          </form>
        </div>
      </div>

      <LockoutDialog
        open={lockDialogOpen && locked}
        seconds={lockSeconds}
        total={lockTotal || lockSeconds}
        onClose={() => setLockDialogOpen(false)}
      />
      <Snackbar toast={snack} onDismiss={dismissSnack} />
    </main>
  )
}
