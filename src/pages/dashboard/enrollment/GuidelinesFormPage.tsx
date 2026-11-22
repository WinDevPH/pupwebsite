import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { BookOpen, CalendarDays, Clock, Loader2, Megaphone } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
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
  createBatchWindow,
  createScheduleDay,
  getBatchWindow,
  getScheduleDay,
  updateBatchWindow,
  updateScheduleDay,
  type EnrollmentBatchWindow,
  type EnrollmentScheduleDay,
} from '@/lib/enrollment-guidelines-api'
import {
  buildTimeRangeLabel,
  formatEnrollmentDateLabel,
  parseEnrollmentDateToIso,
  parseTimeRangeToInputs,
} from '@/pages/dashboard/enrollment/enrollment-admin-ui'

const BASE_PATH = '/admin/enrollment/guidelines'

type EditorTab = 'content' | 'publish'
type Kind = 'schedule' | 'windows'

const EDITOR_TABS = [
  { id: 'content' as const, label: 'Content', short: 'Fields', icon: BookOpen },
  { id: 'publish' as const, label: 'Publish', short: 'Live', icon: Megaphone },
]

type ScheduleForm = {
  dateIso: string
  dateLabel: string
  groupLabel: string
  dayLabel: string
  muted: boolean
  sortOrder: string
  published: boolean
}

type WindowForm = {
  label: string
  startTime: string
  endTime: string
  timeLabel: string
  detail: string
  tone: 'active' | 'pause'
  sortOrder: string
  published: boolean
}

const emptySchedule = (): ScheduleForm => ({
  dateIso: '',
  dateLabel: '',
  groupLabel: '',
  dayLabel: '',
  muted: false,
  sortOrder: '0',
  published: true,
})

const emptyWindow = (): WindowForm => ({
  label: '',
  startTime: '10:00',
  endTime: '12:00',
  timeLabel: buildTimeRangeLabel('10:00', '12:00'),
  detail: '',
  tone: 'active',
  sortOrder: '0',
  published: true,
})

function scheduleToForm(row: EnrollmentScheduleDay): ScheduleForm {
  const dateIso = parseEnrollmentDateToIso(row.dateLabel)
  return {
    dateIso,
    dateLabel: row.dateLabel,
    groupLabel: row.groupLabel,
    dayLabel: row.dayLabel,
    muted: row.muted,
    sortOrder: String(row.sortOrder),
    published: row.published,
  }
}

function windowToForm(row: EnrollmentBatchWindow): WindowForm {
  const range = parseTimeRangeToInputs(row.timeLabel || '')
  const startTime = range?.start ?? '10:00'
  const endTime = range?.end ?? '12:00'
  return {
    label: row.label,
    startTime,
    endTime,
    timeLabel: row.timeLabel || buildTimeRangeLabel(startTime, endTime),
    detail: row.detail,
    tone: row.tone === 'pause' ? 'pause' : 'active',
    sortOrder: String(row.sortOrder),
    published: row.published,
  }
}

