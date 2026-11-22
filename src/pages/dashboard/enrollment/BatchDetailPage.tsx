import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  CheckCircle2,
  Clock3,
  Link2,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  UserPlus,
  Users,
  UserRound,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { RequireLoginRedirect } from '@/components/portal/RequireLoginRedirect'
import {
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
  formWorkspacePrimaryBtnCls,
  workspaceTenantMainStackCls,
} from '@/components/portal/register-ui'
import { Button } from '@/components/ui/button'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import {
  assignAllApprovedToBatch,
  assignAppointmentToBatch,
  getAppointmentBatchRoster,
  type BatchSlotSummary,
  type BatchStudent,
  type EnrollmentAppointmentBatch,
} from '@/lib/enrollment-batches-api'
import { cn } from '@/lib/utils'
import {
  EnrollmentEmptyState,
  EnrollmentStatusBadge,
} from '@/pages/dashboard/enrollment/enrollment-admin-ui'

const BASE_PATH = '/admin/enrollment/batches'
const ROUTING_PATH = '/admin/enrollment/routing'
const APPOINTMENTS_PATH = '/admin/enrollment/appointments'

type RosterFilter = 'all' | 'approved' | 'pending'

function statusTone(status: string) {
  const key = status.trim().toLowerCase()
  if (key === 'serving') {
    return {
      wrap: 'border-emerald-200/85 bg-gradient-to-br from-white to-emerald-50/80 text-emerald-950 dark:border-emerald-500/22 dark:from-zinc-950 dark:to-emerald-500/14 dark:text-emerald-50',
      label: status,
    }
  }
  if (key === 'up next') {
    return {
      wrap: 'border-amber-200/85 bg-gradient-to-br from-white to-amber-50/80 text-amber-950 dark:border-amber-500/22 dark:from-zinc-950 dark:to-amber-500/14 dark:text-amber-50',
      label: status,
    }
  }
  if (key === 'closed') {
    return {
      wrap: 'border-zinc-200/85 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
      label: status,
    }
  }
  return {
    wrap: 'border-zinc-200/85 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
    label: status.trim() || '—',
  }
}

function studentStatusTone(status: string) {
  if (status === 'approved') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100'
  }
  if (status === 'pending') {
    return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-100'
  }
  return 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
}

function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string
  value: string | number
  hint: string
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-3.5 py-3',
        accent
          ? 'border-brand-200/80 bg-brand-50/55 dark:border-brand-500/30 dark:bg-brand-500/10'
          : 'border-zinc-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none',
      )}
    >
      <p
        className={cn(
          'text-[10px] font-semibold tracking-[0.12em] uppercase',
          accent ? 'text-brand-700 dark:text-brand-300' : 'text-zinc-400',
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-[20px] font-semibold tracking-tight tabular-nums',
          accent ? 'text-brand-950 dark:text-zinc-50' : 'text-zinc-900 dark:text-zinc-50',
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">{hint}</p>
    </div>
  )
}

function StudentRow({
  student,
  action,
}: {
  student: BatchStudent
  action?: ReactNode
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-zinc-50/90 dark:hover:bg-zinc-900/50">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-brand-100 bg-brand-50/80 text-brand-700 dark:border-brand-500/25 dark:bg-brand-500/15 dark:text-brand-300">
        <UserRound className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <p className="truncate text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
            {student.fullName}
          </p>
          <span
            className={cn(
              'inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase',
              studentStatusTone(student.status),
            )}
          >
            {student.status}
          </span>
        </div>
        <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">
          {student.studentNumber || 'No student no.'}
          {student.trackingCode ? ` · ${student.trackingCode}` : ''}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-zinc-500">
          {student.enrollmentDateLabel || student.enrollmentDate || 'No date'}
          {' · '}
          {student.timeSlotLabel || student.timeSlot || 'No slot'}
          {student.yearLevel ? ` · Year ${student.yearLevel}` : ''}
        </p>
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </li>
  )
}

