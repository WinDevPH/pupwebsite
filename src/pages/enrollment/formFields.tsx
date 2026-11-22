import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type FieldTone = 'idle' | 'error' | 'ok' | 'warn'

export const enrollmentFieldClass =
  'h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-brand-950 outline-none transition placeholder:text-zinc-400 focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500'

export function fieldToneClass(tone: FieldTone) {
  if (tone === 'error') {
    return 'border-rose-400 focus:border-rose-500 focus:ring-rose-100 dark:border-rose-500/60 dark:focus:border-rose-400 dark:focus:ring-rose-500/20'
  }
  if (tone === 'ok') {
    return 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-100 dark:border-emerald-500/50 dark:focus:border-emerald-400 dark:focus:ring-emerald-500/20'
  }
  if (tone === 'warn') {
    return 'border-amber-400 focus:border-amber-500 focus:ring-amber-100 dark:border-amber-500/50 dark:focus:border-amber-400 dark:focus:ring-amber-500/20'
  }
  return 'border-zinc-200 focus:border-brand-400 focus:ring-brand-100 dark:border-zinc-700 dark:focus:border-brand-400 dark:focus:ring-brand-500/25'
}

export function FieldHint({
  tone,
  children,
}: {
  tone: Exclude<FieldTone, 'idle'>
  children: ReactNode
}) {
  const Icon = tone === 'ok' ? CheckCircle2 : AlertCircle
  return (
    <p
      className={cn(
        'mt-1.5 inline-flex items-start gap-1.5 text-[11px] leading-4',
        tone === 'error' && 'text-rose-600 dark:text-rose-300',
        tone === 'ok' && 'text-emerald-700 dark:text-emerald-300',
        tone === 'warn' && 'text-amber-700 dark:text-amber-300',
      )}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

export function validateStudentName(value: string): { tone: FieldTone; message: string } {
  const trimmed = value.trim()
  if (!trimmed) {
    return { tone: 'error', message: 'Full name is required.' }
  }
  if (trimmed.length < 3) {
    return { tone: 'error', message: 'Enter at least 3 characters.' }
  }
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(trimmed)) {
    return { tone: 'error', message: 'Name must include letters.' }
  }
  if (!trimmed.includes(',') && trimmed.split(/\s+/).length < 2) {
    return { tone: 'warn', message: 'Tip: use LASTNAME, FIRSTNAME M.I.' }
  }
  return { tone: 'ok', message: 'Name looks good.' }
}

export function validateStudentNumber(value: string): { tone: FieldTone; message: string } {
  const trimmed = value.trim().toUpperCase()
  if (!trimmed) {
    return { tone: 'error', message: 'Student number is required.' }
  }
  if (trimmed.length < 6) {
    return { tone: 'error', message: 'Student number is too short.' }
  }
  if (!/^[0-9A-Z][0-9A-Z\-]*[0-9A-Z]$/.test(trimmed)) {
    return { tone: 'error', message: 'Use letters, numbers, and dashes only.' }
  }
  if (!/\d{4}/.test(trimmed)) {
    return { tone: 'warn', message: 'Usually starts with a year like 2024-…' }
  }
  return { tone: 'ok', message: 'Student number looks valid.' }
}

export function validatePaymentMode(
  value: string,
  feeLabel?: string,
): { tone: FieldTone; message: string } {
  if (!value) {
    return {
      tone: 'error',
      message: feeLabel
        ? `Select how you paid the SC Contribution (${feeLabel}).`
        : 'Select how you paid the SC Contribution.',
    }
  }
  return { tone: 'ok', message: 'Payment mode selected.' }
}

export function validateReferenceNo(value: string): { tone: FieldTone; message: string } {
  const trimmed = value.trim()
  if (!trimmed) {
    return { tone: 'error', message: 'Reference / receipt number is required.' }
  }
  if (trimmed.length < 4) {
    return { tone: 'error', message: 'Enter at least 4 characters.' }
  }
  if (!/[0-9A-Za-z]/.test(trimmed)) {
    return { tone: 'error', message: 'Include letters or numbers from your receipt.' }
  }
  return { tone: 'ok', message: 'Reference number ready.' }
}

export function validateProof(hasProof: boolean): { tone: FieldTone; message: string } {
  if (!hasProof) {
    return { tone: 'error', message: 'Attach a payment proof image.' }
  }
  return { tone: 'ok', message: 'Proof attached.' }
}

export function visibleFieldState(
  result: { tone: FieldTone; message: string },
  opts: { touched: boolean; showAll: boolean; showOk?: boolean },
) {
  if (!opts.touched && !opts.showAll) {
    return { tone: 'idle' as const, message: '' }
  }
  if (result.tone === 'ok' && !opts.showOk) {
    return { tone: 'idle' as const, message: '' }
  }
  return result
}
