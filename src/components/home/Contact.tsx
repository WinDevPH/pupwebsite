import { useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { ArrowUpRight, CircleAlert, Clock, Ellipsis, Lightbulb, Loader2, Mail, MapPin, MessageSquare, Send, ThumbsUp, User, type LucideIcon } from 'lucide-react'
import { Reveal } from '@/components/motion/Reveal'
import { SectionKicker } from '@/components/ui/SectionKicker'
import { Button } from '@/components/ui/button'
import { useSiteContact } from '@/hooks/useSiteContact'
import type { SiteContact } from '@/lib/site-settings-api'
import { cn } from '@/lib/utils'

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-sm text-brand-950 outline-none placeholder:text-zinc-400 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 aria-invalid:border-maroon-600 aria-invalid:focus:border-maroon-600 aria-invalid:focus:ring-maroon-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-400 dark:focus:bg-zinc-900 dark:focus:ring-brand-500/25'

type FeedbackField = 'name' | 'email' | 'about' | 'message'
type FeedbackErrors = Partial<Record<FeedbackField, string>>

const fieldOrder: FeedbackField[] = ['name', 'email', 'about', 'message']

const feedbackKinds = [
  { id: 'suggestion', label: 'Suggestion', icon: Lightbulb },
  { id: 'concern', label: 'Concern', icon: CircleAlert },
  { id: 'compliment', label: 'Compliment', icon: ThumbsUp },
  { id: 'other', label: 'Something else', icon: Ellipsis },
] as const

function validateName(value: string) {
  const name = value.trim()
  if (name.length < 2) return 'Enter your name.'
  if (name.length > 80) return 'Keep your name under 80 characters.'
  if (!/^[\p{L}][\p{L} .'-]*$/u.test(name)) return 'Use letters in your name.'
  return ''
}

function validateEmail(value: string) {
  const email = value.trim()
  if (!email) return 'Enter your email.'
  if (
    email.length > 254 ||
    !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/.test(email)
  ) {
    return 'Enter a valid email so the Council can reply.'
  }
  return ''
}

function validateAbout(value: string) {
  if (feedbackKinds.some((kind) => kind.id === value)) return ''
  return 'Choose what this feedback is about.'
}

function validateMessage(value: string) {
  const message = value.trim()
  if (message.length < 10) return 'Write a little more so the Council can read your feedback.'
  if (message.length > 1500) return 'Keep the feedback under 1,500 characters.'
  return ''
}

const validators: Record<FeedbackField, (value: string) => string> = {
  name: validateName,
  email: validateEmail,
  about: validateAbout,
  message: validateMessage,
}

export function ContactSection() {
  const location = useLocation()
  const contact = useSiteContact()

  useLayoutEffect(() => {
    if (location.hash !== '#contact') return
    const section = document.getElementById('contact')
    const scroller = document.querySelector('.app-scroll')
    if (!section || !(scroller instanceof HTMLElement)) return
    const top =
      section.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      112
    scroller.scrollTop = Math.max(0, top)
  }, [location.hash, location.pathname])

  return (
    <section
      id="contact"
      aria-labelledby="contact-title"
      className="scroll-mt-28 bg-white dark:bg-zinc-950"
    >
      <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+3vw,5rem)] sm:px-6 lg:px-8">
        <Reveal>
          <header className="mx-auto max-w-3xl text-center">
            <SectionKicker icon={Mail}>Contact</SectionKicker>
            <h2
              id="contact-title"
              className="mt-[clamp(0.85rem,0.5rem+1vw,1.25rem)] font-hero text-[clamp(1.85rem,0.9rem+3vw,3.75rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950"
            >
              Contact and <span className="text-brand-600">Helpdesk</span>
            </h2>
            <p className="mx-auto mt-[clamp(0.75rem,0.4rem+1vw,1.15rem)] max-w-lg text-[clamp(0.875rem,0.82rem+0.2vw,0.95rem)] leading-relaxed text-zinc-500">
              Reach the Council directly. Office details and a feedback form are on this page.
            </p>
          </header>
        </Reveal>

        <div className="mt-[clamp(1.5rem,1rem+1.5vw,2.25rem)] grid items-stretch gap-4 lg:grid-cols-2">
          <HelpdeskCard contact={contact} />
          <FeedbackForm contact={contact} />
        </div>
      </div>
    </section>
  )
}

function HelpdeskCard({ contact }: { contact: SiteContact }) {
  const facebook = contact.socials.find((item) => item.name === 'Facebook')

  return (
    <div className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-brand-700 uppercase">Helpdesk</p>
        <p className="mt-2 font-display text-[clamp(1.35rem,0.95rem+1.15vw,1.85rem)] leading-tight text-balance text-brand-950">
          Reach the Council office.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3.5 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
          <Clock className="size-4" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">
            Office hours
          </span>
          <span className="mt-0.5 block text-sm leading-5 font-semibold text-brand-950">{contact.hours}</span>
        </span>
      </div>

      <div className="rounded-xl bg-zinc-50 px-4 py-4">
        <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-brand-700 uppercase">
          <MapPin className="size-3.5" aria-hidden />
          Campus office
        </p>
        <p className="mt-2 text-sm leading-6 text-brand-950">{contact.address}</p>
        <p className="mt-3 border-t border-zinc-200 pt-3 text-xs leading-5 text-zinc-500">
          {contact.secRegistration}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <HelpdeskLink href={`mailto:${contact.email}`} icon={Mail} label="Official email" value={contact.email} />
        {facebook ? (
          <HelpdeskLink
            href={facebook.href}
            external
            icon={FacebookMark}
            label="Official Facebook page"
            value={facebook.handle}
          />
        ) : null}
      </div>
    </div>
  )
}

function DetailValue({ value }: { value: string }) {
  const at = value.indexOf('@')
  if (at < 1 || value.includes(' ')) return value
  return (
    <>
      {value.slice(0, at + 1)}
      <wbr />
      {value.slice(at + 1)}
    </>
  )
}

function HelpdeskLink({
  href,
  external,
  icon: Icon,
  label,
  value,
}: {
  href: string
  external?: boolean
  icon: LucideIcon | typeof FacebookMark
  label: string
  value: string
}) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className="group flex items-center gap-3 rounded-xl border border-zinc-200 px-3.5 py-3 transition-colors hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">
          {label}
        </span>
        <span className="mt-0.5 block text-sm leading-5 break-words text-brand-950">
          <DetailValue value={value} />
        </span>
      </span>
      {external ? <ArrowUpRight className="size-4 shrink-0 text-zinc-400" aria-hidden /> : null}
    </a>
  )
}

