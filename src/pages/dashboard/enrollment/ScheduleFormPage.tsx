import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { BookOpen, ClipboardList, Loader2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { RequireLoginRedirect } from '@/components/portal/RequireLoginRedirect'
import {
  catalogInput,
  formControlWellCls,
  formInsetPanelCls,
  formSectionHeadingCls,
  formSectionIconWrapCls,
  formSectionIntroCls,
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
  listOfferings,
  type EnrollmentOffering,
} from '@/lib/enrollment-offerings-api'
import {
  createSchedule,
  getSchedule,
  updateScheduleDetails,
  type EnrollmentSchedule,
  type ScheduleOfferingSnapshot,
  type ScheduleStatus,
} from '@/lib/enrollment-schedules-api'
import { cn } from '@/lib/utils'

const BASE_PATH = '/admin/enrollment/schedules'

function isOfferingFull(item: EnrollmentOffering): boolean {
  return item.full || item.availability === 'FULL'
}

type FormState = {
  studentName: string
  studentNumber: string
  status: ScheduleStatus
  adminNote: string
  selectedOfferingIds: string[]
}

const emptyForm = (): FormState => ({
  studentName: '',
  studentNumber: '',
  status: 'pending',
  adminNote: '',
  selectedOfferingIds: [],
})

function offeringToSnapshot(item: EnrollmentOffering): ScheduleOfferingSnapshot {
  return {
    id: String(item.id),
    code: item.code,
    title: item.title,
    section: item.section,
    units: item.units,
    days: item.days ?? [],
    startHour: item.startHour,
    endHour: item.endHour,
    timeLabel: item.timeLabel || item.scheduleLabel,
  }
}

function recordToForm(item: EnrollmentSchedule): FormState {
  return {
    studentName: item.studentName,
    studentNumber: item.studentNumber,
    status: item.status,
    adminNote: item.adminNote ?? '',
    selectedOfferingIds: item.offerings.map((o) => o.id),
  }
}

export default function ScheduleFormPage() {
  const navigate = useNavigate()
  const { id: idParam } = useParams()
  const editId = idParam ? Number(idParam) : NaN
  const mode: 'create' | 'edit' = Number.isFinite(editId) && editId > 0 ? 'edit' : 'create'

  const [form, setForm] = useState<FormState>(emptyForm)
  const [offerings, setOfferings] = useState<EnrollmentOffering[]>([])
  const [existingSnapshots, setExistingSnapshots] = useState<ScheduleOfferingSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [needsLogin, setNeedsLogin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<SnackToast | null>(null)

  const catalogOfferings = useMemo(() => {
    const published = offerings.filter((o) => o.published && !isOfferingFull(o))
    const publishedIds = new Set(published.map((o) => String(o.id)))
    const extras = offerings.filter(
      (o) =>
        !o.published &&
        form.selectedOfferingIds.includes(String(o.id)) &&
        !isOfferingFull(o),
    )
    const alreadySelectedFull = offerings.filter(
      (o) => isOfferingFull(o) && form.selectedOfferingIds.includes(String(o.id)),
    )
    return [
      ...published,
      ...extras.filter((o) => !publishedIds.has(String(o.id))),
      ...alreadySelectedFull.filter((o) => !publishedIds.has(String(o.id))),
    ]
  }, [offerings, form.selectedOfferingIds])

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
    void listOfferings({ all: true }).then((offeringsResult) => {
      if (cancelled) return
      if (!offeringsResult.ok) {
        if (offeringsResult.status === 401 || offeringsResult.status === 403) setNeedsLogin(true)
        else setLoadError(offeringsResult.error)
        setLoading(false)
        return
      }
      setOfferings(offeringsResult.data.items)

      if (mode !== 'edit') {
        setForm(emptyForm())
        setExistingSnapshots([])
        setLoading(false)
        return
      }

      void getSchedule(editId).then((result) => {
        if (cancelled) return
        if (!result.ok) {
          setNeedsLogin(result.status === 401 || result.status === 403)
          setLoadError(result.status === 401 || result.status === 403 ? '' : result.error)
          setLoading(false)
          return
        }
        setExistingSnapshots(result.data.item.offerings)
        setForm(recordToForm(result.data.item))
        setLoading(false)
      })
    })
    return () => {
      cancelled = true
    }
  }, [mode, editId])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleOffering(id: string) {
    const catalog = offerings.find((o) => String(o.id) === id)
    if (catalog && isOfferingFull(catalog)) return
    setForm((prev) => {
      const has = prev.selectedOfferingIds.includes(id)
      return {
        ...prev,
        selectedOfferingIds: has
          ? prev.selectedOfferingIds.filter((x) => x !== id)
          : [...prev.selectedOfferingIds, id],
      }
    })
  }

  const incomplete =
    !form.studentName.trim() || !form.studentNumber.trim() || form.selectedOfferingIds.length === 0

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (incomplete) {
      showToast('Student details and at least one class offering are required.', 'error')
      return
    }

    const byCatalog = new Map(offerings.map((o) => [String(o.id), o]))
    const byExisting = new Map(existingSnapshots.map((o) => [o.id, o]))
    const selectedSnapshots: ScheduleOfferingSnapshot[] = []
    for (const id of form.selectedOfferingIds) {
      const catalog = byCatalog.get(id)
      if (catalog) {
        selectedSnapshots.push(offeringToSnapshot(catalog))
        continue
      }
      const existing = byExisting.get(id)
      if (existing) selectedSnapshots.push(existing)
    }
    if (selectedSnapshots.length === 0) {
      showToast('Select at least one class offering.', 'error')
      return
    }

    setSaving(true)
    const payload = {
      studentName: form.studentName.trim(),
      studentNumber: form.studentNumber.trim(),
      offerings: selectedSnapshots,
      status: form.status,
      adminNote: form.adminNote.trim(),
    }
    const result =
      mode === 'edit'
        ? await updateScheduleDetails({ ...payload, id: editId })
        : await createSchedule(payload)
    setSaving(false)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) setNeedsLogin(true)
      else showToast(result.error, 'error')
      return
    }
    navigate(BASE_PATH, {
      state: {
        toast: {
          message: mode === 'edit' ? 'Schedule updated.' : 'Schedule created.',
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
          <Link to={BASE_PATH}>Back to schedules</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to={BASE_PATH} label="Class Schedules" />

      <form onSubmit={(e) => void onSubmit(e)} className={formWorkspaceCardCls}>
        <div className={formWorkspaceCardEyebrowCls}>
          <p className={formWorkspaceCardEyebrowTextCls}>Enrollment · Schedule</p>
        </div>

        <div className={formWorkspaceCardBodyCls}>
          <div className={formInsetPanelCls}>
            <div className="flex min-w-0 items-start gap-2.5">
              <span className={formSectionIconWrapCls}>
                <ClipboardList className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <h4 className={formSectionHeadingCls}>
                  {mode === 'edit' ? 'Edit class schedule' : 'New class schedule'}
                </h4>
                <p className={formSectionIntroCls}>Student identity and proposed class load.</p>
              </div>
            </div>

            <div className={cn(formControlWellCls, 'mt-4 space-y-4')}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className={workspaceFormFieldGroupCls}>
                  <label className={workspaceFormLabelCls} htmlFor="sched-student-name">
                    Student name <span className={workspaceFormRequiredMarkCls}>*</span>
                  </label>
                  <input
                    id="sched-student-name"
                    className={catalogInput}
                    value={form.studentName}
                    onChange={(e) => set('studentName', e.target.value)}
                    disabled={saving}
                    required
                  />
                </div>
                <div className={workspaceFormFieldGroupCls}>
                  <label className={workspaceFormLabelCls} htmlFor="sched-student-number">
                    Student number <span className={workspaceFormRequiredMarkCls}>*</span>
                  </label>
                  <input
                    id="sched-student-number"
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
                  <label className={workspaceFormLabelCls} htmlFor="sched-status">
                    Status
                  </label>
                  <select
                    id="sched-status"
                    className={catalogInput}
                    value={form.status}
                    onChange={(e) => set('status', e.target.value as ScheduleStatus)}
                    disabled={saving}
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div className={workspaceFormFieldGroupCls}>
                <label className={workspaceFormLabelCls} htmlFor="sched-admin-note">
                  Admin note
                </label>
                <textarea
                  id="sched-admin-note"
                  className={cn(catalogInput, 'min-h-[88px] resize-y py-2.5')}
                  value={form.adminNote}
                  onChange={(e) => set('adminNote', e.target.value)}
                  disabled={saving}
                />
              </div>

              <h4 className={formSectionHeadingCls}>
                Class offerings <span className={workspaceFormRequiredMarkCls}>*</span>
              </h4>
              <p className={formSectionIntroCls}>
                Select class offerings ({form.selectedOfferingIds.length} selected).
              </p>
              {catalogOfferings.length === 0 && existingSnapshots.length === 0 ? (
                <p className="text-[13px] text-zinc-500">No offerings available.</p>
              ) : (
                <ul className="max-h-[22rem] space-y-2 overflow-y-auto rounded-xl border border-zinc-200/80 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
                  {catalogOfferings.map((item) => {
                    const id = String(item.id)
                    const checked = form.selectedOfferingIds.includes(id)
                    const slotFull = isOfferingFull(item)
                    return (
                      <li key={id}>
                        <label
                          className={cn(
                            'flex items-start gap-2 rounded-lg border px-3 py-2.5 transition',
                            slotFull && !checked
                              ? 'cursor-not-allowed opacity-60'
                              : 'cursor-pointer',
                            checked
                              ? 'border-brand-300/70 bg-brand-50/50 dark:border-brand-500/35 dark:bg-brand-500/10'
                              : 'border-transparent hover:border-zinc-200 hover:bg-zinc-50/80 dark:hover:border-zinc-800 dark:hover:bg-zinc-900/50',
                          )}
                        >
                          <input
                            type="checkbox"
                            className={cn(tableCheckboxCls, 'mt-0.5')}
                            checked={checked}
                            onChange={() => toggleOffering(id)}
                            disabled={saving || (slotFull && !checked)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
                              <BookOpen className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden />
                              {item.code} · {item.title}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-zinc-500">
                              {item.section} · {item.units}u ·{' '}
                              {item.timeLabel || item.scheduleLabel || '—'}
                              {slotFull ? ' · FULL' : item.remaining >= 0 ? ` · ${item.remaining} seats` : ''}
                            </span>
                          </span>
                        </label>
                      </li>
                    )
                  })}
                  {existingSnapshots
                    .filter(
                      (snap) =>
                        form.selectedOfferingIds.includes(snap.id) &&
                        !catalogOfferings.some((o) => String(o.id) === snap.id),
                    )
                    .map((snap) => (
                      <li key={`snap-${snap.id}-${snap.code}`}>
                        <label
                          className={cn(
                            'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 transition',
                            'border-brand-300/70 bg-brand-50/50 dark:border-brand-500/35 dark:bg-brand-500/10',
                          )}
                        >
                          <input
                            type="checkbox"
                            className={cn(tableCheckboxCls, 'mt-0.5')}
                            checked
                            onChange={() => toggleOffering(snap.id)}
                            disabled={saving}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
                              <BookOpen className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden />
                              {snap.code} · {snap.title}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-zinc-500">
                              {snap.section} · {snap.units}u · {snap.timeLabel || '—'} (saved)
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className={formWorkspaceCardFooterCls}>
          <button
            type="submit"
            className={formWorkspacePrimaryBtnCls}
            disabled={saving || incomplete}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Save
          </button>
        </div>
      </form>

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}