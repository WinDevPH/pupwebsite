import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link2, Loader2, Plus, RefreshCw, Search } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ConfirmDeleteDialog } from '@/components/portal/ConfirmDeleteDialog'
import { HorizontalDragScrollTableWrap } from '@/components/portal/HorizontalDragScrollTableWrap'
import { RegisterRowActions } from '@/components/portal/RegisterRowActions'
import { RequireLoginRedirect } from '@/components/portal/RequireLoginRedirect'
import {
  catalogInput,
  catalogToolbarIconBtn,
  effectiveRegisterPageSize,
  plansRegisterPanelFooterCls,
  plansRegisterTableScrollerCls,
  readStoredRegisterPageSize,
  RegisterPaginationBar,
  RegisterPanelHeading,
  workspaceCatalogPadCls,
  workspaceCatalogShellCls,
  workspaceCatalogToolbarIconCls,
  workspaceCatalogToolbarMainRowCls,
  workspaceCatalogToolbarSearchFieldCls,
  workspaceCatalogToolbarSearchRowCls,
  workspacePageAddBtnCls,
  workspaceRegisterPanelShellCls,
  workspaceRegisterSectionStackCls,
  workspaceRegisterTableCls,
  workspaceRegisterTbodyRowCls,
  workspaceRegisterThActionsCellCls,
  workspaceRegisterThSortCellCls,
  workspaceRegisterTheadCls,
  workspaceTenantMainStackCls,
  writeStoredRegisterPageSize,
} from '@/components/portal/register-ui'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import {
  deleteResourceLink,
  getResourceLibrary,
  type ResourceLinkRecord,
} from '@/lib/resource-library-api'
import { cn } from '@/lib/utils'

const PAGE_SIZE_KEY = 'pup-admin-resource-links-page-size'
const HEADING_ID = 'resource-links-register-heading'
const BASE = '/admin/resource-links'

