import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  ImagePlus,
  Loader2,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
  workspaceFormRequiredMarkCls,
  workspaceTenantMainStackCls,
} from '@/components/portal/register-ui'
import { Button } from '@/components/ui/button'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import {
  createAppointment,
  getAppointment,
  updateAppointmentDetails,
  type AppointmentStatus,
  type EnrollmentAppointment,
} from '@/lib/enrollment-appointments-api'
import { AppointmentProofImage } from '@/pages/dashboard/enrollment/AppointmentProofImage'
import {
  getRoutingBundle,
  type EnrollmentDate,
  type EnrollmentPaymentChannel,
  type EnrollmentTimeSlot,
} from '@/lib/enrollment-routing-api'
import { cn } from '@/lib/utils'

const BASE_PATH = '/admin/enrollment/appointments'

type EditorTab = 'student' | 'booking' | 'payment' | 'review'

const EDITOR_TABS = [
  { id: 'student' as const, label: 'Student', short: 'ID', icon: UserRound },
  { id: 'booking' as const, label: 'Booking', short: 'Slot', icon: CalendarDays },
  { id: 'payment' as const, label: 'Payment', short: 'Pay', icon: CreditCard },
  { id: 'review' as const, label: 'Review', short: 'Status', icon: ShieldCheck },
]

type DateOption = Pick<EnrollmentDate, 'id' | 'value' | 'label'>
type SlotOption = Pick<EnrollmentTimeSlot, 'id' | 'value' | 'label' | 'remaining' | 'full'>

type FormState = {
  fullName: string
  studentNumber: string
  yearLevel: string
  classification: 'regular' | 'irregular'
  dateId: number | null
  enrollmentDate: string
  enrollmentDateLabel: string
  slotId: number | null
  timeSlot: string
  timeSlotLabel: string
  checkStanding: boolean
  checkSchedule: boolean
  checkPetition: boolean
  paymentMode: string
  referenceNo: string
  status: AppointmentStatus
  adminNote: string
}

const emptyForm = (): FormState => ({
  fullName: '',
  studentNumber: '',
  yearLevel: '',
  classification: 'regular',
  dateId: null,
  enrollmentDate: '',
  enrollmentDateLabel: '',
  slotId: null,
  timeSlot: '',
  timeSlotLabel: '',
  checkStanding: false,
  checkSchedule: false,
  checkPetition: false,
  paymentMode: '',
  referenceNo: '',
  status: 'pending',
  adminNote: '',
})

function recordToForm(item: EnrollmentAppointment): FormState {
  return {
    fullName: item.fullName,
    studentNumber: item.studentNumber,
    yearLevel: item.yearLevel,
    classification: item.classification === 'irregular' ? 'irregular' : 'regular',
    dateId: item.dateId ?? null,
    enrollmentDate: item.enrollmentDate,
    enrollmentDateLabel: item.enrollmentDateLabel,
    slotId: item.slotId ?? null,
    timeSlot: item.timeSlot,
    timeSlotLabel: item.timeSlotLabel,
    checkStanding: item.checkStanding,
    checkSchedule: item.checkSchedule,
    checkPetition: item.checkPetition,
    paymentMode: item.paymentMode,
    referenceNo: item.referenceNo,
    status: item.status,
    adminNote: item.adminNote ?? '',
  }
}

function resolveLinkedIds(
  form: FormState,
  dateOptions: DateOption[],
  slotOptions: SlotOption[],
): FormState {
  let next = form
  if (next.dateId == null && next.enrollmentDate) {
    const dateMatch = dateOptions.find((d) => d.value === next.enrollmentDate)
    if (dateMatch) {
      next = {
        ...next,
        dateId: dateMatch.id,
        enrollmentDateLabel: next.enrollmentDateLabel || dateMatch.label,
      }
    }
  }
  if (next.slotId == null && next.timeSlot) {
    const slotMatch = slotOptions.find((s) => s.value === next.timeSlot)
    if (slotMatch) {
      next = {
        ...next,
        slotId: slotMatch.id,
        timeSlotLabel: next.timeSlotLabel || slotMatch.label,
      }
    }
  }
  return next
}