function FeedbackForm({ contact }: { contact: SiteContact }) {
  const formId = useId()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [about, setAbout] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<FeedbackErrors>({})
  const [sending, setSending] = useState(false)
  const sendingRef = useRef(false)
  const attempted = useRef(false)
  const values: Record<FeedbackField, string> = { name, email, about, message }
  const valuesRef = useRef(values)
  valuesRef.current = values

  function check(field: FeedbackField, value: string) {
    return validators[field](value)
  }

  function showField(field: FeedbackField, value: string) {
    const messageText = check(field, value)
    setErrors((current) => {
      if (!messageText && !current[field]) return current
      if (current[field] === messageText) return current
      return { ...current, [field]: messageText || undefined }
    })
  }

  function onField(field: FeedbackField, value: string) {
    valuesRef.current = { ...valuesRef.current, [field]: value }
    if (field === 'name') setName(value)
    if (field === 'email') setEmail(value)
    if (field === 'about') setAbout(value)
    if (field === 'message') setMessage(value)
    if (attempted.current || errors[field]) showField(field, value)
  }

  function onBlur(field: FeedbackField) {
    const value = valuesRef.current[field]
    if (!attempted.current && !value.trim()) return
    showField(field, value)
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sendingRef.current) return
    attempted.current = true
    const current = valuesRef.current
    const next: FeedbackErrors = {}
    for (const field of fieldOrder) {
      const messageText = check(field, current[field])
      if (messageText) next[field] = messageText
    }
    setErrors(next)
    const first = fieldOrder.find((field) => next[field])
    if (first) {
      document.getElementById(`${formId}-${first}`)?.focus()
      return
    }
    const kind = feedbackKinds.find((item) => item.id === current.about)
    sendingRef.current = true
    setSending(true)
    const body = `Name: ${current.name.trim()}\nEmail: ${current.email.trim()}\nAbout: ${kind?.label ?? ''}\n\n${current.message.trim()}`
    const href = `mailto:${contact.email}?subject=${encodeURIComponent(`Feedback: ${kind?.label ?? 'Feedback'}`)}&body=${encodeURIComponent(body)}`
    window.setTimeout(() => {
      window.location.href = href
      sendingRef.current = false
      setSending(false)
    }, 700)
  }

  const aboutErrorId = `${formId}-about-error`

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8"
    >
      <h3 className="text-lg font-semibold text-brand-950">Send feedback</h3>
      <p className="mt-1 text-sm leading-6 text-zinc-500">
        This opens your email app. Nothing is stored on this website.
      </p>
      <div className="mt-6 grid flex-1 content-start gap-4 sm:grid-cols-2">
        <Field
          id={`${formId}-name`}
          label="Name"
          icon={User}
          value={name}
          error={errors.name}
          autoComplete="name"
          placeholder="Your name"
          onChange={(value) => onField('name', value)}
          onBlur={() => onBlur('name')}
        />
        <Field
          id={`${formId}-email`}
          label="Email"
          icon={Mail}
          type="email"
          value={email}
          error={errors.email}
          autoComplete="email"
          inputMode="email"
          placeholder="you@email.com"
          onChange={(value) => onField('email', value)}
          onBlur={() => onBlur('email')}
        />
        <fieldset
          className="sm:col-span-2"
          aria-invalid={Boolean(errors.about)}
          aria-describedby={errors.about ? aboutErrorId : undefined}
        >
          <legend className="flex items-center gap-1.5 text-sm font-medium text-brand-950">
            <MessageSquare className="size-3.5 text-brand-700" aria-hidden />
            This feedback is about
          </legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {feedbackKinds.map((kind, index) => {
              const selected = about === kind.id
              const Icon = kind.icon
              return (
                <label
                  key={kind.id}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500',
                    selected
                      ? 'border-brand-600 bg-brand-50 text-brand-800'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-brand-300 hover:text-brand-800',
                  )}
                >
                  <input
                    id={index === 0 ? `${formId}-about` : undefined}
                    type="radio"
                    name={`${formId}-about`}
                    value={kind.id}
                    checked={selected}
                    onChange={() => onField('about', kind.id)}
                    className="sr-only"
                  />
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {kind.label}
                </label>
              )
            })}
          </div>
          {errors.about ? (
            <p id={aboutErrorId} className="mt-1.5 text-xs leading-5 text-maroon-700">
              {errors.about}
            </p>
          ) : null}
        </fieldset>
        <div className="sm:col-span-2">
          <Field
            id={`${formId}-message`}
            label="Feedback"
            icon={MessageSquare}
            value={message}
            error={errors.message}
            multiline
            placeholder="Share what the Council should hear."
            onChange={(value) => onField('message', value)}
            onBlur={() => onBlur('message')}
          />
        </div>
      </div>
      <div className="mt-auto pt-5">
        <Button
          type="submit"
          size="lg"
          disabled={sending}
          aria-busy={sending}
          className="h-12 w-full rounded-xl px-6 disabled:cursor-wait"
        >
          {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          {sending ? 'Sending…' : 'Send feedback'}
        </Button>
      </div>
    </form>
  )
}

