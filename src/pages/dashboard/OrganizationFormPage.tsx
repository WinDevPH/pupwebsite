import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlignLeft, ImageOff, Loader2, RotateCcw, Settings2, Users, Eye } from 'lucide-react'
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
  workspaceFormOptionalBadgeCls,
  workspaceFormRequiredMarkCls,
  workspaceTenantMainStackCls,
} from '@/components/portal/register-ui'
import { Button } from '@/components/ui/button'
import { CatalogSelect } from '@/components/ui/CatalogSelect'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import {
  buildAcademicYearOptions,
  currentAcademicYearStart,
  formatAcademicYear,
  normalizeAcademicYear,
} from '@/lib/council-members-api'
import {
  createOrganization,
  getOrganizationById,
  listOrganizations,
  updateOrganization,
  type OrganizationInput,
  type OrganizationRecord,
} from '@/lib/organizations-api'
import { cn } from '@/lib/utils'

const CUSTOM_YEAR = '__custom__'

type EditorTab = 'content' | 'details' | 'publish'

const BASE_PATH = '/admin/organizations'

const EDITOR_TABS: {
  id: EditorTab
  label: string
  short: string
  icon: typeof AlignLeft
}[] = [
  { id: 'content', label: 'Content', short: 'Copy', icon: AlignLeft },
  { id: 'details', label: 'Details', short: 'More', icon: Settings2 },
  { id: 'publish', label: 'Publish', short: 'Live', icon: Eye },
]

type FormState = {
  short: string
  name: string
  logo: string
  slug: string
  facebook: string
  academicYear: string
  sortOrder: string
  published: boolean
}

const emptyForm = (): FormState => ({
  short: '',
  name: '',
  logo: '',
  slug: '',
  facebook: '',
  academicYear: formatAcademicYear(currentAcademicYearStart()),
  sortOrder: '0',
  published: true,
})

function recordToForm(record: OrganizationRecord): FormState {
  return {
    short: record.short,
    name: record.name,
    logo: record.logo,
    slug: record.slug,
    facebook: record.facebook,
    academicYear: normalizeAcademicYear(record.academicYear),
    sortOrder: String(record.sortOrder),
    published: record.published,
  }
}

function formToInput(form: FormState): OrganizationInput {
  return {
    slug: form.slug.trim() || undefined,
    short: form.short.trim(),
    name: form.name.trim(),
    facebook: form.facebook.trim(),
    logo: form.logo.trim(),
    academicYear: normalizeAcademicYear(form.academicYear),
    sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
    published: form.published,
  }
}