export default function GuidelinesFormPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id: idParam } = useParams()
  const editId = idParam ? Number(idParam) : NaN
  const mode: 'create' | 'edit' = Number.isFinite(editId) && editId > 0 ? 'edit' : 'create'

  const kind: Kind | null = useMemo(() => {
    if (location.pathname.includes('/schedule/')) return 'schedule'
    if (location.pathname.includes('/windows/')) return 'windows'
    return null
  }, [location.pathname])

  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(emptySchedule)
  const [windowForm, setWindowForm] = useState<WindowForm>(emptyWindow)
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
    setTab('content')
    if (!kind) {
      setLoading(false)
      return
    }
    if (mode !== 'edit') {
      setScheduleForm(emptySchedule())
      setWindowForm(emptyWindow())
      setLoading(false)
      setLoadError('')
      setNeedsLogin(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError('')

    const applyFailure = (status: number, error: string) => {
      if (status === 401 || status === 403) {
        setNeedsLogin(true)
        setLoadError('')
      } else {
        setNeedsLogin(false)
        setLoadError(error)
      }
      setLoading(false)
    }

    if (kind === 'schedule') {
      void getScheduleDay(editId).then((result) => {
        if (cancelled) return
        if (!result.ok) {
          applyFailure(result.status, result.error)
          return
        }
        setNeedsLogin(false)
        setScheduleForm(scheduleToForm(result.data.item))
        setLoading(false)
      })
    } else {
      void getBatchWindow(editId).then((result) => {
        if (cancelled) return
        if (!result.ok) {
          applyFailure(result.status, result.error)
          return
        }
        setNeedsLogin(false)
        setWindowForm(windowToForm(result.data.item))
        setLoading(false)
      })
    }

    return () => {
      cancelled = true
    }
  }, [kind, mode, editId])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!kind) return

    if (kind === 'schedule') {
      if (!scheduleForm.dateLabel.trim() || !scheduleForm.groupLabel.trim() || !scheduleForm.dayLabel.trim()) {
        setTab('content')
        showToast('Date, group, and day labels are required.', 'error')
        return
      }
      setSaving(true)
      const payload = {
        dateLabel: scheduleForm.dateLabel.trim(),
        groupLabel: scheduleForm.groupLabel.trim(),
        dayLabel: scheduleForm.dayLabel.trim(),
        muted: scheduleForm.muted,
        sortOrder: Number.parseInt(scheduleForm.sortOrder, 10) || 0,
        published: scheduleForm.published,
      }
      const result =
        mode === 'edit'
          ? await updateScheduleDay({ ...payload, id: editId })
          : await createScheduleDay(payload)
      setSaving(false)
      if (!result.ok) {
        if (result.status === 401 || result.status === 403) setNeedsLogin(true)
        else showToast(result.error, 'error')
        return
      }
      navigate(BASE_PATH, {
        state: {
          toast: {
            message: mode === 'edit' ? 'Schedule day updated.' : 'Schedule day created.',
            variant: 'success' as const,
          },
        },
      })
      return
    }

    const timeLabel =
      buildTimeRangeLabel(windowForm.startTime, windowForm.endTime).trim() ||
      windowForm.timeLabel.trim()
    if (!windowForm.label.trim() || !timeLabel) {
      setTab('content')
      showToast('Label and time are required.', 'error')
      return
    }
    setSaving(true)
    const payload = {
      label: windowForm.label.trim(),
      timeLabel,
      detail: windowForm.detail.trim(),
      tone: windowForm.tone,
      sortOrder: Number.parseInt(windowForm.sortOrder, 10) || 0,
      published: windowForm.published,
    }
    const result =
      mode === 'edit'
        ? await updateBatchWindow({ ...payload, id: editId })
        : await createBatchWindow(payload)
    setSaving(false)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) setNeedsLogin(true)
      else showToast(result.error, 'error')
      return
    }
    navigate(BASE_PATH, {
      state: {
        toast: {
          message: mode === 'edit' ? 'Batch window updated.' : 'Batch window created.',
          variant: 'success' as const,
        },
      },
    })
  }

  if (!kind) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <p className="text-sm text-zinc-700">Unknown guidelines form route.</p>
        <Button asChild variant="outline">
          <Link to={BASE_PATH}>Back to guidelines</Link>
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300/90 bg-zinc-50/80 px-5 py-16 text-[13px] text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-hidden />
          Loading…
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
          <Link to={BASE_PATH}>Back to guidelines</Link>
        </Button>
      </div>
    )
  }

  const Icon = kind === 'schedule' ? CalendarDays : Clock
  const heading =
    kind === 'schedule'
      ? mode === 'edit'
        ? 'Edit schedule day'
        : 'New schedule day'
      : mode === 'edit'
        ? 'Edit batch window'
        : 'New batch window'
  const eyebrow = kind === 'schedule' ? 'Guidelines · Schedule' : 'Guidelines · Windows'
  const contentIncomplete =
    kind === 'schedule'
      ? !scheduleForm.dateLabel.trim() ||
        !scheduleForm.groupLabel.trim() ||
        !scheduleForm.dayLabel.trim()
      : !windowForm.label.trim() || !windowForm.timeLabel.trim()

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to={BASE_PATH} label="Enrollment guidelines" />

      <form onSubmit={(e) => void onSubmit(e)} className={formWorkspaceCardCls}>
        <div className={formWorkspaceCardEyebrowCls}>
          <p className={formWorkspaceCardEyebrowTextCls}>{eyebrow}</p>
        </div>

        <div className={formWorkspaceCardBodyCls}>
          <div className={formInsetPanelCls}>
            <div className={formTabChromeCardCls}>
              <div className="flex min-w-0 items-start gap-2.5">
                <span className={formSectionIconWrapCls}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h4 className={formSectionHeadingCls}>{heading}</h4>
                  <p className={formSectionIntroCls}>Shown on the enrollment guidelines hub.</p>
                </div>
              </div>
              <div className={formTabListCls} role="tablist">
                {EDITOR_TABS.map((item) => {
                  const TabIcon = item.icon
                  const active = tab === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={formTabBtnCls(active)}
                      disabled={saving}
                      onClick={() => setTab(item.id)}
                    >
                      <TabIcon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                      <FormSectionTabLabel
                        label={item.label}
                        short={item.short}
                        alert={item.id === 'content' && contentIncomplete}
                      />
                    </button>
                  )
                })}
              </div>
            </div>

            <div className={formControlWellCls}>
              {tab === 'content' && kind === 'schedule' ? (
                <ScheduleFields form={scheduleForm} saving={saving} onChange={setScheduleForm} />
              ) : null}
              {tab === 'content' && kind === 'windows' ? (
                <WindowFields form={windowForm} saving={saving} onChange={setWindowForm} />
              ) : null}
              {tab === 'publish' ? (
                <div className="space-y-4">
                  <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200/90 bg-white px-3 text-[12px] font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      checked={kind === 'schedule' ? scheduleForm.published : windowForm.published}
                      onChange={(e) =>
                        kind === 'schedule'
                          ? setScheduleForm((p) => ({ ...p, published: e.target.checked }))
                          : setWindowForm((p) => ({ ...p, published: e.target.checked }))
                      }
                      className={tableCheckboxCls}
                      disabled={saving}
                    />
                    Published on enrollment hub
                  </label>
                  {kind === 'schedule' ? (
                    <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200/90 bg-white px-3 text-[12px] font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                      <input
                        type="checkbox"
                        checked={scheduleForm.muted}
                        onChange={(e) =>
                          setScheduleForm((p) => ({ ...p, muted: e.target.checked }))
                        }
                        className={tableCheckboxCls}
                        disabled={saving}
                      />
                      Muted styling
                    </label>
                  ) : null}
                  <div className={workspaceFormFieldGroupCls}>
                    <label className={workspaceFormLabelCls} htmlFor="guidelines-sort">
                      Sort order
                    </label>
                    <input
                      id="guidelines-sort"
                      type="number"
                      className={catalogInput}
                      value={kind === 'schedule' ? scheduleForm.sortOrder : windowForm.sortOrder}
                      onChange={(e) =>
                        kind === 'schedule'
                          ? setScheduleForm((p) => ({ ...p, sortOrder: e.target.value }))
                          : setWindowForm((p) => ({ ...p, sortOrder: e.target.value }))
                      }
                      disabled={saving}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className={formWorkspaceCardFooterCls}>
          <button
            type="submit"
            className={formWorkspacePrimaryBtnCls}
            disabled={saving || contentIncomplete}
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

function ScheduleFields({
  form,
  saving,
  onChange,
}: {
  form: ScheduleForm
  saving: boolean
  onChange: React.Dispatch<React.SetStateAction<ScheduleForm>>
}) {
  function set<K extends keyof ScheduleForm>(key: K, value: ScheduleForm[K]) {
    onChange((prev) => ({ ...prev, [key]: value }))
  }
  return (
    <div className="space-y-4">
      <div className={workspaceFormFieldGroupCls}>
        <label className={workspaceFormLabelCls} htmlFor="schedule-date">
          Date <span className={workspaceFormRequiredMarkCls}>*</span>
        </label>
        <input
          id="schedule-date"
          type="date"
          className={catalogInput}
          value={form.dateIso}
          onChange={(e) => {
            const iso = e.target.value
            onChange((prev) => ({
              ...prev,
              dateIso: iso,
              dateLabel: formatEnrollmentDateLabel(iso) || prev.dateLabel,
            }))
          }}
          disabled={saving}
          required
        />
      </div>
      <div className={workspaceFormFieldGroupCls}>
        <label className={workspaceFormLabelCls} htmlFor="schedule-dateLabel">
          Date label <span className={workspaceFormRequiredMarkCls}>*</span>
        </label>
        <input
          id="schedule-dateLabel"
          type="text"
          className={catalogInput}
          value={form.dateLabel}
          onChange={(e) => set('dateLabel', e.target.value)}
          disabled={saving}
          required
        />
        <p className="mt-1 text-[11px] text-zinc-500">
          Auto-filled from the date; edit for a custom public label.
        </p>
      </div>
      <div className={workspaceFormFieldGroupCls}>
        <label className={workspaceFormLabelCls} htmlFor="schedule-groupLabel">
          Group label <span className={workspaceFormRequiredMarkCls}>*</span>
        </label>
        <input
          id="schedule-groupLabel"
          type="text"
          className={catalogInput}
          value={form.groupLabel}
          onChange={(e) => set('groupLabel', e.target.value)}
          disabled={saving}
          required
        />
      </div>
      <div className={workspaceFormFieldGroupCls}>
        <label className={workspaceFormLabelCls} htmlFor="schedule-dayLabel">
          Day label <span className={workspaceFormRequiredMarkCls}>*</span>
        </label>
        <input
          id="schedule-dayLabel"
          type="text"
          className={catalogInput}
          value={form.dayLabel}
          onChange={(e) => set('dayLabel', e.target.value)}
          disabled={saving}
          required
        />
      </div>
    </div>
  )
}

function WindowFields({
  form,
  saving,
  onChange,
}: {
  form: WindowForm
  saving: boolean
  onChange: React.Dispatch<React.SetStateAction<WindowForm>>
}) {
  function set<K extends keyof WindowForm>(key: K, value: WindowForm[K]) {
    onChange((prev) => ({ ...prev, [key]: value }))
  }
  function applyTimes(startTime: string, endTime: string) {
    onChange((prev) => ({
      ...prev,
      startTime,
      endTime,
      timeLabel: buildTimeRangeLabel(startTime, endTime),
    }))
  }
  return (
    <div className="space-y-4">
      <div className={workspaceFormFieldGroupCls}>
        <label className={workspaceFormLabelCls} htmlFor="window-label">
          Label <span className={workspaceFormRequiredMarkCls}>*</span>
        </label>
        <input
          id="window-label"
          type="text"
          className={catalogInput}
          value={form.label}
          onChange={(e) => set('label', e.target.value)}
          disabled={saving}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={workspaceFormFieldGroupCls}>
          <label className={workspaceFormLabelCls} htmlFor="window-start">
            Start time <span className={workspaceFormRequiredMarkCls}>*</span>
          </label>
          <input
            id="window-start"
            type="time"
            step={300}
            className={catalogInput}
            value={form.startTime}
            onChange={(e) => applyTimes(e.target.value, form.endTime)}
            disabled={saving}
            required
          />
        </div>
        <div className={workspaceFormFieldGroupCls}>
          <label className={workspaceFormLabelCls} htmlFor="window-end">
            End time <span className={workspaceFormRequiredMarkCls}>*</span>
          </label>
          <input
            id="window-end"
            type="time"
            step={300}
            className={catalogInput}
            value={form.endTime}
            onChange={(e) => applyTimes(form.startTime, e.target.value)}
            disabled={saving}
            required
          />
        </div>
      </div>
      <div className={formInsetPanelCls}>
        <p className={workspaceFormLabelCls}>Public time label</p>
        <p className="mt-1.5 text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
          {form.timeLabel || 'Pick start and end'}
        </p>
      </div>
      <div className={workspaceFormFieldGroupCls}>
        <label className={workspaceFormLabelCls} htmlFor="window-detail">
          Detail
        </label>
        <input
          id="window-detail"
          type="text"
          className={catalogInput}
          value={form.detail}
          onChange={(e) => set('detail', e.target.value)}
          disabled={saving}
        />
      </div>
      <div className={workspaceFormFieldGroupCls}>
        <label className={workspaceFormLabelCls} htmlFor="window-tone">
          Tone
        </label>
        <select
          id="window-tone"
          className={catalogInput}
          value={form.tone}
          onChange={(e) => set('tone', e.target.value as 'active' | 'pause')}
          disabled={saving}
        >
          <option value="active">Active</option>
          <option value="pause">Pause</option>
        </select>
      </div>
    </div>
  )
}