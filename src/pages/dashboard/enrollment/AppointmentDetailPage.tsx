import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  Loader2,
  Pencil,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ConfirmDeleteDialog } from '@/components/portal/ConfirmDeleteDialog'
import { RequireLoginRedirect } from '@/components/portal/RequireLoginRedirect'
import {
  catalogInput,
  FormWorkspaceBackLink,
  formControlWellCls,
  formInsetPanelCls,
  formSectionHeadingCls,
  formSectionIconWrapCls,
  formSectionIntroCls,
  formWorkspaceCardBodyCls,
  formWorkspaceCardCls,
  formWorkspaceCardEyebrowCls,
  formWorkspaceCardEyebrowTextCls,
  formWorkspaceCardFooterCls,
  formWorkspacePrimaryBtnCls,
  workspaceFormFieldGroupCls,
  workspaceFormLabelCls,
  workspaceTenantMainStackCls,
} from '@/components/portal/register-ui'
import { Button } from '@/components/ui/button'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import { formatPhDateTime } from '@/lib/datetime'
import {
  appointmentProofUrl,
  deleteAppointment,
  getAppointment,
  updateAppointmentStatus,
  type AppointmentStatus,
  type EnrollmentAppointment,
} from '@/lib/enrollment-appointments-api'
import { cn } from '@/lib/utils'
import { AppointmentProofImage } from '@/pages/dashboard/enrollment/AppointmentProofImage'

const BASE_PATH = '/admin/enrollment/appointments'

function AppointmentProofPreview({
  appointmentId,
  proofName,
}: {
  appointmentId: number
  proofName: string
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
        <p className="truncate text-[12px] font-medium text-zinc-700 dark:text-zinc-300">
          {proofName || 'Payment proof'}
        </p>
        <a
          href={appointmentProofUrl(appointmentId, { download: true })}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Download
        </a>
      </div>
      <AppointmentProofImage
        appointmentId={appointmentId}
        proofName={proofName}
        variant="full"
        className="rounded-none border-0"
      />
    </div>
  )
}

function statusTone(status: string) {
  switch (status) {
    case 'approved':
      return {
        wrap: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100',
        label: 'Approved',
        hint: 'Slot capacity reserved',
      }
    case 'rejected':
      return {
        wrap: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-100',
        label: 'Rejected',
        hint: 'Slot capacity released',
      }
    default:
      return {
        wrap: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-100',
        label: 'Pending',
        hint: 'Holding slot capacity',
      }
  }
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-200/80 bg-zinc-50/70 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/50">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-zinc-400 uppercase">{label}</p>
      <p className="mt-1 break-words text-[13px] font-medium text-zinc-900 dark:text-zinc-50">
        {value || '—'}
      </p>
    </div>
  )
}

function CheckPill({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold',
        on
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100'
          : 'border-zinc-200 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400',
      )}
    >
      {on ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
      {label}
    </span>
  )
}

