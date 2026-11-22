import * as XLSX from 'xlsx'
import { formatPhDate, formatPhDateTime } from '@/lib/datetime'
import type { EnrollmentAppointment } from '@/lib/enrollment-appointments-api'

function text(value: string | null | undefined) {
  const next = (value ?? '').trim()
  return next || '—'
}

function statusLabel(status: string) {
  const key = status.trim().toLowerCase()
  if (key === 'approved') return 'Approved'
  if (key === 'rejected') return 'Rejected'
  return 'Pending'
}

function classificationLabel(value: string) {
  const key = value.trim().toLowerCase()
  if (key === 'irregular') return 'Irregular'
  if (key === 'regular') return 'Regular'
  return text(value)
}

function yearLevelLabel(value: string) {
  const raw = value.trim()
  if (!raw) return '—'
  if (/^\d+[lL]$/.test(raw)) return raw.toUpperCase()
  if (/^\d+$/.test(raw)) return `${raw}L`
  return raw
}

function enrollmentDateLabel(item: EnrollmentAppointment) {
  const labeled = (item.enrollmentDateLabel || '').trim()
  if (labeled) return labeled
  return formatPhDate(item.enrollmentDate)
}

function triggerXlsxDownload(workbook: XLSX.WorkBook, filename: string) {
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** Real .xlsx appointments export — opens cleanly in Excel / Sheets. */
export function downloadAppointmentsCatalogExcel(options: {
  appointments: EnrollmentAppointment[]
  scopeLabel?: string
}) {
  const rows = options.appointments
  const stamp = new Date().toISOString().slice(0, 10)
  const scope = options.scopeLabel?.trim() || 'Enrollment appointments'
  const generated = formatPhDateTime(new Date())

  const sheetRows: Array<Array<string | number>> = [
    ['PUP College of Law Student Council'],
    ['Enrollment Appointments'],
    [scope],
    [`Generated ${generated}`],
    [],
    [
      'Tracking code',
      'Full name',
      'Student number',
      'Year level',
      'Classification',
      'Enrollment date',
      'Time slot',
      'Payment mode',
      'Reference no.',
      'Payment proof',
      'Proof filename',
      'Status',
      'Admin note',
      'Submitted',
    ],
    ...rows.map((item) => [
      text(item.trackingCode),
      text(item.fullName),
      text(item.studentNumber),
      yearLevelLabel(item.yearLevel || ''),
      classificationLabel(item.classification || ''),
      enrollmentDateLabel(item),
      text(item.timeSlotLabel || item.timeSlot),
      text(item.paymentMode),
      text(item.referenceNo),
      item.hasProof ? 'Yes' : 'No',
      item.hasProof ? text(item.proofName) : '—',
      statusLabel(item.status),
      text(item.adminNote),
      formatPhDateTime(item.createdAt),
    ]),
  ]

  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows)
  worksheet['!cols'] = [
    { wch: 16 },
    { wch: 28 },
    { wch: 16 },
    { wch: 10 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 16 },
    { wch: 12 },
    { wch: 22 },
    { wch: 12 },
    { wch: 28 },
    { wch: 22 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Appointments')
  triggerXlsxDownload(workbook, `enrollment-appointments-${stamp}.xlsx`)
}
