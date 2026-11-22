import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { BookOpen, Loader2, Megaphone } from 'lucide-react'
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
  createOffering,
  getOffering,
  updateOffering,
  type EnrollmentOffering,
} from '@/lib/enrollment-offerings-api'
import {
  OFFERING_DAY_OPTIONS,
  buildScheduleLabel,
  buildTimeRangeLabel,
  hourToTimeInput,
  parseTimeRangeToInputs,
  timeInputToHour,
} from '@/pages/dashboard/enrollment/enrollment-admin-ui'
import { cn } from '@/lib/utils'

const BASE_PATH = '/admin/enrollment/offerings'

type EditorTab = 'content' | 'schedule' | 'publish'

const EDITOR_TABS = [
  { id: 'content' as const, label: 'Content', short: 'Course', icon: BookOpen },
  { id: 'schedule' as const, label: 'Schedule', short: 'Time', icon: BookOpen },
  { id: 'publish' as const, label: 'Publish', short: 'Live', icon: Megaphone },
]

type FormState = {
  code: string
  title: string
  section: string
  year: string
  units: string
  days: string[]
  startTime: string
  endTime: string
  timeLabel: string
  scheduleLabel: string
  capacity: string
  openCapacity: string
  availability: 'OPEN' | 'FULL'
  sortOrder: string
  published: boolean
}

const emptyForm = (): FormState => ({
  code: '',
  title: '',
  section: '',
  year: '1',
  units: '3',
  days: [],
  startTime: '08:00',
  endTime: '11:00',
  timeLabel: buildTimeRangeLabel('08:00', '11:00'),
  scheduleLabel: '',
  capacity: '40',
  openCapacity: '40',
  availability: 'OPEN',
  sortOrder: '0',
  published: true,
})

function resolveOfferingTimes(item: EnrollmentOffering): { startTime: string; endTime: string } {
  const fromLabel = parseTimeRangeToInputs(item.timeLabel || '')
  if (fromLabel) return { startTime: fromLabel.start, endTime: fromLabel.end }
  const start = Number(item.startHour)
  const end = Number(item.endHour)
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    return { startTime: hourToTimeInput(start), endTime: hourToTimeInput(end) }
  }
  return { startTime: '08:00', endTime: '11:00' }
}

function recordToForm(item: EnrollmentOffering): FormState {
  const availability: 'OPEN' | 'FULL' =
    item.availability === 'FULL' || item.full ? 'FULL' : 'OPEN'
  const capacity = String(item.capacity ?? 40)
  const { startTime, endTime } = resolveOfferingTimes(item)
  const days = item.days ?? []
  const timeLabel = item.timeLabel?.trim() || buildTimeRangeLabel(startTime, endTime)
  const scheduleLabel =
    item.scheduleLabel?.trim() || buildScheduleLabel(days, startTime, endTime)
  return {
    code: item.code,
    title: item.title,
    section: item.section,
    year: item.year || '1',
    units: String(item.units ?? 0),
    days,
    startTime,
    endTime,
    timeLabel,
    scheduleLabel,
    capacity,
    openCapacity: availability === 'OPEN' && Number(capacity) > 0 ? capacity : '40',
    availability,
    sortOrder: String(item.sortOrder),
    published: item.published,
  }
}

