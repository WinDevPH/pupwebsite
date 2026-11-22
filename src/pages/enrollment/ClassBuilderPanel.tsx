import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Rows3,
  Search,
  UserRound,
  X,
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import { motion } from 'motion/react'
import logoCol from '@/assets/pup-col-logo.png'
import logoSc from '@/assets/pup-col-sc-seal.png'
import { Reveal } from '@/components/motion/Reveal'
import { Button } from '@/components/ui/button'
import { SectionKicker } from '@/components/ui/SectionKicker'
import { Snackbar, type SnackToast, type SnackVariant } from '@/components/ui/Snackbar'
import { listOfferings } from '@/lib/enrollment-offerings-api'
import { getRoutingBundle } from '@/lib/enrollment-routing-api'
import { popIn } from '@/lib/motion'
import { renderLogoWithWhiteOutline } from '@/lib/logo-render'
import { cn } from '@/lib/utils'

const PDF_BRAND = {
  primary: [95, 24, 184] as [number, number, number],
  primaryDeep: [30, 5, 65] as [number, number, number],
  soft: [237, 226, 255] as [number, number, number],
  softBorder: [219, 198, 255] as [number, number, number],
  gold: [242, 183, 5] as [number, number, number],
  ink: [30, 5, 65] as [number, number, number],
  body: [39, 39, 42] as [number, number, number],
  muted: [82, 82, 91] as [number, number, number],
  line: [228, 228, 231] as [number, number, number],
  zebra: [250, 247, 255] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
}

type DayKey = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'

type OfferingAvailability = 'OPEN' | 'FULL'

type Offering = {
  id: string
  offeringId: number
  code: string
  title: string
  section: string
  units: number
  days: DayKey[]
  startHour: number
  endHour: number
  timeLabel: string
  capacity: number
  takenCount: number
  remaining: number
  full: boolean
  availability: OfferingAvailability
}

const DAYS: DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DEFAULT_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
const HOUR_PX = 40
/** Top/bottom inset so hour labels and end-of-day blocks are not clipped. */
const GRID_PAD_Y = 14
const offeringPageSizes = [5, 10, 15, 'all'] as const
type OfferingPageSize = (typeof offeringPageSizes)[number]

type MobilePane = 'catalog' | 'schedule'

type BuilderStepId = 'details' | 'subjects' | 'schedule' | 'export'

const BUILDER_STEPS: {
  id: BuilderStepId
  label: string
  hint: string
  Icon: typeof UserRound
}[] = [
  {
    id: 'details',
    label: 'Student details',
    hint: 'Enter name and student number',
    Icon: UserRound,
  },
  {
    id: 'subjects',
    label: 'Pick subjects',
    hint: 'Add offerings from the catalog',
    Icon: BookOpen,
  },
  {
    id: 'schedule',
    label: 'Check schedule',
    hint: 'Confirm a conflict-free week',
    Icon: CalendarDays,
  },
  {
    id: 'export',
    label: 'Download PDF',
    hint: 'Export your official draft',
    Icon: Download,
  },
]

function toDayKeys(days: string[]): DayKey[] {
  return days.filter((day): day is DayKey => (DAYS as string[]).includes(day))
}

function offeringAvailability(source: { availability?: string; full?: boolean }): OfferingAvailability {
  if (source.full === true || source.availability === 'FULL') return 'FULL'
  return 'OPEN'
}

function offeringIsFull(item: Pick<Offering, 'full' | 'availability'>) {
  return item.full === true || item.availability === 'FULL'
}

/** Parse "1:00PM", "1:00 PM", "13:00", "5:30PM" into 24h decimal hours. */
function parseClockToHour(token: string): number | null {
  const cleaned = token.trim().replace(/\s+/g, '')
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?(AM|PM)?$/i)
  if (!match) return null
  let hour = Number.parseInt(match[1], 10)
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null
  const minutes = match[2] ? Number.parseInt(match[2], 10) : 0
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 59) return null
  const meridiem = match[3]?.toUpperCase()
  if (meridiem === 'PM' && hour < 12) hour += 12
  if (meridiem === 'AM' && hour === 12) hour = 0
  return hour + minutes / 60
}

function parseTimeLabelRange(label: string): { start: number; end: number } | null {
  const cleaned = label.replace(/[–—−]/g, '-').replace(/\s+/g, ' ').trim()
  if (!cleaned) return null
  const parts = cleaned.split(/\s*-\s*/)
  if (parts.length < 2) return null
  const start = parseClockToHour(parts[0])
  const end = parseClockToHour(parts[1])
  if (start === null || end === null || !(end > start)) return null
  return { start, end }
}

/** Prefer stored hours when valid; otherwise recover from time label (e.g. 1:00PM–5:30PM). */
function effectiveHours(item: Pick<Offering, 'startHour' | 'endHour' | 'timeLabel'>) {
  if (
    Number.isFinite(item.startHour) &&
    Number.isFinite(item.endHour) &&
    item.endHour > item.startHour
  ) {
    return { start: item.startHour, end: item.endHour }
  }
  return parseTimeLabelRange(item.timeLabel) ?? { start: item.startHour, end: item.endHour }
}

/** Distinct schedule colors — keyed by course code so Mon/Wed blocks match. */
const subjectPalette = [
  { block: 'bg-sky-600', dot: 'bg-sky-600', ring: 'ring-sky-300' },
  { block: 'bg-emerald-600', dot: 'bg-emerald-600', ring: 'ring-emerald-300' },
  { block: 'bg-amber-600', dot: 'bg-amber-600', ring: 'ring-amber-300' },
  { block: 'bg-rose-600', dot: 'bg-rose-600', ring: 'ring-rose-300' },
  { block: 'bg-indigo-600', dot: 'bg-indigo-600', ring: 'ring-indigo-300' },
  { block: 'bg-teal-600', dot: 'bg-teal-600', ring: 'ring-teal-300' },
  { block: 'bg-orange-600', dot: 'bg-orange-600', ring: 'ring-orange-300' },
  { block: 'bg-fuchsia-600', dot: 'bg-fuchsia-600', ring: 'ring-fuchsia-300' },
  { block: 'bg-cyan-700', dot: 'bg-cyan-700', ring: 'ring-cyan-300' },
  { block: 'bg-lime-700', dot: 'bg-lime-700', ring: 'ring-lime-300' },
  { block: 'bg-brand-700', dot: 'bg-brand-700', ring: 'ring-brand-300' },
  { block: 'bg-violet-700', dot: 'bg-violet-700', ring: 'ring-violet-300' },
] as const

function subjectTone(code: string) {
  let hash = 0
  for (let i = 0; i < code.length; i += 1) {
    hash = (hash * 31 + code.charCodeAt(i)) >>> 0
  }
  return subjectPalette[hash % subjectPalette.length]
}

function overlaps(a: Offering, b: Offering) {
  const sharedDays = a.days.some((day) => b.days.includes(day))
  if (!sharedDays) return false
  const ah = effectiveHours(a)
  const bh = effectiveHours(b)
  return ah.start < bh.end && bh.start < ah.end
}