export default function AppointmentDetailPage() {
  const { id: idParam } = useParams()
  const navigate = useNavigate()
  const id = Number(idParam)

  const [item, setItem] = useState<EnrollmentAppointment | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [needsLogin, setNeedsLogin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [adminNote, setAdminNote] = useState('')
  const [confirmReject, setConfirmReject] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(false)
  const [toast, setToast] = useState<SnackToast | null>(null)

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const load = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) {
      setLoadError('Invalid appointment id.')
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError('')
    const result = await getAppointment(id)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        setNeedsLogin(true)
        setLoadError('')
      } else {
        setNeedsLogin(false)
        setLoadError(result.error)
      }
      setItem(null)
      setLoading(false)
      return
    }
    setNeedsLogin(false)
    setItem(result.data.item)
    setAdminNote(result.data.item.adminNote ?? '')
    setLoading(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function setStatus(status: AppointmentStatus) {
    if (!item) return
    setSaving(true)
    const result = await updateAppointmentStatus({
      id: item.id,
      status,
      adminNote,
    })
    setSaving(false)
    setConfirmReject(false)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        setNeedsLogin(true)
        return
      }
      showToast(result.error, 'error')
      return
    }
    setItem(result.data.item)
    setAdminNote(result.data.item.adminNote ?? '')
    showToast(
      status === 'approved'
        ? 'Appointment approved.'
        : status === 'rejected'
          ? 'Appointment rejected.'
          : 'Appointment marked pending.',
      'success',
    )
  }

  function onSaveNote(event: FormEvent) {
    event.preventDefault()
    if (!item) return
    void setStatus(item.status)
  }

  async function removeAppointment() {
    if (!item) return
    setSaving(true)
    const result = await deleteAppointment(item.id)
    setSaving(false)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        setNeedsLogin(true)
        return
      }
      showToast(result.error, 'error')
      setPendingDelete(false)
      return
    }
    navigate(BASE_PATH, {
      state: { toast: { message: 'Appointment deleted.', variant: 'success' as const } },
    })
  }

  if (loading) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300/90 bg-zinc-50/80 px-5 py-16 text-[13px] text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-hidden />
          Loading appointment…
        </div>
      </div>
    )
  }

  if (needsLogin) return <RequireLoginRedirect />

  if (loadError || !item) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <FormWorkspaceBackLink to={BASE_PATH} label="Appointments" />
        <div className="rounded-xl border border-zinc-200 bg-white px-5 py-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {loadError || 'Appointment not found.'}
          </p>
          <div className="mt-4">
            <Button asChild size="lg" variant="outline">
              <Link to={BASE_PATH}>Back to appointments</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const tone = statusTone(item.status)

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to={BASE_PATH} label="Appointments" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900 sm:text-[22px] dark:text-zinc-50">
              {item.fullName}
            </h1>
            <span
              className={cn(
                'inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase',
                tone.wrap,
              )}
            >
              {tone.label}
            </span>
          </div>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
            Tracking{' '}
            <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-200">
              {item.trackingCode}
            </span>
            {' · '}
            Submitted {formatPhDateTime(item.createdAt)}
          </p>
          <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{tone.hint}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-lg"
            onClick={() => navigate(`${BASE_PATH}/${item.id}/edit`)}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-lg border-rose-200 text-rose-800 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-200"
            onClick={() => setPendingDelete(true)}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200/90 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-zinc-400 uppercase">Student</p>
          <p className="mt-1 truncate text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
            {item.studentNumber}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-zinc-500">
            {item.yearLevel}
            {' · '}
            {item.classification === 'irregular' ? 'Irregular' : 'Regular'}
          </p>
        </div>
        <div className="rounded-xl border border-brand-200/80 bg-brand-50/50 px-3.5 py-3 dark:border-brand-500/30 dark:bg-brand-500/10">
          <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-brand-700 uppercase dark:text-brand-300">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            Booking
          </p>
          <p className="mt-1 truncate text-[13px] font-semibold text-brand-950 dark:text-zinc-50">
            {item.enrollmentDateLabel}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-zinc-500">{item.timeSlotLabel}</p>
        </div>
        <div className="rounded-xl border border-zinc-200/90 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-zinc-400 uppercase">Payment</p>
          <p className="mt-1 truncate text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
            {item.paymentMode || '—'}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-zinc-500">
            {item.referenceNo || 'No reference'}
            {item.hasProof ? ' · proof on file' : ''}
          </p>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
        <div className={formWorkspaceCardCls}>
          <div className={formWorkspaceCardEyebrowCls}>
            <p className={formWorkspaceCardEyebrowTextCls}>Appointment · Details</p>
          </div>
          <div className={formWorkspaceCardBodyCls}>
            <div className={formInsetPanelCls}>
              <div className="flex min-w-0 items-start gap-2.5">
                <span className={formSectionIconWrapCls}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h4 className={formSectionHeadingCls}>Student</h4>
                  <p className={formSectionIntroCls}>
                    Identity and classification from the routing slip form.
                  </p>
                </div>
              </div>
              <div className={cn(formControlWellCls, 'mt-4 grid gap-3 sm:grid-cols-2')}>
                <DetailRow label="Full name" value={item.fullName} />
                <DetailRow label="Student number" value={item.studentNumber} />
                <DetailRow label="Year level" value={item.yearLevel} />
                <DetailRow
                  label="Classification"
                  value={item.classification === 'irregular' ? 'Irregular' : 'Regular'}
                />
              </div>
            </div>

            <div className={cn(formInsetPanelCls, 'mt-4')}>
              <div className="flex min-w-0 items-start gap-2.5">
                <span className={formSectionIconWrapCls}>
                  <Clock3 className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h4 className={formSectionHeadingCls}>Booking slot</h4>
                  <p className={formSectionIntroCls}>
                    Linked date and hourly slot that drive live capacity.
                  </p>
                </div>
              </div>
              <div className={cn(formControlWellCls, 'mt-4 grid gap-3')}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-brand-200/80 bg-brand-50/50 px-3.5 py-3 dark:border-brand-500/30 dark:bg-brand-500/10">
                    <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-brand-700 uppercase dark:text-brand-300">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                      Enrollment date
                    </p>
                    <p className="mt-1.5 text-[14px] font-semibold text-brand-950 dark:text-zinc-50">
                      {item.enrollmentDateLabel}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-zinc-500">{item.enrollmentDate}</p>
                  </div>
                  <div className="rounded-xl border border-brand-200/80 bg-brand-50/50 px-3.5 py-3 dark:border-brand-500/30 dark:bg-brand-500/10">
                    <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-brand-700 uppercase dark:text-brand-300">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden />
                      Hourly time slot
                    </p>
                    <p className="mt-1.5 text-[14px] font-semibold text-brand-950 dark:text-zinc-50">
                      {item.timeSlotLabel}
                    </p>
                    {item.slotId != null ? (
                      <p className="mt-0.5 font-mono text-[11px] text-zinc-500">Slot #{item.slotId}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <CheckPill on={item.checkStanding} label="Academic standing" />
                  <CheckPill on={item.checkSchedule} label="Class schedule" />
                  <CheckPill on={item.checkPetition} label="Petition / appeal" />
                </div>
              </div>
            </div>

            <div className={cn(formInsetPanelCls, 'mt-4')}>
              <div className="flex min-w-0 items-start gap-2.5">
                <span className={formSectionIconWrapCls}>
                  <Download className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h4 className={formSectionHeadingCls}>SC contribution</h4>
                  <p className={formSectionIntroCls}>
                    Payment mode, reference, and attached proof image.
                  </p>
                </div>
              </div>
              <div className={cn(formControlWellCls, 'mt-4 space-y-3')}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailRow label="Payment mode" value={item.paymentMode} />
                  <DetailRow label="Reference / receipt no." value={item.referenceNo} />
                </div>
                {item.hasProof ? (
                  <AppointmentProofPreview
                    appointmentId={item.id}
                    proofName={item.proofName || 'Payment proof'}
                  />
                ) : (
                  <p className="rounded-xl border border-dashed border-zinc-300/90 bg-zinc-50/70 px-3 py-4 text-center text-[13px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40">
                    No payment proof on file.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <form onSubmit={onSaveNote} className={formWorkspaceCardCls}>
            <div className={formWorkspaceCardEyebrowCls}>
              <p className={formWorkspaceCardEyebrowTextCls}>Review · Decision</p>
            </div>
            <div className={formWorkspaceCardBodyCls}>
              <div className={workspaceFormFieldGroupCls}>
                <label className={workspaceFormLabelCls} htmlFor="appt-admin-note">
                  Admin note
                </label>
                <textarea
                  id="appt-admin-note"
                  className={cn(catalogInput, 'min-h-[96px] resize-y py-2.5')}
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  disabled={saving}
                  placeholder="Optional note for officers (reason for rejection, follow-up, etc.)"
                />
              </div>
              {item.reviewedAt ? (
                <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Last reviewed {formatPhDateTime(item.reviewedAt)}
                </p>
              ) : (
                <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Not reviewed yet · capacity is already held while pending.
                </p>
              )}
            </div>
            <div className={cn(formWorkspaceCardFooterCls, 'flex flex-col gap-2')}>
              <button
                type="button"
                className={cn(formWorkspacePrimaryBtnCls, 'w-full justify-center')}
                disabled={saving}
                onClick={() => void setStatus('approved')}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Check className="h-4 w-4" aria-hidden />
                )}
                Approve
              </button>
              {!confirmReject ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setConfirmReject(true)}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-[13px] font-semibold text-rose-900 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-100 dark:hover:bg-rose-500/25"
                >
                  <XCircle className="h-4 w-4" aria-hidden />
                  Reject
                </button>
              ) : (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-500/30 dark:bg-rose-500/10">
                  <p className="text-[12px] font-medium text-rose-900 dark:text-rose-100">
                    Reject and release this slot’s capacity?
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void setStatus('rejected')}
                      className="inline-flex min-h-9 flex-1 items-center justify-center rounded-lg bg-rose-700 px-3 text-[12px] font-semibold text-white disabled:opacity-50"
                    >
                      Confirm reject
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setConfirmReject(false)}
                      className="inline-flex min-h-9 flex-1 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-[12px] font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {item.status !== 'pending' ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void setStatus('pending')}
                  className="inline-flex min-h-9 w-full items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-[12px] font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                >
                  Mark pending again
                </button>
              ) : null}
              <button type="submit" disabled={saving} className="sr-only">
                Save note
              </button>
            </div>
          </form>

          <Link
            to={BASE_PATH}
            className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-zinc-200 bg-white text-[13px] font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          >
            Back to list
          </Link>
        </aside>
      </section>

      {pendingDelete ? (
        <ConfirmDeleteDialog
          title={item.fullName || item.trackingCode}
          noun="appointment"
          description="This appointment booking will be removed permanently, including any payment proof file. Linked slot capacity will be released."
          busy={saving}
          onCancel={() => setPendingDelete(false)}
          onConfirm={() => void removeAppointment()}
        />
      ) : null}

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
