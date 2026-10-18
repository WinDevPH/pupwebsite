import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

/** NetLynk Plans / Employees register tokens (light-first; dark classes kept for portal theme). */

export const workspaceCatalogShellCls =
  'relative z-10 overflow-visible rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_2px_8px_rgba(15,23,42,0.03)] dark:border-zinc-800 dark:bg-zinc-900/30 dark:shadow-none'

export const workspaceCatalogPadCls = 'p-3 sm:p-4'

export const workspaceCatalogToolbarMainRowCls =
  'flex w-full min-w-0 flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3'

export const workspaceCatalogToolbarSearchRowCls =
  'flex w-full min-w-0 items-center gap-1.5 sm:w-auto sm:shrink-0 sm:gap-2'

export const workspaceCatalogToolbarSearchFieldCls =
  'relative min-w-0 w-full flex-1 basis-0 sm:w-[18rem] sm:max-w-[18rem] sm:flex-none'

export const workspaceCatalogToolbarActionsRowCls =
  'flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap sm:justify-end sm:gap-3 sm:overflow-visible'

export const workspaceCatalogToolbarDividerCls =
  'hidden h-7 w-px shrink-0 self-center bg-zinc-200 dark:bg-zinc-700 sm:inline-block'

export const workspaceCatalogToolbarIconCls = 'h-4 w-4 shrink-0'

export const workspaceCatalogSegTrackInlineCls =
  'flex h-10 min-h-10 w-auto shrink-0 items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-900/80 sm:inline-flex sm:h-auto sm:min-h-0 sm:w-auto sm:flex-none sm:shrink-0 sm:justify-start'

export const workspaceTenantMainStackCls =
  'flex w-full max-w-none flex-col gap-2 sm:gap-3 lg:gap-4'

export const workspaceRegisterSectionStackCls = 'space-y-1.5 sm:space-y-2'

export const workspaceRegisterTableOuterCls =
  'overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_12px_rgba(15,23,42,0.04)] dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none'

export function workspaceRegisterPanelShellCls(view: 'table' | 'cards' = 'table') {
  const base = 'flex min-w-0 flex-col'
  if (view !== 'cards') return `${workspaceRegisterTableOuterCls} ${base}`
  return [
    base,
    'max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:shadow-none',
    'sm:rounded-xl sm:border sm:border-brand-200/70 sm:bg-white sm:shadow-sm dark:sm:border-zinc-800 dark:sm:bg-zinc-950',
  ].join(' ')
}

export const plansRegisterPanelHeaderCls =
  'border-b border-brand-200/70 bg-brand-50/60 px-3.5 py-3.5 text-left dark:border-zinc-800 dark:bg-zinc-950/55 sm:px-4 sm:py-4'

export const plansRegisterPanelFooterCls =
  'relative border-t border-brand-200/70 bg-brand-50/45 px-3.5 py-2 dark:border-zinc-800 dark:bg-zinc-950/70 sm:px-4 sm:py-2.5'

export const plansRegisterTableScrollerCls =
  'relative z-0 min-w-0 overflow-x-auto bg-white dark:bg-zinc-950 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

export const workspaceRegisterTheadCls =
  'sticky top-0 z-20 border-b border-zinc-200 bg-zinc-50 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 [&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-zinc-50 dark:[&_th]:bg-zinc-950'

export const workspaceRegisterThSortCellCls = 'whitespace-nowrap px-1 py-1.5 sm:px-2'

export const workspaceRegisterThCheckboxCellCls =
  'w-[2.5rem] whitespace-nowrap px-1 py-1.5 text-center sm:w-11 sm:px-2'

export const workspaceRegisterThActionsCellCls =
  'w-[3.25rem] whitespace-nowrap px-1 py-1.5 pr-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-800/90 dark:text-zinc-300 sm:pr-2.5'

export const tableCheckboxCls =
  'h-4 w-4 shrink-0 cursor-pointer rounded border-zinc-300 text-brand-600 accent-brand-600 focus:ring-2 focus:ring-brand-500/55 focus:ring-offset-0 disabled:pointer-events-none disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-950'

export const workspaceRegisterBulkSelectionPlacementCls =
  'flex w-full min-w-0 justify-stretch sm:justify-end'

export const workspaceRegisterTbodyRowCls =
  'border-t border-zinc-200/70 transition-colors hover:bg-zinc-50/80 dark:border-zinc-800/80 dark:hover:bg-zinc-900/60 [&>td]:align-middle'

export const workspaceRegisterTableCls =
  'min-w-full w-max table-auto border-collapse text-left text-[12px] [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap'