export default function OfferingFormPage() {
  const navigate = useNavigate()
  const { id: idParam } = useParams()
  const editId = idParam ? Number(idParam) : NaN
  const mode: 'create' | 'edit' = Number.isFinite(editId) && editId > 0 ? 'edit' : 'create'

  const [form, setForm] = useState<FormState>(emptyForm)
  const [tab, setTab] = useState<EditorTab>('content')
  const [loading, setLoading] = useState(mode === 'edit')
  const [loadError, setLoadError] = useState('')
  const [needsLogin, setNeedsLogin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<SnackToast | null>(null)

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (mode !== 'edit') {
      setForm(emptyForm())
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void getOffering(editId).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setNeedsLogin(result.status === 401 || result.status === 403)
        setLoadError(result.status === 401 || result.status === 403 ? '' : result.error)
        setLoading(false)
        return
      }
      setForm(recordToForm(result.data.item))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [mode, editId])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function applySchedule(
    prev: FormState,
    patch: Partial<Pick<FormState, 'days' | 'startTime' | 'endTime'>>,
  ): FormState {
    const days = patch.days ?? prev.days
    const startTime = patch.startTime ?? prev.startTime
    const endTime = patch.endTime ?? prev.endTime
    const timeLabel = buildTimeRangeLabel(startTime, endTime)
    return {
      ...prev,
      days,
      startTime,
      endTime,
      timeLabel,
      scheduleLabel: buildScheduleLabel(days, startTime, endTime),
    }
  }

  function toggleDay(day: string) {
    setForm((prev) => {
      const has = prev.days.includes(day)
      const days = has ? prev.days.filter((d) => d !== day) : [...prev.days, day]
      return applySchedule(prev, { days })
    })
  }

  const incomplete = !form.code.trim() || !form.title.trim() || !form.section.trim()

  const capacityNum = Number.parseInt(form.capacity, 10)

  function setAvailability(next: 'OPEN' | 'FULL') {
    setForm((prev) => {
      if (next === 'FULL') {
        const currentCap = Number.parseInt(prev.capacity, 10)
        return {
          ...prev,
          availability: 'FULL',
          openCapacity:
            Number.isFinite(currentCap) && currentCap > 0 ? String(currentCap) : prev.openCapacity,
          capacity: '0',
        }
      }
      const restore = Number.parseInt(prev.openCapacity, 10)
      return {
        ...prev,
        availability: 'OPEN',
        capacity: Number.isFinite(restore) && restore > 0 ? String(restore) : '40',
      }
    })
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (incomplete) {
      setTab('content')
      showToast('Code, title, and section are required.', 'error')
      return
    }
    const startHour = timeInputToHour(form.startTime)
    const endHour = timeInputToHour(form.endTime)
    if (!(endHour > startHour)) {
      setTab('schedule')
      showToast('End time must be after start time.', 'error')
      return
    }
    setSaving(true)
    const timeLabel = buildTimeRangeLabel(form.startTime, form.endTime)
    const scheduleLabel = buildScheduleLabel(form.days, form.startTime, form.endTime)
    const capacity =
      form.availability === 'FULL'
        ? 0
        : Number.isFinite(capacityNum)
          ? Math.max(0, capacityNum)
          : 40
    const payload = {
      code: form.code.trim(),
      title: form.title.trim(),
      section: form.section.trim(),
      year: form.year,
      units: Number.parseInt(form.units, 10) || 0,
      days: form.days,
      startHour,
      endHour,
      timeLabel,
      scheduleLabel,
      capacity,
      availability: capacity <= 0 ? 'FULL' : 'OPEN',
      sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
      published: form.published,
    }
    const result =
      mode === 'edit'
        ? await updateOffering({ ...payload, id: editId })
        : await createOffering(payload)
    setSaving(false)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) setNeedsLogin(true)
      else showToast(result.error, 'error')
      return
    }
    navigate(BASE_PATH, {
      state: {
        toast: {
          message: mode === 'edit' ? 'Offering updated.' : 'Offering created.',
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
          Loading offering…
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
          <Link to={BASE_PATH}>Back to offerings</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to={BASE_PATH} label="Course offerings" />

      <form onSubmit={(e) => void onSubmit(e)} className={formWorkspaceCardCls}>
        <div className={formWorkspaceCardEyebrowCls}>
          <p className={formWorkspaceCardEyebrowTextCls}>Enrollment · Offering</p>
        </div>

        <div className={formWorkspaceCardBodyCls}>
          <div className={formInsetPanelCls}>
            <div className={formTabChromeCardCls}>
              <div className="flex min-w-0 items-start gap-2.5">
                <span className={formSectionIconWrapCls}>
                  <BookOpen className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h4 className={formSectionHeadingCls}>
                    {mode === 'edit' ? 'Edit offering' : 'New offering'}
                  </h4>
                  <p className={formSectionIntroCls}>Shown in the class builder schedule grid.</p>
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
                        alert={item.id === 'content' && incomplete}
                      />
                    </button>
                  )
                })}
              </div>
            </div>

            <div className={formControlWellCls}>
              {tab === 'content' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className={workspaceFormFieldGroupCls}>
                    <label className={workspaceFormLabelCls} htmlFor="offering-code">
                      Code <span className={workspaceFormRequiredMarkCls}>*</span>
                    </label>
                    <input
                      id="offering-code"
                      className={catalogInput}
                      value={form.code}
                      onChange={(e) => set('code', e.target.value)}
                      disabled={saving}
                      required
                    />
                  </div>
                  <div className={workspaceFormFieldGroupCls}>
                    <label className={workspaceFormLabelCls} htmlFor="offering-section">
                      Section <span className={workspaceFormRequiredMarkCls}>*</span>
                    </label>
                    <input
                      id="offering-section"
                      className={catalogInput}
                      value={form.section}
                      onChange={(e) => set('section', e.target.value)}
                      disabled={saving}
                      required
                    />
                  </div>
                  <div className={cn(workspaceFormFieldGroupCls, 'sm:col-span-2')}>
                    <label className={workspaceFormLabelCls} htmlFor="offering-title">
                      Title <span className={workspaceFormRequiredMarkCls}>*</span>
                    </label>
                    <input
                      id="offering-title"
                      className={catalogInput}
                      value={form.title}
                      onChange={(e) => set('title', e.target.value)}
                      disabled={saving}
                      required
                    />
                  </div>
                  <div className={workspaceFormFieldGroupCls}>
                    <label className={workspaceFormLabelCls} htmlFor="offering-year">
                      Year level
                    </label>
                    <select
                      id="offering-year"
                      className={catalogInput}
                      value={form.year}
                      onChange={(e) => set('year', e.target.value)}
                      disabled={saving}
                    >
                      {[1, 2, 3, 4].map((y) => (
                        <option key={y} value={String(y)}>
                          Year {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={workspaceFormFieldGroupCls}>
                    <label className={workspaceFormLabelCls} htmlFor="offering-units">
                      Units
                    </label>
                    <input
                      id="offering-units"
                      type="number"
                      min={0}
                      className={catalogInput}
                      value={form.units}
                      onChange={(e) => set('units', e.target.value)}
                      disabled={saving}
                    />
                  </div>
                  <div className={workspaceFormFieldGroupCls}>
                    <label className={workspaceFormLabelCls} htmlFor="offering-capacity">
                      Capacity
                    </label>
                    <input
                      id="offering-capacity"
                      type="number"
                      min={0}
                      className={catalogInput}
                      value={form.capacity}
                      onChange={(e) => {
                        const value = e.target.value
                        const next = Number.parseInt(value, 10)
                        setForm((prev) => ({
                          ...prev,
                          capacity: value,
                          openCapacity:
                            Number.isFinite(next) && next > 0 ? value : prev.openCapacity,
                          availability:
                            Number.isFinite(next) && next <= 0 ? 'FULL' : 'OPEN',
                        }))
                      }}
                      disabled={saving || form.availability === 'FULL'}
                    />
                  </div>
                  <div className={workspaceFormFieldGroupCls}>
                    <p className={workspaceFormLabelCls} id="offering-availability-label">
                      Availability
                    </p>
                    <div
                      className="mt-1 inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-900"
                      role="group"
                      aria-labelledby="offering-availability-label"
                    >
                      {(['OPEN', 'FULL'] as const).map((option) => {
                        const active = form.availability === option
                        return (
                          <button
                            key={option}
                            type="button"
                            disabled={saving}
                            onClick={() => setAvailability(option)}
                            className={cn(
                              'inline-flex h-9 min-w-[4.5rem] items-center justify-center rounded-md px-3 text-[12px] font-semibold transition-colors',
                              active
                                ? option === 'OPEN'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-zinc-700 text-white'
                                : 'text-zinc-600 hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-950',
                            )}
                          >
                            {option === 'OPEN' ? 'Open' : 'Full'}
                          </button>
                        )
                      })}
                    </div>
                    <p className="mt-1.5 text-[11px] leading-4 text-zinc-500">
                      Shown in Class Builder and Class Slot Availability. Full sets capacity to 0;
                      Open restores capacity. Approved schedules can also fill seats automatically.
                    </p>
                  </div>
                </div>
              ) : null}

              {tab === 'schedule' ? (
                <div className="space-y-4">
                  <fieldset>
                    <legend className={workspaceFormLabelCls}>Meeting days</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {OFFERING_DAY_OPTIONS.map((day) => (
                        <label
                          key={day}
                          className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-[12px] font-medium dark:border-zinc-700 dark:bg-zinc-950"
                        >
                          <input
                            type="checkbox"
                            className={tableCheckboxCls}
                            checked={form.days.includes(day)}
                            onChange={() => toggleDay(day)}
                            disabled={saving}
                          />
                          {day}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="offering-start">
                        Start time
                      </label>
                      <input
                        id="offering-start"
                        type="time"
                        step={300}
                        className={catalogInput}
                        value={form.startTime}
                        onChange={(e) =>
                          setForm((prev) => applySchedule(prev, { startTime: e.target.value }))
                        }
                        disabled={saving}
                      />
                    </div>
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="offering-end">
                        End time
                      </label>
                      <input
                        id="offering-end"
                        type="time"
                        step={300}
                        className={catalogInput}
                        value={form.endTime}
                        onChange={(e) =>
                          setForm((prev) => applySchedule(prev, { endTime: e.target.value }))
                        }
                        disabled={saving}
                      />
                    </div>
                  </div>
                  <div className={formInsetPanelCls}>
                    <p className={workspaceFormLabelCls}>Public schedule preview</p>
                    <p className="mt-1.5 text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                      {form.scheduleLabel || form.timeLabel || 'Select days and times'}
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-zinc-500">
                      Saved as clock times for Class Builder so the public grid matches exactly.
                    </p>
                  </div>
                </div>
              ) : null}

              {tab === 'publish' ? (
                <div className="space-y-4">
                  <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200/90 bg-white px-3 text-[12px] font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      checked={form.published}
                      onChange={(e) => set('published', e.target.checked)}
                      className={tableCheckboxCls}
                      disabled={saving}
                    />
                    Published on enrollment hub
                  </label>
                  <div className={workspaceFormFieldGroupCls}>
                    <label className={workspaceFormLabelCls} htmlFor="offering-sort">
                      Sort order
                    </label>
                    <input
                      id="offering-sort"
                      type="number"
                      className={catalogInput}
                      value={form.sortOrder}
                      onChange={(e) => set('sortOrder', e.target.value)}
                      disabled={saving}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className={formWorkspaceCardFooterCls}>
          <button type="submit" className={formWorkspacePrimaryBtnCls} disabled={saving || incomplete}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Save
          </button>
        </div>
      </form>

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}