export default function OrganizationFormPage() {
  const navigate = useNavigate()
  const { id: idParam } = useParams()
  const editId = idParam ? Number(idParam) : NaN
  const mode: 'create' | 'edit' = Number.isFinite(editId) && editId > 0 ? 'edit' : 'create'

  const [form, setForm] = useState<FormState>(emptyForm)
  const [baseline, setBaseline] = useState<FormState>(emptyForm)
  const [tab, setTab] = useState<EditorTab>('content')
  const [loading, setLoading] = useState(mode === 'edit')
  const [loadError, setLoadError] = useState('')
  const [needsLogin, setNeedsLogin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<SnackToast | null>(null)
  const [knownYears, setKnownYears] = useState<string[]>([])
  const [yearMode, setYearMode] = useState<'preset' | 'custom'>('preset')

  const yearOptions = useMemo(
    () => buildAcademicYearOptions(knownYears, 6),
    [knownYears],
  )

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
    void listOrganizations({ all: true }).then((result) => {
      if (cancelled || !result.ok) return
      const years = [
        ...new Set(
          result.data.items
            .map((item) => normalizeAcademicYear(item.academicYear))
            .filter(Boolean),
        ),
      ]
      setKnownYears(years)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setTab('content')
    if (mode !== 'edit') {
      const blank = emptyForm()
      setForm(blank)
      setBaseline(blank)
      setYearMode(yearOptions.includes(blank.academicYear) ? 'preset' : 'custom')
      setLoading(false)
      setLoadError('')
      setNeedsLogin(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError('')
    void getOrganizationById(editId).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        if (result.status === 401 || result.status === 403) {
          setNeedsLogin(true)
          setLoadError('')
        } else {
          setNeedsLogin(false)
          setLoadError(result.error)
        }
        setLoading(false)
        return
      }
      setNeedsLogin(false)
      const next = recordToForm(result.data.item)
      setForm(next)
      setBaseline(next)
      const normalized = normalizeAcademicYear(next.academicYear)
      setYearMode(
        buildAcademicYearOptions([normalized, ...knownYears], 6).includes(normalized)
          ? 'preset'
          : 'custom',
      )
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [mode, editId])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function resetForm() {
    setForm(baseline)
    const normalized = normalizeAcademicYear(baseline.academicYear)
    setYearMode(yearOptions.includes(normalized) ? 'preset' : 'custom')
    setTab('content')
  }

  const academicYearOk = /^\d{4}–\d{4}$/u.test(normalizeAcademicYear(form.academicYear))
  const contentIncomplete = !form.short.trim() || !form.name.trim()
  const tabAlert: Record<EditorTab, boolean> = {
    content: contentIncomplete,
    details: !academicYearOk,
    publish: false,
  }

  const canSave = !saving && !loading && !contentIncomplete && academicYearOk

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (contentIncomplete) {
      setTab('content')
      showToast('Short name and full name are required.', 'error')
      return
    }
    if (!academicYearOk) {
      setTab('details')
      showToast('Enter academic year as YYYY–YYYY (e.g. 2026–2027).', 'error')
      return
    }

    setSaving(true)
    const payload = formToInput(form)
    const result =
      mode === 'edit'
        ? await updateOrganization({ ...payload, id: editId })
        : await createOrganization(payload)
    setSaving(false)

    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        setNeedsLogin(true)
        return
      }
      showToast(result.error, 'error')
      return
    }

    navigate(BASE_PATH, {
      state: {
        toast: {
          message: mode === 'edit' ? 'Organization updated.' : 'Organization created.',
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
          Loading organization…
        </div>
      </div>
    )
  }

  if (needsLogin) return <RequireLoginRedirect />

  if (loadError) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <div className="rounded-xl border border-zinc-200 bg-white px-5 py-8 shadow-sm">
          <p className="text-sm font-medium text-zinc-900">{loadError}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="lg" variant="outline">
              <Link to={BASE_PATH}>Back to organizations</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const heading = mode === 'edit' ? 'Edit organization' : 'New organization'

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to={BASE_PATH} label="organizations" />

      <section aria-label="Organization form" className="w-full max-w-none">
        <form onSubmit={(event) => void onSubmit(event)} className={formWorkspaceCardCls}>
          <div className={formWorkspaceCardEyebrowCls}>
            <p className={formWorkspaceCardEyebrowTextCls}>Organization · Student group</p>
          </div>

          <div className={formWorkspaceCardBodyCls}>
            <div className={formInsetPanelCls}>
              <div className={formTabChromeCardCls}>
                <div className="flex w-full min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3">
                    <span className={formSectionIconWrapCls}>
                      <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h4 className={formSectionHeadingCls}>{heading}</h4>
                      <p className={formSectionIntroCls}>
                        Shown on the home page and The Council. Required fields show a red dot when
                        incomplete.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Reset organization form"
                    title="Reset"
                    disabled={saving}
                    className="mt-[1px] inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-[12px] font-semibold text-zinc-700 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition hover:border-zinc-300 hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-50 sm:min-h-9 sm:px-3 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-900"
                    onClick={resetForm}
                  >
                    <RotateCcw
                      className="h-4 w-4 shrink-0 text-zinc-600 dark:text-zinc-300"
                      aria-hidden
                    />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                </div>

                <div
                  className={formTabListCls}
                  role="tablist"
                  aria-label="Organization editor sections"
                >
                  {EDITOR_TABS.map((item) => {
                    const Icon = item.icon
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

              <div className={formControlWellCls}>
                {tab === 'content' ? (
                  <div className="space-y-4">
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="org-short">
                        Short name <span className={workspaceFormRequiredMarkCls}>*</span>
                      </label>
                      <input
                        id="org-short"
                        type="text"
                        className={catalogInput}
                        value={form.short}
                        onChange={(e) => set('short', e.target.value)}
                        disabled={saving}
                        required
                      />
                    </div>
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="org-name">
                        Full name <span className={workspaceFormRequiredMarkCls}>*</span>
                      </label>
                      <input
                        id="org-name"
                        type="text"
                        className={catalogInput}
                        value={form.name}
                        onChange={(e) => set('name', e.target.value)}
                        disabled={saving}
                        required
                      />
                    </div>
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="org-logo">
                        Logo path or URL{' '}
                        <span className={workspaceFormOptionalBadgeCls}>Optional</span>
                      </label>
                      <div className="flex items-center gap-3">
                        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950">
                          {form.logo.trim() ? (
                            <img
                              src={form.logo.trim()}
                              alt=""
                              className="max-h-12 w-auto max-w-[3rem] object-contain"
                            />
                          ) : (
                            <ImageOff className="size-4 text-zinc-300" aria-hidden />
                          )}
                        </span>
                        <input
                          id="org-logo"
                          type="text"
                          className={`${catalogInput} min-w-0 flex-1`}
                          value={form.logo}
                          onChange={(e) => set('logo', e.target.value)}
                          placeholder="/org-logos/name.png"
                          disabled={saving}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                {tab === 'details' ? (
                  <div className="space-y-4">
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="org-slug">
                        Slug <span className={workspaceFormOptionalBadgeCls}>Optional</span>
                      </label>
                      <input
                        id="org-slug"
                        type="text"
                        className={catalogInput}
                        value={form.slug}
                        onChange={(e) => set('slug', e.target.value)}
                        placeholder="auto from short name"
                        disabled={saving}
                      />
                    </div>
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="org-facebook">
                        Facebook URL{' '}
                        <span className={workspaceFormOptionalBadgeCls}>Optional</span>
                      </label>
                      <input
                        id="org-facebook"
                        type="url"
                        className={catalogInput}
                        value={form.facebook}
                        onChange={(e) => set('facebook', e.target.value)}
                        placeholder="https://www.facebook.com/…"
                        disabled={saving}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className={workspaceFormFieldGroupCls}>
                        <label className={workspaceFormLabelCls} htmlFor="org-year">
                          Academic year <span className={workspaceFormRequiredMarkCls}>*</span>
                        </label>
                        <CatalogSelect
                          id="org-year"
                          aria-label="Academic year"
                          required
                          disabled={saving}
                          value={
                            yearMode === 'custom'
                              ? CUSTOM_YEAR
                              : yearOptions.includes(normalizeAcademicYear(form.academicYear))
                                ? normalizeAcademicYear(form.academicYear)
                                : CUSTOM_YEAR
                          }
                          options={[
                            ...yearOptions.map((year) => ({
                              value: year,
                              label: `A.Y. ${year}`,
                            })),
                            {
                              value: CUSTOM_YEAR,
                              label: 'Custom…',
                              description: 'Enter YYYY–YYYY',
                            },
                          ]}
                          onChange={(value) => {
                            if (value === CUSTOM_YEAR) {
                              setYearMode('custom')
                              return
                            }
                            setYearMode('preset')
                            set('academicYear', value)
                          }}
                        />
                        {yearMode === 'custom' ||
                        !yearOptions.includes(normalizeAcademicYear(form.academicYear)) ? (
                          <input
                            id="org-year-custom"
                            className={cn(catalogInput, 'mt-2')}
                            value={form.academicYear}
                            onChange={(e) => {
                              setYearMode('custom')
                              set('academicYear', e.target.value)
                            }}
                            placeholder="2026–2027"
                            disabled={saving}
                            aria-label="Custom academic year"
                            required
                          />
                        ) : null}
                        <p className="mt-1.5 text-[12px] text-zinc-500 dark:text-zinc-400">
                          Latest through future years. Choose Custom for another YYYY–YYYY value.
                        </p>
                      </div>
                      <div className={workspaceFormFieldGroupCls}>
                        <label className={workspaceFormLabelCls} htmlFor="org-sort">
                          Sort order
                        </label>
                        <input
                          id="org-sort"
                          type="number"
                          className={catalogInput}
                          value={form.sortOrder}
                          onChange={(e) => set('sortOrder', e.target.value)}
                          disabled={saving}
                        />
                      </div>
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
                      Published on home page and The Council
                    </label>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className={formWorkspaceCardFooterCls}>
            <button type="submit" className={formWorkspacePrimaryBtnCls} disabled={!canSave}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Save
            </button>
          </div>
        </form>
      </section>

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