function formatHour(hour: number) {
  const h = Math.floor(hour)
  const mins = Math.round((hour - h) * 60)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const display = ((h + 11) % 12) + 1
  if (mins === 0) return `${display} ${suffix}`
  return `${display}:${String(mins).padStart(2, '0')} ${suffix}`
}

function formatPdfTime(startHour: number, endHour: number) {
  const compact = (hour: number) => {
    const h = Math.floor(hour)
    const mins = hour % 1 === 0 ? '' : ':30'
    const suffix = h >= 12 ? 'PM' : 'AM'
    const display = ((h + 11) % 12) + 1
    return `${display}${mins}${suffix}`
  }
  return `${compact(startHour)}-${compact(endHour)}`
}


function OfferingPageSizeDropdown({
  value,
  onChange,
}: {
  value: OfferingPageSize
  onChange: (value: OfferingPageSize) => void
}) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    function place() {
      const el = rootRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setMenuPos({
        top: rect.bottom + 8,
        left: rect.left,
        width: Math.max(rect.width, 180),
      })
    }
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    place()
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Offerings per page"
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-[13px] font-semibold text-brand-950 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800',
          open && 'border-brand-400 ring-2 ring-brand-100',
        )}
      >
        <Rows3 className="size-3.5 text-brand-600" aria-hidden />
        <span className="tabular-nums">{value === 'all' ? 'All' : `${value} / page`}</span>
        <ChevronDown
          className={cn('size-3.5 text-zinc-400 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && menuPos
        ? createPortal(
            <motion.div
              ref={menuRef}
              role="menu"
              initial={popIn.initial}
              animate={popIn.animate}
              transition={popIn.transition}
              style={{
                position: 'fixed',
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.width,
                zIndex: 60,
              }}
              className="rounded-xl border border-zinc-200 bg-white p-1.5 shadow-[0_18px_40px_-20px_rgba(30,5,65,0.35)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/50"
            >
              {offeringPageSizes.map((size) => {
                const selected = size === value
                const label = size === 'all' ? 'All' : `${size} / page`
                return (
                  <button
                    key={String(size)}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => {
                      onChange(size)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left text-[13px] font-medium tabular-nums transition-colors',
                      selected
                        ? 'bg-brand-50 text-brand-800'
                        : 'text-brand-950 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800',
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Rows3 className="size-3.5 shrink-0 text-brand-600" aria-hidden />
                      {label}
                    </span>
                    {selected ? (
                      <CheckCircle2 className="size-3.5 shrink-0 text-brand-700" aria-hidden />
                    ) : null}
                  </button>
                )
              })}
            </motion.div>,
            document.body,
          )
        : null}
    </div>
  )
}

