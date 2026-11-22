import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Calendar,
  Clock,
  CreditCard,
  Loader2,
  MapPin,
  Megaphone,
  ScrollText,
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
import { listAppointmentBatches, type EnrollmentAppointmentBatch } from '@/lib/enrollment-batches-api'
import {
  createPaymentChannel,
  createRoutingDate,
  createRoutingSlot,
  createRoutingStep,
  getRoutingBundle,
  updatePaymentChannel,
  updateRoutingDate,
  updateRoutingSlot,
  updateRoutingStep,
  type EnrollmentDate,
  type EnrollmentPaymentChannel,
  type EnrollmentRoutingStep,
  type EnrollmentTimeSlot,
} from '@/lib/enrollment-routing-api'
import {
  buildTimeRangeLabel,
  formatEnrollmentDateLabel,
  parseTimeRangeToInputs,
} from '@/pages/dashboard/enrollment/enrollment-admin-ui'
import { cn } from '@/lib/utils'

const BASE_PATH = '/admin/enrollment/routing'

type ListKind = 'dates' | 'slots' | 'channels' | 'stations'
type EditorTab = 'content' | 'publish'

const KIND_META: Record<
  ListKind,
  { label: string; singular: string; Icon: typeof Calendar; eyebrow: string }
> = {
  dates: { label: 'Dates', singular: 'date', Icon: Calendar, eyebrow: 'Enrollment · Date' },
  slots: { label: 'Slots', singular: 'time slot', Icon: Clock, eyebrow: 'Enrollment · Slot' },
  channels: {
    label: 'Payment channels',
    singular: 'payment channel',
    Icon: CreditCard,
    eyebrow: 'Enrollment · Channel',
  },
  stations: {
    label: 'Stations',
    singular: 'station',
    Icon: MapPin,
    eyebrow: 'Enrollment · Station',
  },
}

const EDITOR_TABS = [
  { id: 'content' as const, label: 'Content', short: 'Fields', icon: ScrollText },
  { id: 'publish' as const, label: 'Publish', short: 'Live', icon: Megaphone },
]

function parseKind(raw: string | undefined): ListKind | null {
  if (raw === 'dates' || raw === 'slots' || raw === 'channels' || raw === 'stations') return raw
  return null
}

type FormState = {
  value: string
  label: string
  description: string
  batchId: string
  key: string
  title: string
  lines: string
  copyValue: string
  step: string
  office: string
  signatureNote: string
  sortOrder: string
  published: boolean
  startTime: string
  endTime: string
}

const emptyForm = (): FormState => ({
  value: '',
  label: '',
  description: '',
  batchId: '',
  key: '',
  title: '',
  lines: '',
  copyValue: '',
  step: '',
  office: '',
  signatureNote: '',
  sortOrder: '0',
  published: true,
  startTime: '10:00',
  endTime: '11:00',
})

function dateToForm(row: EnrollmentDate): FormState {
  return {
    ...emptyForm(),
    value: row.value,
    label: row.label,
    description: row.description,
    sortOrder: String(row.sortOrder),
    published: row.published,
  }
}

function slotToForm(row: EnrollmentTimeSlot): FormState {
  const range = parseTimeRangeToInputs(row.value || row.label || '')
  const startTime = range?.start ?? '10:00'
  const endTime = range?.end ?? '11:00'
  const rangeLabel = buildTimeRangeLabel(startTime, endTime)
  return {
    ...emptyForm(),
    value: rangeLabel || row.value,
    label: rangeLabel || row.label,
    description: row.description,
    batchId: row.batchId != null ? String(row.batchId) : '',
    sortOrder: String(row.sortOrder),
    published: row.published,
    startTime,
    endTime,
  }
}

function channelToForm(row: EnrollmentPaymentChannel): FormState {
  return {
    ...emptyForm(),
    key: row.key,
    title: row.title,
    lines: row.lines.join('\n'),
    copyValue: row.copyValue,
    sortOrder: String(row.sortOrder),
    published: row.published,
  }
}

