import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Check,
  ChevronDown,
  Download,
  Eye,
  Loader2,
  Mail,
  Paperclip,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { RequireLoginRedirect } from '@/components/portal/RequireLoginRedirect'
import { PortalActionMenu } from '@/components/portal/RegisterRowActions'
import {
  formInsetPanelCls,
  FormWorkspaceBackLink,
  formWorkspaceCardBodyCls,
  formWorkspaceCardCls,
  formWorkspacePrimaryBtnCls,
  workspaceTenantMainStackCls,
} from '@/components/portal/register-ui'
import { Button } from '@/components/ui/button'
import { RichTextContent, RichTextEditor } from '@/components/ui/RichTextEditor'
import { Snackbar, type SnackToast } from '@/components/ui/Snackbar'
import { setPageScrollLocked } from '@/hooks/useLenis'
import { isEmptyRichText, sanitizeRichHtml } from '@/lib/rich-text'
import {
  attachmentPreviewKind,
  deletePortalRequest,
  fetchPortalRequestAttachment,
  fetchPortalRequestReplyAttachment,
  getPortalRequest,
  portalRequestAttachmentUrl,
  portalRequestReplyAttachmentUrl,
  portalRequestStatuses,
  replyPortalRequest,
  updatePortalRequestStatus,
  type PortalRequestRecord,
  type PortalRequestReply,
  type PortalRequestReplyAttachment,
  type PortalRequestStatus,
} from '@/lib/requests-api'
import { formatPhDateTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import { ConfirmDeleteDialog } from '@/components/portal/ConfirmDeleteDialog'

const maxReplyFiles = 5
const maxReplyFileBytes = 10 * 1024 * 1024

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function replyFileAllowed(file: File) {
  return (
    /^(application\/pdf|image\/.+|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|text\/plain|application\/zip)$/i.test(
      file.type,
    ) || /\.(pdf|png|jpe?g|webp|gif|docx?|xlsx?|txt|zip)$/i.test(file.name)
  )
}


function statusTone(status: string) {
  switch (status) {
    case 'Replied':
    case 'Closed':
      return 'emerald' as const
    case 'In review':
      return 'amber' as const
    case 'Received':
      return 'maroon' as const
    default:
      return 'brand' as const
  }
}

export default function RequestDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const dbId = Number(id)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [item, setItem] = useState<PortalRequestRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [needsLogin, setNeedsLogin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [repliesOpen, setRepliesOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [replySubject, setReplySubject] = useState('')
  const [replyFiles, setReplyFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<SnackToast | null>(null)

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  const load = useCallback(async () => {
    if (!Number.isFinite(dbId) || dbId <= 0) {
      setLoadError('Invalid request.')
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError('')
    const result = await getPortalRequest(dbId)
    if (!result.ok) {
      setItem(null)
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
    setItem(result.data.item)
    setReplySubject(`Re: [${result.data.item.id}] ${result.data.item.subject}`)
    setLoading(false)
  }, [dbId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  async function handleStatusChange(status: PortalRequestStatus) {
    if (!item?.dbId || busy) return
    setBusy(true)
    const result = await updatePortalRequestStatus({ dbId: item.dbId, status })
    setBusy(false)
    if (!result.ok) {
      showToast(result.error, 'error')
      return
    }
    setItem(result.data.item)
    showToast(`Status updated to ${status}.`, 'success')
  }

  function addReplyFiles(list: FileList | File[] | null) {
    if (!list) return
    const incoming = Array.from(list)
    const next = [...replyFiles]
    for (const file of incoming) {
      if (next.length >= maxReplyFiles) {
        showToast(`You can attach up to ${maxReplyFiles} files.`, 'error')
        break
      }
      if (!replyFileAllowed(file)) {
        showToast(`Unsupported file: ${file.name}`, 'error')
        continue
      }
      if (file.size > maxReplyFileBytes) {
        showToast(`${file.name} must be 10 MB or smaller.`, 'error')
        continue
      }
      if (next.some((item) => item.name === file.name && item.size === file.size)) continue
      next.push(file)
    }
    setReplyFiles(next)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeReplyFile(index: number) {
    setReplyFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function discardCompose() {
    setReplyBody('')
    setReplyFiles([])
    if (item) setReplySubject(`Re: [${item.id}] ${item.subject}`)
  }

  async function handleSendReply() {
    if (!item?.dbId || sending) return
    const message = sanitizeRichHtml(replyBody)
    if (isEmptyRichText(message)) {
      showToast('Enter a reply message.', 'error')
      return
    }
    setSending(true)
    const result = await replyPortalRequest({
      dbId: item.dbId,
      message,
      subject: replySubject.trim() || undefined,
      files: replyFiles,
    })
    setSending(false)
    if (!result.ok) {
      showToast(result.error, 'error')
      return
    }
    const attachedCount = replyFiles.length
    setReplyBody('')
    setReplyFiles([])
    setItem(result.data.item)
    showToast(
      attachedCount > 0 ? 'Reply sent with attachments.' : 'Reply sent to the requester.',
      'success',
    )
  }

  async function handleDelete() {
    if (!item?.dbId) return
    setBusy(true)
    const result = await deletePortalRequest(item.dbId)
    setBusy(false)
    setPendingDelete(false)
    if (!result.ok) {
      showToast(result.error, 'error')
      return
    }
    navigate('/admin/requests', {
      state: {
        toast: { message: 'Request deleted.', variant: 'success' as const },
      },
    })
  }

  if (loading) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300/90 bg-zinc-50/80 px-5 py-16 text-[13px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-hidden />
          Loading request…
        </div>
      </div>
    )
  }

  if (needsLogin) return <RequireLoginRedirect />

  if (loadError || !item) {
    return (
      <div className={workspaceTenantMainStackCls}>
        <div className="rounded-xl border border-zinc-200 bg-white px-5 py-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {loadError || 'Request not found.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="lg" variant="outline">
              <Link to="/admin/requests">Back to requests</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const currentStatus = portalRequestStatuses.includes(item.status as PortalRequestStatus)
    ? (item.status as PortalRequestStatus)
    : 'Submitted'

  return (
    <div className={workspaceTenantMainStackCls}>
      <FormWorkspaceBackLink to="/admin/requests" label="requests" />

      <div className="flex items-start justify-between gap-3 sm:gap-4 md:gap-6">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900 sm:text-[22px] dark:text-zinc-50">
              {item.subject}
            </h1>
            <StatusBadge status={item.status} />
          </div>
          <p className="max-w-2xl text-[13px] leading-6 text-zinc-500 dark:text-zinc-400">
            <span className="font-mono font-semibold text-brand-700 dark:text-brand-300">
              {item.id}
            </span>
            <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">·</span>
            {item.name} · {item.email}
          </p>
        </div>

        <div className="relative flex shrink-0 items-center gap-2">
          <PortalActionMenu
            open={actionsOpen}
            onOpenChange={setActionsOpen}
            ariaLabel="Request actions"
            items={[
              {
                id: 'download',
                label: 'Download file',
                icon: Download,
                href: portalRequestAttachmentUrl(item),
              },
              {
                id: 'delete',
                label: 'Delete request',
                icon: Trash2,
                danger: true,
                onClick: () => setPendingDelete(true),
              },
            ]}
          />
        </div>
      </div>

      <section aria-label="Request details" className="w-full max-w-none">
        <div className={formWorkspaceCardCls}>
          <div className={formWorkspaceCardBodyCls}>
            <div className={formInsetPanelCls}>
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
                <div className="min-w-0 space-y-5">
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
                      Status
                    </p>
                    <div className="mt-1.5 max-w-sm">
                      <StatusDropdown
                        value={currentStatus}
                        disabled={busy || sending}
                        onChange={(status) => void handleStatusChange(status)}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                    <p className="text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
                      Filed
                    </p>
                    <p className="mt-1 text-[13px] font-medium text-zinc-800 dark:text-zinc-100">
                      {formatPhDateTime(item.submittedAt)}
                    </p>
                    {item.mailSent ? (
                      <p className="mt-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                        Inbound mail delivered
                      </p>
                    ) : item.mailError ? (
                      <p className="mt-2 text-[11px] font-medium text-maroon-700 dark:text-maroon-300">
                        Mail issue: {item.mailError}
                      </p>
                    ) : null}
                    {(item.replies?.length ?? 0) > 0 ? (
                      <p className="mt-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                        {item.replies!.length === 1
                          ? '1 admin reply delivered'
                          : `${item.replies!.length} admin replies delivered`}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
                      Message
                    </p>
                    <div className="mt-1.5 whitespace-pre-wrap rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 text-[13px] leading-6 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                      {item.body?.trim() || '—'}
                    </div>
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
                    Attachment
                  </p>
                  <div className="mt-1.5 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="flex items-start gap-2.5 border-b border-zinc-100 px-3.5 py-3.5 dark:border-zinc-800">
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                        <Paperclip className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p
                          className="truncate text-[13px] font-semibold text-zinc-900 dark:text-zinc-50"
                          title={item.attachment}
                        >
                          {item.attachment}
                        </p>
                        <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                          Submitted with the request
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-px bg-zinc-100 dark:bg-zinc-800">
                      <button
                        type="button"
                        onClick={() => setPreviewOpen(true)}
                        className="inline-flex items-center justify-center gap-1.5 bg-white px-3 py-3 text-[12px] font-semibold text-brand-800 transition hover:bg-brand-50 dark:bg-zinc-950 dark:text-brand-300 dark:hover:bg-brand-500/10"
                      >
                        <Eye className="size-3.5" aria-hidden />
                        Preview
                      </button>
                      <a
                        href={portalRequestAttachmentUrl(item)}
                        className="inline-flex items-center justify-center gap-1.5 bg-white px-3 py-3 text-[12px] font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                      >
                        <Download className="size-3.5" aria-hidden />
                        Download
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {(item.replies?.length ?? 0) > 0 ? (
                <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="flex items-center gap-3 border-b border-zinc-100 px-3.5 py-3.5 dark:border-zinc-800">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      <Mail className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
                        Sent replies
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                        {item.replies!.length === 1
                          ? '1 reply delivered to the requester'
                          : `${item.replies!.length} replies delivered to the requester`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRepliesOpen(true)}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 text-[12px] font-semibold text-brand-800 transition hover:bg-brand-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-brand-300 dark:hover:bg-brand-500/10"
                    >
                      <Eye className="size-3.5" aria-hidden />
                      Preview
                    </button>
                  </div>
                </div>
              ) : null}

              <section className="mt-5 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_10px_28px_-22px_rgba(30,5,65,0.45)] dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
                <div className="flex items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50/90 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/80">
                  <div className="min-w-0">
                    <h3 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-50">
                      New message
                    </h3>
                    <p className="truncate text-[12px] text-zinc-500 dark:text-zinc-400">
                      From studentcouncil@pupcolsc.com
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={discardCompose}
                    disabled={sending || (isEmptyRichText(replyBody) && replyFiles.length === 0)}
                    className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-zinc-500 transition hover:bg-zinc-200/70 hover:text-zinc-800 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  >
                    Discard
                  </button>
                </div>

                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  <div className="flex min-w-0 items-center gap-3 px-4 py-2.5">
                    <span className="w-14 shrink-0 text-[12px] font-semibold text-zinc-500 dark:text-zinc-400">
                      To
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[12px] font-medium text-brand-900 dark:border-brand-500/25 dark:bg-brand-500/15 dark:text-brand-100">
                        <span className="truncate">{item.name}</span>
                        <span className="truncate text-brand-700/80 dark:text-brand-300/80">
                          &lt;{item.email}&gt;
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="flex min-w-0 items-center gap-3 px-4 py-2.5">
                    <span className="w-14 shrink-0 text-[12px] font-semibold text-zinc-500 dark:text-zinc-400">
                      Subject
                    </span>
                    <input
                      type="text"
                      value={replySubject}
                      onChange={(event) => setReplySubject(event.target.value)}
                      disabled={sending}
                      className="min-w-0 flex-1 border-0 bg-transparent text-[13px] font-medium text-zinc-900 outline-none placeholder:text-zinc-400 disabled:opacity-60 dark:text-zinc-50"
                      placeholder="Subject"
                    />
                  </div>
                </div>

                <div className="border-t border-zinc-100 p-3 dark:border-zinc-800">
                  <RichTextEditor
                    value={replyBody}
                    onChange={setReplyBody}
                    disabled={sending}
                    placeholder="Compose your reply…"
                    minHeightClassName="min-h-[12rem]"
                    aria-label="Reply message"
                    className="rounded-xl shadow-none"
                    toolbarExtra={
                      <button
                        type="button"
                        title="Attach files"
                        aria-label="Attach files"
                        disabled={sending || replyFiles.length >= maxReplyFiles}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex size-8 items-center justify-center rounded-md text-zinc-600 outline-none transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-brand-500/35 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                      >
                        <Paperclip className="size-3.5" aria-hidden />
                      </button>
                    }
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="sr-only"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.txt,.zip,application/pdf,image/*,text/plain"
                    onChange={(event) => addReplyFiles(event.target.files)}
                  />

                  {replyFiles.length > 0 ? (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {replyFiles.map((file, index) => (
                        <li
                          key={`${file.name}-${file.size}-${index}`}
                          className="inline-flex max-w-full items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 py-1.5 pr-1.5 pl-2.5 dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <Paperclip
                            className="size-3.5 shrink-0 text-brand-700 dark:text-brand-300"
                            aria-hidden
                          />
                          <span className="min-w-0 truncate text-[12px] font-medium text-zinc-800 dark:text-zinc-100">
                            {file.name}
                          </span>
                          <span className="shrink-0 text-[11px] text-zinc-400">
                            {formatBytes(file.size)}
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove ${file.name}`}
                            disabled={sending}
                            onClick={() => removeReplyFile(index)}
                            className="inline-flex size-6 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                          >
                            <X className="size-3.5" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                      Use the paperclip to attach files, or the link tool for URLs. Up to{' '}
                      {maxReplyFiles} files, 10 MB each.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/80 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900/70">
                  <button
                    type="button"
                    disabled={sending || replyFiles.length >= maxReplyFiles}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 text-[12px] font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    <Paperclip className="size-3.5" aria-hidden />
                    Attach
                  </button>
                  <button
                    type="button"
                    disabled={sending || busy || isEmptyRichText(replyBody)}
                    onClick={() => void handleSendReply()}
                    className={cn(formWorkspacePrimaryBtnCls, 'rounded-full')}
                  >
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Send className="size-4" aria-hidden />
                    )}
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>

      {previewOpen ? (
        <AttachmentPreviewOverlay item={item} onClose={() => setPreviewOpen(false)} />
      ) : null}

      {repliesOpen && (item.replies?.length ?? 0) > 0 ? (
        <SentRepliesModal
          replies={item.replies!}
          requesterName={item.name}
          onClose={() => setRepliesOpen(false)}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDeleteDialog
          title={item.id}
          noun="request"
          description="This request will be removed from the database, including its attachment. This action cannot be undone."
          busy={busy}
          onCancel={() => setPendingDelete(false)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}

      <Snackbar toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

function SentRepliesModal({
  replies,
  requesterName,
  onClose,
}: {
  replies: PortalRequestReply[]
  requesterName: string
  onClose: () => void
}) {
  const titleId = useId()
  const [activeId, setActiveId] = useState(replies[replies.length - 1]?.id ?? replies[0]?.id)
  const [filePreview, setFilePreview] = useState<PortalRequestReplyAttachment | null>(null)
  const active = replies.find((reply) => reply.id === activeId) ?? replies[0]

  useEffect(() => {
    setPageScrollLocked(true)
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (filePreview) setFilePreview(null)
        else onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      setPageScrollLocked(false)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose, filePreview])

  if (!active) return null

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-brand-950/55 dark:bg-black/70"
        aria-label="Close replies preview"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(94dvh,52rem)] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:border dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3.5 sm:px-5 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
              Sent replies
            </p>
            <h2
              id={titleId}
              className="truncate text-[15px] font-semibold text-zinc-900 dark:text-zinc-50"
            >
              {replies.length} delivered to {requesterName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex size-9 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(14rem,17rem)_minmax(0,1fr)]">
          <aside className="max-h-40 overflow-auto border-b border-zinc-100 lg:max-h-none lg:border-r lg:border-b-0 dark:border-zinc-800">
            <ul className="p-2" role="listbox" aria-label="Reply list">
              {[...replies].reverse().map((reply) => {
                const selected = reply.id === active.id
                return (
                  <li key={reply.id} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveId(reply.id)
                        setFilePreview(null)
                      }}
                      className={cn(
                        'w-full rounded-xl px-3 py-2.5 text-left transition',
                        selected
                          ? 'bg-brand-50 dark:bg-brand-500/15'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/80',
                      )}
                    >
                      <p
                        className={cn(
                          'truncate text-[12px] font-semibold',
                          selected
                            ? 'text-brand-900 dark:text-brand-100'
                            : 'text-zinc-800 dark:text-zinc-100',
                        )}
                        title={reply.subject}
                      >
                        {reply.subject}
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                        {formatPhDateTime(reply.sentAt)}
                        {reply.attachments.length > 0
                          ? ` · ${reply.attachments.length} file${reply.attachments.length === 1 ? '' : 's'}`
                          : ''}
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
          </aside>

          <div className="min-h-0 flex-1 overflow-auto bg-zinc-50/80 p-4 sm:p-5 dark:bg-zinc-950/60">
            <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="border-b border-zinc-100 px-4 py-3.5 sm:px-5 dark:border-zinc-800">
                <p className="text-[11px] font-semibold tracking-wide text-emerald-700 uppercase dark:text-emerald-300">
                  Reply delivered
                </p>
                <h3 className="mt-1 text-[14px] font-semibold text-zinc-900 dark:text-zinc-50">
                  {active.subject}
                </h3>
                <time
                  dateTime={active.sentAt}
                  className="mt-1 block text-[12px] text-zinc-500 dark:text-zinc-400"
                >
                  {formatPhDateTime(active.sentAt)}
                </time>
              </div>

              <div className="px-4 py-4 sm:px-5">
                <p className="mb-2 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
                  Message
                </p>
                <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <RichTextContent
                    html={active.bodyHtml || active.bodyText}
                    className="text-[13px] text-zinc-700 dark:text-zinc-200"
                  />
                </div>

                {active.attachments.length > 0 ? (
                  <div className="mt-4">
                    <p className="mb-2 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
                      Attachments
                    </p>
                    <ul className="space-y-2">
                      {active.attachments.map((file, index) => (
                        <li
                          key={`${active.id}-${file.path}-${index}`}
                          className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                        >
                          <div className="flex items-center gap-2.5 px-3 py-2.5">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                              <Paperclip className="size-3.5" aria-hidden />
                            </span>
                            <p
                              className="min-w-0 flex-1 truncate text-[12px] font-semibold text-zinc-900 dark:text-zinc-50"
                              title={file.name}
                            >
                              {file.name}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-px bg-zinc-100 dark:bg-zinc-800">
                            <button
                              type="button"
                              onClick={() => setFilePreview(file)}
                              className="inline-flex items-center justify-center gap-1.5 bg-white px-3 py-2.5 text-[12px] font-semibold text-brand-800 transition hover:bg-brand-50 dark:bg-zinc-950 dark:text-brand-300 dark:hover:bg-brand-500/10"
                            >
                              <Eye className="size-3.5" aria-hidden />
                              Preview
                            </button>
                            <a
                              href={portalRequestReplyAttachmentUrl(active.id, file)}
                              className="inline-flex items-center justify-center gap-1.5 bg-white px-3 py-2.5 text-[12px] font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                            >
                              <Download className="size-3.5" aria-hidden />
                              Download
                            </a>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </article>
          </div>
        </div>
      </div>

      {filePreview ? (
        <ReplyAttachmentPreviewOverlay
          replyId={active.id}
          file={filePreview}
          onClose={() => setFilePreview(null)}
        />
      ) : null}
    </div>,
    document.body,
  )
}

function ReplyAttachmentPreviewOverlay({
  replyId,
  file,
  onClose,
}: {
  replyId: number
  file: PortalRequestReplyAttachment
  onClose: () => void
}) {
  const titleId = useId()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [kind, setKind] = useState<'image' | 'pdf' | 'text' | 'none'>('none')

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let currentUrl: string | null = null
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      setTextContent(null)
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      const result = await fetchPortalRequestReplyAttachment(replyId, file)
      if (cancelled) return
      if (!result.ok) {
        setError(result.error)
        setLoading(false)
        return
      }
      const nextKind = attachmentPreviewKind(file.name, result.mime)
      setKind(nextKind)
      if (nextKind === 'text') {
        const text = await result.blob.text()
        if (cancelled) return
        setTextContent(text)
      } else if (nextKind === 'image' || nextKind === 'pdf') {
        const url = URL.createObjectURL(result.blob)
        currentUrl = url
        setObjectUrl(url)
      }
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
      if (currentUrl) URL.revokeObjectURL(currentUrl)
    }
  }, [replyId, file])

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Close file preview"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(92dvh,44rem)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:border dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
              Attachment preview
            </p>
            <h2
              id={titleId}
              className="truncate text-[14px] font-semibold text-zinc-900 dark:text-zinc-50"
            >
              {file.name}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <a
              href={portalRequestReplyAttachmentUrl(replyId, file)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-200 px-3 text-[12px] font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Download className="size-3.5" aria-hidden />
              Download
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="inline-flex size-9 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-zinc-100/80 p-3 sm:p-4 dark:bg-zinc-950">
          {loading ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <Loader2 className="size-5 animate-spin" aria-hidden />
              Loading preview…
            </div>
          ) : error ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 px-4 text-center">
              <p className="text-sm font-medium text-maroon-800 dark:text-maroon-300">{error}</p>
            </div>
          ) : kind === 'image' && objectUrl ? (
            <img
              src={objectUrl}
              alt={file.name}
              className="mx-auto max-h-[min(70dvh,36rem)] w-auto max-w-full rounded-xl object-contain shadow-sm"
            />
          ) : kind === 'pdf' && objectUrl ? (
            <iframe
              title={file.name}
              src={objectUrl}
              className="h-[min(70dvh,36rem)] w-full rounded-xl border border-zinc-200 bg-white dark:border-zinc-800"
            />
          ) : kind === 'text' && textContent !== null ? (
            <pre className="max-h-[min(70dvh,36rem)] overflow-auto rounded-xl border border-zinc-200 bg-white p-4 text-[12px] leading-5 whitespace-pre-wrap text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
              {textContent}
            </pre>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-4 text-center">
              <Paperclip className="size-8 text-zinc-400" aria-hidden />
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                Preview is not available for this file type.
              </p>
              <a
                href={portalRequestReplyAttachmentUrl(replyId, file)}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white transition hover:bg-brand-800"
              >
                <Download className="size-4" aria-hidden />
                Download instead
              </a>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status)
  return (
    <span
      className={cn(
        'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-[10px] border px-2 py-1 text-[11px] font-medium leading-none shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:shadow-none',
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

function StatusDropdown({
  value,
  disabled,
  onChange,
}: {
  value: PortalRequestStatus
  disabled?: boolean
  onChange: (status: PortalRequestStatus) => void
}) {
  const listId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [isOpen])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => setIsOpen((current) => !current)}
        className={cn(
          'inline-flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-zinc-50 px-3 text-left text-sm font-medium text-zinc-900 outline-none transition',
          'hover:bg-white focus-visible:border-brand-400 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-brand-100',
          'disabled:cursor-not-allowed disabled:opacity-60',
          'dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900 dark:focus-visible:ring-brand-500/20',
          isOpen
            ? 'border-brand-400 bg-white ring-4 ring-brand-100 dark:bg-zinc-900 dark:ring-brand-500/20'
            : 'border-zinc-200',
        )}
      >
        <StatusBadge status={value} />
        <ChevronDown
          className={cn('size-4 shrink-0 text-zinc-400 transition', isOpen && 'rotate-180')}
          aria-hidden
        />
      </button>

      {isOpen ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Request status"
          className="absolute z-30 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-950"
        >
          {portalRequestStatuses.map((status) => {
            const selected = status === value
            return (
              <li key={status} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    if (status !== value) onChange(status)
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[13px] font-medium outline-none transition',
                    selected
                      ? 'bg-brand-50 text-brand-900 dark:bg-brand-500/15 dark:text-brand-100'
                      : 'text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-900',
                  )}
                >
                  <StatusBadge status={status} />
                  {selected ? (
                    <Check className="size-3.5 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden />
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

function AttachmentPreviewOverlay({
  item,
  onClose,
}: {
  item: PortalRequestRecord
  onClose: () => void
}) {
  const titleId = useId()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [kind, setKind] = useState<'image' | 'pdf' | 'text' | 'none'>('none')

  useEffect(() => {
    setPageScrollLocked(true)
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      setPageScrollLocked(false)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  useEffect(() => {
    let currentUrl: string | null = null
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      setTextContent(null)
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      const result = await fetchPortalRequestAttachment(item)
      if (cancelled) return
      if (!result.ok) {
        setError(result.error)
        setLoading(false)
        return
      }
      const nextKind = attachmentPreviewKind(item.attachment, result.mime)
      setKind(nextKind)
      if (nextKind === 'text') {
        const text = await result.blob.text()
        if (cancelled) return
        setTextContent(text)
      } else if (nextKind === 'image' || nextKind === 'pdf') {
        const url = URL.createObjectURL(result.blob)
        currentUrl = url
        setObjectUrl(url)
      }
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
      if (currentUrl) URL.revokeObjectURL(currentUrl)
    }
  }, [item])

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-brand-950/55 dark:bg-black/70"
        aria-label="Close preview"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(94dvh,48rem)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:border dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">Preview</p>
            <h2 id={titleId} className="truncate text-[14px] font-semibold text-zinc-900 dark:text-zinc-50">
              {item.attachment}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <a
              href={portalRequestAttachmentUrl(item)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-200 px-3 text-[12px] font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Download className="size-3.5" aria-hidden />
              Download
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="inline-flex size-9 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-zinc-100/80 p-3 sm:p-4 dark:bg-zinc-950">
          {loading ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <Loader2 className="size-5 animate-spin" aria-hidden />
              Loading preview…
            </div>
          ) : error ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 px-4 text-center">
              <p className="text-sm font-medium text-maroon-800 dark:text-maroon-300">{error}</p>
            </div>
          ) : kind === 'image' && objectUrl ? (
            <img
              src={objectUrl}
              alt={item.attachment}
              className="mx-auto max-h-[min(70dvh,40rem)] w-auto max-w-full rounded-xl object-contain shadow-sm"
            />
          ) : kind === 'pdf' && objectUrl ? (
            <iframe
              title={item.attachment}
              src={objectUrl}
              className="h-[min(70dvh,40rem)] w-full rounded-xl border border-zinc-200 bg-white dark:border-zinc-800"
            />
          ) : kind === 'text' && textContent !== null ? (
            <pre className="max-h-[min(70dvh,40rem)] overflow-auto rounded-xl border border-zinc-200 bg-white p-4 text-[12px] leading-5 whitespace-pre-wrap text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
              {textContent}
            </pre>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-4 text-center">
              <Paperclip className="size-8 text-zinc-400" aria-hidden />
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                Preview is not available for this file type.
              </p>
              <a
                href={portalRequestAttachmentUrl(item)}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white transition hover:bg-brand-800"
              >
                <Download className="size-4" aria-hidden />
                Download instead
              </a>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
