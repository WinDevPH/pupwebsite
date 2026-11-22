import { jsPDF } from 'jspdf'
import logoCol from '@/assets/pup-col-logo.png'
import logoSc from '@/assets/pup-col-sc-seal.png'
import { formatPhDate, formatPhDateTime } from '@/lib/datetime'
import type { EnrollmentAppointment } from '@/lib/enrollment-appointments-api'
import { renderLogoWithWhiteOutline } from '@/lib/logo-render'

const PDF_BRAND = {
  primary: [95, 24, 184] as [number, number, number],
  ink: [30, 5, 65] as [number, number, number],
  body: [39, 39, 42] as [number, number, number],
  muted: [82, 82, 91] as [number, number, number],
  line: [228, 228, 231] as [number, number, number],
  zebra: [250, 247, 255] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
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
  return value.trim() || '—'
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

export type AppointmentsPdfOptions = {
  appointments: EnrollmentAppointment[]
  termBanner?: string
  scopeLabel?: string
}

/** Official landscape catalog PDF for Appointments admin export. */
export async function downloadAppointmentsCatalogPdf(options: AppointmentsPdfOptions) {
  const rows = options.appointments

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginX = 36
  const contentW = pageW - marginX * 2
  const bottomSafe = 40
  let y = 0

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageH - bottomSafe) return false
    doc.addPage()
    y = 32
    drawTableHeader()
    return true
  }

  const headerH = options.termBanner?.trim() ? 78 : 68
  doc.setFillColor(...PDF_BRAND.white)
  doc.rect(0, 0, pageW, headerH, 'F')

  try {
    const logoSize = 36
    const logoGap = 8
    const logoY = (headerH - 8 - logoSize) / 2
    const rasterPx = Math.round(logoSize * 4)
    const [logoColData, logoScData] = await Promise.all([
      renderLogoWithWhiteOutline(logoCol, rasterPx, {
        headerBg: PDF_BRAND.white,
        outlinePx: 0,
      }),
      renderLogoWithWhiteOutline(logoSc, rasterPx, {
        headerBg: PDF_BRAND.white,
        outlinePx: 0,
      }),
    ])
    doc.addImage(logoColData, 'PNG', marginX, logoY, logoSize, logoSize)
    doc.addImage(logoScData, 'PNG', marginX + logoSize + logoGap, logoY, logoSize, logoSize)
  } catch {
    // Continue without logos if assets fail.
  }

  const titleCenterX = pageW / 2
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...PDF_BRAND.primary)
  doc.text('POLYTECHNIC UNIVERSITY OF THE PHILIPPINES', titleCenterX, 22, { align: 'center' })
  doc.setFontSize(7.5)
  doc.setTextColor(...PDF_BRAND.ink)
  doc.text('COLLEGE OF LAW STUDENT COUNCIL, INC.', titleCenterX, 34, { align: 'center' })
  doc.setFontSize(12)
  doc.setTextColor(...PDF_BRAND.ink)
  doc.text('ENROLLMENT APPOINTMENTS', titleCenterX, 50, { align: 'center' })
  if (options.termBanner?.trim()) {
    doc.setFontSize(7.5)
    doc.setTextColor(...PDF_BRAND.body)
    doc.text(options.termBanner.trim(), titleCenterX, 62, { align: 'center' })
  }

  doc.setDrawColor(...PDF_BRAND.primary)
  doc.setLineWidth(1.25)
  doc.line(0, headerH - 2, pageW, headerH - 2)

  y = headerH + 12

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...PDF_BRAND.muted)
  const scope = options.scopeLabel?.trim() || 'All matching appointments'
  doc.text(`${scope}  ·  ${rows.length} record${rows.length === 1 ? '' : 's'}`, marginX, y)
  doc.text(`Generated ${formatPhDateTime(new Date())}`, pageW - marginX, y, { align: 'right' })
  y += 14

  const cols: { label: string; w: number; align?: 'left' | 'center' }[] = [
    { label: 'TRACKING', w: 72 },
    { label: 'NAME', w: 132 },
    { label: 'STUDENT NO.', w: 88 },
    { label: 'YR', w: 30, align: 'center' },
    { label: 'CLASS', w: 58 },
    { label: 'DATE', w: 82 },
    { label: 'SLOT', w: 82 },
    { label: 'PAYMENT', w: 64 },
    { label: 'STATUS', w: 54, align: 'center' },
    { label: 'SUBMITTED', w: contentW - 72 - 132 - 88 - 30 - 58 - 82 - 82 - 64 - 54 },
  ]
  const headerRowH = 22
  const cellPadX = 5
  const lineH = 10

  const drawTableHeader = () => {
    doc.setFillColor(...PDF_BRAND.primary)
    doc.rect(marginX, y, contentW, headerRowH, 'F')
    let x = marginX
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...PDF_BRAND.white)
    for (const col of cols) {
      const tx = col.align === 'center' ? x + col.w / 2 : x + cellPadX
      doc.text(col.label, tx, y + 14, col.align === 'center' ? { align: 'center' } : undefined)
      x += col.w
    }
    y += headerRowH
  }

  drawTableHeader()

  if (rows.length === 0) {
    ensureSpace(28)
    doc.setFillColor(...PDF_BRAND.zebra)
    doc.rect(marginX, y, contentW, 28, 'F')
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(...PDF_BRAND.muted)
    doc.text('No appointments in this export.', marginX + cellPadX, y + 18)
    y += 28
  }

  rows.forEach((item, index) => {
    const values = [
      item.trackingCode || '—',
      item.fullName || '—',
      item.studentNumber || '—',
      yearLevelLabel(item.yearLevel || ''),
      classificationLabel(item.classification || ''),
      enrollmentDateLabel(item),
      item.timeSlotLabel || item.timeSlot || '—',
      item.paymentMode || '—',
      statusLabel(item.status),
      formatPhDateTime(item.createdAt),
    ]

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const wrapped = values.map((value, colIndex) =>
      doc.splitTextToSize(value, cols[colIndex].w - cellPadX * 2),
    )
    const rowH = Math.max(
      20,
      ...wrapped.map((lines) => lines.length * lineH + 8),
    )

    ensureSpace(rowH)

    if (index % 2 === 1) {
      doc.setFillColor(...PDF_BRAND.zebra)
      doc.rect(marginX, y, contentW, rowH, 'F')
    }

    doc.setDrawColor(...PDF_BRAND.line)
    doc.setLineWidth(0.4)
    doc.rect(marginX, y, contentW, rowH, 'S')

    let x = marginX
    doc.setTextColor(...PDF_BRAND.body)
    for (let colIndex = 0; colIndex < cols.length; colIndex += 1) {
      const col = cols[colIndex]
      const lines = wrapped[colIndex] as string[]
      const textY = y + 7 + lineH
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const tx = col.align === 'center' ? x + col.w / 2 : x + cellPadX
        doc.text(
          lines[lineIndex],
          tx,
          textY + lineIndex * lineH,
          col.align === 'center' ? { align: 'center' } : undefined,
        )
      }
      x += col.w
    }
    y += rowH
  })

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...PDF_BRAND.muted)
    doc.text(
      'PUP College of Law Student Council · Enrollment Appointments',
      marginX,
      pageH - 18,
    )
    doc.text(`Page ${page} of ${pageCount}`, pageW - marginX, pageH - 18, { align: 'right' })
  }

  const stamp = new Date().toISOString().slice(0, 10)
  doc.save(`enrollment-appointments-${stamp}.pdf`)
}
