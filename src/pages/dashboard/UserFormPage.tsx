import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  Camera,
  Eye,
  EyeOff,
  ImagePlus,
  KeyRound,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { RequireLoginRedirect } from '@/components/portal/RequireLoginRedirect'
import {
  catalogInput,
  formControlWellCls,
  formInsetPanelCls,
  formMediaDropzoneBaseCls,
  formMediaDropzoneHintCls,
  formMediaDropzoneStateCls,
  formMediaDropzoneTitleCls,
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
import { portraitAspectPresets } from '@/lib/image-crop'
import { patchStoredAuthUser, readStoredAuthUser } from '@/lib/auth-api'
import {
  USER_ROLES,
  createUser,
  getUserById,
  updateUser,
  uploadUserAvatar,
  userInitials,
  type UserInput,
  type UserRecord,
  type UserRole,
} from '@/lib/users-api'
import { cn } from '@/lib/utils'

type EditorTab = 'profile' | 'access' | 'security'

const BASE_PATH = '/admin/users'
const MIN_PASSWORD_LENGTH = 8

const EDITOR_TABS: {
  id: EditorTab
  label: string
  short: string
  icon: typeof UserRound
}[] = [
  { id: 'profile', label: 'Profile', short: 'Info', icon: UserRound },
  { id: 'access', label: 'Access', short: 'Role', icon: ShieldCheck },
  { id: 'security', label: 'Security', short: 'Pass', icon: KeyRound },
]

const YEAR_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: '1', label: 'Year 1' },
  { value: '2', label: 'Year 2' },
  { value: '3', label: 'Year 3' },
  { value: '4', label: 'Year 4' },
]

const ROLE_OPTIONS = USER_ROLES.map((role) => ({ value: role.value, label: role.label }))

type FormState = {
  fullName: string
  email: string
  studentNumber: string
  yearLevel: string
  avatarUrl: string
  role: UserRole
  active: boolean
  password: string
  confirmPassword: string
}

const emptyForm = (): FormState => ({
  fullName: '',
  email: '',
  studentNumber: '',
  yearLevel: '',
  avatarUrl: '',
  role: 'student',
  active: true,
  password: '',
  confirmPassword: '',
})

function recordToForm(record: UserRecord): FormState {
  return {
    fullName: record.fullName,
    email: record.email,
    studentNumber: record.studentNumber ?? '',
    yearLevel: record.yearLevel ? String(record.yearLevel) : '',
    avatarUrl: record.avatarUrl ?? '',
    role: record.role,
    active: record.active,
    password: '',
    confirmPassword: '',
  }
}