export const catalogInput =
  'h-9 max-sm:h-10 w-full min-h-9 max-w-none rounded-md border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 shadow-[0_1px_0_rgba(0,0,0,0.02)] outline-none transition placeholder:text-zinc-400 focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/18 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-400 dark:focus:ring-brand-400/22'

export const catalogTextarea =
  'w-full min-h-[5.5rem] resize-none rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-[13px] text-zinc-900 shadow-[0_1px_0_rgba(0,0,0,0.02)] outline-none transition placeholder:text-zinc-400 focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/18 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-400 dark:focus:ring-brand-400/22'

export const workspaceFormLabelCls =
  'block text-[12px] font-medium text-zinc-800 dark:text-zinc-200'

export const workspaceFormFieldGroupCls = 'block space-y-1.5'

export const workspaceFormOptionalBadgeCls =
  'ml-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500'

export const workspaceFormRequiredMarkCls =
  'text-[13px] font-semibold leading-none text-red-600 dark:text-red-400'

export const workspaceFormHintCls =
  'text-[11px] font-normal leading-snug text-brand-900/65 dark:text-zinc-500'

/** Back link above admin add/edit form cards */
export const formWorkspaceBackLinkCls =
  'font-semibold text-brand-700 hover:text-brand-600 dark:text-brand-300'

export const formWorkspaceBackWrapCls = 'text-[13px]'

export function FormWorkspaceBackLink({
  to,
  label,
}: {
  to: string
  label: string
}) {
  return (
    <p className={formWorkspaceBackWrapCls}>
      <Link to={to} className={formWorkspaceBackLinkCls}>
        ← Back to {label}
      </Link>
    </p>
  )
}

/** NetLynk PlanFormPageChrome / subscriber plan form tokens */
export const formWorkspaceCardCls =
  'overflow-hidden rounded-xl border border-brand-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none'

export const formWorkspaceCardEyebrowCls =
  'border-b border-brand-200/80 bg-brand-50/90 px-4 py-3 sm:px-5 sm:py-3.5 lg:px-8 dark:border-zinc-800 dark:bg-zinc-950'

export const formWorkspaceCardEyebrowTextCls =
  'text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-800/85 dark:text-zinc-400'

export const formWorkspaceCardBodyCls = 'p-3 sm:p-5 lg:p-8'

export const formWorkspaceCardFooterCls =
  'flex shrink-0 justify-end border-t border-zinc-100 bg-zinc-50/50 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] dark:border-zinc-800 dark:bg-zinc-900 sm:px-5 sm:py-4 lg:px-8 lg:py-5'

export const formWorkspacePrimaryBtnCls =
  'inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-brand-600 bg-brand-600 px-4 text-[12px] font-semibold text-white shadow-sm transition hover:border-brand-700 hover:bg-brand-700 disabled:opacity-45 sm:h-9 sm:w-auto sm:min-w-[8.5rem] dark:border-brand-500 dark:bg-brand-500 dark:hover:border-brand-400 dark:hover:bg-brand-400'

export const formInsetPanelCls =
  'rounded-xl border border-zinc-200/95 bg-zinc-50/90 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5 dark:border-zinc-700 dark:bg-zinc-900/50 dark:shadow-black/40 max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none'

export const formTabChromeCardCls =
  'w-full space-y-3 rounded-xl border border-zinc-200/90 bg-white/80 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-zinc-700/90 dark:bg-zinc-950/45 dark:shadow-black/30 sm:space-y-3.5 sm:p-4'

export const formControlWellCls =
  'rounded-lg border border-zinc-200/85 bg-white/85 p-2.5 sm:p-3.5 dark:border-zinc-700/70 dark:bg-zinc-950/50'

/** Image upload drop target (announcements, calendar, projects, council). */
export const formMediaDropzoneBaseCls =
  'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition'

export function formMediaDropzoneStateCls(dragOver: boolean): string {
  return dragOver
    ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/20'
    : 'border-zinc-300 bg-zinc-50 hover:border-brand-400 hover:bg-brand-50/70 dark:border-zinc-600 dark:bg-zinc-950 dark:hover:border-brand-400 dark:hover:bg-brand-500/12'
}

export const formMediaDropzoneIconCls =
  'grid h-10 w-10 place-items-center rounded-xl bg-white text-brand-700 shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:text-brand-300 dark:shadow-none dark:ring-zinc-600'

export const formMediaDropzoneTitleCls =
  'text-[13px] font-semibold text-zinc-900 dark:text-zinc-50'

export const formMediaDropzoneHintCls =
  'max-w-xs text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400'

