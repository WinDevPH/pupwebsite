import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  BookOpen,
  Check,
  Loader2,
  Pencil,
  Trash2,
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
  deleteSchedule,
  getSchedule,
  updateScheduleDetails,
  updateScheduleStatus,
  type EnrollmentSchedule,
  type ScheduleStatus,
} from '@/lib/enrollment-schedules-api'
import { cn } from '@/lib/utils'

const BASE_PATH = '/admin/enrollment/schedules'

function statusTone(status: string) {
  switch (status) {
    case 'approved':
      return {
        wrap: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100',
        label: 'Approved',
      }
    case 'rejected':
      return {
        wrap: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-100',
        label: 'Rejected',
      }
    default:
      return {
        wrap: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-100',
        label: 'Pending',
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

export default function ScheduleDetailPage() {
  const { id: idParam } = useParams()
  const navigate = useNavigate()
  const id = Number(idParam)

  const [item, setItem] = useState<EnrollmentSchedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [needsLogin, setNeedsLogin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [adminNote, setAdminNote] = useState('')
  const [studentName, setStudentName] = useState('')
  const [studentNumber, setStudentNumber] = useState('')
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
      setLoadError('Invalid schedule id.')
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError('')
    const result = await getSchedule(id)
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
    setStudentName(result.data.item.studentName)
    setStudentNumber(result.data.item.studentNumber)
    setLoading(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function setStatus(status: ScheduleStatus) {
    if (!item) return
    setSaving(true)
    const result = await updateScheduleStatus({
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
        ? 'Schedule approved.'
        : status === 'rejected'
          ? 'Schedule rejected.'
          : 'Schedule marked pending.',
      'success',
    )
  }

  async function saveDetails(event: FormEvent) {
    event.preventDefault()
    if (!item) return
    setSaving(true)
    const result = await updateScheduleDetails({
      id: item.id,
      studentName: studentName.trim(),
      studentNumber: studentNumber.trim(),
      offerings: item.offerings,
    })
    setSaving(false)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        setNeedsLogin(true)
        return
      }
      showToast(result.error, 'error')
      return
    }
    setItem(result.data.item)
    setStudentName(result.data.item.studentName)
    setStudentNumber(result.data.item.studentNumber)
    showToast('Student details updated.', 'success')
  }

  async function removeSchedule() {
    if (!item) return
    setSaving(true)
    const result = await deleteSchedule(item.id)
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
      state: { toast: { message: 'Schedule deleted.', variant: 'success' as const } },
    })
  }

  if (loading) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300/90 bg-zinc-50/80 px-5 py-16 text-[13px] text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-hidden />
          Loading schedule…
        </div>
      </div>
    )
  }

  if (needsLogin) return <RequireLoginRedirect />

  if (loadError || !item) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <FormWorkspaceBackLink to={BASE_PATH} label="Class Schedules" />
        <div className="rounded-xl border border-zinc-200 bg-white px-5 py-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {loadError || 'Schedule not found.'}
          </p>
          <div className="mt-4">
            <Button asChild size="lg" variant="outline">
              <Link to={BASE_PATH}>Back to schedules</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const tone = statusTone(item.status)

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to={BASE_PATH} label="Class Schedules" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900 sm:text-[22px] dark:text-zinc-50">
            {item.studentName}
          </h1>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
            Tracking{' '}
            <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-200">
              {item.trackingCode}
            </span>
            {' · '}
            Submitted {formatPhDateTime(item.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex w-fit items-center rounded-full border px-3 py-1 text-[11px] font-bold tracking-wide uppercase',
              tone.wrap,
            )}
          >
            {tone.label}
          </span>
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

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
        <div className="space-y-4">
          <form onSubmit={(e) => void saveDetails(e)} className={formWorkspaceCardCls}>
            <div className={formWorkspaceCardEyebrowCls}>
              <p className={formWorkspaceCardEyebrowTextCls}>Schedule · Student</p>
            </div>
            <div className={formWorkspaceCardBodyCls}>
              <div className={formInsetPanelCls}>
                <h4 className={formSectionHeadingCls}>Edit student</h4>
                <p className={formSectionIntroCls}>
                  Correct name or student number if the submission needs fixing.
                </p>
                <div className={cn(formControlWellCls, 'mt-4 grid gap-3 sm:grid-cols-2')}>
                  <div className={workspaceFormFieldGroupCls}>
                    <label className={workspaceFormLabelCls} htmlFor="sched-student-name">
                      Full name
                    </label>
                    <input
                      id="sched-student-name"
                      className={catalogInput}
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      disabled={saving}
                      required
                    />
                  </div>
                  <div className={workspaceFormFieldGroupCls}>
                    <label className={workspaceFormLabelCls} htmlFor="sched-student-number">
                      Student number
                    </label>
                    <input
                      id="sched-student-number"
                      className={catalogInput}
                      value={studentNumber}
                      onChange={(e) => setStudentNumber(e.target.value)}
                      disabled={saving}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className={formWorkspaceCardFooterCls}>
              <button type="submit" disabled={saving} className={formWorkspacePrimaryBtnCls}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Save student details
              </button>
            </div>
          </form>

          <div className={formWorkspaceCardCls}>
            <div className={formWorkspaceCardEyebrowCls}>
              <p className={formWorkspaceCardEyebrowTextCls}>Schedule · Classes</p>
            </div>
            <div className={formWorkspaceCardBodyCls}>
              <div className={formInsetPanelCls}>
                <h4 className={formSectionHeadingCls}>Proposed offerings</h4>
                <p className={formSectionIntroCls}>
                  {item.offerings.length} class{item.offerings.length === 1 ? '' : 'es'} ·{' '}
                  {item.totalUnits} total unit{item.totalUnits === 1 ? '' : 's'}
                </p>
                <div className={cn(formControlWellCls, 'mt-4 space-y-2')}>
                  {item.offerings.length === 0 ? (
                    <p className="text-[13px] text-zinc-500">No offerings on this submission.</p>
                  ) : (
                    item.offerings.map((offering, index) => (
                      <div
                        key={`${offering.id}-${offering.code}-${index}`}
                        className="rounded-xl border border-zinc-200/80 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950"
                      >
                        <div className="flex items-start gap-2">
                          <BookOpen
                            className="mt-0.5 h-4 w-4 shrink-0 text-brand-600"
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
                              {offering.code} · {offering.title}
                            </p>
                            <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">
                              {offering.section} · {offering.units} unit
                              {offering.units === 1 ? '' : 's'}
                              {offering.timeLabel ? ` · ${offering.timeLabel}` : ''}
                              {offering.days.length > 0 ? ` · ${offering.days.join('/')}` : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <DetailRow label="Total units" value={String(item.totalUnits)} />
                  <DetailRow label="Classes" value={String(item.offerings.length)} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className={formWorkspaceCardCls}>
            <div className={formWorkspaceCardEyebrowCls}>
              <p className={formWorkspaceCardEyebrowTextCls}>Review · Decision</p>
            </div>
            <div className={formWorkspaceCardBodyCls}>
              <div className={workspaceFormFieldGroupCls}>
                <label className={workspaceFormLabelCls} htmlFor="sched-admin-note">
                  Admin note
                </label>
                <textarea
                  id="sched-admin-note"
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
              ) : null}
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
                    Reject this class schedule?
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
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate(BASE_PATH)}
            className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-zinc-200 bg-white text-[13px] font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          >
            Back to list
          </button>
        </aside>
      </section>

      {pendingDelete ? (
        <ConfirmDeleteDialog
          title={item.studentName || item.trackingCode}
          noun="schedule"
          description="This class schedule submission will be removed permanently."
          busy={saving}
          onCancel={() => setPendingDelete(false)}
          onConfirm={() => void removeSchedule()}
        />
      ) : null}

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