function formToInput(form: FormState): UserInput {
  const password = form.password
  return {
    fullName: form.fullName.trim(),
    email: form.email.trim(),
    studentNumber: form.studentNumber.trim() || null,
    yearLevel: form.yearLevel ? Number.parseInt(form.yearLevel, 10) || null : null,
    avatarUrl: form.avatarUrl.trim() || null,
    role: form.role,
    active: form.active,
    ...(password ? { password } : {}),
  }
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export default function UserFormPage() {
  const navigate = useNavigate()
  const { id: idParam } = useParams()
  const editId = idParam ? Number(idParam) : NaN
  const mode: 'create' | 'edit' = Number.isFinite(editId) && editId > 0 ? 'edit' : 'create'
  const fileInputId = useId()

  const [form, setForm] = useState<FormState>(emptyForm)
  const [baseline, setBaseline] = useState<FormState>(emptyForm)
  const [meId, setMeId] = useState<number | null>(null)
  const [tab, setTab] = useState<EditorTab>('profile')
  const [loading, setLoading] = useState(mode === 'edit')
  const [loadError, setLoadError] = useState('')
  const [needsLogin, setNeedsLogin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [toast, setToast] = useState<SnackToast | null>(null)
  const { cropSession, openCrop, closeCrop } = useImageCropUpload()

  const editingSelf = mode === 'edit' && meId !== null && editId === meId
  const busy = saving || uploading

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    setTab('profile')
    setShowPassword(false)
    setShowConfirmPassword(false)
    if (mode !== 'edit') {
      const blank = emptyForm()
      setForm(blank)
      setBaseline(blank)
      setMeId(null)
      setLoading(false)
      setLoadError('')
      setNeedsLogin(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError('')
    void getUserById(editId).then((result) => {
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
      setMeId(typeof result.data.meId === 'number' ? result.data.meId : null)
      const next = recordToForm(result.data.item)
      setForm(next)
      setBaseline(next)
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
    setTab('profile')
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  function handleImageFile(file: File | null | undefined) {
    openCrop(file, {
      busy,
      onInvalid: (message) => showToast(message, 'error'),
    })
  }

  async function handleCroppedUpload(file: File) {
    setUploading(true)
    const result = await uploadUserAvatar(file)
    setUploading(false)
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        setNeedsLogin(true)
        return
      }
      showToast(result.error, 'error')
      return
    }
    closeCrop()
    const nextAvatar = result.data.url || result.data.avatarUrl || result.data.image
    set('avatarUrl', nextAvatar)
    if (editingSelf) {
      patchStoredAuthUser({ avatarUrl: nextAvatar || null })
    }
    showToast('Profile photo uploaded.', 'success')
  }

  const roleOptions = useMemo(() => {
    if (!editingSelf) return ROLE_OPTIONS
    return ROLE_OPTIONS.map((option) => ({
      ...option,
      disabled: option.value !== 'admin',
    }))
  }, [editingSelf])

  const yearOptions = useMemo(() => {
    if (!form.yearLevel || YEAR_OPTIONS.some((o) => o.value === form.yearLevel)) return YEAR_OPTIONS
    return [...YEAR_OPTIONS, { value: form.yearLevel, label: `Year ${form.yearLevel}` }]
  }, [form.yearLevel])

  const passwordRequired = mode === 'create'
  const passwordTooShort = form.password.length > 0 && form.password.length < MIN_PASSWORD_LENGTH
  const passwordMismatch =
    (form.password.length > 0 || form.confirmPassword.length > 0) &&
    form.password !== form.confirmPassword
  const passwordMissing = passwordRequired && form.password.length === 0

  const profileIncomplete = !form.fullName.trim() || !form.email.trim() || !isValidEmail(form.email)
  const accessIncomplete = !form.role
  const securityIncomplete = passwordMissing || passwordTooShort || passwordMismatch
  const tabAlert: Record<EditorTab, boolean> = {
    profile: profileIncomplete,
    access: accessIncomplete,
    security: securityIncomplete,
  }

  const canSave = !busy && !loading && !profileIncomplete && !accessIncomplete && !securityIncomplete

  async function onSubmit(event: FormEvent) {
    event.preventDefault()

    if (!form.fullName.trim() || !form.email.trim()) {
      setTab('profile')
      showToast('Full name and email are required.', 'error')
      return
    }
    if (!isValidEmail(form.email)) {
      setTab('profile')
      showToast('Enter a valid email address.', 'error')
      return
    }
    if (!form.role) {
      setTab('access')
      showToast('Role is required.', 'error')
      return
    }
    if (editingSelf && form.role !== 'admin') {
      setTab('access')
      showToast('You cannot remove your own admin role.', 'error')
      return
    }
    if (editingSelf && !form.active) {
      setTab('access')
      showToast('You cannot deactivate your own account.', 'error')
      return
    }
    if (passwordMissing) {
      setTab('security')
      showToast('Password is required for new users.', 'error')
      return
    }
    if (passwordTooShort) {
      setTab('security')
      showToast(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, 'error')
      return
    }
    if (passwordMismatch) {
      setTab('security')
      showToast('Passwords do not match.', 'error')
      return
    }

    setSaving(true)
    const payload = formToInput(form)
    const result =
      mode === 'edit'
        ? await updateUser({ ...payload, id: editId })
        : await createUser(payload)
    setSaving(false)

    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        setNeedsLogin(true)
        return
      }
      showToast(result.error, 'error')
      return
    }

    if (editingSelf) {
      const stored = readStoredAuthUser()
      if (stored) {
        patchStoredAuthUser({
          fullName: payload.fullName,
          email: payload.email,
          studentNumber: payload.studentNumber ?? null,
          yearLevel: payload.yearLevel ?? null,
          avatarUrl: payload.avatarUrl ?? null,
          role: payload.role,
        })
      }
    }

    navigate(BASE_PATH, {
      state: {
        toast: {
          message: mode === 'edit' ? 'User updated.' : 'User created.',
          variant: 'success' as const,
        },
      },
    })
  }

  if (loading) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300/90 bg-zinc-50/80 px-5 py-16 text-[13px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-hidden />
          Loading user…
        </div>
      </div>
    )
  }

  if (needsLogin) return <RequireLoginRedirect />

  if (loadError) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <div className="rounded-xl border border-zinc-200 bg-white px-5 py-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{loadError}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="lg" variant="outline">
              <Link to={BASE_PATH}>Back to users</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const heading = mode === 'edit' ? 'Edit user' : 'New user'
  const helperCls = 'text-[11px] leading-5 text-zinc-500 dark:text-zinc-400'
  const initials = userInitials(form.fullName || form.email || 'User')

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to={BASE_PATH} label="Users" />

      <section aria-label="User form" className="w-full max-w-none">
        <form
          onSubmit={(event) => void onSubmit(event)}
          className={formWorkspaceCardCls}
          autoComplete="off"
        >
          <div className={formWorkspaceCardEyebrowCls}>
            <p className={formWorkspaceCardEyebrowTextCls}>Users · Account</p>
          </div>

          <div className={formWorkspaceCardBodyCls}>
            <div className={formInsetPanelCls}>
              <div className={formTabChromeCardCls}>
                <div className="flex w-full min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3">
                    <span className={formSectionIconWrapCls}>
                      <UserRound className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h4 className={formSectionHeadingCls}>{heading}</h4>
                      <p className={formSectionIntroCls}>
                        Profile photo, account details, role, and sign-in password.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Reset user form"
                    title="Reset"
                    disabled={busy}
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

                <div className={formTabListCls} role="tablist" aria-label="User editor sections">
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
                        disabled={busy}
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

              <div className="mt-3 space-y-4 sm:mt-4">
                {tab === 'profile' ? (
                  <section role="tabpanel" aria-label="Profile" className="space-y-4">
                    <div className="flex items-start gap-2.5 sm:gap-3">
                      <span className={formSectionIconWrapCls}>
                        <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <h4 className={formSectionHeadingCls}>Profile photo</h4>
                        <p className={formSectionIntroCls}>
                          Optional. Cropped to a square for the register and account details.
                        </p>
                      </div>
                    </div>

                    <div className={formControlWellCls}>
                      <input
                        id={fileInputId}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        disabled={busy}
                        onChange={(e) => {
                          void handleImageFile(e.target.files?.[0])
                          e.target.value = ''
                        }}
                      />

                      {form.avatarUrl ? (
                        <div className="overflow-hidden rounded-lg border border-zinc-200/90 dark:border-zinc-700">
                          <div className="relative flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-zinc-100/90 to-zinc-50/60 px-4 py-7 sm:gap-3.5 sm:py-9 dark:from-zinc-900 dark:to-zinc-950/80">
                            <div className="relative size-[7.25rem] overflow-hidden rounded-full border-2 border-white bg-zinc-200 shadow-[0_10px_28px_-14px_rgba(30,5,65,0.5)] ring-1 ring-zinc-200/90 dark:border-zinc-800 dark:bg-zinc-800 dark:ring-zinc-700 sm:size-36">
                              <img
                                src={form.avatarUrl}
                                alt=""
                                className="size-full object-cover"
                              />
                              {uploading ? (
                                <span className="absolute inset-0 flex items-center justify-center bg-zinc-950/50">
                                  <Loader2
                                    className="h-6 w-6 animate-spin text-white"
                                    aria-hidden
                                  />
                                </span>
                              ) : null}
                            </div>
                            <p className="max-w-[16rem] text-center text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">
                              How this photo appears in the users register.
                            </p>
                          </div>
                          <div className="flex flex-col gap-2.5 border-t border-zinc-200/90 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-3.5 sm:py-2.5 dark:border-zinc-700 dark:bg-zinc-950">
                            <span className="inline-flex min-w-0 items-center justify-center gap-1.5 text-[12px] font-medium text-zinc-600 sm:justify-start sm:text-[11px] dark:text-zinc-400">
                              <Upload className="h-3.5 w-3.5 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden />
                              <span className="truncate">Profile photo set</span>
                            </span>
                            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center sm:gap-2">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => document.getElementById(fileInputId)?.click()}
                                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] font-semibold text-brand-800 outline-none transition hover:border-brand-300 hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-500/35 disabled:opacity-50 sm:h-8 sm:rounded-md sm:border-transparent sm:bg-transparent sm:px-2 sm:text-[11px] sm:text-brand-700 sm:hover:bg-transparent sm:hover:text-brand-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-brand-300 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10 sm:dark:border-transparent sm:dark:bg-transparent sm:dark:hover:bg-transparent sm:dark:hover:text-brand-200"
                              >
                                <ImagePlus className="size-3.5 sm:hidden" aria-hidden />
                                Replace
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  set('avatarUrl', '')
                                  if (editingSelf) patchStoredAuthUser({ avatarUrl: null })
                                }}
                                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] font-semibold text-zinc-700 outline-none transition hover:border-maroon-300 hover:bg-maroon-50 hover:text-maroon-800 focus-visible:ring-2 focus-visible:ring-maroon-500/30 disabled:opacity-50 sm:h-8 sm:rounded-md sm:border-transparent sm:bg-transparent sm:px-2 sm:text-[11px] sm:text-zinc-500 sm:hover:bg-transparent sm:hover:text-maroon-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-maroon-500/35 dark:hover:bg-maroon-500/10 dark:hover:text-maroon-200 sm:dark:border-transparent sm:dark:bg-transparent sm:dark:text-zinc-400 sm:dark:hover:bg-transparent sm:dark:hover:text-red-300"
                              >
                                <Trash2 className="size-3.5 sm:hidden" aria-hidden />
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <label
                          htmlFor={fileInputId}
                          onDragEnter={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (!busy) setDragOver(true)
                          }}
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (!busy) setDragOver(true)
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
                          className={cn(
                            formMediaDropzoneBaseCls,
                            'gap-3 py-9 sm:gap-2 sm:py-8',
                            formMediaDropzoneStateCls(dragOver),
                            busy && 'pointer-events-none opacity-60',
                          )}
                        >
                          <span className="relative inline-flex size-[5.5rem] items-center justify-center overflow-hidden rounded-full border border-dashed border-zinc-300 bg-white text-zinc-400 shadow-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-500 sm:size-10 sm:rounded-xl sm:border-solid sm:border-zinc-200/80 sm:text-brand-700 sm:dark:border-zinc-600 sm:dark:text-brand-300">
                            {uploading ? (
                              <Loader2 className="h-5 w-5 animate-spin sm:h-4 sm:w-4" aria-hidden />
                            ) : (
                              <>
                                <span className="text-[20px] font-semibold tracking-wide text-zinc-400 sm:hidden dark:text-zinc-500">
                                  {initials}
                                </span>
                                <span className="absolute right-0.5 bottom-0.5 inline-flex size-7 items-center justify-center rounded-full border border-white bg-brand-700 text-white shadow-sm sm:static sm:size-auto sm:border-0 sm:bg-transparent sm:text-inherit sm:shadow-none dark:border-zinc-900">
                                  <ImagePlus className="size-3.5 sm:size-4" aria-hidden />
                                </span>
                              </>
                            )}
                          </span>
                          <span className={formMediaDropzoneTitleCls}>
                            {uploading ? 'Uploading…' : 'Upload profile photo'}
                          </span>
                          <span className={formMediaDropzoneHintCls}>
                            <span className="sm:hidden">
                              Tap to choose a photo. JPG, PNG, WEBP, or GIF up to 20 MB.
                            </span>
                            <span className="hidden sm:inline">
                              Drag and drop or click. JPG, PNG, WEBP, or GIF up to 20 MB.
                            </span>
                          </span>
                        </label>
                      )}
                    </div>

                    <div className="flex items-start gap-2.5 sm:gap-3">
                      <span className={formSectionIconWrapCls}>
                        <UserRound className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <h4 className={formSectionHeadingCls}>Account details</h4>
                        <p className={formSectionIntroCls}>Name, email, and student information.</p>
                      </div>
                    </div>

                    <div className={`${formControlWellCls} space-y-4`}>
                      <Field label="Full name" htmlFor="user-full-name" required>
                        <input
                          id="user-full-name"
                          type="text"
                          className={catalogInput}
                          value={form.fullName}
                          onChange={(e) => set('fullName', e.target.value)}
                          disabled={busy}
                          autoComplete="name"
                          required
                        />
                      </Field>
                      <Field label="Email" htmlFor="user-email" required>
                        <input
                          id="user-email"
                          type="email"
                          className={catalogInput}
                          value={form.email}
                          onChange={(e) => set('email', e.target.value)}
                          disabled={busy}
                          autoComplete="off"
                          required
                        />
                      </Field>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Student number" htmlFor="user-student-number" optional>
                          <input
                            id="user-student-number"
                            type="text"
                            className={catalogInput}
                            value={form.studentNumber}
                            onChange={(e) => set('studentNumber', e.target.value)}
                            placeholder="e.g. 2021-00001-MN-0"
                            disabled={busy}
                          />
                        </Field>
                        <Field label="Year level" htmlFor="user-year-level" optional>
                          <CatalogSelect
                            id="user-year-level"
                            aria-label="Year level"
                            disabled={busy}
                            value={form.yearLevel}
                            options={yearOptions}
                            onChange={(value) => set('yearLevel', value)}
                          />
                        </Field>
                      </div>
                    </div>
                  </section>
                ) : null}

                {tab === 'access' ? (
                  <div className={`${formControlWellCls} space-y-4`}>
                    <Field label="Role" htmlFor="user-role" required>
                      <CatalogSelect
                        id="user-role"
                        aria-label="Role"
                        disabled={busy}
                        value={form.role}
                        options={roleOptions}
                        onChange={(value) => set('role', value as UserRole)}
                      />
                      {editingSelf ? (
                        <p className={helperCls}>
                          You are signed in as this user, so the admin role is locked.
                        </p>
                      ) : null}
                    </Field>
                    <div className={workspaceFormFieldGroupCls}>
                      <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200/90 bg-white px-3 text-[12px] font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                        <input
                          type="checkbox"
                          checked={form.active}
                          onChange={(e) => set('active', e.target.checked)}
                          className={tableCheckboxCls}
                          disabled={busy || editingSelf}
                        />
                        Active — can sign in to the portal
                      </label>
                      {editingSelf ? (
                        <p className={helperCls}>You cannot deactivate your own account.</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {tab === 'security' ? (
                  <div className={`${formControlWellCls} space-y-4`}>
                    <Field
                      label="Password"
                      htmlFor="user-password"
                      required={passwordRequired}
                      optional={!passwordRequired}
                    >
                      <PasswordField
                        id="user-password"
                        value={form.password}
                        visible={showPassword}
                        onVisibleChange={setShowPassword}
                        onChange={(value) => set('password', value)}
                        disabled={busy}
                        required={passwordRequired}
                        minLength={passwordRequired ? MIN_PASSWORD_LENGTH : undefined}
                      />
                      <p className={helperCls}>
                        {passwordRequired
                          ? `At least ${MIN_PASSWORD_LENGTH} characters.`
                          : `Leave blank to keep current password. New passwords need at least ${MIN_PASSWORD_LENGTH} characters.`}
                      </p>
                      {passwordTooShort ? (
                        <p className="text-[11px] font-medium text-red-700 dark:text-red-400">
                          Password must be at least {MIN_PASSWORD_LENGTH} characters.
                        </p>
                      ) : null}
                    </Field>
                    <Field
                      label="Confirm password"
                      htmlFor="user-confirm-password"
                      required={passwordRequired}
                      optional={!passwordRequired}
                    >
                      <PasswordField
                        id="user-confirm-password"
                        value={form.confirmPassword}
                        visible={showConfirmPassword}
                        onVisibleChange={setShowConfirmPassword}
                        onChange={(value) => set('confirmPassword', value)}
                        disabled={busy}
                        required={passwordRequired}
                      />
                      {passwordMismatch ? (
                        <p className="text-[11px] font-medium text-red-700 dark:text-red-400">
                          Passwords do not match.
                        </p>
                      ) : null}
                    </Field>
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

      {cropSession ? (
        <ImageCropDialog
          open
          imageSrc={cropSession.url}
          fileName={cropSession.name}
          mime={cropSession.mime}
          title="Crop profile photo"
          aspect={1}
          presets={portraitAspectPresets}
          onCancel={closeCrop}
          onConfirm={handleCroppedUpload}
        />
      ) : null}

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

function PasswordField({
  id,
  value,
  visible,
  onVisibleChange,
  onChange,
  disabled,
  required,
  minLength,
}: {
  id: string
  value: string
  visible: boolean
  onVisibleChange: (visible: boolean) => void
  onChange: (value: string) => void
  disabled?: boolean
  required?: boolean
  minLength?: number
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        className={cn(catalogInput, 'pr-11')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoComplete="new-password"
        minLength={minLength}
        required={required}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label={visible ? 'Hide password' : 'Show password'}
        onClick={() => onVisibleChange(!visible)}
        className="absolute top-1/2 right-1.5 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 outline-none transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-brand-500/35 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  required = false,
  optional = false,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  optional?: boolean
  children: ReactNode
}) {
  return (
    <div className={workspaceFormFieldGroupCls}>
      <label className={workspaceFormLabelCls} htmlFor={htmlFor}>
        {label}{' '}
        {required ? <span className={workspaceFormRequiredMarkCls}>*</span> : null}
        {optional && !required ? (
          <span className={workspaceFormOptionalBadgeCls}>Optional</span>
        ) : null}
      </label>
      {children}
    </div>
  )
}
