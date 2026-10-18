import type { ReactNode } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import {
  catalogInput,
  workspaceFormFieldGroupCls,
  workspaceFormLabelCls,
  workspaceFormOptionalBadgeCls,
  workspaceFormRequiredMarkCls,
  workspaceTenantMainStackCls,
} from '@/components/portal/register-ui'
import { cn } from '@/lib/utils'

export const cmsInputCls = catalogInput
export const cmsTextareaCls = cn(catalogInput, 'min-h-[4.5rem] resize-y py-2 leading-6')

export const cmsSecondaryBtnCls =
  'inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-45 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'

export const cmsSaveBtnCls =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-brand-600 bg-brand-600 px-3 text-[12px] font-semibold text-white shadow-sm transition hover:border-brand-700 hover:bg-brand-700 disabled:opacity-45 dark:border-brand-500 dark:bg-brand-500 dark:hover:border-brand-400 dark:hover:bg-brand-400'

export function CmsPage({
  title,
  blurb,
  actions,
  children,
}: {
  title: string
  blurb: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className={workspaceTenantMainStackCls}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <h1 className="font-hero text-[clamp(1.75rem,1.2rem+1.2vw,2.25rem)] leading-none tracking-tight text-brand-950 dark:text-zinc-50">
            {title}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">{blurb}</p>
        </div>
        {actions}
      </header>
      {children}
    </div>
  )
}

export function CmsLoading({ label }: { label: string }) {
  return (
    <div className={workspaceTenantMainStackCls}>
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {label}
      </div>
    </div>
  )
}

export function CmsAddButton({
  onClick,
  children,
  disabled,
}: {
  onClick: () => void
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={cmsSecondaryBtnCls}>
      <Plus className="size-3.5" aria-hidden />
      {children}
    </button>
  )
}

export function CmsField({
  label,
  required,
  optional,
  custom,
  className,
  children,
}: {
  label: string
  required?: boolean
  optional?: boolean
  /** Use a div wrapper (instead of label) around custom controls such as CatalogSelect. */
  custom?: boolean
  className?: string
  children: ReactNode
}) {
  const Wrapper = custom ? 'div' : 'label'
  return (
    <Wrapper className={cn(workspaceFormFieldGroupCls, className)}>
      <span className={workspaceFormLabelCls}>
        {label}
        {required ? <span className={workspaceFormRequiredMarkCls}> *</span> : null}
        {optional ? <span className={workspaceFormOptionalBadgeCls}>Optional</span> : null}
      </span>
      {children}
    </Wrapper>
  )
}

export function CmsPublishedToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="inline-flex items-center gap-2 text-[12px] font-medium text-zinc-700 dark:text-zinc-200">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 rounded border-zinc-300 accent-brand-600"
      />
      Published
    </label>
  )
}

export function CmsRowCard({
  title,
  eyebrow,
  isNew,
  dirty,
  saving,
  onSave,
  onDelete,
  footerExtra,
  children,
}: {
  title: string
  eyebrow?: string
  isNew: boolean
  dirty: boolean
  saving: boolean
  onSave: () => void
  onDelete: () => void
  footerExtra?: ReactNode
  children: ReactNode
}) {
  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[10px] font-semibold tracking-[0.14em] text-brand-700 uppercase dark:text-brand-300">
              {eyebrow}
            </p>
          ) : null}
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {title || (isNew ? 'New item' : 'Untitled')}
          </p>
        </div>
        {isNew ? (
          <span className="rounded-md bg-gold-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-brand-950 uppercase">
            Unsaved
          </span>
        ) : dirty ? (
          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-600 uppercase dark:bg-zinc-800 dark:text-zinc-300">
            Edited
          </span>
        ) : null}
      </div>

      {children}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <div className="flex items-center gap-3">{footerExtra}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-red-700 disabled:opacity-40 dark:text-red-300"
          >
            <Trash2 className="size-3.5" aria-hidden />
            {isNew ? 'Discard' : 'Delete'}
          </button>
          <button
            type="button"
            disabled={saving || (!isNew && !dirty)}
            onClick={onSave}
            className={cmsSaveBtnCls}
          >
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </li>
  )
}
