import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Bookmark,
  FileText,
  Loader2,
  Lock,
  ShoppingBag,
  UserRound,
} from 'lucide-react'
import { RequireLoginRedirect } from '@/components/portal/RequireLoginRedirect'
import { HorizontalDragScrollTableWrap } from '@/components/portal/HorizontalDragScrollTableWrap'
import {
  formInsetPanelCls,
  formSectionHeadingCls,
  formSectionIconWrapCls,
  formSectionIntroCls,
  FormWorkspaceBackLink,
  formWorkspaceCardBodyCls,
  formWorkspaceCardCls,
  formWorkspaceCardEyebrowCls,
  formWorkspaceCardEyebrowTextCls,
  plansRegisterTableScrollerCls,
  RegisterPanelHeading,
  workspaceRegisterPanelShellCls,
  workspaceRegisterSectionStackCls,
  workspaceRegisterTableCls,
  workspaceRegisterTbodyRowCls,
  workspaceRegisterThActionsCellCls,
  workspaceRegisterThSortCellCls,
  workspaceRegisterTheadCls,
  workspaceTenantMainStackCls,
} from '@/components/portal/register-ui'
import { Button } from '@/components/ui/button'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import {
  buildCustomers,
  customerInitials,
  decodeCustomerKey,
  findCustomer,
  type CustomerRecord,
} from '@/lib/customers'
import { formatPhDateTime } from '@/lib/datetime'
import { listPortalRequests } from '@/lib/requests-api'
import {
  RESERVATION_STATUSES,
  formatReservationMoney,
  listReservations,
  reservationRentalLabel,
  type ReservationShop,
  type ReservationStatus,
} from '@/lib/reservations-api'
import { cn } from '@/lib/utils'

function reservationStatusLabel(status: string) {
  return RESERVATION_STATUSES.find((item) => item.value === status)?.label ?? status
}