function stepToForm(row: EnrollmentRoutingStep): FormState {
  return {
    ...emptyForm(),
    step: row.step,
    office: row.office,
    signatureNote: row.signatureNote ?? '',
    sortOrder: String(row.sortOrder),
    published: row.published,
  }
}

export default function RoutingFormPage() {
  const navigate = useNavigate()
  const { kind: kindParam, id: idParam } = useParams()
  const kind = parseKind(kindParam)
  const editId = idParam ? Number(idParam) : NaN
  const mode: 'create' | 'edit' = Number.isFinite(editId) && editId > 0 ? 'edit' : 'create'
  const meta = kind ? KIND_META[kind] : null

  const [form, setForm] = useState<FormState>(emptyForm)
  const [existingSlot, setExistingSlot] = useState<EnrollmentTimeSlot | null>(null)
  const [batches, setBatches] = useState<EnrollmentAppointmentBatch[]>([])
  const [tab, setTab] = useState<EditorTab>('content')
  const [loading, setLoading] = useState(true)
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
    if (!kind) {
      setLoading(false)
      setLoadError('Unknown routing record type.')
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError('')
    setTab('content')

    void Promise.all([getRoutingBundle({ all: true }), listAppointmentBatches({ all: true })]).then(
      ([bundleResult, batchesResult]) => {
        if (cancelled) return

        if (!bundleResult.ok) {
          if (bundleResult.status === 401 || bundleResult.status === 403) setNeedsLogin(true)
          else setLoadError(bundleResult.error)
          setLoading(false)
          return
        }

        if (batchesResult.ok) setBatches(batchesResult.data.items)
        else setBatches([])

        if (mode !== 'edit') {
          setForm(emptyForm())
          setExistingSlot(null)
          setLoading(false)
          return
        }

        const bundle = bundleResult.data
        if (kind === 'dates') {
          const row = bundle.dates.find((d) => d.id === editId)
          if (!row) {
            setLoadError('Date option not found.')
            setLoading(false)
            return
          }
          setForm(dateToForm(row))
          setExistingSlot(null)
        } else if (kind === 'slots') {
          const row = bundle.slots.find((s) => s.id === editId)
          if (!row) {
            setLoadError('Time slot not found.')
            setLoading(false)
            return
          }
          setForm(slotToForm(row))
          setExistingSlot(row)
        } else if (kind === 'channels') {
          const row = bundle.channels.find((c) => c.id === editId)
          if (!row) {
            setLoadError('Payment channel not found.')
            setLoading(false)
            return
          }
          setForm(channelToForm(row))
          setExistingSlot(null)
        } else {
          const row = bundle.steps.find((s) => s.id === editId)
          if (!row) {
            setLoadError('Station step not found.')
            setLoading(false)
            return
          }
          setForm(stepToForm(row))
          setExistingSlot(null)
        }
        setLoading(false)
      },
    )

    return () => {
      cancelled = true
    }
  }, [kind, mode, editId])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const contentIncomplete = useMemo(() => {
    if (!kind) return true
    if (kind === 'dates') return !form.value.trim() || !form.label.trim()
    if (kind === 'slots') return !form.startTime || !form.endTime
    if (kind === 'channels') return !form.key.trim() || !form.title.trim()
    return !form.step.trim() || !form.office.trim()
  }, [kind, form])

  function applySlotTimes(startTime: string, endTime: string) {
    const rangeLabel = buildTimeRangeLabel(startTime, endTime)
    setForm((prev) => ({
      ...prev,
      startTime,
      endTime,
      value: rangeLabel,
      label: rangeLabel,
    }))
  }

  function applyDateValue(iso: string) {
    setForm((prev) => ({
      ...prev,
      value: iso,
      label: formatEnrollmentDateLabel(iso) || prev.label,
    }))
  }

  function backToList(toastMessage?: string) {
    navigate(BASE_PATH, {
      state: {
        tab: kind ?? 'dates',
        ...(toastMessage
          ? { toast: { message: toastMessage, variant: 'success' as const } }
          : {}),
      },
    })
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!kind || contentIncomplete) {
      setTab('content')
      showToast('Fill required fields before saving.', 'error')
      return
    }

    setSaving(true)
    const sort = Number.parseInt(form.sortOrder, 10) || 0
    let result

    if (kind === 'dates') {
      const payload = {
        value: form.value.trim(),
        label: form.label.trim(),
        description: form.description.trim(),
        sortOrder: sort,
        published: form.published,
      }
      result =
        mode === 'edit'
          ? await updateRoutingDate({ ...payload, id: editId })
          : await createRoutingDate(payload)
    } else if (kind === 'slots') {
      const rangeLabel = buildTimeRangeLabel(form.startTime, form.endTime).trim()
      if (!rangeLabel) {
        setSaving(false)
        setTab('content')
        showToast('Pick a valid start and end time.', 'error')
        return
      }
      const parsedBatchId = form.batchId.trim() ? Number.parseInt(form.batchId, 10) : null
      const slotBatchId =
        parsedBatchId != null && Number.isFinite(parsedBatchId) && parsedBatchId > 0
          ? parsedBatchId
          : null
      if (mode === 'edit' && existingSlot) {
        result = await updateRoutingSlot({
          ...existingSlot,
          value: rangeLabel,
          label: rangeLabel,
          description: form.description.trim(),
          capacity: existingSlot.capacity,
          batchId: slotBatchId,
          sortOrder: sort,
          published: form.published,
        })
      } else {
        result = await createRoutingSlot({
          value: rangeLabel,
          label: rangeLabel,
          description: form.description.trim(),
          capacity: 40,
          batchId: slotBatchId,
          sortOrder: sort,
          published: form.published,
        })
      }
    } else if (kind === 'channels') {
      const payload = {
        key: form.key.trim(),
        title: form.title.trim(),
        lines: form.lines
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
        copyValue: form.copyValue.trim(),
        sortOrder: sort,
        published: form.published,
      }
      result =
        mode === 'edit'
          ? await updatePaymentChannel({ ...payload, id: editId })
          : await createPaymentChannel(payload)
    } else {
      const payload = {
        step: form.step.trim(),
        office: form.office.trim(),
        signatureNote: form.signatureNote.trim() || null,
        sortOrder: sort,
        published: form.published,
      }
      result =
        mode === 'edit'
          ? await updateRoutingStep({ ...payload, id: editId })
          : await createRoutingStep(payload)
    }

    setSaving(false)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) setNeedsLogin(true)
      else showToast(result.error, 'error')
      return
    }

    backToList(mode === 'edit' ? 'Record updated.' : 'Record created.')
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

  if (!kind || !meta || loadError) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <FormWorkspaceBackLink to={BASE_PATH} label="Routing Config" />
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {loadError || 'Unknown routing record type.'}
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link to={BASE_PATH}>Back to routing</Link>
        </Button>
      </div>
    )
  }

  const Icon = meta.Icon

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to={BASE_PATH} label="Routing Config" />

      <form onSubmit={(e) => void onSubmit(e)} className={formWorkspaceCardCls}>
        <div className={formWorkspaceCardEyebrowCls}>
          <p className={formWorkspaceCardEyebrowTextCls}>{meta.eyebrow}</p>
        </div>

        <div className={formWorkspaceCardBodyCls}>
          <div className={formInsetPanelCls}>
            <div className={formTabChromeCardCls}>
              <div className="flex min-w-0 items-start gap-2.5">
                <span className={formSectionIconWrapCls}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h4 className={formSectionHeadingCls}>
                    {mode === 'edit' ? `Edit ${meta.singular}` : `New ${meta.singular}`}
                  </h4>
                  <p className={formSectionIntroCls}>
                    Routing slip inventory used by the public wizard and appointments.
                  </p>
                </div>
              </div>
              <div className={cn(formTabListCls, 'sm:grid-cols-2')} role="tablist">
                {EDITOR_TABS.map((item) => {
                  const TabIcon = item.icon
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
              {tab === 'content' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {kind === 'dates' ? (
                    <>
                      <div className={workspaceFormFieldGroupCls}>
                        <label className={workspaceFormLabelCls} htmlFor="routing-value">
                          Date <span className={workspaceFormRequiredMarkCls}>*</span>
                        </label>
                        <input
                          id="routing-value"
                          type="date"
                          className={catalogInput}
                          value={form.value}
                          onChange={(e) => applyDateValue(e.target.value)}
                          disabled={saving}
                          required
                        />
                      </div>
                      <div className={workspaceFormFieldGroupCls}>
                        <label className={workspaceFormLabelCls} htmlFor="routing-label">
                          Label <span className={workspaceFormRequiredMarkCls}>*</span>
                        </label>
                        <input
                          id="routing-label"
                          className={catalogInput}
                          value={form.label}
                          onChange={(e) => set('label', e.target.value)}
                          disabled={saving}
                          required
                        />
                        <p className="mt-1 text-[11px] text-zinc-500">
                          Auto-filled from the date; edit if you need a custom public label.
                        </p>
                      </div>
                      <div className={cn(workspaceFormFieldGroupCls, 'sm:col-span-2')}>
                        <label className={workspaceFormLabelCls} htmlFor="routing-description">
                          Description
                        </label>
                        <textarea
                          id="routing-description"
                          className={cn(catalogInput, 'min-h-[4.5rem] resize-y py-2.5')}
                          value={form.description}
                          onChange={(e) => set('description', e.target.value)}
                          disabled={saving}
                        />
                      </div>
                    </>
                  ) : null}
                  {kind === 'slots' ? (
                    <>
                      <div className={workspaceFormFieldGroupCls}>
                        <label className={workspaceFormLabelCls} htmlFor="routing-slot-start">
                          Start time <span className={workspaceFormRequiredMarkCls}>*</span>
                        </label>
                        <input
                          id="routing-slot-start"
                          type="time"
                          step={300}
                          className={catalogInput}
                          value={form.startTime}
                          onChange={(e) => applySlotTimes(e.target.value, form.endTime)}
                          disabled={saving}
                          required
                        />
                      </div>
                      <div className={workspaceFormFieldGroupCls}>
                        <label className={workspaceFormLabelCls} htmlFor="routing-slot-end">
                          End time <span className={workspaceFormRequiredMarkCls}>*</span>
                        </label>
                        <input
                          id="routing-slot-end"
                          type="time"
                          step={300}
                          className={catalogInput}
                          value={form.endTime}
                          onChange={(e) => applySlotTimes(form.startTime, e.target.value)}
                          disabled={saving}
                          required
                        />
                      </div>
                      <div className={cn(workspaceFormFieldGroupCls, 'sm:col-span-2')}>
                        <p className={workspaceFormLabelCls}>Public slot label</p>
                        <p className="mt-1.5 text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                          {buildTimeRangeLabel(form.startTime, form.endTime) || 'Pick start and end'}
                        </p>
                      </div>
                      <div className={cn(workspaceFormFieldGroupCls, 'sm:col-span-2')}>
                        <label className={workspaceFormLabelCls} htmlFor="routing-description">
                          Description
                        </label>
                        <textarea
                          id="routing-description"
                          className={cn(catalogInput, 'min-h-[4.5rem] resize-y py-2.5')}
                          value={form.description}
                          onChange={(e) => set('description', e.target.value)}
                          disabled={saving}
                        />
                      </div>
                      <div className={cn(workspaceFormFieldGroupCls, 'sm:col-span-2')}>
                        <label className={workspaceFormLabelCls} htmlFor="routing-batch">
                          Linked batch (optional)
                        </label>
                        <select
                          id="routing-batch"
                          className={catalogInput}
                          value={form.batchId}
                          onChange={(e) => set('batchId', e.target.value)}
                          disabled={saving}
                        >
                          <option value="">None</option>
                          {batches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : null}

                  {kind === 'channels' ? (
                    <>
                      <div className={workspaceFormFieldGroupCls}>
                        <label className={workspaceFormLabelCls} htmlFor="routing-key">
                          Key <span className={workspaceFormRequiredMarkCls}>*</span>
                        </label>
                        <input
                          id="routing-key"
                          className={catalogInput}
                          value={form.key}
                          onChange={(e) => set('key', e.target.value)}
                          disabled={saving}
                          required
                        />
                      </div>
                      <div className={workspaceFormFieldGroupCls}>
                        <label className={workspaceFormLabelCls} htmlFor="routing-title">
                          Title <span className={workspaceFormRequiredMarkCls}>*</span>
                        </label>
                        <input
                          id="routing-title"
                          className={catalogInput}
                          value={form.title}
                          onChange={(e) => set('title', e.target.value)}
                          disabled={saving}
                          required
                        />
                      </div>
                      <div className={workspaceFormFieldGroupCls}>
                        <label className={workspaceFormLabelCls} htmlFor="routing-copy">
                          Copy value
                        </label>
                        <input
                          id="routing-copy"
                          className={catalogInput}
                          value={form.copyValue}
                          onChange={(e) => set('copyValue', e.target.value)}
                          disabled={saving}
                        />
                      </div>
                      <div className={cn(workspaceFormFieldGroupCls, 'sm:col-span-2')}>
                        <label className={workspaceFormLabelCls} htmlFor="routing-lines">
                          Lines (one per row)
                        </label>
                        <textarea
                          id="routing-lines"
                          className={cn(catalogInput, 'min-h-[4.5rem] resize-y py-2.5')}
                          value={form.lines}
                          onChange={(e) => set('lines', e.target.value)}
                          disabled={saving}
                        />
                      </div>
                    </>
                  ) : null}

                  {kind === 'stations' ? (
                    <>
                      <div className={workspaceFormFieldGroupCls}>
                        <label className={workspaceFormLabelCls} htmlFor="routing-step">
                          Step <span className={workspaceFormRequiredMarkCls}>*</span>
                        </label>
                        <input
                          id="routing-step"
                          className={catalogInput}
                          value={form.step}
                          onChange={(e) => set('step', e.target.value)}
                          disabled={saving}
                          required
                        />
                      </div>
                      <div className={workspaceFormFieldGroupCls}>
                        <label className={workspaceFormLabelCls} htmlFor="routing-office">
                          Office <span className={workspaceFormRequiredMarkCls}>*</span>
                        </label>
                        <input
                          id="routing-office"
                          className={catalogInput}
                          value={form.office}
                          onChange={(e) => set('office', e.target.value)}
                          disabled={saving}
                          required
                        />
                      </div>
                      <div className={cn(workspaceFormFieldGroupCls, 'sm:col-span-2')}>
                        <label className={workspaceFormLabelCls} htmlFor="routing-signature">
                          Signature note
                        </label>
                        <input
                          id="routing-signature"
                          className={catalogInput}
                          value={form.signatureNote}
                          onChange={(e) => set('signatureNote', e.target.value)}
                          disabled={saving}
                        />
                      </div>
                    </>
                  ) : null}
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
                    Published on routing slip
                  </label>
                  <div className={workspaceFormFieldGroupCls}>
                    <label className={workspaceFormLabelCls} htmlFor="routing-sort">
                      Sort order
                    </label>
                    <input
                      id="routing-sort"
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
          <button
            type="button"
            disabled={saving}
            onClick={() => backToList()}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-[12px] font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
          >
            Cancel
          </button>
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
