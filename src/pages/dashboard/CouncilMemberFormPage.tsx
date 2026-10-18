import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import {
  AlignLeft,
  Briefcase,
  ImagePlus,
  Loader2,
  Megaphone,
  Tags,
  Users,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FormMediaDropzone, FormMediaPreview } from '@/components/portal/FormMediaPreview'
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
import { ImageCropDialog } from '@/components/ui/ImageCropDialog'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import { useImageCropUpload } from '@/hooks/useImageCropUpload'
import {
  buildAcademicYearOptions,
  councilBoardMeta,
  councilRolesForSection,
  createCouncilMember,
  formatAcademicYear,
  currentAcademicYearStart,
  getCouncilMemberById,
  listCouncilAcademicYears,
  normalizeAcademicYear,
  updateCouncilMember,
  uploadCouncilMemberPhoto,
  type CouncilBoard,
  type CouncilMemberRecord,
  type CouncilSection,
} from '@/lib/council-members-api'
import { portraitAspectPresets } from '@/lib/image-crop'
import { cn } from '@/lib/utils'

const CUSTOM_YEAR = '__custom__'

type EditorTab = 'details' | 'assignment' | 'media' | 'publish'

const EDITOR_TABS: {
  id: EditorTab
  label: string
  short: string
  icon: typeof AlignLeft
}[] = [
  { id: 'details', label: 'Details', short: 'Name', icon: AlignLeft },
  { id: 'assignment', label: 'Assignment', short: 'Role', icon: Tags },
  { id: 'media', label: 'Media', short: 'Photo', icon: ImagePlus },
  { id: 'publish', label: 'Publish', short: 'Live', icon: Megaphone },
]

type FormState = {
  academicYear: string
  section: CouncilSection
  role: string
  name: string
  photo: string
  vacant: boolean
  sortOrder: string
  published: boolean
}

function defaultSection(board: CouncilBoard): CouncilSection {
  return councilBoardMeta[board].sections[0]?.id ?? 'executive'
}

function emptyForm(board: CouncilBoard): FormState {
  const section = defaultSection(board)
  return {
    academicYear: formatAcademicYear(currentAcademicYearStart()),
    section,
    role: councilRolesForSection(section)[0] ?? '',
    name: '',
    photo: '',
    vacant: false,
    sortOrder: '0',
    published: true,
  }
}

function recordToForm(item: CouncilMemberRecord): FormState {
  return {
    academicYear: item.academicYear,
    section: item.section,
    role: item.role,
    name: item.name,
    photo: item.photo ?? '',
    vacant: item.vacant,
    sortOrder: String(item.sortOrder ?? 0),
    published: item.published,
  }
}

