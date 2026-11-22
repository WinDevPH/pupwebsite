import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Layers, Loader2, Megaphone } from 'lucide-react'
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
  createAppointmentBatch,
  getAppointmentBatch,
  updateAppointmentBatch,
  type EnrollmentAppointmentBatch,
} from '@/lib/enrollment-batches-api'

const BASE_PATH = '/admin/enrollment/batches'

type EditorTab = 'content' | 'publish'

const EDITOR_TABS = [
  { id: 'content' as const, label: 'Content', short: 'Batch', icon: Layers },
  { id: 'publish' as const, label: 'Publish', short: 'Live', icon: Megaphone },
]

type FormState = {
  label: string
  windowLabel: string
  status: 'Serving' | 'Up next' | 'Closed'
  sortOrder: string
  published: boolean
}

const emptyForm = (): FormState => ({
  label: '',
  windowLabel: '',
  status: 'Up next',
  sortOrder: '0',
  published: true,
})

function recordToForm(item: EnrollmentAppointmentBatch): FormState {
  const key = item.status.trim().toLowerCase()
  return {
    label: item.label,
    windowLabel: item.windowLabel,
    status: key === 'serving' ? 'Serving' : key === 'closed' ? 'Closed' : 'Up next',
    sortOrder: String(item.sortOrder),
    published: item.published,
  }
}

export default function BatchFormPage() {
  const navigate = useNavigate()
  const { id: idParam } = useParams()
  const editId = idParam ? Number(idParam) : NaN
  const mode: 'create' | 'edit' = Number.isFinite(editId) && editId > 0 ? 'edit' : 'create'

  const [form, setForm] = useState<FormState>(emptyForm)
  const [computedScheduledCount, setComputedScheduledCount] = useState<number | null>(null)
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
      setComputedScheduledCount(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void getAppointmentBatch(editId).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setNeedsLogin(result.status === 401 || result.status === 403)
        setLoadError(result.status === 401 || result.status === 403 ? '' : result.error)
        setLoading(false)
        return
      }
      const item = result.data.item
      setForm(recordToForm(item))
      setComputedScheduledCount(item.scheduledCount ?? 0)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [mode, editId])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const incomplete = !form.label.trim() || !form.windowLabel.trim()

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (incomplete) {
      setTab('content')
      showToast('Label and window label are required.', 'error')
      return
    }
    setSaving(true)
    const payload = {
      label: form.label.trim(),
      windowLabel: form.windowLabel.trim(),
      status: form.status,
      sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
      published: form.published,
    }
    const result =
      mode === 'edit'
        ? await updateAppointmentBatch({ ...payload, id: editId })
        : await createAppointmentBatch(payload)
    setSaving(false)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) setNeedsLogin(true)
      else showToast(result.error, 'error')
      return
    }
    navigate(BASE_PATH, {
      state: {
        toast: {
          message: mode === 'edit' ? 'Batch updated.' : 'Batch created.',
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
          Loading batch…
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
          <Link to={BASE_PATH}>Back to batches</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to={BASE_PATH} label="Appointment batches" />

      <form onSubmit={(e) => void onSubmit(e)} className={formWorkspaceCardCls}>
        <div className={formWorkspaceCardEyebrowCls}>
          <p className={formWorkspaceCardEyebrowTextCls}>Enrollment · Batch</p>
        </div>

        <div className={formWorkspaceCardBodyCls}>
          <div className={formInsetPanelCls}>
            <div className={formTabChromeCardCls}>
              <div className="flex min-w-0 items-start gap-2.5">
                <span className={formSectionIconWrapCls}>
                  <Layers className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h4 className={formSectionHeadingCls}>
                    {mode === 'edit' ? 'Edit appointment batch' : 'New appointment batch'}
                  </h4>
                  <p className={formSectionIntroCls}>Queue row on the enrollment hub.</p>
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
                <div className="space-y-4">
                  <div className={workspaceFormFieldGroupCls}>
                    <label className={workspaceFormLabelCls} htmlFor="batch-label">
                      Label <span className={workspaceFormRequiredMarkCls}>*</span>
                    </label>
                    <input
                      id="batch-label"
                      className={catalogInput}
                      value={form.label}
                      onChange={(e) => set('label', e.target.value)}
                      disabled={saving}
                      required
                    />
                  </div>
                  <div className={workspaceFormFieldGroupCls}>
                    <label className={workspaceFormLabelCls} htmlFor="batch-window">
                      Window label <span className={workspaceFormRequiredMarkCls}>*</span>
                    </label>
                    <input
                      id="batch-window"
                      className={catalogInput}
                      value={form.windowLabel}
                      onChange={(e) => set('windowLabel', e.target.value)}
                      disabled={saving}
                      required
                    />
                  </div>
                  {mode === 'edit' && computedScheduledCount != null ? (
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="batch-count">
                        Scheduled count (computed)
                      </label>
                      <input
                        id="batch-count"
                        type="number"
                        className={catalogInput}
                        value={computedScheduledCount}
                        readOnly
                        tabIndex={-1}
                        aria-readonly
                        disabled
                      />
                      <p className="mt-1 text-[11px] text-zinc-500">
                        Derived from linked appointments; not editable here.
                      </p>
                    </div>
                  ) : null}
                  <div className={workspaceFormFieldGroupCls}>
                    <label className={workspaceFormLabelCls} htmlFor="batch-status">
                      Status
                    </label>
                    <select
                      id="batch-status"
                      className={catalogInput}
                      value={form.status}
                      onChange={(e) => set('status', e.target.value as FormState['status'])}
                      disabled={saving}
                    >
                      <option value="Serving">Serving</option>
                      <option value="Up next">Up next</option>
                      <option value="Closed">Closed</option>
                    </select>
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
                    <label className={workspaceFormLabelCls} htmlFor="batch-sort">
                      Sort order
                    </label>
                    <input
                      id="batch-sort"
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