export default function ResourceLinksAdmin() {
  const navigate = useNavigate()
  const location = useLocation()
  const [items, setItems] = useState<ResourceLinkRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadBusy, setReloadBusy] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [query, setQuery] = useState('')
  const [pageNo, setPageNo] = useState(1)
  const [pageSize, setPageSize] = useState(() => readStoredRegisterPageSize(PAGE_SIZE_KEY))
  const [busyId, setBusyId] = useState<number | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ResourceLinkRecord | null>(null)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [toast, setToast] = useState<SnackToast | null>(null)

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (opts?.soft) setReloadBusy(true)
      else setLoading(true)
      const result = await getResourceLibrary({ all: true })
      if (!result.ok) {
        setItems([])
        setNeedsLogin(result.status === 401 || result.status === 403)
        if (result.status !== 401 && result.status !== 403) showToast(result.error, 'error')
      } else {
        setNeedsLogin(false)
        setItems(result.data.items)
      }
      setLoading(false)
      setReloadBusy(false)
    },
    [showToast],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const flash = (
      location.state as { toast?: { message: string; variant: SnackToast['variant'] } } | null
    )?.toast
    if (!flash?.message) return
    setToast({ id: Date.now(), message: flash.message, variant: flash.variant ?? 'success' })
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return items
    return items.filter((item) =>
      `${item.title} ${item.slug} ${item.url}`.toLowerCase().includes(needle),
    )
  }, [items, query])

  useEffect(() => {
    setPageNo(1)
  }, [query, pageSize])

  const pageMeta = useMemo(() => {
    const total = filtered.length
    const psz = effectiveRegisterPageSize(pageSize, total)
    const pages = total === 0 ? 0 : Math.ceil(total / psz)
    const page = pages === 0 ? 1 : Math.min(Math.max(1, pageNo), pages)
    const start = total === 0 ? 0 : (page - 1) * psz
    return {
      total,
      pages,
      page,
      from: total === 0 ? 0 : start + 1,
      to: total === 0 ? 0 : Math.min(start + psz, total),
      rows: total === 0 ? [] : filtered.slice(start, start + psz),
    }
  }, [filtered, pageNo, pageSize])

  const busy = loading || reloadBusy || busyId !== null
  if (needsLogin) return <RequireLoginRedirect />

  return (
    <div className={workspaceTenantMainStackCls}>
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="min-w-0 space-y-1">
          <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900 sm:text-[22px] dark:text-zinc-50">
            Resource library
          </h1>
          <p className="max-w-xl text-[13px] leading-6 text-zinc-500 dark:text-zinc-400">
            Drive folder links shown in Resources and on the public Forms page.
          </p>
        </div>
        <button type="button" className={workspacePageAddBtnCls} onClick={() => navigate(`${BASE}/new`)}>
          <Plus className="h-4 w-4" aria-hidden />
          New link
        </button>
      </div>

      <section aria-label="Catalog" className="w-full max-w-none">
        <div className={`${workspaceCatalogShellCls} ${workspaceCatalogPadCls} w-full max-w-none`}>
          <div className={workspaceCatalogToolbarMainRowCls}>
            <div className={workspaceCatalogToolbarSearchRowCls}>
              <div className={workspaceCatalogToolbarSearchFieldCls}>
                <Search
                  className={`pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-zinc-400 ${workspaceCatalogToolbarIconCls}`}
                  aria-hidden
                />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  disabled={busy}
                  placeholder="Search…"
                  aria-label="Search resource links"
                  className={`${catalogInput} min-w-0 w-full pl-9`}
                />
              </div>
              <button
                type="button"
                disabled={busy}
                title="Reload catalog"
                aria-label="Reload catalog"
                onClick={() => void load({ soft: true })}
                className={catalogToolbarIconBtn}
              >
                <RefreshCw
                  className={`${workspaceCatalogToolbarIconCls} ${reloadBusy ? 'animate-spin' : 'opacity-85'}`}
                  aria-hidden
                />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby={HEADING_ID}
        aria-label="Registered Resource Links"
        className={workspaceRegisterSectionStackCls}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-zinc-300/90 bg-zinc-50/80 px-5 py-12 text-[13px] text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-hidden />
            Loading resource links…
          </div>
        ) : filtered.length === 0 ? (
          <div className={workspaceRegisterPanelShellCls('table')}>
            <RegisterPanelHeading
              headingId={HEADING_ID}
              title="Registered Resource Links"
              subtitle="0 in catalog"
              onAdd={() => navigate(`${BASE}/new`)}
              addAriaLabel="New link"
            />
            <div className="flex flex-col items-center px-5 py-10 text-center">
              <Link2 className="mb-5 h-[3.75rem] w-[3.75rem] text-brand-600/45" strokeWidth={1.35} aria-hidden />
              <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
                {items.length === 0 ? 'No resource links yet' : 'No matching links'}
              </p>
            </div>
          </div>
        ) : (
          <div className={workspaceRegisterPanelShellCls('table')}>
            <RegisterPanelHeading
              headingId={HEADING_ID}
              title="Registered Resource Links"
              subtitle={`${pageMeta.total.toLocaleString()} record${pageMeta.total === 1 ? '' : 's'}`}
              onAdd={() => navigate(`${BASE}/new`)}
              addAriaLabel="New link"
            />
            <HorizontalDragScrollTableWrap className={plansRegisterTableScrollerCls}>
              <table className={workspaceRegisterTableCls}>
                <thead className={workspaceRegisterTheadCls}>
                  <tr className="[&_th]:text-brand-900/80 dark:[&_th]:text-zinc-300">
                    <th scope="col" className={cn(workspaceRegisterThSortCellCls, 'text-left')}>
                      Link
                    </th>
                    <th scope="col" className={cn(workspaceRegisterThSortCellCls, 'w-[9rem] text-left')}>
                      Slug
                    </th>
                    <th scope="col" className={cn(workspaceRegisterThSortCellCls, 'w-[5rem] text-left')}>
                      Sort
                    </th>
                    <th scope="col" className={cn(workspaceRegisterThSortCellCls, 'w-[7rem] text-left')}>
                      Status
                    </th>
                    <th scope="col" className={workspaceRegisterThActionsCellCls}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-950">
                  {pageMeta.rows.map((item) => (
                    <tr
                      key={item.id}
                      className={cn(workspaceRegisterTbodyRowCls, 'cursor-pointer')}
                      onClick={() => navigate(`${BASE}/${item.id}/edit`)}
                    >
                      <td className="px-1.5 py-2 sm:px-2">
                        <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{item.title}</p>
                        <p className="mt-0.5 truncate text-[11px] text-zinc-500">{item.url}</p>
                      </td>
                      <td className="px-1.5 py-2 font-mono text-[11px] text-zinc-600 sm:px-2">
                        {item.slug}
                      </td>
                      <td className="px-1.5 py-2 font-mono text-[11px] text-zinc-600 sm:px-2">
                        {item.sortOrder}
                      </td>
                      <td className="px-1.5 py-2 sm:px-2">
                        <StatusBadge published={item.published} />
                      </td>
                      <td
                        className="px-1 py-2 pr-1.5 sm:px-1.5"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <RegisterRowActions
                          open={openMenuId === item.id}
                          onOpenChange={(open) => setOpenMenuId(open ? item.id : null)}
                          onEdit={() => navigate(`${BASE}/${item.id}/edit`)}
                          onDelete={() => setPendingDelete(item)}
                          disabled={busyId === item.id}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </HorizontalDragScrollTableWrap>
            <footer className={plansRegisterPanelFooterCls}>
              <RegisterPaginationBar
                disabled={busy}
                showingFrom={pageMeta.from}
                showingTo={pageMeta.to}
                totalRecords={pageMeta.total}
                pageSize={pageSize}
                onPageSizeChange={(n) => {
                  setPageSize(n)
                  writeStoredRegisterPageSize(PAGE_SIZE_KEY, n)
                }}
                page={pageMeta.page}
                totalPages={pageMeta.pages}
                onPrev={() => setPageNo((prev) => (prev <= 1 ? prev : prev - 1))}
                onNext={() => setPageNo((prev) => Math.min(pageMeta.pages, prev + 1))}
                onGoPage={(pn) => setPageNo(Math.min(Math.max(1, pn), pageMeta.pages))}
                ariaLabel="Resource links pagination"
              />
            </footer>
          </div>
        )}
      </section>

      {pendingDelete ? (
        <ConfirmDeleteDialog
          title={pendingDelete.title}
          noun="resource link"
          description="This link will be removed from the Resources menu and the public Forms page."
          busy={busyId === pendingDelete.id}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            void (async () => {
              setBusyId(pendingDelete.id)
              const result = await deleteResourceLink(pendingDelete.id)
              setBusyId(null)
              if (!result.ok) {
                showToast(result.error, 'error')
                return
              }
              showToast('Resource link deleted.', 'success')
              setPendingDelete(null)
              await load({ soft: true })
            })()
          }}
        />
      ) : null}

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

function StatusBadge({ published }: { published: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[10px] border px-2 py-1 text-[11px] font-medium',
        published
          ? 'border-emerald-200/85 bg-emerald-50 text-emerald-950'
          : 'border-amber-200/85 bg-amber-50 text-amber-950',
      )}
    >
      {published ? 'Published' : 'Draft'}
    </span>
  )
}