export function ClassBuilderPanel() {
  const [studentName, setStudentName] = useState('')
  const [studentNumber, setStudentNumber] = useState('')
  const [touched, setTouched] = useState({ name: false, number: false })
  const [query, setQuery] = useState('')
  const [sectionFilter, setSectionFilter] = useState('All')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [duplicateNotice, setDuplicateNotice] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<OfferingPageSize>(5)
  const [mobilePane, setMobilePane] = useState<MobilePane>('catalog')
  const [snack, setSnack] = useState<SnackToast | null>(null)
  const [offerings, setOfferings] = useState<Offering[]>([])
  const [termBanner, setTermBanner] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  const snackId = useRef(0)
  const snackTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (snackTimer.current) window.clearTimeout(snackTimer.current)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void Promise.all([listOfferings(), getRoutingBundle()]).then(([result, routingResult]) => {
      if (cancelled) return
      if (routingResult.ok) {
        setTermBanner(routingResult.data.settings.termBanner || '')
      }
      if (!result.ok) {
        setLoadError(result.error)
        setOfferings([])
        setLoading(false)
        return
      }
      setLoadError('')
      setOfferings(
        result.data.items.map((item) => {
          const availability = offeringAvailability(item)
          return {
            id: String(item.id),
            offeringId: Number(item.id),
            code: item.code,
            title: item.title,
            section: item.section,
            units: item.units,
            days: toDayKeys(item.days),
            startHour: item.startHour,
            endHour: item.endHour,
            timeLabel: item.timeLabel || item.scheduleLabel,
            capacity: item.capacity,
            takenCount: item.takenCount,
            remaining: item.remaining,
            full: availability === 'FULL',
            availability,
          }
        }),
      )
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function dismissSnack() {
    if (snackTimer.current) window.clearTimeout(snackTimer.current)
    snackTimer.current = null
    setSnack(null)
  }

  function showSnackbar(message: string, variant: SnackVariant = 'info') {
    if (snackTimer.current) window.clearTimeout(snackTimer.current)
    const id = snackId.current + 1
    snackId.current = id
    setSnack({ id, message, variant })
    snackTimer.current = window.setTimeout(
      () => {
        setSnack((current) => (current?.id === id ? null : current))
        snackTimer.current = null
      },
      message.length > 140 ? 10_000 : 5200,
    )
  }

  const sectionFilters = useMemo(() => {
    const sections = Array.from(new Set(offerings.map((item) => item.section))).sort((a, b) =>
      a.localeCompare(b),
    )
    return ['All', ...sections]
  }, [offerings])

  const selected = useMemo(
    () => offerings.filter((item) => selectedIds.includes(item.id)),
    [offerings, selectedIds],
  )

  const conflicts = useMemo(() => {
    const pairs: { a: Offering; b: Offering }[] = []
    for (let i = 0; i < selected.length; i += 1) {
      for (let j = i + 1; j < selected.length; j += 1) {
        if (overlaps(selected[i], selected[j])) {
          pairs.push({ a: selected[i], b: selected[j] })
        }
      }
    }
    return pairs
  }, [selected])

  const conflictIds = useMemo(() => {
    const ids = new Set<string>()
    for (const pair of conflicts) {
      ids.add(pair.a.id)
      ids.add(pair.b.id)
    }
    return ids
  }, [conflicts])

  const totalUnits = selected.reduce((sum, item) => sum + item.units, 0)
  const scheduleHours = useMemo(() => {
    let minH = DEFAULT_HOURS[0]
    let maxH = DEFAULT_HOURS[DEFAULT_HOURS.length - 1] + 1
    for (const item of selected) {
      const { start, end } = effectiveHours(item)
      if (!Number.isFinite(start) || !Number.isFinite(end) || !(end > start)) continue
      minH = Math.min(minH, Math.floor(start))
      maxH = Math.max(maxH, Math.ceil(end))
    }
    minH = Math.max(6, Math.min(minH, 20))
    maxH = Math.min(23, Math.max(maxH, minH + 1))
    const hours: number[] = []
    for (let hour = minH; hour < maxH; hour += 1) hours.push(hour)
    return hours.length > 0 ? hours : DEFAULT_HOURS
  }, [selected])
  const nameOk = studentName.trim().length >= 3
  const numberOk = studentNumber.trim().length >= 5
  const canExport = selected.length > 0 && conflicts.length === 0 && nameOk && numberOk

  const stepDone: Record<BuilderStepId, boolean> = {
    details: nameOk && numberOk,
    subjects: selected.length > 0,
    schedule: selected.length > 0 && conflicts.length === 0,
    export: canExport,
  }
  const activeStepIndex = (() => {
    const firstOpen = BUILDER_STEPS.findIndex((step) => !stepDone[step.id])
    return firstOpen === -1 ? BUILDER_STEPS.length - 1 : firstOpen
  })()
  const completedSteps = BUILDER_STEPS.filter((step) => stepDone[step.id]).length

  function markTouched(key: 'name' | 'number') {
    setTouched((current) => (current[key] ? current : { ...current, [key]: true }))
  }

  function goToBuilderStep(stepId: BuilderStepId) {
    if (stepId === 'details') {
      document.getElementById('class-builder-details')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
      window.setTimeout(() => {
        document.getElementById('class-builder-student-name')?.focus()
      }, 280)
      return
    }
    if (stepId === 'subjects') {
      setMobilePane('catalog')
      document.getElementById('class-builder-catalog')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
      return
    }
    if (stepId === 'schedule') {
      setMobilePane('schedule')
      document.getElementById('class-builder-schedule')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
      return
    }
    document.getElementById('class-builder-export')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  const filteredOfferings = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return offerings.filter((item) => {
      if (sectionFilter !== 'All' && item.section !== sectionFilter) return false
      if (!needle) return true
      return `${item.code} ${item.title} ${item.section} ${item.timeLabel}`
        .toLowerCase()
        .includes(needle)
    })
  }, [offerings, query, sectionFilter])

  const totalRecords = filteredOfferings.length
  const effectivePageSize = pageSize === 'all' ? Math.max(totalRecords, 1) : pageSize
  const totalPages = Math.max(1, Math.ceil(totalRecords / effectivePageSize))
  const currentPage = Math.min(page, totalPages)
  const showingFrom = totalRecords === 0 ? 0 : (currentPage - 1) * effectivePageSize + 1
  const showingTo = Math.min(currentPage * effectivePageSize, totalRecords)
  const visibleOfferings =
    pageSize === 'all'
      ? filteredOfferings
      : filteredOfferings.slice((currentPage - 1) * effectivePageSize, currentPage * effectivePageSize)

  useEffect(() => {
    setPage(1)
  }, [query, sectionFilter, pageSize])

  function toggleOffering(item: Offering) {
    setDuplicateNotice('')
    if (selectedIds.includes(item.id)) {
      setSelectedIds((current) => current.filter((id) => id !== item.id))
      return
    }
    if (offeringIsFull(item)) {
      showSnackbar(`${item.code} (${item.section}) is full.`, 'error')
      return
    }
    const duplicate = selected.find((picked) => picked.code === item.code)
    if (duplicate) {
      setDuplicateNotice(
        `You already selected ${duplicate.title} (${duplicate.code}) under ${duplicate.section}. Remove it first to switch sections.`,
      )
      return
    }
    setSelectedIds((current) => [...current, item.id])
  }

  function clearAll() {
    setSelectedIds([])
    setDuplicateNotice('')
  }

  async function downloadPdf() {
    if (!canExport || pdfBusy) return
    setPdfBusy(true)

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const marginX = 40
      const contentW = pageW - marginX * 2
      const bottomSafe = 48
      let y = 0

      const ensureSpace = (needed: number) => {
        if (y + needed <= pageH - bottomSafe) return false
        doc.addPage()
        y = 40
        return true
      }

      // Formal institutional letterhead (compact)
      const headerH = termBanner ? 88 : 76
      doc.setFillColor(...PDF_BRAND.white)
      doc.rect(0, 0, pageW, headerH, 'F')

      try {
        const logoSize = 40
        const logoGap = 8
        const logoY = (headerH - 8 - logoSize) / 2
        const colX = marginX
        const scX = colX + logoSize + logoGap
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
        doc.addImage(logoColData, 'PNG', colX, logoY, logoSize, logoSize)
        doc.addImage(logoScData, 'PNG', scX, logoY, logoSize, logoSize)
      } catch {
        // Continue without logo if asset fails to load.
      }

      const titleCenterX = pageW / 2
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...PDF_BRAND.primary)
      doc.text('POLYTECHNIC UNIVERSITY OF THE PHILIPPINES', titleCenterX, 24, { align: 'center' })
      doc.setFontSize(7.5)
      doc.setTextColor(...PDF_BRAND.ink)
      doc.text('COLLEGE OF LAW STUDENT COUNCIL, INC.', titleCenterX, 36, { align: 'center' })
      doc.setFontSize(12)
      doc.setTextColor(...PDF_BRAND.ink)
      doc.text('PROPOSED CLASS SCHEDULE', titleCenterX, 52, { align: 'center' })
      if (termBanner) {
        doc.setFontSize(7.5)
        doc.setTextColor(...PDF_BRAND.body)
        doc.text(termBanner, titleCenterX, 64, { align: 'center' })
      }

      // Single purple rule
      doc.setDrawColor(...PDF_BRAND.primary)
      doc.setLineWidth(1.25)
      doc.line(0, headerH - 2, pageW, headerH - 2)

      y = headerH + 16

    // Student fields
    const drawField = (label: string, value: string, lineW: number) => {
      ensureSpace(28)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...PDF_BRAND.primary)
      doc.text(label, marginX, y)

      const labelW = Math.max(doc.getTextWidth(label) + 10, 78)
      const lineX = marginX + labelW
      const lineY = y + 2

      doc.setDrawColor(...PDF_BRAND.primary)
      doc.setLineWidth(1.15)
      doc.line(lineX, lineY, lineX + lineW, lineY)

      if (value) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.setTextColor(...PDF_BRAND.ink)
        doc.text(value, lineX + 2, y - 1)
      }
      y += 26
    }

    drawField('FULL NAME:', studentName.trim(), contentW - 108)
    drawField('STUDENT NUMBER:', studentNumber.trim(), Math.min(260, contentW * 0.48))
    y += 8

    // Schedule table
    const cols: { label: string; w: number; align?: 'left' | 'center' }[] = [
      { label: 'CODE', w: 62 },
      { label: 'SUBJECT DESCRIPTION', w: 208 },
      { label: 'SEC', w: 62 },
      { label: 'UNITS', w: 44, align: 'center' },
      { label: 'DAY', w: 58 },
      { label: 'TIME', w: contentW - 62 - 208 - 62 - 44 - 58 },
    ]
    const headerRowH = 26
    const cellPadX = 7
    const cellPadY = 7
    const lineH = 11

    const drawTableHeader = () => {
      ensureSpace(headerRowH + 40)
      doc.setFillColor(...PDF_BRAND.primary)
      doc.rect(marginX, y, contentW, headerRowH, 'F')

      let x = marginX
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(...PDF_BRAND.white)
      for (const col of cols) {
        const tx = col.align === 'center' ? x + col.w / 2 : x + cellPadX
        doc.text(col.label, tx, y + 16, col.align === 'center' ? { align: 'center' } : undefined)
        x += col.w
      }
      y += headerRowH
    }

    drawTableHeader()

    selected.forEach((item, index) => {
      const values = [
        item.code,
        item.title,
        item.section,
        String(item.units),
        item.days.join('/'),
        (() => {
          const hours = effectiveHours(item)
          return formatPdfTime(hours.start, hours.end)
        })(),
      ]

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      const wrapped = values.map((value, colIndex) =>
        doc.splitTextToSize(value, cols[colIndex].w - cellPadX * 2),
      )
      const maxLines = Math.max(...wrapped.map((lines) => lines.length), 1)
      const rowH = Math.max(26, maxLines * lineH + cellPadY * 2)

      if (ensureSpace(rowH + headerRowH + 8)) drawTableHeader()

      if (index % 2 === 1) {
        doc.setFillColor(...PDF_BRAND.zebra)
        doc.rect(marginX, y, contentW, rowH, 'F')
      } else {
        doc.setFillColor(...PDF_BRAND.white)
        doc.rect(marginX, y, contentW, rowH, 'F')
      }

      doc.setDrawColor(...PDF_BRAND.line)
      doc.setLineWidth(0.55)
      doc.rect(marginX, y, contentW, rowH, 'S')

      let x = marginX
      wrapped.forEach((lines, colIndex) => {
        const col = cols[colIndex]
        if (colIndex < cols.length - 1) {
          doc.line(x + col.w, y, x + col.w, y + rowH)
        }

        const textY = y + cellPadY + 9
        doc.setFont('helvetica', colIndex === 1 ? 'normal' : 'bold')
        doc.setFontSize(colIndex === 1 ? 9 : 8.75)
        doc.setTextColor(...PDF_BRAND.body)

        if (col.align === 'center') {
          doc.text(lines, x + col.w / 2, textY, { align: 'center' })
        } else {
          doc.text(lines, x + cellPadX, textY)
        }
        x += col.w
      })

      y += rowH
    })

    // Outer brand stroke on table block end
    doc.setDrawColor(...PDF_BRAND.primary)
    doc.setLineWidth(1.1)
    doc.line(marginX, y, marginX + contentW, y)

    y += 22
    ensureSpace(34)

    // Total units strip
    const totalLabel = `TOTAL UNITS: ${totalUnits}`
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    const totalPadX = 14
    const totalW = Math.max(doc.getTextWidth(totalLabel) + totalPadX * 2, 132)
    const totalH = 26
    doc.setFillColor(...PDF_BRAND.soft)
    doc.setDrawColor(...PDF_BRAND.softBorder)
    doc.setLineWidth(0.9)
    doc.roundedRect(marginX, y, totalW, totalH, 3, 3, 'FD')
    doc.setTextColor(...PDF_BRAND.primary)
    doc.text(totalLabel, marginX + totalPadX, y + 17)

    // Meta on the right of total row
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...PDF_BRAND.muted)
    doc.text(
      `${selected.length} subject${selected.length === 1 ? '' : 's'}  ·  Conflict-free schedule`,
      marginX + contentW,
      y + 17,
      { align: 'right' },
    )

    // Bottom signatures + footer — generous vertical rhythm
    y += totalH + 36
    ensureSpace(130)

    const signGap = 48
    const signW = (contentW - signGap) / 2
    const blocks = [
      { title: "Student's Signature over Printed Name", x: marginX },
      { title: 'College Secretary / Adviser', x: marginX + signW + signGap },
    ]

    for (const block of blocks) {
      doc.setDrawColor(...PDF_BRAND.ink)
      doc.setLineWidth(1.1)
      doc.line(block.x + 8, y, block.x + signW - 8, y)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...PDF_BRAND.muted)
      doc.text(block.title, block.x + signW / 2, y + 16, { align: 'center' })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...PDF_BRAND.primary)
      doc.text('DATE', block.x + 8, y + 52)
      doc.setDrawColor(...PDF_BRAND.primary)
      doc.setLineWidth(0.95)
      doc.line(block.x + 40, y + 52, block.x + signW - 8, y + 52)
    }

    y += 78
    ensureSpace(32)
    doc.setDrawColor(...PDF_BRAND.line)
    doc.setLineWidth(0.6)
    doc.line(marginX, y, marginX + contentW, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...PDF_BRAND.muted)
    const stamped = new Date().toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
    doc.text('PUP College of Law · Enrollment Hub · Class Builder', marginX, y + 14)
    doc.text(stamped, marginX + contentW, y + 14, { align: 'right' })

      const safeName = (studentNumber.trim() || studentName.trim() || 'schedule')
        .replace(/[^\w\-]+/g, '_')
        .slice(0, 40)
      doc.save(`proposed-class-schedule-${safeName}.pdf`)
      showSnackbar('PDF downloaded. Proposed class schedule saved successfully.', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not generate the PDF.'
      showSnackbar(message, 'error')
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <Reveal>
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-8">
          <div className="min-w-0">
            <SectionKicker icon={LayoutGrid}>Official Schedule Draft</SectionKicker>
            <h2 className="mt-2 font-hero text-[clamp(1.7rem,1rem+2.2vw,3.1rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950 sm:mt-2.5 dark:text-zinc-50">
              Class <span className="text-brand-600 dark:text-brand-400">Builder</span>
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-5 text-zinc-500 sm:mt-3 sm:text-sm sm:leading-6 dark:text-zinc-400">
              Follow the steps below: details, subjects, schedule check, then export PDF.
            </p>
          </div>
          <div
            id="class-builder-export"
            className="flex w-full scroll-mt-24 gap-2 lg:w-auto lg:justify-end"
          >
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11 flex-1 rounded-xl sm:flex-none"
              onClick={clearAll}
              disabled={selected.length === 0 || pdfBusy}
              title={selected.length === 0 ? 'No subjects selected' : 'Clear selected subjects'}
            >
              <Eraser className="size-4" aria-hidden />
              Clear
            </Button>
            <Button
              type="button"
              size="lg"
              className="h-11 flex-[1.35] rounded-xl sm:min-w-[11.5rem] sm:flex-none"
              onClick={() => void downloadPdf()}
              disabled={!canExport || pdfBusy}
              aria-busy={pdfBusy}
              title={
                canExport
                  ? 'Download proposed class schedule PDF'
                  : 'Add name, student number, and a conflict-free schedule to export'
              }
            >
              {pdfBusy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Download className="size-4" aria-hidden />
              )}
              {pdfBusy ? 'Preparing…' : 'Download PDF'}
            </Button>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.03}>
        <nav
          aria-label="Class Builder steps"
          className="overflow-hidden rounded-2xl border border-zinc-200 bg-white sm:rounded-[1.5rem] dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3 sm:px-5 dark:border-zinc-800">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-400 uppercase">
              Step-by-step guide
            </p>
            <p className="text-[12px] font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
              {completedSteps}/{BUILDER_STEPS.length} complete
            </p>
          </div>
          <ol className="grid divide-y divide-zinc-100 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 dark:divide-zinc-800">
            {BUILDER_STEPS.map((step, index) => {
              const done = stepDone[step.id]
              const active = index === activeStepIndex
              const StepIcon = step.Icon
              return (
                <li
                  key={step.id}
                  className={cn(
                    'border-zinc-100 dark:border-zinc-800',
                    (index === 0 || index === 2) && 'sm:border-r',
                    index < BUILDER_STEPS.length - 1 && 'lg:border-r',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => goToBuilderStep(step.id)}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors sm:px-5 sm:py-4',
                      active
                        ? 'bg-brand-50/70 dark:bg-brand-500/10'
                        : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold tabular-nums',
                        done
                          ? 'bg-emerald-600 text-white'
                          : active
                            ? 'bg-brand-700 text-white'
                            : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
                      )}
                      aria-hidden
                    >
                      {done ? <CheckCircle2 className="size-4" /> : index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <StepIcon
                          className={cn(
                            'size-3.5 shrink-0',
                            done
                              ? 'text-emerald-600'
                              : active
                                ? 'text-brand-700 dark:text-brand-300'
                                : 'text-zinc-400',
                          )}
                          aria-hidden
                        />
                        <span
                          className={cn(
                            'text-[13px] font-semibold tracking-tight',
                            done || active
                              ? 'text-brand-950 dark:text-zinc-50'
                              : 'text-zinc-600 dark:text-zinc-300',
                          )}
                        >
                          {step.label}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-4 text-zinc-500 dark:text-zinc-400">
                        {step.id === 'schedule' && conflicts.length > 0
                          ? `${conflicts.length} overlap${conflicts.length === 1 ? '' : 's'} to fix`
                          : step.id === 'subjects' && selected.length > 0
                            ? `${selected.length} subject${selected.length === 1 ? '' : 's'} selected`
                            : step.hint}
                      </span>
                      <span className="sr-only">
                        {done ? 'Completed' : active ? 'Current step' : 'Upcoming'}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>
      </Reveal>

      <Reveal delay={0.04}>
        <div
          id="class-builder-details"
          className="scroll-mt-24 overflow-hidden rounded-2xl border border-zinc-200 bg-white sm:rounded-[1.5rem] dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="grid gap-3 border-b border-zinc-100 p-4 sm:grid-cols-2 sm:gap-4 sm:p-5">
            <label className="block min-w-0">
              <span className="mb-1.5 block text-[10px] font-semibold tracking-[0.14em] text-zinc-400 uppercase sm:text-[11px]">
                Student Name <span className="text-brand-600">*</span>
              </span>
              <input
                id="class-builder-student-name"
                value={studentName}
                onChange={(event) => {
                  setStudentName(event.target.value)
                }}
                onBlur={() => markTouched('name')}
                placeholder="LASTNAME, FIRSTNAME M.I."
                aria-invalid={touched.name && !nameOk}
                className={cn(
                  'h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-brand-950 outline-none placeholder:text-zinc-400 focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500',
                  touched.name && !nameOk
                    ? 'border-maroon-400 focus:border-maroon-500 focus:ring-maroon-100 dark:border-maroon-400/70'
                    : 'border-zinc-200 focus:border-brand-400 focus:ring-brand-100 dark:border-zinc-700 dark:focus:border-brand-400 dark:focus:ring-brand-500/25',
                )}
              />
              {touched.name && !nameOk ? (
                <p className="mt-1.5 text-[11px] leading-4 text-maroon-700 dark:text-maroon-300" role="alert">
                  Enter student name (min. 3 characters).
                </p>
              ) : null}
            </label>
            <label className="block min-w-0">
              <span className="mb-1.5 block text-[10px] font-semibold tracking-[0.14em] text-zinc-400 uppercase sm:text-[11px]">
                Student Number <span className="text-brand-600">*</span>
              </span>
              <input
                value={studentNumber}
                onChange={(event) => {
                  setStudentNumber(event.target.value)
                }}
                onBlur={() => markTouched('number')}
                placeholder="2024-00011-MN-0"
                aria-invalid={touched.number && !numberOk}
                className={cn(
                  'h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-brand-950 outline-none placeholder:text-zinc-400 focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500',
                  touched.number && !numberOk
                    ? 'border-maroon-400 focus:border-maroon-500 focus:ring-maroon-100 dark:border-maroon-400/70'
                    : 'border-zinc-200 focus:border-brand-400 focus:ring-brand-100 dark:border-zinc-700 dark:focus:border-brand-400 dark:focus:ring-brand-500/25',
                )}
              />
              {touched.number && !numberOk ? (
                <p className="mt-1.5 text-[11px] leading-4 text-maroon-700 dark:text-maroon-300" role="alert">
                  Enter a valid student number.
                </p>
              ) : null}
            </label>
          </div>

          <div className="grid grid-cols-3 gap-px bg-zinc-100 dark:bg-zinc-800">
            <div className="bg-white px-3 py-3 sm:px-6 sm:py-4 dark:bg-zinc-900">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-zinc-400 uppercase sm:text-[11px]">
                Units
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums text-brand-950 sm:text-lg dark:text-zinc-50">
                {totalUnits}
              </p>
            </div>
            <div className="bg-white px-3 py-3 sm:px-6 sm:py-4 dark:bg-zinc-900">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-zinc-400 uppercase sm:text-[11px]">
                Subjects
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums text-brand-950 sm:text-lg dark:text-zinc-50">
                {selected.length}
              </p>
            </div>
            <div className="bg-white px-3 py-3 sm:px-6 sm:py-4 dark:bg-zinc-900">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-zinc-400 uppercase sm:text-[11px]">
                Conflicts
              </p>
              <p
                className={cn(
                  'mt-1 inline-flex items-center gap-1.5 text-base font-semibold tabular-nums sm:text-lg',
                  conflicts.length ? 'text-amber-800' : 'text-emerald-700',
                )}
              >
                {conflicts.length ? (
                  <>
                    <AlertTriangle className="size-3.5" aria-hidden />
                    {conflicts.length}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    0
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </Reveal>

      {duplicateNotice ? (
        <div className="flex items-start gap-3 overflow-hidden rounded-2xl border border-amber-200 bg-white px-4 py-3.5 sm:rounded-[1.5rem] sm:px-5 dark:border-amber-500/30 dark:bg-zinc-900">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <AlertTriangle className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-amber-700/80 uppercase dark:text-amber-300/80">
              Duplicate course
            </p>
            <p className="mt-1 text-[13px] leading-5 text-brand-950 dark:text-zinc-100">
              {duplicateNotice}
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setDuplicateNotice('')}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-brand-950 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}

      {conflicts.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-rose-200 bg-white sm:rounded-[1.5rem] dark:border-rose-500/30 dark:bg-zinc-900">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rose-100 px-4 py-3.5 sm:px-5 sm:py-4 dark:border-rose-500/20">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                <AlertTriangle className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-[0.14em] text-rose-700/80 uppercase dark:text-rose-300/80">
                  Schedule conflicts
                </p>
                <p className="mt-1 text-[13px] font-semibold text-brand-950 sm:text-sm dark:text-zinc-50">
                  {conflicts.length} overlap{conflicts.length > 1 ? 's' : ''} blocking PDF export
                </p>
                <p className="mt-0.5 text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">
                  Remove one subject from each pair to clear the draft.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold tracking-wide text-rose-800 uppercase dark:bg-rose-500/15 dark:text-rose-200">
              <span className="size-1.5 rounded-full bg-rose-500" aria-hidden />
              Resolve required
            </span>
          </div>

          <ul className="divide-y divide-rose-100 dark:divide-rose-500/15">
            {conflicts.map((pair) => (
              <li
                key={`${pair.a.id}-${pair.b.id}`}
                className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-bold tracking-wide text-brand-800 uppercase dark:border-brand-500/40 dark:bg-brand-500/20 dark:text-brand-200">
                      {pair.a.code}
                    </span>
                    <span className="text-[11px] font-semibold text-zinc-400">overlaps</span>
                    <span className="inline-flex items-center rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-bold tracking-wide text-brand-800 uppercase dark:border-brand-500/40 dark:bg-brand-500/20 dark:text-brand-200">
                      {pair.b.code}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">
                    <span className="font-medium text-zinc-600 dark:text-zinc-300">{pair.a.timeLabel}</span>
                    <span className="mx-1.5 text-zinc-300">·</span>
                    <span className="font-medium text-zinc-600 dark:text-zinc-300">{pair.b.timeLabel}</span>
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => toggleOffering(pair.a)}
                    className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-[12px] font-semibold text-brand-950 transition-colors hover:bg-zinc-50 sm:h-8 sm:w-auto dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <X className="size-3.5" aria-hidden />
                    Remove {pair.a.code}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleOffering(pair.b)}
                    className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-[12px] font-semibold text-brand-950 transition-colors hover:bg-zinc-50 sm:h-8 sm:w-auto dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <X className="size-3.5" aria-hidden />
                    Remove {pair.b.code}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-200 bg-zinc-100/80 p-1 lg:hidden dark:border-zinc-700 dark:bg-zinc-900">
        {(
          [
            { id: 'catalog' as const, label: 'Offerings', icon: List, count: totalRecords },
            {
              id: 'schedule' as const,
              label: 'Schedule',
              icon: CalendarDays,
              count: selected.length,
            },
          ] as const
        ).map((pane) => {
          const Icon = pane.icon
          const active = mobilePane === pane.id
          return (
            <button
              key={pane.id}
              type="button"
              onClick={() => setMobilePane(pane.id)}
              className={cn(
                'inline-flex h-10 items-center justify-center gap-2 rounded-lg text-[13px] font-semibold transition-colors',
                active
                  ? 'bg-white text-brand-950 shadow-sm dark:bg-zinc-800 dark:text-zinc-50'
                  : 'text-zinc-500 hover:text-brand-800 dark:text-zinc-400',
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {pane.label}
              <span
                className={cn(
                  'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums',
                  active ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200' : 'bg-zinc-200/80 text-zinc-500 dark:bg-zinc-800',
                )}
              >
                {pane.count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-stretch lg:gap-5">
        <Reveal
          delay={0.06}
          className={cn(
            'min-w-0 scroll-mt-24 space-y-3 sm:space-y-4',
            mobilePane === 'catalog' ? 'block' : 'hidden lg:block',
          )}
        >
          <div
            id="class-builder-catalog"
            className="overflow-hidden rounded-2xl border border-zinc-200 bg-white sm:rounded-[1.5rem] dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="border-b border-zinc-100 px-4 py-3.5 sm:px-5 sm:py-4 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold tracking-[0.14em] text-zinc-400 uppercase sm:text-[11px]">
                    Available subjects
                  </p>
                  <p className="mt-1 text-[13px] font-semibold text-brand-950 sm:text-sm dark:text-zinc-50">
                    {sectionFilter === 'All' ? 'All sections' : sectionFilter}
                    <span className="font-medium text-zinc-500">
                      {' '}
                      · {totalRecords} listed
                    </span>
                  </p>
                </div>
              </div>

              <div
                data-lenis-prevent
                role="tablist"
                aria-label="Filter by section"
                className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto overscroll-x-contain px-1 pb-1 touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:rounded-xl sm:border sm:border-zinc-200/80 sm:bg-zinc-50/90 sm:p-2 sm:pb-2 dark:sm:border-zinc-800 dark:sm:bg-zinc-950/70 [&::-webkit-scrollbar]:hidden"
              >
                {sectionFilters.map((section) => {
                  const active = sectionFilter === section
                  return (
                    <button
                      key={section}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setSectionFilter(section)}
                      className={cn(
                        'inline-flex h-8 shrink-0 items-center justify-center rounded-md px-2.5 text-[11px] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/35 sm:text-[12px]',
                        active
                          ? 'bg-brand-700 text-white dark:bg-brand-600'
                          : 'bg-transparent text-zinc-600 hover:bg-white hover:text-brand-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-brand-200 sm:hover:shadow-[inset_0_0_0_1px_rgba(228,228,231,1)] dark:sm:hover:shadow-[inset_0_0_0_1px_rgba(63,63,70,1)]',
                      )}
                    >
                      {section}
                    </button>
                  )
                })}
              </div>

              <label className="relative mt-3 block">
                <span className="sr-only">Search subject offerings</span>
                <Search
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400"
                  aria-hidden
                />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search code, title, or schedule…"
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white pr-4 pl-10 text-sm text-brand-950 outline-none placeholder:text-zinc-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-400 dark:focus:ring-brand-500/25"
                />
              </label>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-2 px-5 py-12 text-[13px] text-zinc-500">
                <Loader2 className="size-5 animate-spin text-zinc-400" aria-hidden />
                Loading class offerings…
              </div>
            ) : loadError ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-semibold text-brand-950">Could not load offerings</p>
                <p className="mt-1 text-[13px] leading-5 text-zinc-500">{loadError}</p>
              </div>
            ) : offerings.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <BookOpen className="mx-auto size-8 text-brand-600/35" strokeWidth={1.4} aria-hidden />
                <p className="mt-3 text-sm font-semibold text-brand-950">No class offerings yet</p>
                <p className="mt-1 text-[13px] leading-5 text-zinc-500">
                  Published offerings will appear here once added in Admin.
                </p>
              </div>
            ) : totalRecords === 0 ? (
              <div className="px-5 py-10 text-center">
                <Search className="mx-auto size-8 text-brand-600/35" strokeWidth={1.4} aria-hidden />
                <p className="mt-3 text-sm font-semibold text-brand-950">No matching offerings</p>
                <p className="mt-1 text-[13px] leading-5 text-zinc-500">
                  Try another section filter or search.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setSectionFilter('All')
                  }}
                  className="mt-4 inline-flex h-9 items-center justify-center rounded-full bg-brand-700 px-4 text-[13px] font-semibold text-white hover:bg-brand-800"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {visibleOfferings.map((item) => {
                  const isSelected = selectedIds.includes(item.id)
                  const hasConflict = conflictIds.has(item.id)
                  const isFull = offeringIsFull(item)
                  const canToggle = isSelected || !isFull
                  const statusLabel = isSelected
                    ? hasConflict
                      ? 'Conflict'
                      : 'Added'
                    : isFull
                      ? 'Full'
                      : null

                  return (
                    <li key={item.id}>
                      <div
                        role={canToggle ? 'button' : undefined}
                        tabIndex={canToggle ? 0 : undefined}
                        aria-disabled={!canToggle}
                        aria-pressed={isSelected || undefined}
                        onClick={() => {
                          if (!canToggle) return
                          toggleOffering(item)
                        }}
                        onKeyDown={(event) => {
                          if (!canToggle) return
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            toggleOffering(item)
                          }
                        }}
                        className={cn(
                          'group flex items-start gap-3 px-4 py-3.5 outline-none transition-colors sm:px-5',
                          canToggle &&
                            'cursor-pointer focus-visible:bg-brand-50/70 dark:focus-visible:bg-brand-500/10',
                          !canToggle && 'cursor-not-allowed opacity-70',
                          isSelected
                            ? hasConflict
                              ? 'bg-rose-50/60 dark:bg-rose-500/[0.08]'
                              : 'bg-brand-50/40 dark:bg-brand-500/[0.08]'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[10px] font-semibold tracking-[0.08em] text-brand-700 uppercase dark:text-brand-300">
                            {item.code}
                            <span className="mx-1.5 font-normal tracking-normal text-zinc-300 dark:text-zinc-600">
                              ·
                            </span>
                            <span className="font-medium tracking-normal text-zinc-500 normal-case dark:text-zinc-400">
                              {item.section}
                            </span>
                          </p>

                          <p className="mt-1 text-[13px] leading-[1.35] font-semibold text-zinc-900 dark:text-zinc-50">
                            {item.title}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
                            <span className="font-medium tabular-nums text-zinc-600 dark:text-zinc-300">
                              {item.units} {item.units === 1 ? 'unit' : 'units'}
                            </span>
                            <span aria-hidden className="text-zinc-300 dark:text-zinc-600">
                              |
                            </span>
                            <span>{item.days.join(', ')}</span>
                            <span aria-hidden className="text-zinc-300 dark:text-zinc-600">
                              |
                            </span>
                            <span className="min-w-0 truncate">
                              {item.timeLabel.replace(/^.*?·\s*/, '') || item.timeLabel}
                            </span>
                            {statusLabel ? (
                              <>
                                <span aria-hidden className="text-zinc-300 dark:text-zinc-600">
                                  |
                                </span>
                                <span
                                  className={cn(
                                    'font-semibold',
                                    isSelected && hasConflict
                                      ? 'text-rose-600 dark:text-rose-300'
                                      : isSelected
                                        ? 'text-brand-700 dark:text-brand-300'
                                        : 'text-zinc-400',
                                  )}
                                >
                                  {statusLabel}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>

                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={(event) => {
                            event.stopPropagation()
                            if (!canToggle) return
                            toggleOffering(item)
                          }}
                          disabled={!canToggle}
                          aria-label={
                            isSelected
                              ? `Remove ${item.code} from draft`
                              : isFull
                                ? `${item.code} is full`
                                : `Add ${item.code} to draft`
                          }
                          className={cn(
                            'mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors',
                            !canToggle
                              ? 'border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500'
                              : isSelected
                                ? hasConflict
                                  ? 'border-rose-200 bg-rose-600 text-white hover:bg-rose-700 dark:border-rose-500/40'
                                  : 'border-brand-700 bg-brand-700 text-white hover:bg-brand-800 dark:border-brand-500 dark:bg-brand-600'
                                : 'border-zinc-200 bg-white text-brand-700 hover:border-brand-300 hover:bg-brand-50 group-hover:border-brand-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-brand-300 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/10',
                          )}
                        >
                          {isSelected ? (
                            hasConflict ? (
                              <AlertTriangle className="size-3.5" aria-hidden />
                            ) : (
                              <CheckCircle2 className="size-3.5" aria-hidden />
                            )
                          ) : isFull ? (
                            <X className="size-3.5" aria-hidden />
                          ) : (
                            <Plus className="size-3.5" aria-hidden />
                          )}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {totalRecords > 0 ? (
            <div
              role="navigation"
              aria-label="Offerings pagination"
              className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white px-3.5 py-3 sm:px-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                <div className="inline-flex items-center gap-2 text-[12px] text-zinc-500">
                  <span className="font-semibold tracking-[0.12em] text-zinc-400 uppercase">
                    Show
                  </span>
                  <OfferingPageSizeDropdown value={pageSize} onChange={setPageSize} />
                </div>
                <p className="text-[12px] tabular-nums text-zinc-500">
                  <span className="sm:hidden">
                    <span className="font-semibold text-brand-950 dark:text-zinc-50">
                      {showingFrom}–{showingTo}
                    </span>
                    <span className="text-zinc-400"> / </span>
                    <span className="font-semibold text-brand-950 dark:text-zinc-50">
                      {totalRecords}
                    </span>
                  </span>
                  <span className="hidden sm:inline">
                    Showing{' '}
                    <span className="font-semibold text-brand-950 dark:text-zinc-50">
                      {showingFrom}
                    </span>
                    <span className="text-zinc-400"> – </span>
                    <span className="font-semibold text-brand-950 dark:text-zinc-50">
                      {showingTo}
                    </span>
                    <span className="text-zinc-400"> of </span>
                    <span className="font-semibold text-brand-950 dark:text-zinc-50">
                      {totalRecords}
                    </span>
                  </span>
                </p>
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-[12px] font-semibold text-brand-950 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <ChevronLeft className="size-3.5" aria-hidden />
                  <span className="hidden min-[380px]:inline">Prev</span>
                </button>
                <div className="flex max-w-[12rem] items-center gap-1 overflow-x-auto sm:max-w-none">
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => {
                    const selectedPage = pageNumber === currentPage
                    return (
                      <button
                        key={pageNumber}
                        type="button"
                        aria-label={`Page ${pageNumber}`}
                        aria-current={selectedPage ? 'page' : undefined}
                        onClick={() => setPage(pageNumber)}
                        className={cn(
                          'inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold tabular-nums transition-colors',
                          selectedPage
                            ? 'bg-brand-700 text-white'
                            : 'border border-zinc-200 bg-white text-brand-950 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
                        )}
                      >
                        {pageNumber}
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-[12px] font-semibold text-brand-950 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <span className="hidden min-[380px]:inline">Next</span>
                  <ChevronRight className="size-3.5" aria-hidden />
                </button>
              </div>
            </div>
          ) : null}
        </Reveal>

        <Reveal
          delay={0.08}
          className={cn(
            'min-w-0 scroll-mt-24 lg:h-full',
            mobilePane === 'schedule' ? 'block' : 'hidden lg:block',
          )}
        >
          <div
            id="class-builder-schedule"
            className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white sm:rounded-[1.5rem] dark:border-zinc-800 dark:bg-zinc-900 lg:sticky lg:top-24"
          >
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-zinc-100 px-4 py-3.5 sm:gap-3 sm:px-5 sm:py-4 dark:border-zinc-800">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-[0.14em] text-zinc-400 uppercase sm:text-[11px]">
                  Weekly schedule
                </p>
                <p className="mt-1 text-[13px] font-semibold text-brand-950 sm:text-sm dark:text-zinc-50">
                  Mon–Sun
                  <span className="font-medium text-zinc-500">
                    {' '}
                    · {formatHour(scheduleHours[0])}–
                    {formatHour(scheduleHours[scheduleHours.length - 1] + 1)}
                  </span>
                </p>
              </div>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase sm:px-3 sm:text-[11px]',
                  selected.length === 0
                    ? 'bg-zinc-100 text-zinc-500'
                    : conflicts.length
                      ? 'bg-amber-50 text-amber-800'
                      : 'bg-emerald-50 text-emerald-700',
                )}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    selected.length === 0
                      ? 'bg-zinc-300'
                      : conflicts.length
                        ? 'bg-amber-500'
                        : 'bg-emerald-500',
                  )}
                  aria-hidden
                />
                {selected.length === 0
                  ? 'Empty'
                  : conflicts.length
                    ? 'Has conflicts'
                    : 'Conflict-free'}
              </span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
              {selected.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 px-5 py-8 text-center dark:border-zinc-700 dark:bg-zinc-900/60 sm:min-h-[22rem] sm:py-10">
                  <BookOpen
                    className="mx-auto size-8 text-brand-600/35"
                    strokeWidth={1.4}
                    aria-hidden
                  />
                  <p className="mt-3 text-sm font-semibold text-brand-950 dark:text-zinc-50">
                    No subjects selected
                  </p>
                  <p className="mt-1 max-w-[18rem] text-[13px] leading-5 text-zinc-500">
                    Choose a section, then Add offerings to fill this week.
                  </p>
                  <button
                    type="button"
                    onClick={() => setMobilePane('catalog')}
                    className="mt-4 inline-flex h-9 items-center justify-center rounded-full bg-brand-700 px-4 text-[13px] font-semibold text-white hover:bg-brand-800 lg:hidden"
                  >
                    Browse offerings
                  </button>
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-x-auto overflow-y-visible [-webkit-overflow-scrolling:touch]">
                  <div className="min-w-[36rem] sm:min-w-[40rem]">
                    <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] gap-1.5">
                      <div aria-hidden className="self-end pb-1" />
                      {DAYS.map((day) => (
                        <div
                          key={day}
                          className="rounded-lg bg-brand-50/70 px-0.5 py-2 text-center text-[10px] font-semibold tracking-wide text-brand-800 uppercase sm:text-[11px] dark:bg-brand-500/10 dark:text-brand-200"
                        >
                          {day}
                        </div>
                      ))}
                    </div>

                    <div
                      className="relative mt-2 grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] gap-1.5 overflow-hidden rounded-xl border border-zinc-100 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                      style={{
                        height: scheduleHours.length * HOUR_PX + GRID_PAD_Y * 2,
                      }}
                    >
                      <div className="relative border-r border-zinc-100 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-900/80">
                        {scheduleHours.map((hour) => (
                          <div
                            key={hour}
                            className="pointer-events-none absolute inset-x-0 flex -translate-y-1/2 justify-end pr-1.5 sm:pr-2"
                            style={{
                              top: GRID_PAD_Y + (hour - scheduleHours[0]) * HOUR_PX,
                            }}
                          >
                            <span className="whitespace-nowrap text-[10px] font-medium leading-none text-zinc-500 tabular-nums sm:text-[11px] dark:text-zinc-400">
                              {formatHour(hour)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {DAYS.map((day, dayIndex) => (
                        <div
                          key={day}
                          className={cn(
                            'relative',
                            dayIndex % 2 === 0
                              ? 'bg-white dark:bg-zinc-950'
                              : 'bg-zinc-50/40 dark:bg-zinc-900/40',
                          )}
                        >
                          {scheduleHours.map((hour) => (
                            <div
                              key={`${day}-${hour}`}
                              className="absolute inset-x-0 border-t border-zinc-100 dark:border-zinc-800/80"
                              style={{
                                top: GRID_PAD_Y + (hour - scheduleHours[0]) * HOUR_PX,
                                height: HOUR_PX,
                              }}
                            />
                          ))}
                          {selected
                            .filter((item) => item.days.includes(day))
                            .map((item) => {
                              const hours = effectiveHours(item)
                              const top =
                                GRID_PAD_Y + (hours.start - scheduleHours[0]) * HOUR_PX
                              const height = Math.max(
                                (hours.end - hours.start) * HOUR_PX - 6,
                                28,
                              )
                              const conflicted = conflictIds.has(item.id)
                              const tone = subjectTone(item.code)
                              return (
                                <button
                                  key={`${day}-${item.id}`}
                                  type="button"
                                  title={`${item.code} · ${item.title} — click to remove`}
                                  onClick={() => toggleOffering(item)}
                                  className={cn(
                                    'absolute inset-x-1 z-[1] overflow-hidden rounded-lg px-1.5 py-1 text-left text-[10px] leading-tight text-white shadow-sm',
                                    tone.block,
                                    conflicted &&
                                      'ring-2 ring-rose-500 ring-offset-1 dark:ring-offset-zinc-900',
                                  )}
                                  style={{ top: top + 3, height }}
                                >
                                  <p className="font-bold">{item.code}</p>
                                  <p className="truncate opacity-90">{item.section}</p>
                                </button>
                              )
                            })}
                        </div>
                      ))}
                    </div>

                    <ul className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                      {selected.map((item) => {
                        const tone = subjectTone(item.code)
                        const conflicted = conflictIds.has(item.id)
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => toggleOffering(item)}
                              title="Remove from draft"
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors',
                                conflicted
                                  ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200'
                                  : 'border-zinc-200 bg-zinc-50 text-brand-950 hover:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800',
                              )}
                            >
                              <span className={cn('size-2.5 rounded-sm', tone.dot)} aria-hidden />
                              {item.code}
                              <X className="size-3 opacity-50" aria-hidden />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Reveal>
      </div>
      <Snackbar toast={snack} onDismiss={dismissSnack} />
    </div>
  )
}
