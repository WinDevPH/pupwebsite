import {
  Building2,
  CalendarClock,
  ClipboardCheck,
  FileBarChart,
  FileText,
  Gavel,
  HeartHandshake,
  Landmark,
  Mail,
  PieChart,
  Receipt,
  Scale,
  ScrollText,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export const TRANSPARENCY_ICON_OPTIONS: { value: string; label: string }[] = [
  { value: 'landmark', label: 'Landmark' },
  { value: 'gavel', label: 'Gavel' },
  { value: 'mail', label: 'Mail' },
  { value: 'clipboard-check', label: 'Clipboard' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'file-text', label: 'Document' },
  { value: 'scroll-text', label: 'Scroll' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'scale', label: 'Scale' },
  { value: 'building-2', label: 'Building' },
  { value: 'heart-handshake', label: 'Handshake' },
]

const ICONS: Record<string, LucideIcon> = {
  landmark: Landmark,
  gavel: Gavel,
  mail: Mail,
  'clipboard-check': ClipboardCheck,
  wallet: Wallet,
  'file-text': FileText,
  'scroll-text': ScrollText,
  receipt: Receipt,
  scale: Scale,
  'building-2': Building2,
  'heart-handshake': HeartHandshake,
}

export function transparencyIcon(name: string | undefined | null): LucideIcon {
  if (!name) return FileText
  return ICONS[name] ?? FileText
}

const INNER_TAB_ICONS: Record<string, LucideIcon> = {
  'quarterly-liquidations': CalendarClock,
  'budget-allocations': PieChart,
  'financial-statements': FileBarChart,
}

export function transparencyInnerTabIcon(slug: string | undefined | null): LucideIcon {
  if (!slug) return FileText
  return INNER_TAB_ICONS[slug] ?? FileText
}