export default function CustomerRecordPage() {
  const navigate = useNavigate()
  const { customerKey: rawKey } = useParams()
  const customerKey = decodeCustomerKey(rawKey)
  const [customer, setCustomer] = useState<CustomerRecord | null | undefined>(undefined)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [toast, setToast] = useState<SnackToast | null>(null)

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  useEffect(() => {
    let cancelled = false
    setCustomer(undefined)
    setLoadError('')
    void Promise.all([listReservations({ all: true }), listPortalRequests()]).then(
      ([reservations, requests]) => {
        if (cancelled) return
        if (!reservations.ok) {
          if (reservations.status === 401 || reservations.status === 403) setNeedsLogin(true)
          else {
            setLoadError(reservations.error)
            showToast(reservations.error, 'error')
          }
          setCustomer(null)
          return
        }
        setNeedsLogin(false)
        const list = buildCustomers(reservations.data.items, requests.ok ? requests.data.items : [])
        setCustomer(findCustomer(list, customerKey))
      },
    )
    return () => {
      cancelled = true
    }
  }, [customerKey, showToast])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const activeLocker = useMemo(
    () =>
      customer?.reservations.find(
        (item) => item.shop === 'locker' && item.status !== 'cancelled',
      ) ?? null,
    [customer],
  )

  if (needsLogin) return <RequireLoginRedirect />

  if (customer === undefined) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <FormWorkspaceBackLink to="/admin/customers" label="customers" />
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300/90 bg-zinc-50/80 px-5 py-16 text-[13px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-hidden />
          Loading customer record…
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <FormWorkspaceBackLink to="/admin/customers" label="customers" />
        <div className="rounded-xl border border-zinc-200 bg-white px-5 py-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {loadError || 'Customer not found.'}
          </p>
          <p className="mt-2 text-[13px] text-zinc-500 dark:text-zinc-400">
            This record is missing or the student has no matching reservations or requests.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="lg" variant="outline">
              <Link to="/admin/customers">Back to customers</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to="/admin/customers" label="customers" />

      <div className="flex items-start justify-between gap-3 sm:gap-4 md:gap-6">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900 sm:text-[22px] dark:text-zinc-50">
              {customer.name || 'Unknown'}
            </h1>
            <ActivityPills item={customer} />
          </div>
          <p className="max-w-2xl text-[13px] leading-6 text-zinc-500 dark:text-zinc-400">
            {customer.email || 'No email on file'}
            {customer.studentId ? (
              <>
                <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">·</span>
                <span className="font-mono text-zinc-600 dark:text-zinc-300">
                  {customer.studentId}
                </span>
              </>
            ) : null}
          </p>
          <p className="max-w-2xl text-[12px] leading-5 text-zinc-400 dark:text-zinc-500">
            Use the reservation and request tracking IDs below to follow locker, merch, and portal
            activity for this student.
          </p>
        </div>
      </div>

      <section aria-label="Customer details" className="w-full max-w-none">
        <div className={formWorkspaceCardCls}>
          <div className={formWorkspaceCardEyebrowCls}>
            <p className={formWorkspaceCardEyebrowTextCls}>Customers · Record</p>
          </div>
          <div className={formWorkspaceCardBodyCls}>
            <div className={formInsetPanelCls}>
              <div className="flex w-full min-w-0 items-start gap-2.5 sm:gap-3">
                <span className={formSectionIconWrapCls}>
                  <UserRound className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className={formSectionHeadingCls}>Student profile</h2>
                  <p className={formSectionIntroCls}>
                    Contact details pulled from the latest reservation or request. Counts below stay
                    linked to this student even if they file more than once.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
                <span
                  className="inline-flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-50 text-[15px] font-semibold tracking-wide text-brand-800 dark:bg-brand-500/15 dark:text-brand-200"
                  aria-hidden
                >
                  {customerInitials(customer.name)}
                </span>
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                  <MetaCell label="Email" value={customer.email || '—'} />
                  <MetaCell label="Mobile" value={customer.mobile || '—'} />
                  <MetaCell label="Student ID" value={customer.studentId || '—'} mono />
                  <MetaCell label="Year level" value={customer.year || '—'} />
                </div>
              </div>

              {activeLocker ? (
                <p className="mt-4 rounded-xl border border-brand-200/80 bg-brand-50/70 px-3 py-2.5 text-[12px] font-medium text-brand-900 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-100">
                  Active locker {activeLocker.itemName} ·{' '}
                  {reservationRentalLabel(activeLocker.rentalType)} · {activeLocker.code}
                </p>
              ) : null}

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatCell
                  icon={Bookmark}
                  label="Reservations"
                  value={String(customer.reservations.length)}
                />
                <StatCell icon={Lock} label="Lockers" value={String(customer.lockerCount)} />
                <StatCell icon={ShoppingBag} label="Merch" value={String(customer.merchCount)} />
                <StatCell
                  icon={FileText}
                  label="Lifetime"
                  value={formatReservationMoney(customer.totalAmount)}
                  hint={
                    customer.requestCount > 0
                      ? `${customer.requestCount} request${customer.requestCount === 1 ? '' : 's'}`
                      : customer.activeTotal !== customer.totalAmount
                        ? `${formatReservationMoney(customer.activeTotal)} open`
                        : undefined
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="customer-purchases-heading"
        className={workspaceRegisterSectionStackCls}
      >
        <div className={workspaceRegisterPanelShellCls('table')}>
          <RegisterPanelHeading
            headingId="customer-purchases-heading"
            title="Purchases and reservations"
            subtitle={
              customer.reservations.length === 0
                ? 'No locker or merch reservations yet'
                : `${customer.reservations.length} reservation${customer.reservations.length === 1 ? '' : 's'} · open a row to track by ID`
            }
          />
          {customer.reservations.length === 0 ? (
            <EmptyPanel
              icon={Bookmark}
              title="No purchases yet"
              body="Locker rentals and merch holds filed by this student will appear here."
            />
          ) : (
            <HorizontalDragScrollTableWrap className={plansRegisterTableScrollerCls}>
              <table className={workspaceRegisterTableCls}>
                <caption className="sr-only">Customer purchases</caption>
                <thead className={workspaceRegisterTheadCls}>
                  <tr className="[&_th]:text-brand-900/80 dark:[&_th]:text-zinc-300">
                    <th
                      scope="col"
                      className={cn(
                        workspaceRegisterThSortCellCls,
                        'w-[16rem] max-w-[16rem] text-left sm:w-[20rem] sm:max-w-[20rem]',
                      )}
                    >
                      Item
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[8rem] text-left')}
                    >
                      Type
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[7rem] text-left')}
                    >
                      Total
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[7rem] text-left')}
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[11rem] text-left')}
                    >
                      Filed
                    </th>
                    <th scope="col" className={workspaceRegisterThActionsCellCls}>
                      View
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-950">
                  {customer.reservations.map((item) => (
                    <tr
                      key={item.id}
                      className={cn(workspaceRegisterTbodyRowCls, 'cursor-pointer')}
                      onClick={() => navigate(`/admin/reservations/${item.id}/edit`)}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open reservation ${item.code}`}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          navigate(`/admin/reservations/${item.id}/edit`)
                        }
                      }}
                    >
                      <td className="w-[16rem] max-w-[16rem] px-1.5 py-2 sm:w-[20rem] sm:max-w-[20rem] sm:px-2">
                        <div className="flex min-w-0 max-w-full items-center gap-2.5 overflow-hidden sm:gap-3">
                          <Thumb src={item.image ?? ''} shop={item.shop} />
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <p
                              className="truncate font-semibold leading-tight text-zinc-900 dark:text-zinc-50"
                              title={item.itemName}
                            >
                              {item.itemName || 'Untitled'}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                              Track{' '}
                              <span className="font-mono">{item.code || '—'}</span>
                              {item.shop === 'locker'
                                ? ` · ${reservationRentalLabel(item.rentalType)}`
                                : ` · × ${item.quantity}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 sm:px-2">
                        <TypeBadge
                          label={
                            item.shop === 'locker'
                              ? reservationRentalLabel(item.rentalType)
                              : `Merch × ${item.quantity}`
                          }
                          tone={item.shop === 'locker' ? 'locker' : 'merch'}
                        />
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 text-[12px] font-medium sm:px-2">
                        {formatReservationMoney(item.totalAmount)}
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 sm:px-2">
                        <ReservationStatusBadge status={item.status} />
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-2 text-[12px] text-zinc-500 sm:px-2">
                        {formatPhDateTime(item.submittedAt)}
                      </td>
                      <td className="whitespace-nowrap px-1 py-2 pr-1.5 sm:px-1.5 sm:pr-2.5">
                        <span className="flex justify-end">
                          <UserRound className="h-4 w-4 text-zinc-400" aria-hidden />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </HorizontalDragScrollTableWrap>
          )}
        </div>
      </section>

      <section
        aria-labelledby="customer-requests-heading"
        className={workspaceRegisterSectionStackCls}
      >
        <div className={workspaceRegisterPanelShellCls('table')}>
          <RegisterPanelHeading
            headingId="customer-requests-heading"
            title="Portal requests"
            subtitle={
              customer.requests.length === 0
                ? 'No portal requests on this email'
                : `${customer.requests.length} request${customer.requests.length === 1 ? '' : 's'} · match the tracking ID from the portal`
            }
          />
          {customer.requests.length === 0 ? (
            <EmptyPanel
              icon={FileText}
              title="No portal requests"
              body="Inquiries filed with the same email address will appear here."
            />
          ) : (
            <HorizontalDragScrollTableWrap className={plansRegisterTableScrollerCls}>
              <table className={workspaceRegisterTableCls}>
                <caption className="sr-only">Customer portal requests</caption>
                <thead className={workspaceRegisterTheadCls}>
                  <tr className="[&_th]:text-brand-900/80 dark:[&_th]:text-zinc-300">
                    <th
                      scope="col"
                      className={cn(
                        workspaceRegisterThSortCellCls,
                        'w-[16rem] max-w-[16rem] text-left sm:w-[22rem] sm:max-w-[22rem]',
                      )}
                    >
                      Request
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[8rem] text-left')}
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className={cn(workspaceRegisterThSortCellCls, 'w-[11rem] text-left')}
                    >
                      Filed
                    </th>
                    <th scope="col" className={workspaceRegisterThActionsCellCls}>
                      View
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-950">
                  {customer.requests.map((item) => {
                    const href = item.dbId ? `/admin/requests/${item.dbId}` : ''
                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          workspaceRegisterTbodyRowCls,
                          href && 'cursor-pointer',
                        )}
                        onClick={() => {
                          if (href) navigate(href)
                        }}
                        tabIndex={href ? 0 : undefined}
                        role={href ? 'button' : undefined}
                        aria-label={href ? `Open request ${item.id}` : undefined}
                        onKeyDown={(event) => {
                          if (!href) return
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            navigate(href)
                          }
                        }}
                      >
                        <td className="w-[16rem] max-w-[16rem] px-1.5 py-2 sm:w-[22rem] sm:max-w-[22rem] sm:px-2">
                          <div className="flex min-w-0 max-w-full items-center gap-2.5 overflow-hidden sm:gap-3">
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900">
                              <FileText className="h-4 w-4" aria-hidden />
                            </span>
                            <div className="min-w-0 flex-1 overflow-hidden">
                              <p
                                className="truncate font-semibold leading-tight text-zinc-900 dark:text-zinc-50"
                                title={item.subject}
                              >
                                {item.subject}
                              </p>
                              <p className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                                Tracking ID <span className="font-mono">{item.id}</span>
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-2 sm:px-2">
                          <RequestStatusBadge status={item.status} />
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-2 text-[12px] text-zinc-500 sm:px-2">
                          {formatPhDateTime(item.submittedAt)}
                        </td>
                        <td className="whitespace-nowrap px-1 py-2 pr-1.5 sm:px-1.5 sm:pr-2.5">
                          <span className="flex justify-end">
                            <FileText className="h-4 w-4 text-zinc-400" aria-hidden />
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </HorizontalDragScrollTableWrap>
          )}
        </div>
      </section>

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

function ActivityPills({ item }: { item: CustomerRecord }) {
  const chips = [
    item.lockerCount > 0
      ? {
          key: 'locker',
          label: `${item.lockerCount} locker${item.lockerCount === 1 ? '' : 's'}`,
          cls: 'border-brand-200/70 bg-brand-50/70 text-brand-800 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-300',
        }
      : null,
    item.merchCount > 0
      ? {
          key: 'merch',
          label: `${item.merchCount} merch`,
          cls: 'border-sky-200/80 bg-sky-50/80 text-sky-900 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-200',
        }
      : null,
    item.requestCount > 0
      ? {
          key: 'requests',
          label: `${item.requestCount} request${item.requestCount === 1 ? '' : 's'}`,
          cls: 'border-zinc-200/85 bg-zinc-50 text-zinc-700 dark:border-zinc-600/40 dark:bg-zinc-800/60 dark:text-zinc-300',
        }
      : null,
  ].filter((chip): chip is NonNullable<typeof chip> => Boolean(chip))

  if (chips.length === 0) return null

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className={cn(
            'inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
            chip.cls,
          )}
        >
          {chip.label}
        </span>
      ))}
    </span>
  )
}

function MetaCell({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-200/80 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-950/60">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-zinc-400 uppercase dark:text-zinc-500">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 min-w-0 truncate text-[13px] font-medium text-zinc-800 dark:text-zinc-100',
          mono && 'font-mono',
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  )
}

function StatCell({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof UserRound
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="min-w-0 rounded-xl border border-zinc-200/80 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-950/60">
      <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-zinc-400 uppercase dark:text-zinc-500">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <p className="mt-1 text-[16px] font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
        {value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-[11px] text-zinc-500">{hint}</p> : null}
    </div>
  )
}

function Thumb({ src, shop }: { src: string; shop: ReservationShop }) {
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900">
      {src ? (
        <img src={src} alt="" className="size-full object-cover" loading="lazy" />
      ) : shop === 'locker' ? (
        <Lock className="h-4 w-4" aria-hidden />
      ) : (
        <ShoppingBag className="h-4 w-4" aria-hidden />
      )}
    </span>
  )
}

function TypeBadge({ label, tone }: { label: string; tone: 'locker' | 'merch' }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        tone === 'locker'
          ? 'border-brand-200/70 bg-brand-50/70 text-brand-800 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-300'
          : 'border-sky-200/80 bg-sky-50/80 text-sky-900 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-200',
      )}
    >
      {label}
    </span>
  )
}