export const formSectionIconWrapCls =
  'mt-[1px] flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200/95 bg-white text-brand-700 shadow-[0_1px_2px_rgba(15,23,42,0.05)] sm:h-9 sm:w-9 dark:border-zinc-700 dark:bg-zinc-950 dark:text-brand-400'

export const formSectionIntroCls =
  'mt-1.5 text-[11px] leading-snug text-zinc-600 sm:text-[12px] dark:text-zinc-400'

export const formSectionHeadingCls =
  'text-[12px] font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-100'

export function formTabBtnCls(selected: boolean): string {
  return [
    'inline-flex min-w-0 w-full items-center justify-center gap-1.5 whitespace-normal rounded-lg px-1.5 py-2 text-center text-[11px] font-semibold leading-tight transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 sm:px-2 sm:text-[12px]',
    selected
      ? 'bg-brand-50 text-brand-900 ring-1 ring-brand-200/90 dark:bg-brand-500/20 dark:text-zinc-50 dark:ring-brand-400/45 dark:hover:bg-brand-500/28'
      : 'bg-zinc-100/90 text-zinc-600 hover:bg-zinc-200/90 hover:text-zinc-900 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-50',
  ].join(' ')
}

/** Tab strip track behind form section tabs (NetLynk plan form). */
export const formTabListCls =
  'grid w-full grid-cols-2 gap-1.5 rounded-xl border border-zinc-200/80 bg-zinc-100/70 p-1 sm:grid-cols-4 dark:border-zinc-700/80 dark:bg-zinc-950/70'

export function FormSectionTabLabel({
  label,
  short,
  alert = false,
}: {
  label: string
  short: string
  alert?: boolean
}) {
  return (
    <span className="inline-flex items-center justify-center gap-1.5">
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{short}</span>
      {alert ? (
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-label="Incomplete" />
      ) : null}
    </span>
  )
}

export const workspaceToolbarPrimaryBtnCls =
  'inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-brand-600 bg-brand-600 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:border-brand-700 hover:bg-brand-700 disabled:opacity-45 sm:flex-initial sm:min-w-[7.75rem] dark:border-brand-500 dark:bg-brand-500 dark:hover:border-brand-400 dark:hover:bg-brand-400'

export const workspaceToolbarCancelBtnCls =
  'inline-flex h-12 w-full items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-[13px] font-semibold text-zinc-700 outline-none transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-brand-500/35 disabled:opacity-45 sm:h-10 sm:w-auto dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900'

export const catalogToolbarIconBtn =
  'inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-brand-200/90 bg-white text-brand-950 shadow-[0_1px_0_rgba(0,0,0,0.02)] outline-none transition hover:border-brand-300 hover:bg-brand-50/70 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-brand-500/40 max-sm:h-10 max-sm:w-10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-900 dark:focus-visible:ring-brand-400/45'

const brandSegmentActiveCls =
  'bg-white text-brand-900 shadow-sm ring-1 ring-brand-300/90 dark:bg-brand-600 dark:text-white dark:ring-brand-400/55'

export function catalogSegIcon(active: boolean) {
  return [
    'inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[6px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed max-sm:h-8 max-sm:w-8 max-sm:rounded-[5px]',
    active
      ? brandSegmentActiveCls
      : 'text-brand-900/65 hover:bg-white/80 dark:text-zinc-400 dark:ring-transparent dark:hover:bg-zinc-800/90',
  ].join(' ')
}

export const workspacePageAddBtnCls =
  'hidden md:inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-brand-600 bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:border-brand-700 hover:bg-brand-700 disabled:opacity-45'

export const plansRegisterMobilePanelFabCls =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-600 bg-brand-600 text-white shadow-sm outline-none transition hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500/40 md:hidden'

export const PAGE_SIZE_ALL = 0
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, PAGE_SIZE_ALL] as const
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]

export function isPageSizeOption(n: number): n is PageSizeOption {
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n)
}

export function pageSizeOptionLabel(n: number): string {
  return n === PAGE_SIZE_ALL ? 'All' : String(n)
}

export function effectiveRegisterPageSize(pageSize: number, total: number): number {
  if (!Number.isFinite(pageSize) || pageSize === PAGE_SIZE_ALL || pageSize <= 0) {
    return Math.max(1, total)
  }
  return Math.max(1, Math.floor(pageSize))
}