export default function AppointmentFormPage() {
  const navigate = useNavigate()
  const { id: idParam } = useParams()
  const editId = idParam ? Number(idParam) : NaN
  const mode: 'create' | 'edit' = Number.isFinite(editId) && editId > 0 ? 'edit' : 'create'

  const [form, setForm] = useState<FormState>(emptyForm)
  const [tab, setTab] = useState<EditorTab>('student')
  const [yearLevels, setYearLevels] = useState<{ value: string; label: string }[]>([])
  const [dates, setDates] = useState<DateOption[]>([])
  const [slots, setSlots] = useState<SlotOption[]>([])
  const [channels, setChannels] = useState<EnrollmentPaymentChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [needsLogin, setNeedsLogin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<SnackToast | null>(null)
  const [existingProofName, setExistingProofName] = useState('')
  const [existingProofId, setExistingProofId] = useState<number | null>(null)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    setLoading(true)
    setLoadError('')

    void getRoutingBundle({ all: true }).then((bundleResult) => {
      if (cancelled) return
      if (!bundleResult.ok) {
        if (bundleResult.status === 401 || bundleResult.status === 403) setNeedsLogin(true)
        else setLoadError(bundleResult.error)
        setLoading(false)
        return
      }

      const bundle = bundleResult.data
      const dateOptions: DateOption[] = bundle.dates.map((d) => ({
        id: d.id,
        value: d.value,
        label: d.label,
      }))
      const slotOptions: SlotOption[] = bundle.slots.map((s) => ({
        id: s.id,
        value: s.value,
        label: s.label,
        remaining: s.remaining,
        full: s.full,
      }))

      setYearLevels(bundle.settings.yearLevels ?? [])
      setDates(dateOptions)
      setSlots(slotOptions)
      setChannels(bundle.channels ?? [])

      if (mode !== 'edit') {
        setForm(emptyForm())
        setExistingProofName('')
        setExistingProofId(null)
        setProofFile(null)
        setProofPreview(null)
        setLoading(false)
        return
      }

      void getAppointment(editId).then((result) => {
        if (cancelled) return
        if (!result.ok) {
          setNeedsLogin(result.status === 401 || result.status === 403)
          setLoadError(result.status === 401 || result.status === 403 ? '' : result.error)
          setLoading(false)
          return
        }
        const item = result.data.item
        setForm(resolveLinkedIds(recordToForm(item), dateOptions, slotOptions))
        setExistingProofName(item.proofName || '')
        setExistingProofId(item.hasProof ? item.id : null)
        setProofFile(null)
        setProofPreview(null)
        setLoading(false)
      })
    })

    return () => {
      cancelled = true
    }
  }, [mode, editId])

  useEffect(() => {
    return () => {
      if (proofPreview?.startsWith('blob:')) URL.revokeObjectURL(proofPreview)
    }
  }, [proofPreview])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function onProofChange(file: File | null) {
    setProofPreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return file ? URL.createObjectURL(file) : null
    })
    setProofFile(file)
  }

  const selectedDate = useMemo(
    () => dates.find((d) => d.id === form.dateId) ?? null,
    [dates, form.dateId],
  )
  const selectedSlot = useMemo(
    () => slots.find((s) => s.id === form.slotId) ?? null,
    [slots, form.slotId],
  )
  const selectedChannel = useMemo(
    () => channels.find((c) => c.key === form.paymentMode) ?? null,
    [channels, form.paymentMode],
  )

  const studentIncomplete = !form.fullName.trim() || !form.studentNumber.trim() || !form.yearLevel
  const bookingIncomplete = form.dateId == null || form.slotId == null
  const paymentIncomplete = !form.paymentMode
  const incomplete = studentIncomplete || bookingIncomplete || paymentIncomplete

  const tabAlert: Record<EditorTab, boolean> = {
    student: studentIncomplete,
    booking: bookingIncomplete,
    payment: paymentIncomplete,
    review: false,
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (incomplete) {
      if (studentIncomplete) setTab('student')
      else if (bookingIncomplete) setTab('booking')
      else setTab('payment')
      showToast('Fill all required fields before saving.', 'error')
      return
    }
    setSaving(true)
    const payload = {
      fullName: form.fullName.trim(),
      studentNumber: form.studentNumber.trim(),
      yearLevel: form.yearLevel,
      classification: form.classification,
      enrollmentDate: form.enrollmentDate,
      enrollmentDateLabel: form.enrollmentDateLabel,
      ...(form.dateId != null ? { dateId: form.dateId } : {}),
      timeSlot: form.timeSlot,
      timeSlotLabel: form.timeSlotLabel,
      ...(form.slotId != null ? { slotId: form.slotId } : {}),
      checkStanding: form.checkStanding,
      checkSchedule: form.checkSchedule,
      checkPetition: form.checkPetition,
      paymentMode: form.paymentMode,
      referenceNo: form.referenceNo.trim(),
      status: form.status,
      adminNote: form.adminNote.trim(),
    }
    const result =
      mode === 'edit'
        ? await updateAppointmentDetails({ ...payload, id: editId }, proofFile)
        : await createAppointment(payload, proofFile)
    setSaving(false)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) setNeedsLogin(true)
      else showToast(result.error, 'error')
      return
    }
    navigate(BASE_PATH, {
      state: {
        toast: {
          message: mode === 'edit' ? 'Appointment updated.' : 'Appointment created.',
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
          Loading form…
        </div>
      </div>
    )
  }

  if (needsLogin) return <RequireLoginRedirect />

  if (loadError) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <p className="text-sm font-medium text-zinc-900">{loadError}</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to={BASE_PATH}>Back to appointments</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to={BASE_PATH} label="Appointments" />

      <form onSubmit={(e) => void onSubmit(e)} className={formWorkspaceCardCls}>
        <div className={formWorkspaceCardEyebrowCls}>
          <p className={formWorkspaceCardEyebrowTextCls}>Enrollment · Appointment</p>
        </div>

        <div className={formWorkspaceCardBodyCls}>
          <div className={formInsetPanelCls}>
            <div className={formTabChromeCardCls}>
              <div className="flex min-w-0 items-start gap-2.5">
                <span className={formSectionIconWrapCls}>
                  <ClipboardCheck className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h4 className={formSectionHeadingCls}>
                    {mode === 'edit' ? 'Edit appointment' : 'New appointment'}
                  </h4>
                  <p className={formSectionIntroCls}>
                    Officer booking that reserves routing-slip slot capacity automatically.
                  </p>
                </div>
              </div>
              <div className={formTabListCls} role="tablist">
                {EDITOR_TABS.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={tab === item.id}
                      className={formTabBtnCls(tab === item.id)}
                      disabled={saving}
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

            <div className={cn(formControlWellCls, 'mt-0')}>
              {tab === 'student' ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="appt-full-name">
                        Full name <span className={workspaceFormRequiredMarkCls}>*</span>
                      </label>
                      <input
                        id="appt-full-name"
                        className={catalogInput}
                        value={form.fullName}
                        onChange={(e) => set('fullName', e.target.value)}
                        disabled={saving}
                        required
                        autoComplete="name"
                      />
                    </div>
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="appt-student-number">
                        Student number <span className={workspaceFormRequiredMarkCls}>*</span>
                      </label>
                      <input
                        id="appt-student-number"
                        className={catalogInput}
                        value={form.studentNumber}
                        onChange={(e) => set('studentNumber', e.target.value)}
                        disabled={saving}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="appt-year-level">
                        Year level <span className={workspaceFormRequiredMarkCls}>*</span>
                      </label>
                      <select
                        id="appt-year-level"
                        className={catalogInput}
                        value={form.yearLevel}
                        onChange={(e) => set('yearLevel', e.target.value)}
                        disabled={saving}
                        required
                      >
                        <option value="">Select year level</option>
                        {yearLevels.map((yl) => (
                          <option key={yl.value} value={yl.value}>
                            {yl.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="appt-classification">
                        Classification
                      </label>
                      <select
                        id="appt-classification"
                        className={catalogInput}
                        value={form.classification}
                        onChange={(e) =>
                          set('classification', e.target.value as FormState['classification'])
                        }
                        disabled={saving}
                      >
                        <option value="regular">Regular</option>
                        <option value="irregular">Irregular</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : null}

              {tab === 'booking' ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="appt-enrollment-date">
                        Enrollment date <span className={workspaceFormRequiredMarkCls}>*</span>
                      </label>
                      <select
                        id="appt-enrollment-date"
                        className={catalogInput}
                        value={form.dateId ?? ''}
                        onChange={(e) => {
                          const id = Number(e.target.value)
                          const match = dates.find((d) => d.id === id)
                          setForm((prev) => ({
                            ...prev,
                            dateId: Number.isFinite(id) && id > 0 ? id : null,
                            enrollmentDate: match?.value ?? '',
                            enrollmentDateLabel: match?.label ?? '',
                          }))
                        }}
                        disabled={saving}
                        required
                      >
                        <option value="">Select date</option>
                        {dates.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                      {selectedDate ? (
                        <p className="mt-1 font-mono text-[11px] text-zinc-500">{selectedDate.value}</p>
                      ) : null}
                    </div>

                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="appt-time-slot">
                        Time slot <span className={workspaceFormRequiredMarkCls}>*</span>
                      </label>
                      <select
                        id="appt-time-slot"
                        className={catalogInput}
                        value={form.slotId ?? ''}
                        onChange={(e) => {
                          const id = Number(e.target.value)
                          const match = slots.find((s) => s.id === id)
                          setForm((prev) => ({
                            ...prev,
                            slotId: Number.isFinite(id) && id > 0 ? id : null,
                            timeSlot: match?.value ?? '',
                            timeSlotLabel: match?.label ?? '',
                          }))
                        }}
                        disabled={saving}
                        required
                      >
                        <option value="">Select slot</option>
                        {slots.map((s) => {
                          const isCurrent = form.slotId === s.id
                          const disabled = s.full && !isCurrent
                          return (
                            <option key={s.id} value={s.id} disabled={disabled}>
                              {s.label}
                              {s.full && !isCurrent
                                ? ' · FULL'
                                : ` · ${Math.max(0, s.remaining)} left`}
                            </option>
                          )
                        })}
                      </select>
                      {selectedSlot ? (
                        <p className="mt-1 text-[11px] text-zinc-500">
                          {selectedSlot.full && form.slotId !== selectedSlot.id
                            ? 'This slot is full.'
                            : `Live capacity · ${Math.max(0, selectedSlot.remaining)} remaining`}
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] text-zinc-500">
                          Saving links this booking to routing inventory automatically.
                        </p>
                      )}
                    </div>
                  </div>

                  <fieldset className="space-y-2">
                    <legend className={workspaceFormLabelCls}>Routing checks</legend>
                    {(
                      [
                        ['checkStanding', 'Academic standing'] as const,
                        ['checkSchedule', 'Class schedule'] as const,
                        ['checkPetition', 'Petition / appeal'] as const,
                      ]
                    ).map(([key, label]) => (
                      <label
                        key={key}
                        className="flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200/90 bg-white px-3 text-[12px] font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                      >
                        <input
                          type="checkbox"
                          checked={form[key]}
                          onChange={(e) => set(key, e.target.checked)}
                          className={tableCheckboxCls}
                          disabled={saving}
                        />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                </div>
              ) : null}

              {tab === 'payment' ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="appt-payment">
                        Payment mode <span className={workspaceFormRequiredMarkCls}>*</span>
                      </label>
                      <select
                        id="appt-payment"
                        className={catalogInput}
                        value={form.paymentMode}
                        onChange={(e) => set('paymentMode', e.target.value)}
                        disabled={saving}
                        required
                      >
                        <option value="">Select channel</option>
                        {channels.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                      {selectedChannel?.lines?.length ? (
                        <p className="mt-1 line-clamp-2 text-[11px] text-zinc-500">
                          {selectedChannel.lines.join(' · ')}
                        </p>
                      ) : null}
                    </div>
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="appt-reference">
                        Reference / receipt no.
                      </label>
                      <input
                        id="appt-reference"
                        className={catalogInput}
                        value={form.referenceNo}
                        onChange={(e) => set('referenceNo', e.target.value)}
                        disabled={saving}
                        placeholder="Optional for officers"
                      />
                    </div>
                  </div>

                  <div className={workspaceFormFieldGroupCls}>
                    <p className={workspaceFormLabelCls}>Payment proof image</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/*"
                      className="sr-only"
                      disabled={saving}
                      onChange={(event) => onProofChange(event.target.files?.[0] ?? null)}
                    />
                    {proofPreview || existingProofId ? (
                      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
                        {proofPreview ? (
                          <img
                            src={proofPreview}
                            alt="Payment proof preview"
                            className="max-h-44 w-full object-cover"
                          />
                        ) : existingProofId ? (
                          <AppointmentProofImage
                            appointmentId={existingProofId}
                            proofName={existingProofName || 'Payment proof'}
                            variant="panel"
                          />
                        ) : null}
                        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                          <p className="min-w-0 truncate text-[11px] text-zinc-500">
                            {proofFile?.name || existingProofName || 'Payment proof'}
                            {proofFile ? ' · new upload' : existingProofId ? ' · on file' : ''}
                          </p>
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              className="text-[11px] font-semibold text-brand-700 dark:text-brand-300"
                              disabled={saving}
                              onClick={() => fileInputRef.current?.click()}
                            >
                              Replace
                            </button>
                            {proofFile ? (
                              <button
                                type="button"
                                className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300"
                                disabled={saving}
                                onClick={() => {
                                  onProofChange(null)
                                  if (fileInputRef.current) fileInputRef.current.value = ''
                                }}
                              >
                                Undo
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => fileInputRef.current?.click()}
                        className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 px-4 py-6 text-center transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-zinc-600 dark:bg-zinc-950/40"
                      >
                        <ImagePlus className="size-5 text-brand-600 dark:text-brand-300" aria-hidden />
                        <span className="text-[12px] font-semibold text-brand-950 dark:text-zinc-50">
                          Attach payment proof
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          PNG, JPG, or WEBP · optional for officers
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              ) : null}

              {tab === 'review' ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <p className="text-[10px] font-semibold tracking-[0.12em] text-zinc-400 uppercase">
                        Student
                      </p>
                      <p className="mt-1 truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-50">
                        {form.fullName.trim() || '—'}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">
                        {form.studentNumber.trim() || 'No student no.'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-brand-200/80 bg-brand-50/50 px-3 py-2.5 dark:border-brand-500/30 dark:bg-brand-500/10">
                      <p className="text-[10px] font-semibold tracking-[0.12em] text-brand-700 uppercase dark:text-brand-300">
                        Slot
                      </p>
                      <p className="mt-1 truncate text-[13px] font-semibold text-brand-950 dark:text-zinc-50">
                        {form.enrollmentDateLabel || '—'}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                        {form.timeSlotLabel || 'No time slot'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <p className="text-[10px] font-semibold tracking-[0.12em] text-zinc-400 uppercase">
                        Payment
                      </p>
                      <p className="mt-1 truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-50">
                        {selectedChannel?.title || form.paymentMode || '—'}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                        {form.referenceNo.trim() || 'No reference'}
                      </p>
                    </div>
                  </div>

                  <div className={workspaceFormFieldGroupCls}>
                    <label className={workspaceFormLabelCls} htmlFor="appt-status">
                      Status
                    </label>
                    <select
                      id="appt-status"
                      className={catalogInput}
                      value={form.status}
                      onChange={(e) => set('status', e.target.value as AppointmentStatus)}
                      disabled={saving}
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Pending and approved bookings reserve slot capacity; rejected frees it.
                    </p>
                  </div>

                  <div className={workspaceFormFieldGroupCls}>
                    <label className={workspaceFormLabelCls} htmlFor="appt-admin-note">
                      Admin note
                    </label>
                    <textarea
                      id="appt-admin-note"
                      className={cn(catalogInput, 'min-h-[88px] resize-y py-2.5')}
                      value={form.adminNote}
                      onChange={(e) => set('adminNote', e.target.value)}
                      disabled={saving}
                      placeholder="Optional note for officers"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className={formWorkspaceCardFooterCls}>
          <div className="mr-auto hidden text-[11px] text-zinc-500 sm:block">
            {incomplete
              ? 'Complete required fields to save.'
              : mode === 'edit'
                ? 'Updates sync capacity automatically.'
                : 'Creates a booking and reserves the selected slot.'}
          </div>
          <button
            type="submit"
            className={formWorkspacePrimaryBtnCls}
            disabled={saving || incomplete}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <CalendarDays className="h-4 w-4 opacity-90" aria-hidden />
            )}
            Save
          </button>
        </div>
      </form>

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