const STATUS_TONE: Record<string, 'amber' | 'sky' | 'emerald' | 'zinc'> = {
  pending: 'amber',
  submitted: 'amber',
  confirmed: 'sky',
  fulfilled: 'emerald',
  cancelled: 'zinc',
}

function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  const label = reservationStatusLabel(status)
  const tone = STATUS_TONE[status] ?? 'zinc'
  return (
    <span
      className={cn(
        'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-[10px] border px-2 py-1 text-[11px] font-medium leading-none',
        tone === 'amber' &&
          'border-amber-200/85 bg-gradient-to-br from-white to-amber-50/80 text-amber-950 dark:border-amber-500/22 dark:from-zinc-950 dark:to-amber-500/14 dark:text-amber-50',
        tone === 'sky' &&
          'border-sky-200/85 bg-gradient-to-br from-white to-sky-50/80 text-sky-950 dark:border-sky-500/22 dark:from-zinc-950 dark:to-sky-500/14 dark:text-sky-50',
        tone === 'emerald' &&
          'border-emerald-200/85 bg-gradient-to-br from-white to-emerald-50/80 text-emerald-950 dark:border-emerald-500/22 dark:from-zinc-950 dark:to-emerald-500/14 dark:text-emerald-50',
        tone === 'zinc' &&
          'border-zinc-200/85 bg-gradient-to-br from-white to-zinc-100/80 text-zinc-600 dark:border-zinc-600/40 dark:from-zinc-950 dark:to-zinc-800/60 dark:text-zinc-400',
      )}
      title={label}
    >
      <span
        className={cn(
          'inline-flex h-2 w-2 shrink-0 rounded-full',
          tone === 'amber' && 'bg-amber-500',
          tone === 'sky' && 'bg-sky-500',
          tone === 'emerald' && 'bg-emerald-500',
          tone === 'zinc' && 'bg-zinc-400',
        )}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </span>
  )
}

