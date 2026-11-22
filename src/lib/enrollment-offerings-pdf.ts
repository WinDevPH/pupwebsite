import { jsPDF } from 'jspdf'
import logoCol from '@/assets/pup-col-logo.png'
import logoSc from '@/assets/pup-col-sc-seal.png'
import type { EnrollmentOffering } from '@/lib/enrollment-offerings-api'
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

function offeringOpen(row: EnrollmentOffering) {
  return !(row.full === true || row.availability === 'FULL')
}

function stampDate() {
  return new Date().toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export type OfferingsPdfOptions = {
  offerings: EnrollmentOffering[]
  termBanner?: string
  scopeLabel?: string
}

/** Official landscape catalog PDF for Class Offerings admin export. */
export async function downloadOfferingsCatalogPdf(options: OfferingsPdfOptions) {
  const rows = options.offerings

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
  doc.text('CLASS OFFERINGS CATALOG', titleCenterX, 50, { align: 'center' })
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
  const scope = options.scopeLabel?.trim() || 'All matching offerings'
  doc.text(`${scope}  ·  ${rows.length} record${rows.length === 1 ? '' : 's'}`, marginX, y)
  doc.text(`Generated ${stampDate()}`, pageW - marginX, y, { align: 'right' })
  y += 14

  const cols: { label: string; w: number; align?: 'left' | 'center' }[] = [
    { label: 'CODE', w: 70 },
    { label: 'SUBJECT', w: 210 },
    { label: 'SEC', w: 48, align: 'center' },
    { label: 'YR', w: 36, align: 'center' },
    { label: 'UNITS', w: 44, align: 'center' },
    { label: 'DAYS', w: 78 },
    { label: 'TIME', w: 110 },
    { label: 'AVAIL', w: 52, align: 'center' },
    { label: 'STATUS', w: contentW - 70 - 210 - 48 - 36 - 44 - 78 - 110 - 52, align: 'center' },
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
    doc.text('No offerings in this export.', marginX + cellPadX, y + 18)
    y += 28
  }

  rows.forEach((item, index) => {
    const values = [
      item.code || '—',
      item.title || '—',
      item.section || '—',
      item.year || '—',
      String(item.units ?? 0),
      item.days?.length ? item.days.join('/') : '—',
      item.timeLabel || item.scheduleLabel || '—',
      offeringOpen(item) ? 'OPEN' : 'FULL',
      item.published ? 'Published' : 'Draft',
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
      'PUP College of Law Student Council · Class Offerings Catalog',
      marginX,
      pageH - 18,
    )
    doc.text(`Page ${page} of ${pageCount}`, pageW - marginX, pageH - 18, { align: 'right' })
  }

  const stamp = new Date().toISOString().slice(0, 10)
  doc.save(`class-offerings-catalog-${stamp}.pdf`)
}