export function buildRegisterPageList(current: number, total: number): number[] {
  if (total <= 0) return []
  const size = 5
  const clamped = Math.min(Math.max(current, 1), total)
  let start = Math.max(1, clamped - Math.floor(size / 2))
  let end = Math.min(total, start + size - 1)
  if (end - start + 1 < size) {
    start = Math.max(1, end - size + 1)
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

export function readStoredRegisterPageSize(storageKey: string): number {
  if (typeof window === 'undefined') return 10
  try {
    const raw = sessionStorage.getItem(storageKey)
    if (raw == null || raw === '') return 10
    const n = Number(raw)
    if (Number.isFinite(n) && isPageSizeOption(n)) return n
  } catch {
    /* ignore */
  }
  return 10
}

export function writeStoredRegisterPageSize(storageKey: string, n: number) {
  try {
    sessionStorage.setItem(storageKey, String(n))
  } catch {
    /* ignore */
  }
}

export type RegisterView = 'table' | 'cards'

export function readStoredRegisterView(storageKey: string): RegisterView | null {
  if (typeof window === 'undefined') return null
  try {
    const v = sessionStorage.getItem(storageKey)
    return v === 'table' || v === 'cards' ? v : null
  } catch {
    return null
  }
}

export function initialRegisterView(storageKey: string): RegisterView {
  const saved = readStoredRegisterView(storageKey)
  if (saved) return saved
  if (typeof window === 'undefined') return 'table'
  return window.matchMedia('(max-width: 639px)').matches ? 'cards' : 'table'
}

const registerPaginatorEmbeddedShellCls =
  'flex min-w-0 w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-2'

const registerPaginatorBtnCls =
  'inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white px-2 text-[12px] font-semibold text-zinc-800 outline-none transition hover:border-zinc-300 hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-35 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-900'

const registerPaginatorPageBtnActiveCls =
  'border-brand-300 bg-brand-50 text-brand-900 dark:border-brand-500/45 dark:bg-brand-500/15 dark:text-brand-50'

const registerPaginatorMobileShellCls =
  'max-sm:grid max-sm:grid-cols-[auto_minmax(0,1fr)] max-sm:items-center max-sm:gap-x-2 max-sm:gap-y-3 max-sm:py-2.5'

const pageSizeSelectCls =
  'h-9 min-w-[4.75rem] max-w-[7rem] cursor-pointer rounded-md border border-zinc-200 bg-white px-2.5 font-mono text-[13px] font-semibold tabular-nums text-zinc-900 shadow-[0_1px_0_rgba(0,0,0,0.02)] outline-none transition hover:border-zinc-300 focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/18 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100'

export function RegisterPaginationBar({
  disabled,
  showingFrom,
  showingTo,
  totalRecords,
  pageSize,
  onPageSizeChange,
  page,
  totalPages,
  onPrev,
  onNext,
  onGoPage,
  ariaLabel = 'Register pagination',
}: {
  disabled: boolean
  showingFrom: number
  showingTo: number
  totalRecords: number
  pageSize: number
  onPageSizeChange: (n: number) => void
  page: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
  onGoPage: (p: number) => void
  ariaLabel?: string
}) {
  const prevDisabled = disabled || page <= 1 || totalRecords === 0
  const nextDisabled =
    disabled || totalPages <= 0 || page >= totalPages || totalRecords === 0
  const pageList = totalPages > 0 ? buildRegisterPageList(page, totalPages) : []

  return (
    <div
      role="navigation"
      aria-label={ariaLabel}
      className={`${registerPaginatorEmbeddedShellCls} ${registerPaginatorMobileShellCls}`}
    >
      <label className="flex min-w-0 shrink-0 items-center gap-2.5 max-sm:col-start-1 max-sm:row-start-1 max-sm:whitespace-nowrap">
        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 max-sm:text-[11px] max-sm:font-medium max-sm:normal-case max-sm:tracking-normal max-sm:text-zinc-400">
          Show
        </span>
        <select
          aria-label="Number of records to show per page"
          disabled={disabled}
          value={String(pageSize)}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className={pageSizeSelectCls}
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={String(n)}>
              {pageSizeOptionLabel(n)}
            </option>
          ))}
        </select>
      </label>

      <div className="flex min-w-0 flex-1 flex-col gap-2 max-sm:contents sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <p className="min-w-0 text-left text-[12px] leading-snug tabular-nums text-zinc-600 dark:text-zinc-400 max-sm:col-start-2 max-sm:row-start-1 max-sm:min-w-0 max-sm:justify-self-start max-sm:overflow-x-auto max-sm:text-[11px] max-sm:whitespace-nowrap max-sm:[scrollbar-width:thin]">
          <span>Showing </span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {showingFrom.toLocaleString()}
          </span>
          <span className="text-zinc-400 dark:text-zinc-500">{' – '}</span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {showingTo.toLocaleString()}
          </span>
          <span className="text-zinc-500 dark:text-zinc-400"> of </span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {totalRecords.toLocaleString()}
          </span>
          <span> records</span>
        </p>

        <div className="flex min-w-0 flex-wrap items-center gap-2 max-sm:col-span-2 max-sm:row-start-2 max-sm:w-full max-sm:justify-center max-sm:gap-2 sm:justify-end">
          <button
            type="button"
            aria-label="Previous page"
            className={registerPaginatorBtnCls}
            disabled={prevDisabled}
            onClick={onPrev}
          >
            <ChevronLeft className="h-[18px] w-[18px] opacity-90" aria-hidden />
          </button>

          <div role="group" aria-label="Pagination pages" className="flex min-w-0 flex-wrap items-center gap-1">
            {pageList.map((item) => (
              <button
                key={item}
                type="button"
                aria-label={`Page ${item}`}
                aria-current={item === page ? 'page' : undefined}
                disabled={disabled}
                onClick={() => onGoPage(item)}
                className={cn(
                  'inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border px-2 font-mono text-[12px] font-semibold tabular-nums outline-none transition focus-visible:ring-2 focus-visible:ring-brand-500/40',
                  item === page
                    ? `${registerPaginatorPageBtnActiveCls} disabled:opacity-50`
                    : 'border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900',
                )}
              >
                {item}
              </button>
            ))}
          </div>

          <button
            type="button"
            aria-label="Next page"
            className={registerPaginatorBtnCls}
            disabled={nextDisabled}
            onClick={onNext}
          >
            <ChevronRight className="h-[18px] w-[18px] opacity-90" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}

