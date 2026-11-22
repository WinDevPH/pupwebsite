import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Banknote,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  Clock3,
  Copy,
  Download,
  Eye,
  FileImage,
  GraduationCap,
  ImagePlus,
  Loader2,
  LoaderCircle,
  Printer,
  ScrollText,
  Send,
  type LucideIcon,
} from 'lucide-react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { motion } from 'motion/react'
import logoCol from '@/assets/pup-col-logo.png'
import logoSc from '@/assets/pup-col-sc-seal.png'
import { Reveal } from '@/components/motion/Reveal'
import { Button } from '@/components/ui/button'
import { SectionKicker } from '@/components/ui/SectionKicker'
import { Snackbar, type SnackToast, type SnackVariant } from '@/components/ui/Snackbar'
import { submitAppointment } from '@/lib/enrollment-appointments-api'
import {
  getRoutingBundle,
  type EnrollmentPaymentChannel,
  type EnrollmentRoutingStep,
} from '@/lib/enrollment-routing-api'
import { renderLogoWithWhiteOutline } from '@/lib/logo-render'
import { popIn } from '@/lib/motion'
import {
  defaultEnrollmentPayment,
  getEnrollmentPayment,
  mergeEnrollmentPayment,
  type EnrollmentPaymentSettings,
} from '@/lib/site-settings-api'
import { cn } from '@/lib/utils'

type ExportKind = 'png' | 'pdf' | 'print'

type YearLevel = string
type Classification = 'regular' | 'irregular'
type PaymentMode = '' | 'bank' | 'cash'
type MobilePane = 'form' | 'preview'

type SlipOption = {
  id?: number
  value: string
  label: string
  /** Clean label without seat counts, used when submitting the appointment. */
  plainLabel?: string
  description?: string
  icon?: ReactNode
  disabled?: boolean
}

type PaymentChannelView = {
  id: string
  title: string
  lines: string[]
  copyValue: string
}

type RoutingStepView = {
  step: string
  office: string
  signatureNote?: string
}

const paymentModeOptions: SlipOption[] = [
  { value: '', label: 'Select payment mode', description: 'Required for SC contribution verification' },
  { value: 'bank', label: 'Bank Account', description: 'Bank deposit / transfer', icon: <Building2 className="size-4" /> },
  { value: 'cash', label: 'Cash (On-site)', description: 'Pay at SC verification desk', icon: <Banknote className="size-4" /> },
]

function applyBankSettings(
  channels: EnrollmentPaymentChannel[],
  bank: EnrollmentPaymentSettings,
): PaymentChannelView[] {
  return channels.map((channel) => {
    if (channel.key !== 'bank') {
      return {
        id: channel.key || String(channel.id),
        title: channel.title,
        lines: channel.lines,
        copyValue: channel.copyValue,
      }
    }
    const accountNumber = bank.accountNumber.trim()
    const displayNumber = accountNumber || 'To follow'
    return {
      id: channel.key || String(channel.id),
      title: bank.bankName.trim() || channel.title,
      lines: [bank.accountName.trim() || channel.lines[0] || 'PUP COL SC, Inc.', displayNumber],
      copyValue: accountNumber || displayNumber,
    }
  })
}

function mapSteps(steps: EnrollmentRoutingStep[]): RoutingStepView[] {
  return steps.map((step) => ({
    step: step.step,
    office: step.office,
    signatureNote: step.signatureNote ?? undefined,
  }))
}

const fieldCls =
  'h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm text-brand-950 outline-none transition placeholder:text-zinc-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-400 dark:focus:ring-brand-500/25'

const fieldErrorCls =
  'border-maroon-400 focus:border-maroon-500 focus:ring-maroon-100 dark:border-maroon-400/70 dark:focus:border-maroon-400 dark:focus:ring-maroon-500/20'

const labelCls =
  'mb-1.5 block text-[10px] font-semibold tracking-[0.14em] text-zinc-400 uppercase sm:text-[11px]'

const sectionTitleCls =
  'text-[10px] font-semibold tracking-[0.14em] text-zinc-400 uppercase sm:text-[11px]'

function formatDateLabel(value: string, dates: SlipOption[]) {
  return dates.find((item) => item.value === value)?.label ?? value
}

function hasRecordId(id: number | undefined): id is number {
  return typeof id === 'number' && Number.isFinite(id) && id > 0
}

function slotIsFull(slot: { full: boolean; remaining: number }) {
  return slot.full === true || slot.remaining <= 0
}


const PREVIEW_SHEET_WIDTH = 720

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

type ExportSlipData = {
  logoColDataUrl: string
  logoScDataUrl: string
  termBanner: string
  fullName: string
  studentNumber: string
  yearLevel: string
  classificationLabel: string
  enrollmentDateLabel: string
  timeSlot: string
  checkStanding: boolean
  checkSchedule: boolean
  checkPetition: boolean
  referenceNo: string
  paymentMode: string
}