export default function BatchDetailPage() {
  const { id: idParam } = useParams()
  const navigate = useNavigate()
  const id = Number(idParam)

  const [item, setItem] = useState<EnrollmentAppointmentBatch | null>(null)
  const [students, setStudents] = useState<BatchStudent[]>([])
  const [assignable, setAssignable] = useState<BatchStudent[]>([])
  const [slots, setSlots] = useState<BatchSlotSummary[]>([])
  const [filter, setFilter] = useState<RosterFilter>('all')
  const [loading, setLoading] = useState(true)
  const [reloading, setReloading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [needsLogin, setNeedsLogin] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [assigningAll, setAssigningAll] = useState(false)
  const [toast, setToast] = useState<SnackToast | null>(null)

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (!Number.isFinite(id) || id <= 0) {
        setLoadError('Invalid batch id.')
        setLoading(false)
        return
      }
      if (opts?.soft) setReloading(true)
      else setLoading(true)
      setLoadError('')
      const result = await getAppointmentBatchRoster(id)
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
        setReloading(false)
        return
      }
      setNeedsLogin(false)
      setItem(result.data.item)
      setStudents(result.data.students)
      setAssignable(result.data.assignable)
      setSlots(result.data.slots)
      setLoading(false)
      setReloading(false)
    },
    [id],
  )

  useEffect(() => {
    void load()
  }, [load])

  const counts = useMemo(
    () => ({
      all: students.length,
      approved: students.filter((s) => s.status === 'approved').length,
      pending: students.filter((s) => s.status === 'pending').length,
    }),
    [students],
  )

  const filteredStudents = useMemo(() => {
    if (filter === 'all') return students
    return students.filter((s) => s.status === filter)
  }, [students, filter])

  const approvedAssignable = useMemo(
    () => assignable.filter((s) => s.status === 'approved'),
    [assignable],
  )

  const openSlots = useMemo(() => slots.filter((s) => !s.full), [slots])
  const seatsLeft = useMemo(
    () => openSlots.reduce((n, s) => n + Math.max(0, s.remaining), 0),
    [openSlots],
  )
  const canAssign = slots.length > 0 && openSlots.length > 0
  const setupNeeded = slots.length === 0

  async function assignOne(appointmentId: number) {
    if (!item) return
    setBusyId(appointmentId)
    const result = await assignAppointmentToBatch({
      batchId: item.id,
      appointmentId,
    })
    setBusyId(null)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        setNeedsLogin(true)
        return
      }
      showToast(result.error, 'error')
      return
    }
    setItem(result.data.item)
    setStudents(result.data.students)
    setAssignable(result.data.assignable)
    setSlots(result.data.slots)
    showToast('Student assigned to this batch.', 'success')
  }

  async function assignAll() {
    if (!item) return
    setAssigningAll(true)
    const result = await assignAllApprovedToBatch(item.id)
    setAssigningAll(false)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        setNeedsLogin(true)
        return
      }
      showToast(result.error, 'error')
      return
    }
    setItem(result.data.item)
    setStudents(result.data.students)
    setAssignable(result.data.assignable)
    setSlots(result.data.slots)
    showToast(
      result.data.assigned > 0
        ? `Assigned ${result.data.assigned} approved student${result.data.assigned === 1 ? '' : 's'}.`
        : 'No approved students were available to assign.',
      result.data.assigned > 0 ? 'success' : 'error',
    )
  }

  if (loading) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300/90 bg-zinc-50/80 px-5 py-16 text-[13px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/60">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-hidden />
          Loading batch roster…
        </div>
      </div>
    )
  }

  if (needsLogin) return <RequireLoginRedirect />

  if (loadError || !item) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <FormWorkspaceBackLink to={BASE_PATH} label="Appointment Batches" />
        <EnrollmentEmptyState
          Icon={Users}
          title="Batch not found"
          description={loadError || 'This appointment batch may have been removed.'}
          actionLabel="Back to batches"
          onAction={() => navigate(BASE_PATH)}
        />
      </div>
    )
  }

  const tone = statusTone(item.status)

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to={BASE_PATH} label="Appointment Batches" />

      <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-gradient-to-br from-white via-white to-zinc-50/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900/80 dark:shadow-none">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:p-5">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900 sm:text-[22px] dark:text-zinc-50">
                {item.label}
              </h1>
              <span
                className={cn(
                  'inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase',
                  tone.wrap,
                )}
              >
                {tone.label}
              </span>
              <EnrollmentStatusBadge published={item.published} />
            </div>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
              {item.windowLabel || 'No window label'}
              <span className="mx-1.5 text-zinc-300 dark:text-zinc-600" aria-hidden>
                ·
              </span>
              <span className="tabular-nums font-semibold text-zinc-800 dark:text-zinc-200">
                {item.scheduledCount}
              </span>{' '}
              scheduled
            </p>
            <p className="max-w-xl text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Bookings on linked Routing slots land here automatically. You can also assign approved
              appointments into open seats.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-lg"
              disabled={reloading}
              onClick={() => void load({ soft: true })}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', reloading && 'animate-spin')} aria-hidden />
              Refresh
            </Button>
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
            <button
              type="button"
              disabled={assigningAll || approvedAssignable.length === 0 || !canAssign}
              onClick={() => void assignAll()}
              className={cn(formWorkspacePrimaryBtnCls, 'h-9 px-3 text-[12px]')}
              title={
                setupNeeded
                  ? 'Link Routing slots to this batch first'
                  : !canAssign
                    ? 'All linked slots are full'
                    : 'Assign all approved students not yet on this batch'
              }
            >
              {assigningAll ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <UserPlus className="h-4 w-4" aria-hidden />
              )}
              Auto-assign
            </button>
          </div>
        </div>

        {setupNeeded ? (
          <div className="border-t border-amber-200/80 bg-amber-50/80 px-4 py-3 sm:px-5 dark:border-amber-500/25 dark:bg-amber-500/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-amber-950 dark:text-amber-100">
                  Link time slots to unlock this batch
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-amber-900/80 dark:text-amber-100/75">
                  In Routing Config → Slots, set Linked batch to “{item.label}”. New bookings then
                  appear here automatically.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                className="h-9 shrink-0 rounded-lg"
                onClick={() => navigate(ROUTING_PATH)}
              >
                <Link2 className="h-3.5 w-3.5" aria-hidden />
                Open Routing Config
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="On roster"
          value={students.length}
          hint={`${counts.approved} approved · ${counts.pending} pending`}
        />
        <StatCard
          label="Ready to assign"
          value={approvedAssignable.length}
          hint="Approved students not on this batch"
          accent
        />
        <StatCard
          label="Open capacity"
          value={setupNeeded ? '—' : `${seatsLeft}`}
          hint={
            setupNeeded
              ? 'No slots linked yet'
              : `${openSlots.length} of ${slots.length} slots open`
          }
        />
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,22rem)]">
        <div className={formWorkspaceCardCls}>
          <div className={formWorkspaceCardEyebrowCls}>
            <p className={formWorkspaceCardEyebrowTextCls}>Batch · Roster</p>
          </div>
          <div className={formWorkspaceCardBodyCls}>
            <div className={formInsetPanelCls}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className={formSectionIconWrapCls}>
                    <Users className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h4 className={formSectionHeadingCls}>Students</h4>
                    <p className={formSectionIntroCls}>
                      Scheduled on slots linked to this batch.
                    </p>
                  </div>
                </div>
                <div
                  role="radiogroup"
                  aria-label="Filter roster"
                  className="inline-flex self-start rounded-lg border border-zinc-200/90 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-950"
                >
                  {(
                    [
                      ['all', 'All', counts.all],
                      ['approved', 'Approved', counts.approved],
                      ['pending', 'Pending', counts.pending],
                    ] as const
                  ).map(([fid, label, count]) => (
                    <button
                      key={fid}
                      type="button"
                      role="radio"
                      aria-checked={filter === fid}
                      onClick={() => setFilter(fid)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition',
                        filter === fid
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
                      )}
                    >
                      {label}
                      <span
                        className={cn(
                          'tabular-nums opacity-70',
                          filter === fid && 'opacity-90',
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={cn(formControlWellCls, 'mt-4 overflow-hidden p-0')}>
                {students.length === 0 ? (
                  <EnrollmentEmptyState
                    Icon={Users}
                    title="No students yet"
                    description={
                      setupNeeded
                        ? 'Link Routing slots to this batch first. Bookings on those slots will show up here automatically.'
                        : 'No one is scheduled on this batch’s slots yet. New routing-slip bookings land here when students pick a linked slot.'
                    }
                    actionLabel={setupNeeded ? 'Link slots' : 'Open appointments'}
                    onAction={() =>
                      navigate(setupNeeded ? ROUTING_PATH : APPOINTMENTS_PATH)
                    }
                    className="border-0 bg-transparent py-12"
                  />
                ) : filteredStudents.length === 0 ? (
                  <EnrollmentEmptyState
                    Icon={Search}
                    title="No matching students"
                    description={`Nothing in “${filter}” right now. Try another filter or refresh the roster.`}
                    actionLabel="Show all"
                    onAction={() => setFilter('all')}
                    className="border-0 bg-transparent py-12"
                  />
                ) : (
                  <ul className="max-h-[30rem] divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
                    {filteredStudents.map((student) => (
                      <StudentRow
                        key={student.id}
                        student={student}
                        action={
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg text-[11px]"
                            onClick={() => navigate(`${APPOINTMENTS_PATH}/${student.id}`)}
                          >
                            Open
                          </Button>
                        }
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className={formWorkspaceCardCls}>
            <div className={formWorkspaceCardEyebrowCls}>
              <p className={formWorkspaceCardEyebrowTextCls}>Assign · Queue</p>
            </div>
            <div className={formWorkspaceCardBodyCls}>
              <div className="flex min-w-0 items-start gap-2.5">
                <span className={formSectionIconWrapCls}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h4 className={formSectionHeadingCls}>Approved to assign</h4>
                  <p className={formSectionIntroCls}>
                    Place approved appointments into open seats on this batch.
                  </p>
                </div>
              </div>

              <div className={cn(formControlWellCls, 'mt-4 overflow-hidden p-0')}>
                {setupNeeded ? (
                  <EnrollmentEmptyState
                    Icon={Link2}
                    title="Slots required"
                    description="Assign needs at least one Routing slot linked to this batch."
                    actionLabel="Open Routing Config"
                    onAction={() => navigate(ROUTING_PATH)}
                    className="border-0 bg-transparent py-10"
                  />
                ) : !canAssign ? (
                  <EnrollmentEmptyState
                    Icon={Clock3}
                    title="All seats full"
                    description="Every linked slot is at capacity. Free a seat or raise capacity in Routing Config."
                    actionLabel="Review slots"
                    onAction={() => navigate(ROUTING_PATH)}
                    className="border-0 bg-transparent py-10"
                  />
                ) : approvedAssignable.length === 0 ? (
                  <EnrollmentEmptyState
                    Icon={UserPlus}
                    title="Nothing to assign"
                    description="There are no approved appointments waiting outside this batch."
                    actionLabel="Review appointments"
                    onAction={() => navigate(APPOINTMENTS_PATH)}
                    className="border-0 bg-transparent py-10"
                  />
                ) : (
                  <ul className="max-h-[16rem] divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
                    {approvedAssignable.map((student) => (
                      <StudentRow
                        key={student.id}
                        student={student}
                        action={
                          <button
                            type="button"
                            disabled={busyId === student.id}
                            onClick={() => void assignOne(student.id)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand-700 px-2.5 text-[11px] font-semibold text-white transition hover:bg-brand-800 disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
                          >
                            {busyId === student.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <UserPlus className="h-3.5 w-3.5" aria-hidden />
                            )}
                            Assign
                          </button>
                        }
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className={formWorkspaceCardCls}>
            <div className={formWorkspaceCardEyebrowCls}>
              <p className={formWorkspaceCardEyebrowTextCls}>Capacity · Slots</p>
            </div>
            <div className={formWorkspaceCardBodyCls}>
              <div className="flex min-w-0 items-start gap-2.5">
                <span className={formSectionIconWrapCls}>
                  <Clock3 className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h4 className={formSectionHeadingCls}>Linked slots</h4>
                  <p className={formSectionIntroCls}>Live occupancy for this batch.</p>
                </div>
              </div>

              <div className={cn(formControlWellCls, 'mt-4 overflow-hidden p-0')}>
                {slots.length === 0 ? (
                  <EnrollmentEmptyState
                    Icon={Clock3}
                    title="No linked slots"
                    description="Connect hourly slots from Routing Config so capacity and auto-roster can work."
                    actionLabel="Link slots"
                    onAction={() => navigate(ROUTING_PATH)}
                    className="border-0 bg-transparent py-10"
                  />
                ) : (
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {slots.map((slot) => {
                      const used = Math.min(slot.capacity, slot.bookedCount)
                      const pct =
                        slot.capacity > 0 ? Math.round((used / slot.capacity) * 100) : 0
                      return (
                        <li key={slot.id} className="space-y-2 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-semibold text-zinc-900 dark:text-zinc-50">
                                {slot.label}
                              </p>
                              <p className="text-[10px] tabular-nums text-zinc-500">
                                {slot.bookedCount}/{slot.capacity} booked
                              </p>
                            </div>
                            <span
                              className={cn(
                                'shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase',
                                slot.full
                                  ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-100'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100',
                              )}
                            >
                              {slot.full ? 'Full' : `${slot.remaining} left`}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <div
                              className={cn(
                                'h-full rounded-full transition-[width]',
                                slot.full ? 'bg-rose-500' : 'bg-brand-600',
                              )}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </aside>
      </section>

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
