import * as XLSX from 'xlsx'
import { formatPhDateTime } from '@/lib/datetime'
import type { EnrollmentOffering } from '@/lib/enrollment-offerings-api'

function text(value: string | null | undefined) {
  const next = (value ?? '').trim()
  return next || '—'
}

function offeringOpen(row: EnrollmentOffering) {
  return !(row.full === true || row.availability === 'FULL')
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

/** Real .xlsx catalog export — opens cleanly in Excel / Sheets. */
export function downloadOfferingsCatalogExcel(options: {
  offerings: EnrollmentOffering[]
  scopeLabel?: string
}) {
  const rows = options.offerings
  const stamp = new Date().toISOString().slice(0, 10)
  const scope = options.scopeLabel?.trim() || 'Class offerings catalog'
  const generated = formatPhDateTime(new Date())

  const sheetRows: Array<Array<string | number>> = [
    ['PUP College of Law Student Council'],
    ['Class Offerings Catalog'],
    [scope],
    [`Generated ${generated}`],
    [],
    [
      'Code',
      'Subject',
      'Section',
      'Year',
      'Units',
      'Days',
      'Time',
      'Schedule',
      'Availability',
      'Status',
      'Sort order',
    ],
    ...rows.map((item) => [
      text(item.code),
      text(item.title),
      text(item.section),
      text(item.year),
      item.units ?? 0,
      item.days?.length ? item.days.join('/') : '—',
      text(item.timeLabel),
      text(item.scheduleLabel),
      offeringOpen(item) ? 'Open' : 'Full',
      item.published ? 'Published' : 'Draft',
      item.sortOrder ?? 0,
    ]),
  ]

  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows)
  worksheet['!cols'] = [
    { wch: 12 },
    { wch: 36 },
    { wch: 14 },
    { wch: 8 },
    { wch: 8 },
    { wch: 12 },
    { wch: 18 },
    { wch: 28 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Class Offerings')
  triggerXlsxDownload(workbook, `class-offerings-catalog-${stamp}.xlsx`)
}