function Field({
  id,
  label,
  icon: Icon,
  value,
  onChange,
  onBlur,
  error,
  type = 'text',
  autoComplete,
  inputMode,
  placeholder,
  multiline = false,
}: {
  id: string
  label: string
  icon?: LucideIcon
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  error?: string
  type?: string
  autoComplete?: string
  inputMode?: 'email'
  placeholder?: string
  multiline?: boolean
}) {
  const errorId = `${id}-error`
  const describedBy = error ? errorId : undefined
  const controlClass = cn(fieldClass, 'mt-0', Icon && (multiline ? 'py-3 pl-10' : 'h-11 pl-10'))

  return (
    <div className={multiline ? 'flex h-full min-h-0 flex-col' : undefined}>
      <label htmlFor={id} className="block text-sm font-medium text-brand-950">
        {label}
      </label>
      <div className={cn('relative mt-1.5', multiline && 'flex min-h-28 flex-1 flex-col')}>
        {Icon ? (
          <span
            className={cn(
              'pointer-events-none absolute left-0 flex w-10 justify-center text-zinc-400',
              multiline ? 'top-3 h-5 items-center' : 'inset-y-0 items-center',
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
        {multiline ? (
          <textarea
            id={id}
            name={id}
            value={value}
            rows={4}
            required
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
            className={cn(controlClass, 'h-full min-h-28 flex-1')}
          />
        ) : (
          <input
            id={id}
            name={id}
            type={type}
            value={value}
            required
            autoComplete={autoComplete}
            inputMode={inputMode}
            placeholder={placeholder}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
            className={cn(controlClass, 'h-11')}
          />
        )}
      </div>
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs leading-5 text-maroon-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function FacebookMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1Z" />
    </svg>
  )
}