function RequestStatusBadge({ status }: { status: string }) {
  const tone =
    status === 'Replied' || status === 'Closed'
      ? 'emerald'
      : status === 'In review'
        ? 'amber'
        : status === 'Received'
          ? 'maroon'
          : 'brand'
  return (
    <span
      className={cn(
        'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-[10px] border px-2 py-1 text-[11px] font-medium leading-none',
        tone === 'emerald' &&
          'border-emerald-200/85 bg-gradient-to-br from-white to-emerald-50/80 text-emerald-950 dark:border-emerald-500/22 dark:from-zinc-950 dark:to-emerald-500/14 dark:text-emerald-50',
        tone === 'amber' &&
          'border-amber-200/85 bg-gradient-to-br from-white to-amber-50/80 text-amber-950 dark:border-amber-500/22 dark:from-zinc-950 dark:to-amber-500/14 dark:text-amber-50',
        tone === 'maroon' &&
          'border-maroon-200/85 bg-gradient-to-br from-white to-maroon-50/80 text-maroon-950 dark:border-maroon-500/22 dark:from-zinc-950 dark:to-maroon-500/14 dark:text-maroon-50',
        tone === 'brand' &&
          'border-brand-200/85 bg-gradient-to-br from-white to-brand-50/80 text-brand-950 dark:border-brand-500/22 dark:from-zinc-950 dark:to-brand-500/14 dark:text-brand-50',
      )}
      title={status}
    >
      <span
        className={cn(
          'inline-flex h-2 w-2 shrink-0 rounded-full',
          tone === 'emerald' && 'bg-emerald-500',
          tone === 'amber' && 'bg-amber-500',
          tone === 'maroon' && 'bg-maroon-600',
          tone === 'brand' && 'bg-brand-600',
        )}
        aria-hidden
      />
      <span className="truncate">{status}</span>
    </span>
  )
}

function EmptyPanel({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof UserRound
  title: string
  body: string
}) {
  return (
    <div className="min-w-0 bg-white px-4 py-5 sm:px-5 sm:py-6 dark:bg-zinc-950">
      <div className="flex flex-col items-center overflow-hidden rounded-lg border border-dashed border-zinc-300/90 bg-zinc-50/85 px-5 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
        <Icon
          className="mb-5 h-[3.75rem] w-[3.75rem] shrink-0 text-brand-600/45"
          strokeWidth={1.35}
          aria-hidden
        />
        <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">{title}</p>
        <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          {body}
        </p>
      </div>
    </div>
  )
}