export function RegisterPanelHeading({
  headingId,
  title,
  subtitle,
  onAdd,
  addAriaLabel = 'Add',
  showMobileAdd = true,
  addDisabled = false,
}: {
  headingId: string
  title: string
  subtitle?: ReactNode
  onAdd?: () => void
  addAriaLabel?: string
  showMobileAdd?: boolean
  addDisabled?: boolean
}) {
  return (
    <header className={plansRegisterPanelHeaderCls}>
      <div className="flex min-w-0 w-full items-center justify-between gap-2 max-sm:gap-3">
        <div className="min-w-0 flex-1">
          <h2
            id={headingId}
            className="min-w-0 truncate text-[14px] font-semibold leading-snug tracking-tight text-brand-950 dark:text-zinc-100 sm:text-[15px]"
          >
            {title}
          </h2>
          {subtitle ? (
            <div className="mt-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">{subtitle}</div>
          ) : null}
        </div>
        {showMobileAdd && onAdd ? (
          <button
            type="button"
            className={plansRegisterMobilePanelFabCls}
            aria-label={addAriaLabel}
            disabled={addDisabled}
            onClick={onAdd}
          >
            <svg
              className="h-[15px] w-[15px] opacity-95"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        ) : null}
      </div>
    </header>
  )
}

export function RegisterBulkSelectionBar({
  count,
  disabled,
  onClear,
  onDelete,
}: {
  count: number
  disabled: boolean
  onClear: () => void
  onDelete?: () => void | Promise<void>
}) {
  if (count <= 0) return null

  const ghostIcon =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md outline-none transition focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-40'
  const ghostIconMuted = `${ghostIcon} text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900`

  return (
    <div className="flex min-w-0 max-w-full justify-end">
      <div
        role="toolbar"
        aria-label={`${count} selected`}
        className="flex min-w-0 max-w-full flex-wrap items-center gap-0.5 rounded-lg border border-zinc-200/95 bg-white p-0.5 shadow-sm sm:max-w-[min(100%,24rem)]"
      >
        <span
          className="select-none whitespace-nowrap px-2 py-1.5 font-mono text-[11px] font-semibold tabular-nums text-zinc-500"
          title={`${count} selected`}
        >
          {count}
        </span>
        <span className="my-1 h-4 w-px shrink-0 bg-zinc-200" aria-hidden />
        {onDelete ? (
          <>
            <button
              type="button"
              className={`${ghostIcon} text-red-700 hover:bg-red-50`}
              disabled={disabled}
              title="Delete selected"
              aria-label={`Delete ${count} selected`}
              onClick={() => void onDelete()}
            >
              <Trash2 className="h-3.5 w-3.5 opacity-90" aria-hidden />
            </button>
            <span className="my-1 h-4 w-px shrink-0 bg-zinc-200" aria-hidden />
          </>
        ) : null}
        <button
          type="button"
          className={ghostIconMuted}
          disabled={disabled}
          title="Clear selection"
          aria-label="Clear selection"
          onClick={onClear}
        >
          <X className="h-[15px] w-[15px]" strokeWidth={2.35} aria-hidden />
        </button>
      </div>
    </div>
  )
}