/** Hex-only slip markup for html2canvas (no Tailwind / oklch). Mirrors live preview layout. */
function buildExportSlipHtml(data: ExportSlipData, routingSteps: RoutingStepView[]) {
  // One SVG per check row (box + label baked together) — forces top/bottom align in html2canvas.
  const checkRow = (on: boolean, label: string) => {
    const height = 14
    const box = 11
    const boxY = (height - box) / 2
    const width = Math.max(120, Math.ceil(20 + label.length * 5.7))
    const boxMarkup = on
      ? `<rect x="0.75" y="${boxY}" width="${box}" height="${box}" fill="#5f18b8" stroke="#5f18b8" stroke-width="1.5"/><rect x="3.1" y="${boxY + 2.35}" width="6.3" height="6.3" fill="#ffffff"/>`
      : `<rect x="0.75" y="${boxY}" width="${box}" height="${box}" fill="#ffffff" stroke="#71717a" stroke-width="1.5"/>`
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${boxMarkup}<text x="18" y="10.5" font-family="Arial,Helvetica,sans-serif" font-size="10" fill="#3f3f46">${escapeHtml(label)}</text></svg>`
    return `<img src="data:image/svg+xml,${encodeURIComponent(svg)}" width="${width}" height="${height}" alt="${escapeHtml(label)}" style="display:block;width:${width}px;height:${height}px;border:0;margin:0;padding:0;" />`
  }

  const badgeSvg = (n: number) =>
    `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><rect width="22" height="22" rx="6" fill="#ede2ff"/><text x="11" y="15" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="800" fill="#5f18b8">${n}</text></svg>`,
    )}`

  const stepBadge = (n: number) =>
    `<img src="${badgeSvg(n)}" width="22" height="22" alt="${n}" style="display:block;width:22px;height:22px;border:0;" />`

  const stepRows = routingSteps
    .map((row, index) => {
      const remark =
        index === 1 && data.referenceNo.trim()
          ? `OR/Ref: ${escapeHtml(data.referenceNo.trim())}${
              data.paymentMode ? ` (${escapeHtml(data.paymentMode)})` : ''
            }`
          : '<span style="color:#c4b5d8;">—</span>'
      const title = escapeHtml(row.step.replace(/^\d+\.\s*/, ''))
      const office = escapeHtml(row.office)
      const signatureCell = row.signatureNote
        ? `<div style="font-size:8px;line-height:1.35;color:#71717a;font-style:italic;word-break:break-word;">${escapeHtml(row.signatureNote)}</div>`
        : `<div style="padding-top:14px;"><div style="border-bottom:1.25px solid #a78bc9;height:1px;font-size:0;line-height:0;">&nbsp;</div></div>`
      return `<tr style="background:${index % 2 ? '#faf7ff' : '#ffffff'};">
        <td style="width:46%;border-top:1px solid #e8dff5;border-right:1px solid #e8dff5;padding:11px 10px;" valign="middle">
          <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;table-layout:fixed;">
            <tr>
              <td width="30" valign="middle" style="width:30px;padding:0 8px 0 0;">${stepBadge(index + 1)}</td>
              <td valign="middle" style="padding:0;">
                <div style="margin:0;padding:0;font-size:11px;font-weight:700;color:#1e0541;line-height:14px;">${title}</div>
                <div style="margin:2px 0 0;padding:0;font-size:9px;color:#71717a;line-height:12px;">${office}</div>
              </td>
            </tr>
          </table>
        </td>
        <td style="width:24%;border-top:1px solid #e8dff5;border-right:1px solid #e8dff5;padding:11px 10px;" valign="middle">
          <div style="font-size:9px;line-height:1.35;color:#52525b;word-break:break-word;">${remark}</div>
        </td>
        <td style="width:30%;border-top:1px solid #e8dff5;padding:11px 10px;" valign="middle">
          ${signatureCell}
        </td>
      </tr>`
    })
    .join('')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body { margin: 0; padding: 0; background: #ffffff; }
    * { box-sizing: border-box; }
  </style>
</head>
<body>
  <div id="slip" style="width:${PREVIEW_SHEET_WIDTH}px;margin:0 auto;background:#ffffff;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1e0541;">
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#ffffff;color:#1e0541;">
      <tr>
        <td style="width:128px;padding:14px 10px 14px 28px;vertical-align:middle;">
          <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr>
              <td style="padding:0 6px 0 0;vertical-align:middle;">
                <img src="${data.logoColDataUrl}" alt="College of Law" width="44" height="44" style="display:block;width:44px;height:44px;object-fit:contain;background:transparent;padding:0;" />
              </td>
              <td style="padding:0;vertical-align:middle;">
                <img src="${data.logoScDataUrl}" alt="Student Council" width="44" height="44" style="display:block;width:44px;height:44px;object-fit:contain;background:transparent;padding:0;" />
              </td>
            </tr>
          </table>
        </td>
        <td style="padding:14px 12px;vertical-align:middle;text-align:center;">
          <div style="margin:0;font-size:10px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;line-height:1.2;color:#5f18b8;">Polytechnic University of the Philippines</div>
          <div style="margin:2px 0 0;font-size:8px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;line-height:1.2;color:#111111;">College of Law Student Council, Inc.</div>
          <div style="margin:6px 0 0;font-size:13px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;line-height:1.15;color:#111111;">Enrollment Routing Slip</div>
          ${
            data.termBanner
              ? `<div style="margin:3px 0 0;font-size:8px;font-weight:500;letter-spacing:0.03em;line-height:1.25;color:#111111;">${escapeHtml(data.termBanner)}</div>`
              : ''
          }
        </td>
        <td style="width:128px;padding:14px 16px;">&nbsp;</td>
      </tr>
      <tr>
        <td colspan="3" style="height:1.5px;padding:0;background:#5f18b8;font-size:0;line-height:0;">&nbsp;</td>
      </tr>
    </table>

    <div style="padding:18px 20px 20px;">
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e4e4e7;table-layout:fixed;margin:0 0 16px;">
        <tr>
          <td style="width:50%;padding:10px 12px;vertical-align:top;border-right:1px solid #e4e4e7;border-bottom:1px solid #e4e4e7;">
            <div style="margin:0 0 5px;font-size:8px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#5f18b8;line-height:1.2;">Full Name</div>
            <div style="margin:0;font-size:12px;font-weight:700;color:#1e0541;line-height:1.35;word-break:break-word;">${escapeHtml(data.fullName || '—')}</div>
          </td>
          <td style="width:50%;padding:10px 12px;vertical-align:top;border-bottom:1px solid #e4e4e7;">
            <div style="margin:0 0 5px;font-size:8px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#5f18b8;line-height:1.2;">Student Number</div>
            <div style="margin:0;font-size:12px;font-weight:700;color:#1e0541;line-height:1.35;word-break:break-word;">${escapeHtml(data.studentNumber || '—')}</div>
          </td>
        </tr>
        <tr>
          <td style="width:50%;padding:10px 12px;vertical-align:top;border-right:1px solid #e4e4e7;">
            <div style="margin:0 0 5px;font-size:8px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#5f18b8;line-height:1.2;">Year Level &amp; Classification</div>
            <div style="margin:0;font-size:12px;font-weight:700;color:#1e0541;line-height:1.35;word-break:break-word;">${escapeHtml(`${data.yearLevel} | ${data.classificationLabel}`)}</div>
          </td>
          <td style="width:50%;padding:10px 12px;vertical-align:top;">
            <div style="margin:0 0 5px;font-size:8px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#5f18b8;line-height:1.2;">Scheduled Date &amp; Hourly Slot</div>
            <div style="margin:0;font-size:12px;font-weight:700;color:#1e0541;line-height:1.35;word-break:break-word;">${escapeHtml(`${data.enrollmentDateLabel} | ${data.timeSlot}`)}</div>
          </td>
        </tr>
      </table>

      <div style="margin:0 0 8px;font-size:10px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#5f18b8;">Pre-Enrollment Checks</div>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e4e4e7;background:#faf7ff;table-layout:fixed;margin:0 0 16px;">
        <tr>
          <td style="width:33.33%;padding:10px 12px;vertical-align:middle;border-right:1px solid #e4e4e7;">${checkRow(data.checkStanding, 'Academic Standing')}</td>
          <td style="width:33.33%;padding:10px 12px;vertical-align:middle;border-right:1px solid #e4e4e7;">${checkRow(data.checkSchedule, 'Class Schedule')}</td>
          <td style="width:33.33%;padding:10px 12px;vertical-align:middle;">${checkRow(data.checkPetition, 'Petition / Appeal')}</td>
        </tr>
      </table>

      <div style="margin:0 0 8px;font-size:10px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#5f18b8;">Routing Stations</div>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e0d0f2;table-layout:fixed;">
        <thead>
          <tr>
            <th style="width:46%;background:#f3e9ff;color:#5f18b8;font-size:8px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;text-align:left;padding:9px 10px;border-bottom:1px solid #e0d0f2;border-right:1px solid #e0d0f2;">Step / Station</th>
            <th style="width:24%;background:#f3e9ff;color:#5f18b8;font-size:8px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;text-align:left;padding:9px 10px;border-bottom:1px solid #e0d0f2;border-right:1px solid #e0d0f2;">Remarks</th>
            <th style="width:30%;background:#f3e9ff;color:#5f18b8;font-size:7.5px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;text-align:left;padding:9px 10px;border-bottom:1px solid #e0d0f2;">Signature of Authorized Personnel</th>
          </tr>
        </thead>
        <tbody>${stepRows}</tbody>
      </table>

      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;table-layout:fixed;margin-top:28px;">
        <tr>
          <td style="width:100%;padding:0;vertical-align:top;">
            <div style="max-width:320px;margin:0 auto;">
              <div style="border-bottom:1.5px solid #5f18b8;height:30px;font-size:0;line-height:0;">&nbsp;</div>
              <div style="margin:7px 0 0;text-align:center;font-size:9px;color:#52525b;line-height:1.3;">Student’s Signature over Printed Name</div>
            </div>
          </td>
        </tr>
      </table>

      <div style="margin:16px 0 0;padding-top:10px;border-top:1px solid #e4e4e7;font-size:8px;line-height:1.45;color:#71717a;">
        Bring this slip to each station in order. Keep SC Contribution proof for Step 2. · PUP COL SC Enrollment Hub
      </div>
    </div>
  </div>
</body>
</html>`
}


export function RoutingSlipPanel() {
  const previewRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [mobilePane, setMobilePane] = useState<MobilePane>('form')
  const [fullName, setFullName] = useState('')
  const [studentNumber, setStudentNumber] = useState('')
  const [yearLevel, setYearLevel] = useState<YearLevel>('')
  const [classification, setClassification] = useState<Classification>('regular')
  const [enrollmentDate, setEnrollmentDate] = useState('')
  const [timeSlot, setTimeSlot] = useState('')
  const [checkStanding, setCheckStanding] = useState(false)
  const [checkSchedule, setCheckSchedule] = useState(false)
  const [checkPetition, setCheckPetition] = useState(false)
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('')
  const [referenceNo, setReferenceNo] = useState('')
  const [proofName, setProofName] = useState('')
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState<ExportKind | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [trackingCode, setTrackingCode] = useState('')
  const [snack, setSnack] = useState<SnackToast | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [termBanner, setTermBanner] = useState('')
  const [scFeeLabel, setScFeeLabel] = useState('')
  const [yearLevelOptions, setYearLevelOptions] = useState<SlipOption[]>([])
  const [enrollmentDateOptions, setEnrollmentDateOptions] = useState<SlipOption[]>([])
  const [timeSlotOptions, setTimeSlotOptions] = useState<SlipOption[]>([])
  const [paymentChannels, setPaymentChannels] = useState<PaymentChannelView[]>([])
  const [routingSteps, setRoutingSteps] = useState<RoutingStepView[]>([])
  const snackId = useRef(0)
  const snackTimer = useRef<number | null>(null)
  const [touched, setTouched] = useState({
    fullName: false,
    studentNumber: false,
    paymentMode: false,
    referenceNo: false,
    proof: false,
  })

  useEffect(() => {
    return () => {
      if (snackTimer.current) window.clearTimeout(snackTimer.current)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void Promise.all([getRoutingBundle(), getEnrollmentPayment()]).then(
      ([bundleResult, bankResult]) => {
        if (cancelled) return
        if (!bundleResult.ok) {
          setLoadError(bundleResult.error)
          setLoading(false)
          return
        }
        const bank = mergeEnrollmentPayment(
          defaultEnrollmentPayment,
          bankResult.ok ? bankResult.data.enrollment : null,
        )
        const bundle = bundleResult.data
        const years = (bundle.settings.yearLevels ?? []).map((item) => ({
          value: item.value,
          label: item.label,
          description: item.description,
          icon: <GraduationCap className="size-4" />,
        }))
        const dates = bundle.dates.map((item) => ({
          id: item.id,
          value: item.value,
          label: item.label,
          description: item.description,
          icon: <CalendarDays className="size-4" />,
        }))
        const slots = bundle.slots.map((item) => {
          const base = item.label || item.value
          return {
            id: item.id,
            value: item.value,
            label: base,
            plainLabel: base,
            description: item.description,
            disabled: slotIsFull(item),
            icon: <Clock3 className="size-4" />,
          }
        })
        setTermBanner(bundle.settings.termBanner || '')
        setScFeeLabel(bundle.settings.scFeeLabel || '')
        setYearLevelOptions(years)
        setEnrollmentDateOptions(dates)
        setTimeSlotOptions(slots)
        setPaymentChannels(applyBankSettings(bundle.channels, bank))
        setRoutingSteps(mapSteps(bundle.steps))
        setYearLevel((prev) => (prev && years.some((y) => y.value === prev) ? prev : years[0]?.value || ''))
        setEnrollmentDate((prev) =>
          prev && dates.some((d) => d.value === prev) ? prev : dates[0]?.value || '',
        )
        setTimeSlot((prev) => {
          if (prev) {
            const current = slots.find((item) => item.value === prev && !item.disabled)
            if (current) return prev
          }
          return slots.find((item) => !item.disabled)?.value || ''
        })
        setLoadError('')
        setLoading(false)
      },
    )
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

  const nameOk = fullName.trim().length >= 3
  const studentNoOk = studentNumber.trim().length >= 5
  const paymentModeOk = paymentMode !== ''
  const referenceOk = referenceNo.trim().length >= 4
  const proofOk = Boolean(proofPreview)

  const selectedDateOption = enrollmentDateOptions.find((item) => item.value === enrollmentDate)
  const selectedSlotOption = timeSlotOptions.find((item) => item.value === timeSlot)
  const scheduleOk =
    hasRecordId(selectedDateOption?.id) &&
    hasRecordId(selectedSlotOption?.id) &&
    !selectedSlotOption?.disabled
  const canExport = nameOk && studentNoOk && paymentModeOk && referenceOk && proofOk && scheduleOk
  const classificationLabel = classification === 'regular' ? 'Regular' : 'Irregular'
  const paymentModeLabel =
    paymentModeOptions.find((item) => item.value === paymentMode)?.label ?? paymentMode
  const checksDone = [checkStanding, checkSchedule, checkPetition].filter(Boolean).length
  const isExporting = exportBusy !== null

  function markTouched(key: keyof typeof touched) {
    setTouched((current) => (current[key] ? current : { ...current, [key]: true }))
  }

  function touchFormEdit() {
    if (submitted) {
      setSubmitted(false)
      setTrackingCode('')
    }
  }

  function markAllTouched() {
    setTouched({
      fullName: true,
      studentNumber: true,
      paymentMode: true,
      referenceNo: true,
      proof: true,
    })
  }

  async function submitSlip() {
    markAllTouched()
    if (!canExport || submitting) return
    if (!proofFile) {
      showSnackbar('Attach a clear image of your payment proof.', 'error')
      return
    }

    const selectedDate = enrollmentDateOptions.find((item) => item.value === enrollmentDate)
    const selectedSlot = timeSlotOptions.find((item) => item.value === timeSlot)
    if (!selectedDate || !hasRecordId(selectedDate.id)) {
      showSnackbar('Select an enrollment date.', 'error')
      return
    }
    if (!selectedSlot || !hasRecordId(selectedSlot.id) || selectedSlot.disabled) {
      showSnackbar('Select an open hourly time slot.', 'error')
      return
    }

    const dateLabel = selectedDate.label || enrollmentDate
    const slotLabel = selectedSlot.plainLabel || selectedSlot.label || timeSlot

    const form = new FormData()
    form.set('fullName', fullName.trim())
    form.set('studentNumber', studentNumber.trim())
    form.set('yearLevel', yearLevel)
    form.set('classification', classification)
    form.set('enrollmentDate', enrollmentDate)
    form.set('enrollmentDateLabel', dateLabel)
    form.set('dateId', String(selectedDate.id))
    form.set('timeSlot', timeSlot)
    form.set('timeSlotLabel', slotLabel)
    form.set('slotId', String(selectedSlot.id))
    form.set('checkStanding', checkStanding ? '1' : '0')
    form.set('checkSchedule', checkSchedule ? '1' : '0')
    form.set('checkPetition', checkPetition ? '1' : '0')
    form.set('paymentMode', paymentModeLabel || paymentMode)
    form.set('referenceNo', referenceNo.trim())
    form.set('proof', proofFile)

    setSubmitting(true)
    try {
      const result = await submitAppointment(form)
      if (!result.ok) {
        showSnackbar(result.error, 'error')
        return
      }
      setSubmitted(true)
      setTrackingCode(result.data.item.trackingCode)
      setMobilePane('preview')
      showSnackbar(
        `Appointment submitted (${result.data.item.trackingCode}). You can download PNG/PDF or print your slip.`,
        'success',
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not submit the routing slip.'
      showSnackbar(message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const bookingReady =
    yearLevelOptions.length > 0 &&
    enrollmentDateOptions.length > 0 &&
    timeSlotOptions.length > 0 &&
    routingSteps.length > 0

  const fileSafeName = useMemo(() => {
    const base = (studentNumber.trim() || fullName.trim() || 'routing-slip')
      .replace(/[^\w\-]+/g, '_')
      .slice(0, 40)
    return `enrollment-routing-slip-${base}`
  }, [fullName, studentNumber])

  async function copyText(id: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedId(id)
      window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1600)
      showSnackbar('Copied to clipboard.', 'success')
    } catch {
      showSnackbar('Could not copy. Please copy the details manually.', 'error')
    }
  }

  function onProofChange(file: File | null) {
    if (!file) {
      setProofName('')
      setProofPreview(null)
      setProofFile(null)
      return
    }
    if (!file.type.startsWith('image/')) return
    setProofFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      setProofName(file.name)
      setProofPreview(String(reader.result))
    }
    reader.readAsDataURL(file)
  }

  async function capturePreview() {
    // Hex-only isolated document — never touches Tailwind oklch styles.
    const [logoColDataUrl, logoScDataUrl] = await Promise.all([
      renderLogoWithWhiteOutline(logoCol, 224, {
        headerBg: [255, 255, 255],
        outlinePx: 0,
      }),
      renderLogoWithWhiteOutline(logoSc, 224, {
        headerBg: [255, 255, 255],
        outlinePx: 0,
      }),
    ])
    const html = buildExportSlipHtml(
      {
        logoColDataUrl,
        logoScDataUrl,
        termBanner,
        fullName: fullName.trim(),
        studentNumber: studentNumber.trim(),
        yearLevel,
        classificationLabel,
        enrollmentDateLabel: formatDateLabel(enrollmentDate, enrollmentDateOptions),
        timeSlot,
        checkStanding,
        checkSchedule,
        checkPetition,
        referenceNo: referenceNo.trim(),
        paymentMode: paymentModeLabel,
      },
      routingSteps,
    )

    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText = `position:fixed;left:-12000px;top:0;width:${PREVIEW_SHEET_WIDTH + 40}px;height:1600px;border:0;opacity:0;pointer-events:none;`
    document.body.appendChild(iframe)

    try {
      const idoc = iframe.contentDocument
      if (!idoc) throw new Error('Could not prepare export document.')
      idoc.open()
      idoc.write(html)
      idoc.close()

      const slip = idoc.getElementById('slip')
      if (!slip) throw new Error('Export slip markup is missing.')

      const images = [...slip.querySelectorAll('img')]
      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve()
                return
              }
              img.onload = () => resolve()
              img.onerror = () => resolve()
            }),
        ),
      )
      await new Promise((resolve) => window.setTimeout(resolve, 40))

      const canvas = await html2canvas(slip, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 4000,
        width: PREVIEW_SHEET_WIDTH,
        windowWidth: PREVIEW_SHEET_WIDTH,
        scrollX: 0,
        scrollY: 0,
      })
      if (!canvas.width || !canvas.height) throw new Error('Could not capture the routing slip.')
      return canvas
    } finally {
      iframe.remove()
    }
  }

  async function runExport(kind: ExportKind) {
    if (isExporting || !canExport) return

    setExportBusy(kind)
    try {
      const canvas = await capturePreview()

      if (kind === 'png') {
        const link = document.createElement('a')
        link.download = `${fileSafeName}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
        showSnackbar('PNG downloaded. Routing slip image saved to your device.', 'success')
        return
      }

      if (kind === 'pdf') {
        const img = canvas.toDataURL('image/png')
        const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
        const pageW = doc.internal.pageSize.getWidth()
        const pageH = doc.internal.pageSize.getHeight()
        const margin = 18
        const maxW = pageW - margin * 2
        const maxH = pageH - margin * 2
        const ratio = Math.min(maxW / canvas.width, maxH / canvas.height)
        const drawW = canvas.width * ratio
        const drawH = canvas.height * ratio
        doc.addImage(img, 'PNG', (pageW - drawW) / 2, margin, drawW, drawH)
        doc.save(`${fileSafeName}.pdf`)
        showSnackbar('PDF downloaded. Printable routing slip saved successfully.', 'success')
        return
      }

      // Print via blob URL (avoids blank about:blank / blocked write).
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((next) => resolve(next), 'image/png')
      })
      if (!blob) throw new Error('Could not prepare print image.')
      const imageUrl = URL.createObjectURL(blob)
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Enrollment Routing Slip</title>
  <style>
    @page { size: letter; margin: 0.4in; }
    html, body { margin: 0; background: #fff; }
    body { display: grid; place-items: start center; min-height: 100vh; padding: 12px; }
    img { width: 100%; max-width: 7.5in; height: auto; }
  </style>
</head>
<body>
  <img src="${imageUrl}" alt="Enrollment Routing Slip" />
  <script>
    const img = document.querySelector('img');
    const done = () => { setTimeout(() => window.print(), 120); };
    if (img.complete) done();
    else img.onload = done;
  </script>
</body>
</html>`
      const pageBlob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const pageUrl = URL.createObjectURL(pageBlob)
      const popup = window.open(pageUrl, '_blank', 'width=960,height=720')
      if (!popup) {
        URL.revokeObjectURL(imageUrl)
        URL.revokeObjectURL(pageUrl)
        showSnackbar('Pop-up blocked. Allow pop-ups for this site to print the routing slip.', 'error')
        return
      }
      window.setTimeout(() => {
        URL.revokeObjectURL(imageUrl)
        URL.revokeObjectURL(pageUrl)
      }, 60_000)
      showSnackbar('Print dialog ready. Use the browser print window to finish.', 'info')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed.'
      showSnackbar(message, 'error')
    } finally {
      setExportBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-16 text-[13px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/60">
        <Loader2 className="size-5 animate-spin text-zinc-400" aria-hidden />
        Loading routing slip…
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900/60">
        <ClipboardList className="mx-auto size-10 text-brand-600/40" strokeWidth={1.35} aria-hidden />
        <p className="mt-3 text-base font-semibold text-brand-950 dark:text-zinc-50">
          Could not load routing config
        </p>
        <p className="mt-2 text-sm text-zinc-500">{loadError}</p>
      </div>
    )
  }

  if (!bookingReady) {
    const missing: string[] = []
    if (yearLevelOptions.length === 0) missing.push('year levels')
    if (enrollmentDateOptions.length === 0) missing.push('enrollment dates')
    if (timeSlotOptions.length === 0) missing.push('time slots')
    if (routingSteps.length === 0) missing.push('routing stations')
    return (
      <div className="space-y-6 sm:space-y-8">
        <Reveal>
          <div className="max-w-3xl">
            <SectionKicker icon={ScrollText}>Printable</SectionKicker>
            <h2 className="mt-2 font-hero text-[clamp(1.7rem,1rem+2.2vw,3.1rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950 sm:mt-2.5 dark:text-zinc-50">
              Enrollment <span className="text-brand-600 dark:text-brand-400">Routing Slip</span>
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-5 text-zinc-500 sm:mt-3 sm:text-sm sm:leading-6 dark:text-zinc-400">
              Book an hourly slot and export a print-ready routing slip once appointment booking is
              published.
            </p>
          </div>
        </Reveal>
        <Reveal delay={0.04}>
          <div className="flex w-full flex-col items-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900/60">
            <CalendarDays className="size-10 text-brand-600/40" strokeWidth={1.35} aria-hidden />
            <p className="mt-3 text-base font-semibold text-brand-950 dark:text-zinc-50">
              Appointment booking is not open yet
            </p>
            <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
              Waiting on published {missing.join(', ')}. Check back after officers finish Routing
              Config in Admin.
            </p>
          </div>
        </Reveal>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <Reveal>
        <div className="max-w-3xl">
          <SectionKicker icon={ScrollText}>Printable</SectionKicker>
          <h2 className="mt-2 font-hero text-[clamp(1.7rem,1rem+2.2vw,3.1rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950 sm:mt-2.5 dark:text-zinc-50">
            Enrollment <span className="text-brand-600 dark:text-brand-400">Routing Slip</span>
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-5 text-zinc-500 sm:text-sm sm:leading-6 dark:text-zinc-400">
            Book a slot, attach SC proof, then export your slip.
          </p>
          {termBanner ? (
            <p className="mt-3 text-[12px] font-semibold tracking-wide text-brand-700 dark:text-brand-300">
              {termBanner}
            </p>
          ) : null}
        </div>
      </Reveal>

      <Reveal delay={0.04}>
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white sm:rounded-[1.5rem] dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid grid-cols-2 gap-px bg-zinc-100 sm:grid-cols-4 dark:bg-zinc-800">
            <StatCell label="Year" value={yearLevel} />
            <StatCell label="Class" value={classificationLabel} />
            <StatCell label="Checks" value={`${checksDone}/3`} />
            <StatCell
              label="Status"
              value={submitted ? 'Submitted' : canExport ? 'Ready' : 'Pending'}
              tone={submitted || canExport ? 'ok' : 'muted'}
              icon={submitted || canExport ? Check : ClipboardList}
            />
          </div>
        </div>
      </Reveal>

      {/* Mobile pane switcher */}
      <div className="grid grid-cols-2 gap-2 lg:hidden">
        {(
          [
            { id: 'form' as const, label: 'Intake', icon: ClipboardList },
            { id: 'preview' as const, label: 'Preview', icon: Eye },
          ] as const
        ).map((pane) => {
          const active = mobilePane === pane.id
          const Icon = pane.icon
          return (
            <button
              key={pane.id}
              type="button"
              onClick={() => setMobilePane(pane.id)}
              className={cn(
                'inline-flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition',
                active
                  ? 'border-brand-700 bg-brand-700 text-white dark:border-brand-500 dark:bg-brand-600'
                  : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {pane.label}
            </button>
          )
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        {/* Intake form */}
        <Reveal
          className={cn(mobilePane === 'form' ? 'block' : 'hidden lg:block')}
        >
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white sm:rounded-[1.5rem] dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3.5 sm:px-5 dark:border-zinc-800">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-brand-950 dark:text-zinc-50">
                  Student Intake
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Hourly booking & fee proof
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold tracking-[0.12em] text-emerald-700 uppercase dark:bg-emerald-500/15 dark:text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Sync
              </span>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {/* Student */}
              <section className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
                <p className={sectionTitleCls}>Student</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <label className="block min-w-0">
                    <span className={labelCls}>
                      Full Name <span className="text-brand-600">*</span>
                    </span>
                    <input
                      className={cn(fieldCls, touched.fullName && !nameOk && fieldErrorCls)}
                      value={fullName}
                      onChange={(event) => {
                        touchFormEdit()
                        setFullName(event.target.value)
                      }}
                      onBlur={() => markTouched('fullName')}
                      placeholder="LASTNAME, FIRSTNAME M.I."
                      autoComplete="name"
                      aria-invalid={touched.fullName && !nameOk}
                    />
                    <FieldHint
                      show={touched.fullName && !nameOk}
                      message="Enter your full name (min. 3 characters)."
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className={labelCls}>
                      Student Number <span className="text-brand-600">*</span>
                    </span>
                    <input
                      className={cn(fieldCls, touched.studentNumber && !studentNoOk && fieldErrorCls)}
                      value={studentNumber}
                      onChange={(event) => {
                        touchFormEdit()
                        setStudentNumber(event.target.value)
                      }}
                      onBlur={() => markTouched('studentNumber')}
                      placeholder="2024-00011-MN-0"
                      autoComplete="off"
                      aria-invalid={touched.studentNumber && !studentNoOk}
                    />
                    <FieldHint
                      show={touched.studentNumber && !studentNoOk}
                      message="Enter a valid student number."
                    />
                  </label>
                </div>

                <div className="min-w-0">
                  <p className={labelCls}>Year Level</p>
                  <SlipSelect
                    ariaLabel="Year level"
                    value={yearLevel}
                    options={yearLevelOptions}
                    onChange={(value) => {
                      touchFormEdit()
                      setYearLevel(value as YearLevel)
                    }}
                  />
                </div>

                <div>
                  <p className={labelCls}>Classification</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: 'regular' as const, label: 'Regular', short: 'Regular' },
                        { id: 'irregular' as const, label: 'Irregular', short: 'Irregular' },
                      ] as const
                    ).map((item) => {
                      const active = classification === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            touchFormEdit()
                            setClassification(item.id)
                          }}
                          className={cn(
                            'h-11 rounded-xl border px-3 text-[12px] font-semibold transition sm:text-[13px]',
                            active
                              ? 'border-brand-700 bg-brand-700 text-white dark:border-brand-500 dark:bg-brand-600'
                              : 'border-zinc-200 bg-white text-zinc-600 hover:border-brand-200 hover:text-brand-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300',
                          )}
                        >
                          <span className="sm:hidden">{item.short}</span>
                          <span className="hidden sm:inline">{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </section>

              {/* Schedule */}
              <section className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
                <p className={sectionTitleCls}>Schedule</p>
                <div className="grid gap-3">
                  <div className="min-w-0">
                    <p className={labelCls}>Enrollment Date</p>
                    <SlipSelect
                      ariaLabel="Enrollment date"
                      value={enrollmentDate}
                      options={enrollmentDateOptions}
                      onChange={setEnrollmentDate}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className={labelCls}>Hourly Time Slot</p>
                    <SlipSelect
                      ariaLabel="Hourly time slot"
                      value={timeSlot}
                      options={timeSlotOptions}
                      onChange={(value) => {
                        touchFormEdit()
                        setTimeSlot(value)
                      }}
                      placeholder="Select an open time slot"
                    />
                    <FieldHint
                      show={timeSlotOptions.length > 0 && timeSlotOptions.every((item) => item.disabled)}
                      message="All hourly slots are full."
                    />
                  </div>
                </div>
              </section>

              {/* Self-check */}
              <section className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
                <p className={sectionTitleCls}>Pre-Enrollment Self-Check</p>
                <div className="space-y-2">
                  <CheckRow
                    checked={checkStanding}
                    onChange={setCheckStanding}
                    label="Academic Standing Checked"
                  />
                  <CheckRow
                    checked={checkSchedule}
                    onChange={setCheckSchedule}
                    label="Built Class Schedule Drafted"
                  />
                  <CheckRow
                    checked={checkPetition}
                    onChange={setCheckPetition}
                    label="With Petition / Appeal"
                    hint="Overload, underload, waiver, re-admission"
                  />
                </div>
              </section>

              {/* Payment */}
              <section className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
                <p className={sectionTitleCls}>
                  SC Contribution{scFeeLabel ? ` ${scFeeLabel}` : ''} Payment
                </p>

                <div className="grid gap-2">
                  {paymentChannels.map((channel) => (
                    <div
                      key={channel.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-950/60"
                    >
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-brand-950 dark:text-zinc-50">
                          {channel.title}
                        </p>
                        <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                          {channel.lines.join(' · ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText(channel.id, channel.copyValue)}
                        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-[11px] font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                      >
                        {copiedId === channel.id ? (
                          <>
                            <Check className="size-3.5 text-emerald-600" aria-hidden />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="size-3.5" aria-hidden />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3">
                  <div className="min-w-0">
                    <p className={labelCls}>
                      Payment Mode <span className="text-brand-600">*</span>
                    </p>
                    <SlipSelect
                      ariaLabel="Payment mode"
                      value={paymentMode}
                      options={paymentModeOptions}
                      onChange={(value) => {
                        touchFormEdit()
                        setPaymentMode(value as PaymentMode)
                        markTouched('paymentMode')
                      }}
                      onBlur={() => markTouched('paymentMode')}
                      placeholder="Select payment mode"
                      invalid={touched.paymentMode && !paymentModeOk}
                    />
                    <FieldHint
                      show={touched.paymentMode && !paymentModeOk}
                      message={
                        scFeeLabel
                          ? `Select how you paid the SC Contribution (${scFeeLabel}).`
                          : 'Select how you paid the SC Contribution.'
                      }
                    />
                  </div>
                  <label className="block min-w-0">
                    <span className={labelCls}>
                      Reference / Receipt No. <span className="text-brand-600">*</span>
                    </span>
                    <input
                      className={cn(fieldCls, touched.referenceNo && !referenceOk && fieldErrorCls)}
                      value={referenceNo}
                      onChange={(event) => {
                        touchFormEdit()
                        setReferenceNo(event.target.value)
                      }}
                      onBlur={() => markTouched('referenceNo')}
                      placeholder="Enter reference no."
                      aria-invalid={touched.referenceNo && !referenceOk}
                    />
                    <FieldHint
                      show={touched.referenceNo && !referenceOk}
                      message="Enter the receipt or reference number."
                    />
                  </label>
                </div>

                <div>
                  <p className={labelCls}>
                    Payment Proof <span className="text-brand-600">*</span>
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => {
                      touchFormEdit()
                      markTouched('proof')
                      onProofChange(event.target.files?.[0] ?? null)
                    }}
                  />
                  {proofPreview ? (
                    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
                      <img
                        src={proofPreview}
                        alt="Payment proof preview"
                        className="max-h-36 w-full object-cover"
                      />
                      <div className="flex items-center justify-between gap-2 px-3 py-2">
                        <p className="truncate text-[11px] text-zinc-500">{proofName}</p>
                        <button
                          type="button"
                          className="text-[11px] font-semibold text-brand-700 dark:text-brand-300"
                          onClick={() => {
                            touchFormEdit()
                            onProofChange(null)
                            markTouched('proof')
                            if (fileInputRef.current) fileInputRef.current.value = ''
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        markTouched('proof')
                        fileInputRef.current?.click()
                      }}
                      className={cn(
                        'flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed bg-zinc-50/60 px-4 py-6 text-center transition hover:border-brand-300 hover:bg-brand-50/40 dark:bg-zinc-950/40',
                        touched.proof && !proofOk
                          ? 'border-maroon-400 dark:border-maroon-400/60'
                          : 'border-zinc-300 dark:border-zinc-600',
                      )}
                    >
                      <ImagePlus className="size-5 text-brand-600 dark:text-brand-300" aria-hidden />
                      <span className="text-[12px] font-semibold text-brand-950 dark:text-zinc-50">
                        Attach SC Contribution proof
                      </span>
                      <span className="text-[11px] text-zinc-500">PNG, JPG, or WEBP</span>
                    </button>
                  )}
                  <FieldHint
                    show={touched.proof && !proofOk}
                    message="Attach a clear image of your payment proof."
                  />
                </div>

                <div className="rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-950/60">
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-zinc-400 uppercase">
                    Submission requirements
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    <ReqRow ok={nameOk} label="Full name" />
                    <ReqRow ok={studentNoOk} label="Student number" />
                    <ReqRow ok={paymentModeOk} label="Payment mode" />
                    <ReqRow ok={referenceOk} label="Reference / receipt no." />
                    <ReqRow ok={proofOk} label="Payment proof image" />
                  </ul>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-xl lg:hidden"
                    onClick={() => setMobilePane('preview')}
                  >
                    <Eye className="size-4" aria-hidden />
                    Preview
                  </Button>
                  <Button
                    type="button"
                    className="h-11 w-full rounded-xl sm:col-span-2 lg:col-span-1 xl:col-span-2"
                    disabled={!canExport || submitting}
                    aria-busy={submitting}
                    title={
                      canExport
                        ? submitted
                          ? 'Update submitted routing slip'
                          : 'Submit routing slip'
                        : 'Complete required fields to submit'
                    }
                    onClick={submitSlip}
                  >
                    {submitting ? (
                      <LoaderCircle className="size-4 animate-spin" aria-hidden />
                    ) : submitted ? (
                      <Check className="size-4" aria-hidden />
                    ) : (
                      <Send className="size-4" aria-hidden />
                    )}
                    {submitting ? 'Submitting…' : submitted ? 'Submitted' : 'Submit'}
                  </Button>
                </div>
                {submitted ? (
                  <p className="text-center text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-300">
                    Appointment submitted
                    {trackingCode ? (
                      <>
                        {' '}
                        · Tracking <span className="font-semibold">{trackingCode}</span>
                      </>
                    ) : null}
                    . Export PNG, PDF, or Print from the preview panel.
                  </p>
                ) : null}
              </section>
            </div>
          </div>
        </Reveal>

        {/* Live preview */}
        <Reveal
          className={cn(
            'lg:sticky lg:top-24',
            mobilePane === 'preview' ? 'block' : 'hidden lg:block',
          )}
        >
          <div className="rounded-2xl border border-zinc-200 bg-white sm:rounded-[1.5rem] dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col gap-3 border-b border-zinc-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 dark:border-zinc-800">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-brand-950 dark:text-zinc-50">
                  Live Preview
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {canExport ? 'Ready to export' : 'Complete required fields to enable export'}
                </p>
              </div>
              <ExportToolbar
                className="w-full sm:w-auto"
                busy={exportBusy}
                canExport={canExport}
                onExport={runExport}
              />
            </div>

            <div className="bg-zinc-50 p-3 sm:p-4 dark:bg-zinc-950">
              <div
                ref={previewRef}
                data-routing-slip-preview
                className={cn(
                  'mx-auto w-full max-w-[720px] overflow-hidden rounded-2xl bg-white text-[#1e0541] shadow-[0_18px_40px_-28px_rgba(30,5,65,0.35)] sm:rounded-[1.25rem]',
                  !canExport && 'opacity-95',
                )}
              >
                <div className="bg-white text-[#1e0541]">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 px-4 py-3.5 sm:gap-3 sm:px-5 sm:py-4">
                    <div className="ml-3 flex shrink-0 items-center gap-2 sm:ml-5">
                      <img
                        src={logoCol}
                        alt="College of Law"
                        width={44}
                        height={44}
                        className="size-11 shrink-0 bg-transparent object-contain"
                        draggable={false}
                      />
                      <img
                        src={logoSc}
                        alt="Student Council"
                        width={44}
                        height={44}
                        className="size-11 shrink-0 bg-transparent object-contain"
                        draggable={false}
                      />
                    </div>
                    <div className="min-w-0 text-center">
                      <p className="text-[9px] leading-tight font-extrabold tracking-[0.04em] text-[#5f18b8] uppercase sm:text-[11px]">
                        Polytechnic University of the Philippines
                      </p>
                      <p className="mt-0.5 text-[7.5px] leading-tight font-bold tracking-[0.06em] text-zinc-950 uppercase sm:text-[8.5px]">
                        College of Law Student Council, Inc.
                      </p>
                      <p className="mt-1.5 text-[12px] leading-tight font-extrabold tracking-[0.06em] text-zinc-950 uppercase sm:text-[13px]">
                        Enrollment Routing Slip
                      </p>
                      {termBanner ? (
                        <p className="mt-0.5 text-[7.5px] leading-tight font-medium tracking-[0.03em] text-zinc-900 sm:text-[8.5px]">
                          {termBanner}
                        </p>
                      ) : null}
                    </div>
                    <div className="w-[7.5rem] sm:w-32" aria-hidden />
                  </div>
                  <div className="h-[1.5px] bg-[#5f18b8]" aria-hidden />
                </div>

                <div className="space-y-4 p-4 sm:space-y-5 sm:p-5">
                  <div className="overflow-hidden rounded-xl border border-zinc-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2">
                      <PreviewMeta label="Full Name" value={fullName || '—'} />
                      <PreviewMeta label="Student Number" value={studentNumber || '—'} />
                      <PreviewMeta
                        label="Year Level & Classification"
                        value={`${yearLevel} | ${classificationLabel}`}
                      />
                      <PreviewMeta
                        label="Scheduled Date & Hourly Slot"
                        value={`${formatDateLabel(enrollmentDate, enrollmentDateOptions)} | ${timeSlot}`}
                      />
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[10px] font-extrabold tracking-[0.12em] text-[#5f18b8] uppercase">
                      Pre-Enrollment Checks
                    </p>
                    <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-zinc-200 bg-[#faf7ff] min-[420px]:grid-cols-3">
                      <div className="border-b border-zinc-200 px-3 py-2.5 min-[420px]:border-r min-[420px]:border-b-0">
                        <PreviewCheck checked={checkStanding} label="Academic Standing" />
                      </div>
                      <div className="border-b border-zinc-200 px-3 py-2.5 min-[420px]:border-r min-[420px]:border-b-0">
                        <PreviewCheck checked={checkSchedule} label="Class Schedule" />
                      </div>
                      <div className="px-3 py-2.5">
                        <PreviewCheck checked={checkPetition} label="Petition / Appeal" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[10px] font-extrabold tracking-[0.12em] text-[#5f18b8] uppercase">
                      Routing Stations
                    </p>

                    <div className="space-y-2.5 sm:hidden">
                      {routingSteps.map((row, index) => (
                        <div
                          key={row.step}
                          className="overflow-hidden rounded-xl border border-[#e0d0f2] bg-white"
                        >
                          <div className="flex items-start gap-2.5 border-b border-[#ede2ff] bg-[#faf7ff] px-3 py-2.5">
                            <span className="grid size-6 shrink-0 place-items-center rounded-md bg-[#ede2ff] text-[11px] font-extrabold text-[#5f18b8]">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[12px] leading-4 font-semibold text-[#1e0541]">
                                {row.step.replace(/^\d+\.\s*/, '')}
                              </p>
                              <p className="mt-0.5 text-[10px] text-zinc-500">{row.office}</p>
                            </div>
                          </div>
                          <div className="space-y-2.5 px-3 py-2.5">
                            <div>
                              <p className="text-[9px] font-semibold tracking-[0.08em] text-[#5f18b8]/60 uppercase">
                                Remarks
                              </p>
                              <p className="mt-1 text-[10px] leading-4 text-zinc-500">
                                {index === 1 && referenceNo.trim()
                                  ? `OR/Ref: ${referenceNo.trim()}${paymentModeLabel ? ` (${paymentModeLabel})` : ''}`
                                  : '—'}
                              </p>
                            </div>
                            {row.signatureNote ? (
                              <p className="text-[10px] leading-4 text-zinc-500 italic">
                                {row.signatureNote}
                              </p>
                            ) : (
                              <div className="pt-1">
                                <div className="h-7 border-b border-[#a78bc9]" />
                                <p className="mt-1 text-[9px] text-zinc-400">
                                  Signature of Authorized Personnel
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="hidden overflow-hidden rounded-xl border border-[#e0d0f2] sm:block">
                      <table className="w-full table-fixed border-collapse text-left">
                        <colgroup>
                          <col className="w-[46%]" />
                          <col className="w-[24%]" />
                          <col className="w-[30%]" />
                        </colgroup>
                        <thead>
                          <tr className="bg-[#f3e9ff] text-[#5f18b8]">
                            {[
                              'Step / Station',
                              'Remarks',
                              'Signature of Authorized Personnel',
                            ].map((heading, index, list) => (
                              <th
                                key={heading}
                                className={cn(
                                  'border-b border-[#e0d0f2] px-2.5 py-2.5 text-[7.5px] font-extrabold tracking-[0.06em] uppercase',
                                  index < list.length - 1 && 'border-r border-[#e0d0f2]',
                                )}
                              >
                                {heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {routingSteps.map((row, index) => (
                            <tr
                              key={row.step}
                              className={index % 2 ? 'bg-[#faf7ff]' : 'bg-white'}
                            >
                              <td className="border-t border-r border-[#e8dff5] px-2.5 py-2.5 align-middle">
                                <div className="flex items-start gap-2">
                                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-[#ede2ff] text-[10px] font-extrabold text-[#5f18b8]">
                                    {index + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="m-0 text-[11px] leading-4 font-semibold text-[#1e0541]">
                                      {row.step.replace(/^\d+\.\s*/, '')}
                                    </p>
                                    <p className="m-0 mt-0.5 text-[9px] leading-4 text-zinc-500">
                                      {row.office}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="border-t border-r border-[#e8dff5] px-2.5 py-2.5 align-middle text-[9px] leading-4 break-words text-zinc-500">
                                {index === 1 && referenceNo.trim()
                                  ? `OR/Ref: ${referenceNo.trim()}${paymentModeLabel ? ` (${paymentModeLabel})` : ''}`
                                  : <span className="text-[#c4b5d8]">—</span>}
                              </td>
                              <td className="border-t border-[#e8dff5] px-2.5 py-2.5 align-middle">
                                {row.signatureNote ? (
                                  <p className="m-0 text-[8px] leading-4 text-zinc-500 italic">
                                    {row.signatureNote}
                                  </p>
                                ) : (
                                  <div className="pt-3">
                                    <div className="border-b border-[#a78bc9]" />
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mx-auto w-full max-w-xs pt-1">
                    <div className="h-8 border-b-[1.5px] border-[#5f18b8]" />
                    <p className="mt-1.5 text-center text-[9px] text-zinc-500">
                      Student’s Signature over Printed Name
                    </p>
                  </div>

                  <p className="border-t border-zinc-200 pt-3 text-[8px] leading-4 text-zinc-500">
                    Bring this slip to each station in order. Keep SC Contribution proof for Step
                    2. · PUP COL SC Enrollment Hub
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      <Snackbar toast={snack} onDismiss={dismissSnack} />
    </div>
  )
}

function ExportToolbar({
  busy,
  canExport,
  onExport,
  className,
}: {
  busy: ExportKind | null
  canExport: boolean
  onExport: (kind: ExportKind) => void
  className?: string
}) {
  const items: {
    kind: ExportKind
    label: string
    busyLabel: string
    icon: typeof Download
    variant: 'outline' | 'default'
  }[] = [
    { kind: 'png', label: 'PNG', busyLabel: 'Saving…', icon: FileImage, variant: 'outline' },
    { kind: 'pdf', label: 'PDF', busyLabel: 'Saving…', icon: Download, variant: 'outline' },
    { kind: 'print', label: 'Print', busyLabel: 'Preparing…', icon: Printer, variant: 'default' },
  ]

  return (
    <div
      className={cn('grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:justify-end', className)}
      role="group"
      aria-label="Routing slip export actions"
    >
      {items.map((item) => {
        const Icon = item.icon
        const active = busy === item.kind
        return (
          <Button
            key={item.kind}
            type="button"
            variant={item.variant}
            className="h-10 min-w-0 rounded-xl px-3"
            disabled={!canExport || busy !== null}
            aria-busy={active}
            aria-label={
              canExport
                ? active
                  ? item.busyLabel
                  : item.kind === 'print'
                    ? 'Print routing slip'
                    : `Download ${item.label}`
                : 'Complete required fields to enable export'
            }
            title={canExport ? (item.kind === 'print' ? 'Print routing slip' : `Download ${item.label}`) : 'Complete required fields to enable export'}
            onClick={() => onExport(item.kind)}
          >
            {active ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Icon className="size-4" aria-hidden />
            )}
            <span>{active ? item.busyLabel : item.label}</span>
          </Button>
        )
      })}
    </div>
  )
}

function FieldHint({ show, message }: { show: boolean; message: string }) {
  if (!show) return null
  return (
    <p className="mt-1.5 text-[11px] leading-4 text-maroon-700 dark:text-maroon-300" role="alert">
      {message}
    </p>
  )
}

function ReqRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-[12px]">
      <span
        className={cn(
          'grid size-4 place-items-center rounded-full',
          ok
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
            : 'bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500',
        )}
      >
        {ok ? <Check className="size-2.5" strokeWidth={3} aria-hidden /> : null}
      </span>
      <span className={cn(ok ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-500')}>{label}</span>
    </li>
  )
}

function SlipSelect({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = 'Select…',
  invalid = false,
  onBlur,
}: {
  value: string
  options: SlipOption[]
  onChange: (value: string) => void
  ariaLabel: string
  placeholder?: string
  invalid?: boolean
  onBlur?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{
    top: number
    left: number
    width: number
    maxHeight: number
    placement: 'bottom' | 'top'
  } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value)
  const showPlaceholder = !selected || selected.value === ''

  useEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }

    function place() {
      const el = rootRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const gap = 8
      const pad = 8
      const spaceBelow = window.innerHeight - rect.bottom - pad
      const spaceAbove = rect.top - pad
      const preferBottom = spaceBelow >= 220 || spaceBelow >= spaceAbove
      const available = preferBottom ? spaceBelow : spaceAbove
      const maxHeight = Math.max(160, Math.min(320, available - gap))
      const width = Math.max(rect.width, 240)
      let left = rect.left
      left = Math.min(left, window.innerWidth - width - pad)
      left = Math.max(pad, left)

      setMenuPos({
        top: preferBottom ? rect.bottom + gap : Math.max(pad, rect.top - gap - maxHeight),
        left,
        width,
        maxHeight,
        placement: preferBottom ? 'bottom' : 'top',
      })
    }

    function onKey(event: KeyboardEvent) {
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
    <div ref={rootRef} className="relative w-full min-w-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        onBlur={onBlur}
        onClick={() => setOpen((next) => !next)}
        className={cn(
          'flex min-h-11 w-full items-center gap-2.5 rounded-xl border bg-white px-3 py-2 text-left text-sm transition outline-none dark:bg-zinc-900',
          open
            ? 'border-brand-400 ring-2 ring-brand-100 dark:border-brand-400 dark:ring-brand-500/25'
            : invalid
              ? 'border-maroon-400 dark:border-maroon-400/70'
              : 'border-zinc-200 hover:border-brand-200 dark:border-zinc-700 dark:hover:border-brand-500/40',
        )}
      >
        {selected?.icon && !showPlaceholder ? (
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            {selected.icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 py-0.5">
          <span
            className={cn(
              'block truncate text-[13px] font-semibold sm:text-sm',
              showPlaceholder ? 'font-medium text-zinc-400' : 'text-brand-950 dark:text-zinc-50',
            )}
          >
            {showPlaceholder ? placeholder : selected?.label}
          </span>
          {!showPlaceholder && selected?.description ? (
            <span className="mt-0.5 block truncate text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
              {selected.description}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-zinc-400 transition-transform',
            open && 'rotate-180 text-brand-600',
          )}
          aria-hidden
        />
      </button>

      {open && menuPos
        ? createPortal(
            <motion.div
              ref={menuRef}
              role="listbox"
              aria-label={ariaLabel}
              data-lenis-prevent
              initial={popIn.initial}
              animate={popIn.animate}
              transition={popIn.transition}
              style={{
                position: 'fixed',
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.width,
                maxHeight: menuPos.maxHeight,
                zIndex: 70,
              }}
              className="overflow-y-auto overscroll-contain rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-[0_18px_40px_-20px_rgba(30,5,65,0.35)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/50"
            >
              {options.map((option) => {
                const isSelected = option.value === value
                const isPlaceholderOption = option.value === ''
                const isDisabled = Boolean(option.disabled)
                return (
                  <button
                    key={option.id != null ? `slip-${option.id}` : option.value || 'empty'}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={isDisabled || undefined}
                    disabled={isDisabled}
                    onClick={() => {
                      if (isDisabled) return
                      onChange(option.value)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition',
                      isDisabled
                        ? 'cursor-not-allowed text-zinc-400 opacity-60 dark:text-zinc-500'
                        : isSelected
                          ? 'bg-brand-700 text-white dark:bg-brand-600'
                          : 'text-brand-950 hover:bg-brand-50 dark:text-zinc-50 dark:hover:bg-brand-500/15',
                    )}
                  >
                    {option.icon ? (
                      <span
                        className={cn(
                          'grid size-8 shrink-0 place-items-center rounded-lg',
                          isDisabled
                            ? 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
                            : isSelected
                              ? 'bg-white/15 text-white'
                              : 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
                        )}
                      >
                        {option.icon}
                      </span>
                    ) : (
                      <span className="size-8 shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block truncate text-[13px] font-semibold',
                          isPlaceholderOption && !isSelected && 'text-zinc-400',
                        )}
                      >
                        {option.label}
                      </span>
                      {option.description ? (
                        <span
                          className={cn(
                            'mt-0.5 block truncate text-[11px]',
                            isDisabled
                              ? 'text-zinc-400 dark:text-zinc-500'
                              : isSelected
                                ? 'text-white/75'
                                : 'text-zinc-500 dark:text-zinc-400',
                          )}
                        >
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                    {isSelected && !isDisabled ? <Check className="size-4 shrink-0" aria-hidden /> : null}
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

function StatCell({
  label,
  value,
  tone = 'default',
  icon: Icon,
}: {
  label: string
  value: string
  tone?: 'default' | 'ok' | 'muted'
  icon?: LucideIcon
}) {
  return (
    <div className="bg-white px-3 py-3 sm:px-5 sm:py-4 dark:bg-zinc-900">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-zinc-400 uppercase sm:text-[11px]">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold sm:text-base',
          tone === 'ok' && 'text-emerald-700 dark:text-emerald-300',
          tone === 'muted' && 'text-zinc-500',
          tone === 'default' && 'text-brand-950 dark:text-zinc-50',
        )}
      >
        {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
        {value}
      </p>
    </div>
  )
}

function CheckRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-950/60">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 rounded border-zinc-300 text-brand-700 focus:ring-brand-500"
      />
      <span className="min-w-0">
        <span className="block text-[12px] leading-5 font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </span>
        {hint ? <span className="mt-0.5 block text-[11px] text-zinc-500">{hint}</span> : null}
      </span>
    </label>
  )
}

function PreviewMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-zinc-200 px-3 py-2.5 last:border-b-0 sm:border-r sm:odd:border-r sm:even:border-r-0 sm:[&:nth-last-child(-n+2)]:border-b-0">
      <p className="text-[8px] font-extrabold tracking-[0.12em] text-[#5f18b8] uppercase">{label}</p>
      <p className="mt-1 text-[12px] leading-4 font-semibold break-words text-[#1e0541]">{value}</p>
    </div>
  )
}

function PreviewCheck({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div className="flex items-start gap-2 text-[10px] leading-4 text-zinc-700">
      <span
        className={cn(
          'mt-0.5 size-2.5 shrink-0 rounded-[2px] border-[1.5px]',
          checked
            ? 'border-[#5f18b8] bg-[#5f18b8] shadow-[inset_0_0_0_1.5px_#fff]'
            : 'border-zinc-500 bg-white',
        )}
        aria-hidden
      />
      <span>{label}</span>
    </div>
  )
}
