export type PortalRequestStatus =
  | 'Submitted'
  | 'Received'
  | 'In review'
  | 'Replied'
  | 'Closed'

export type PortalRequestReplyAttachment = {
  name: string
  path: string
  mime: string
}

export type PortalRequestReply = {
  id: number
  subject: string
  bodyHtml: string
  bodyText: string
  attachments: PortalRequestReplyAttachment[]
  sentAt: string
}

export type PortalRequestRecord = {
  id: string
  dbId?: number
  name: string
  email: string
  subject: string
  body?: string | null
  attachment: string
  submittedAt: string
  status: string
  mailSent?: boolean
  mailError?: string | null
  updatedAt?: string | null
  replies?: PortalRequestReply[]
}

export const portalRequestStatuses: PortalRequestStatus[] = [
  'Submitted',
  'Received',
  'In review',
  'Replied',
  'Closed',
]

type ApiFailure = { ok: false; error: string; status: number }
type ApiOk<T> = { ok: true; data: T }

async function request<T>(path: string, init?: RequestInit): Promise<ApiOk<T> | ApiFailure> {
  try {
    const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData
    const response = await fetch(path, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(isFormData || !init?.body ? {} : { 'Content-Type': 'application/json' }),
        ...(init?.headers ?? {}),
      },
      ...init,
    })
    const payload = (await response.json().catch(() => null)) as
      | ({ ok?: boolean; error?: string } & T)
      | null

    if (!response.ok || !payload?.ok) {
      return {
        ok: false,
        error: payload?.error || 'Something went wrong. Please try again.',
        status: response.status,
      }
    }

    return { ok: true, data: payload as T }
  } catch {
    return {
      ok: false,
      error: 'Cannot reach the server. Start Apache and MySQL in XAMPP.',
      status: 0,
    }
  }
}

export async function submitPortalRequest(input: {
  name: string
  email: string
  subject: string
  body: string
  file: File
}) {
  const body = new FormData()
  body.append('name', input.name)
  body.append('email', input.email)
  body.append('subject', input.subject)
  body.append('body', input.body)
  body.append('file', input.file)

  return request<{
    item: PortalRequestRecord
    mailSent: boolean
    confirmationSent: boolean
    message: string
  }>('/api/requests.php', {
    method: 'POST',
    body,
  })
}

export async function trackPortalRequest(id: string) {
  return request<{ item: PortalRequestRecord }>(
    `/api/requests.php?id=${encodeURIComponent(id.trim())}`,
  )
}

export async function listPortalRequests() {
  return request<{ items: PortalRequestRecord[] }>('/api/requests.php?all=1')
}

export async function getPortalRequest(dbId: number) {
  return request<{ item: PortalRequestRecord }>(
    `/api/requests.php?dbId=${encodeURIComponent(String(dbId))}`,
  )
}

export async function updatePortalRequestStatus(input: {
  dbId: number
  status: PortalRequestStatus
}) {
  return request<{ item: PortalRequestRecord }>('/api/requests.php', {
    method: 'PATCH',
    body: JSON.stringify({ dbId: input.dbId, status: input.status }),
  })
}

export async function deletePortalRequest(dbId: number) {
  return request<{ ok: true }>('/api/requests.php', {
    method: 'DELETE',
    body: JSON.stringify({ dbId }),
  })
}

export async function deletePortalRequests(ids: number[]) {
  return request<{ deleted: number }>('/api/requests.php', {
    method: 'DELETE',
    body: JSON.stringify({ ids }),
  })
}

export function portalRequestAttachmentUrl(
  item: PortalRequestRecord,
  options?: { inline?: boolean },
) {
  const inline = options?.inline ? '&inline=1' : ''
  if (item.dbId) {
    return `/api/requests.php?download=1&dbId=${encodeURIComponent(String(item.dbId))}${inline}`
  }
  return `/api/requests.php?download=1&id=${encodeURIComponent(item.id)}${inline}`
}

export function portalRequestReplyAttachmentUrl(
  replyId: number,
  file: PortalRequestReplyAttachment | string,
  options?: { inline?: boolean },
) {
  const inline = options?.inline ? '&inline=1' : ''
  const key =
    typeof file === 'string'
      ? file
      : file.path
        ? file.path.split(/[/\\]/).pop() || file.name
        : file.name
  return `/api/requests.php?download=1&replyId=${encodeURIComponent(String(replyId))}&replyFile=${encodeURIComponent(key)}${inline}`
}

export async function replyPortalRequest(input: {
  dbId: number
  message: string
  subject?: string
  files?: File[]
}) {
  const body = new FormData()
  body.append('action', 'reply')
  body.append('dbId', String(input.dbId))
  body.append('message', input.message)
  if (input.subject?.trim()) body.append('subject', input.subject.trim())
  for (const file of input.files ?? []) {
    body.append('files[]', file, file.name)
  }

  return request<{ item: PortalRequestRecord; message: string }>('/api/requests.php', {
    method: 'POST',
    body,
  })
}

async function fetchBlob(
  url: string,
): Promise<{ ok: true; blob: Blob; mime: string } | { ok: false; error: string }> {
  try {
    const response = await fetch(url, {
      credentials: 'include',
      headers: { Accept: '*/*' },
    })
    if (!response.ok) {
      return { ok: false, error: 'Could not load the attachment.' }
    }
    const blob = await response.blob()
    const mime = blob.type || response.headers.get('Content-Type') || 'application/octet-stream'
    return { ok: true, blob, mime }
  } catch {
    return { ok: false, error: 'Could not load the attachment.' }
  }
}

export async function fetchPortalRequestAttachment(item: PortalRequestRecord) {
  return fetchBlob(portalRequestAttachmentUrl(item, { inline: true }))
}

export async function fetchPortalRequestReplyAttachment(
  replyId: number,
  file: PortalRequestReplyAttachment | string,
) {
  return fetchBlob(portalRequestReplyAttachmentUrl(replyId, file, { inline: true }))
}

export function attachmentPreviewKind(
  filename: string,
  mime = '',
): 'image' | 'pdf' | 'text' | 'none' {
  const name = filename.toLowerCase()
  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(name)) return 'image'
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (mime.startsWith('text/') || name.endsWith('.txt')) return 'text'
  return 'none'
}