export default function CouncilMemberFormPage({ board }: { board: CouncilBoard }) {
  const meta = councilBoardMeta[board]
  const basePath = `/admin/${meta.path}`
  const navigate = useNavigate()
  const { id: idParam } = useParams()
  const editId = idParam ? Number(idParam) : NaN
  const mode: 'create' | 'edit' = Number.isFinite(editId) && editId > 0 ? 'edit' : 'create'
  const fileInputId = useId()

  const [form, setForm] = useState<FormState>(() => emptyForm(board))
  const [tab, setTab] = useState<EditorTab>('details')
  const [loading, setLoading] = useState(mode === 'edit')
  const [loadError, setLoadError] = useState('')
  const [needsLogin, setNeedsLogin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [toast, setToast] = useState<SnackToast | null>(null)
  const [knownYears, setKnownYears] = useState<string[]>([])
  const [yearMode, setYearMode] = useState<'preset' | 'custom'>('preset')
  const { cropSession, openCrop, closeCrop } = useImageCropUpload()

  const yearOptions = useMemo(
    () => buildAcademicYearOptions(knownYears, 6),
    [knownYears],
  )

  const roleOptions = useMemo(() => {
    const options = [...councilRolesForSection(form.section)]
    if (form.role && !options.includes(form.role)) options.unshift(form.role)
    return options
  }, [form.section, form.role])

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
    void listCouncilAcademicYears({ board, all: true }).then((result) => {
      if (cancelled || !result.ok) return
      setKnownYears(result.data.years)
    })
    return () => {
      cancelled = true
    }
  }, [board])

  useEffect(() => {
    if (mode !== 'edit') {
      const next = emptyForm(board)
      setForm(next)
      setYearMode(yearOptions.includes(next.academicYear) ? 'preset' : 'custom')
      setLoading(false)
      setLoadError('')
      setNeedsLogin(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError('')
    void getCouncilMemberById(editId).then((result) => {
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
      if (result.data.item.board !== board) {
        setLoadError('This member belongs to a different board.')
        setLoading(false)
        return
      }
      const next = recordToForm(result.data.item)
      setForm(next)
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
  }, [mode, editId, board])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const academicYearOk = /^\d{4}–\d{4}$/u.test(normalizeAcademicYear(form.academicYear))
  const tabAlert = {
    details: !academicYearOk || (!form.vacant && !form.name.trim()),
    assignment: !form.section || !form.role.trim(),
    media: false,
    publish: false,
  } as const

  function handleImageFile(file: File | null | undefined) {
    openCrop(file, {
      busy: uploading || saving,
      onInvalid: (message) => showToast(message, 'error'),
    })
  }

  async function handleCroppedUpload(file: File) {
    setUploading(true)
    const result = await uploadCouncilMemberPhoto(file)
    setUploading(false)
    if (!result.ok) {
      showToast(result.error, 'error')
      return
    }
    closeCrop()
    set('photo', result.data.url)
    showToast('Photo uploaded.', 'success')
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const academicYear = normalizeAcademicYear(form.academicYear)
    if (!/^\d{4}–\d{4}$/u.test(academicYear)) {
      setTab('details')
      showToast('Enter academic year as YYYY–YYYY (e.g. 2026–2027).', 'error')
      return
    }
    if (!form.vacant && !form.name.trim()) {
      setTab('details')
      showToast('Enter the full name, or mark the seat as vacant.', 'error')
      return
    }
    if (!form.role.trim()) {
      setTab('assignment')
      showToast('Choose a role title.', 'error')
      return
    }

    setSaving(true)
    const payload = {
      academicYear,
      board,
      section: form.section,
      role: form.role.trim(),
      name: form.vacant ? form.name.trim() || 'Vacant' : form.name.trim(),
      photo: form.photo.trim() || null,
      vacant: form.vacant,
      sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
      published: form.published,
    }
    const result =
      mode === 'edit'
        ? await updateCouncilMember({ ...payload, id: editId })
        : await createCouncilMember(payload)
    setSaving(false)

    if (!result.ok) {
      showToast(result.error, 'error')
      return
    }

    navigate(basePath, {
      state: {
        toast: {
          message: mode === 'edit' ? 'Member updated.' : 'Member added.',
          variant: 'success' as const,
        },
      },
    })
  }

  const canSave =
    !saving &&
    !uploading &&
    !loading &&
    academicYearOk &&
    form.role.trim() !== '' &&
    (form.vacant || form.name.trim() !== '')

  if (loading) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300/90 bg-zinc-50/80 px-5 py-16 text-[13px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-hidden />
          Loading member…
        </div>
      </div>
    )
  }

  if (needsLogin) return <RequireLoginRedirect />

  if (loadError) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <div className="rounded-xl border border-zinc-200 bg-white px-5 py-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{loadError}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="lg" variant="outline">
              <Link to={basePath}>Back to {meta.label}</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to={basePath} label={meta.label.toLowerCase()} />

      <section aria-label={`${meta.label} member form`} className="w-full max-w-none">
        <form onSubmit={(event) => void onSubmit(event)} className={formWorkspaceCardCls}>
          <div className={formWorkspaceCardEyebrowCls}>
            <p className={formWorkspaceCardEyebrowTextCls}>
              The Council · {meta.label}
            </p>
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
                      <h4 className={formSectionHeadingCls}>
                        {mode === 'edit' ? 'Edit member' : 'New member'}
                      </h4>
                      <p className={formSectionIntroCls}>
                        Details, assignment, media, and publish use separate tabs. Required fields
                        show a red dot when incomplete.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={formTabListCls} role="tablist" aria-label="Member editor sections">
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
                        disabled={saving || uploading}
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
                {tab === 'details' ? (
                  <div className="space-y-4">
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="cm-year">
                        Academic year <span className={workspaceFormRequiredMarkCls}>*</span>
                      </label>
                      <CatalogSelect
                        id="cm-year"
                        aria-label="Academic year"
                        required
                        disabled={saving || uploading}
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
                          { value: CUSTOM_YEAR, label: 'Custom…', description: 'Enter YYYY–YYYY' },
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
                          id="cm-year-custom"
                          className={cn(catalogInput, 'mt-2')}
                          value={form.academicYear}
                          onChange={(e) => {
                            setYearMode('custom')
                            set('academicYear', e.target.value)
                          }}
                          placeholder="2026–2027"
                          disabled={saving || uploading}
                          aria-label="Custom academic year"
                          required
                        />
                      ) : null}
                      <p className="mt-1.5 text-[12px] text-zinc-500 dark:text-zinc-400">
                        Latest through future years. Choose Custom for another YYYY–YYYY value.
                      </p>
                    </div>
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="cm-name">
                        Full name{' '}
                        {!form.vacant ? (
                          <span className={workspaceFormRequiredMarkCls}>*</span>
                        ) : (
                          <span className={workspaceFormOptionalBadgeCls}>Optional</span>
                        )}
                      </label>
                      <input
                        id="cm-name"
                        className={catalogInput}
                        value={form.name}
                        onChange={(e) => set('name', e.target.value)}
                        placeholder="Surname, Given Name"
                        disabled={saving || uploading || form.vacant}
                        required={!form.vacant}
                      />
                    </div>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-700 dark:bg-zinc-950">
                      <input
                        type="checkbox"
                        className={cn(tableCheckboxCls, 'mt-0.5')}
                        checked={form.vacant}
                        disabled={saving || uploading}
                        onChange={(e) => {
                          set('vacant', e.target.checked)
                          if (e.target.checked) set('name', 'Vacant')
                        }}
                      />
                      <span>
                        <span className="block text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
                          Seat is vacant
                        </span>
                        <span className="mt-1 block text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">
                          Shows as vacant on The Council without a photo.
                        </span>
                      </span>
                    </label>
                  </div>
                ) : null}

                {tab === 'assignment' ? (
                  <div className="space-y-4">
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="cm-section">
                        Section <span className={workspaceFormRequiredMarkCls}>*</span>
                      </label>
                      <CatalogSelect
                        id="cm-section"
                        aria-label="Section"
                        required
                        disabled={saving || uploading}
                        value={form.section}
                        options={meta.sections.map((section) => ({
                          value: section.id,
                          label: section.label,
                        }))}
                        onChange={(value) => {
                          const section = value as CouncilSection
                          const nextRoles = councilRolesForSection(section)
                          setForm((prev) => ({
                            ...prev,
                            section,
                            role: nextRoles.includes(prev.role)
                              ? prev.role
                              : (nextRoles[0] ?? ''),
                          }))
                        }}
                      />
                    </div>
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="cm-role">
                        Role / title <span className={workspaceFormRequiredMarkCls}>*</span>
                      </label>
                      <CatalogSelect
                        id="cm-role"
                        aria-label="Role or title"
                        required
                        disabled={saving || uploading || roleOptions.length === 0}
                        value={form.role}
                        placeholder={
                          roleOptions.length === 0 ? 'No roles for this section' : 'Select a role'
                        }
                        leading={<Briefcase className="h-4 w-4" aria-hidden />}
                        options={roleOptions.map((role) => ({
                          value: role,
                          label: role,
                        }))}
                        onChange={(value) => set('role', value)}
                      />
                    </div>
                    <div className={workspaceFormFieldGroupCls}>
                      <label className={workspaceFormLabelCls} htmlFor="cm-sort">
                        Sort order <span className={workspaceFormOptionalBadgeCls}>Optional</span>
                      </label>
                      <input
                        id="cm-sort"
                        type="number"
                        className={catalogInput}
                        value={form.sortOrder}
                        disabled={saving || uploading}
                        onChange={(e) => set('sortOrder', e.target.value)}
                      />
                      <p className="mt-1.5 text-[12px] text-zinc-500 dark:text-zinc-400">
                        Lower numbers appear earlier within the same section.
                      </p>
                    </div>
                  </div>
                ) : null}

                {tab === 'media' ? (
                  <section role="tabpanel" aria-label="Media" className="space-y-4">
                    <div className="flex items-start gap-2.5 sm:gap-3">
                      <span className={formSectionIconWrapCls}>
                        <ImagePlus className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <h4 className={formSectionHeadingCls}>Photo</h4>
                        <p className={formSectionIntroCls}>
                          Optional portrait for The Council roster cards.
                        </p>
                      </div>
                    </div>
                    <div className={formControlWellCls}>
                      <input
                        id={fileInputId}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        disabled={saving || uploading}
                        onChange={(e) => {
                          void handleImageFile(e.target.files?.[0])
                          e.target.value = ''
                        }}
                      />
                      {form.photo ? (
                        <FormMediaPreview
                          src={form.photo}
                          frame="portrait"
                          uploading={uploading}
                          disabled={saving || uploading}
                          label="Custom photo ready"
                          primaryAction={{
                            label: 'Replace',
                            onClick: () => document.getElementById(fileInputId)?.click(),
                          }}
                          secondaryAction={{
                            label: 'Remove',
                            tone: 'danger',
                            onClick: () => set('photo', ''),
                          }}
                        />
                      ) : (
                        <FormMediaDropzone
                          htmlFor={fileInputId}
                          dragOver={dragOver}
                          uploading={uploading}
                          disabled={saving || uploading}
                          title="Upload photo"
                          onDragEnter={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (!saving && !uploading) setDragOver(true)
                          }}
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (!saving && !uploading) setDragOver(true)
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setDragOver(false)
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setDragOver(false)
                            void handleImageFile(e.dataTransfer.files?.[0])
                          }}
                        />
                      )}
                    </div>
                  </section>
                ) : null}

                {tab === 'publish' ? (
                  <div className="space-y-4">
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-700 dark:bg-zinc-950">
                      <input
                        type="checkbox"
                        className={cn(tableCheckboxCls, 'mt-0.5')}
                        checked={form.published}
                        disabled={saving || uploading}
                        onChange={(e) => set('published', e.target.checked)}
                      />
                      <span>
                        <span className="block text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
                          Published on The Council
                        </span>
                        <span className="mt-1 block text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">
                          Unpublished seats stay in the admin list only.
                        </span>
                      </span>
                    </label>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className={formWorkspaceCardFooterCls}>
            <button type="submit" className={formWorkspacePrimaryBtnCls} disabled={!canSave}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {mode === 'edit' ? 'Save changes' : 'Add member'}
            </button>
          </div>
        </form>
      </section>

      {cropSession ? (
        <ImageCropDialog
          open
          imageSrc={cropSession.url}
          fileName={cropSession.name}
          mime={cropSession.mime}
          title="Crop member photo"
          aspect={3 / 4}
          presets={portraitAspectPresets}
          onCancel={closeCrop}
          onConfirm={handleCroppedUpload}
        />
      ) : null}

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
