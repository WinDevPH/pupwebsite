import {
  CalendarCheck,
  Eye,
  Flag,
  Globe,
  GraduationCap,
  Handshake,
  HeartHandshake,
  Landmark,
  Megaphone,
  MessagesSquare,
  Network,
  Radio,
  Scale,
  ScrollText,
  ShieldCheck,
  Workflow,
  type LucideIcon,
} from 'lucide-react'

export const ABOUT_ICON_OPTIONS: { value: string; label: string }[] = [
  { value: 'scale', label: 'Scale' },
  { value: 'eye', label: 'Eye' },
  { value: 'graduation-cap', label: 'Graduation cap' },
  { value: 'shield-check', label: 'Shield check' },
  { value: 'heart-handshake', label: 'Heart handshake' },
  { value: 'landmark', label: 'Landmark' },
  { value: 'messages-square', label: 'Messages' },
  { value: 'calendar-check', label: 'Calendar check' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'handshake', label: 'Handshake' },
  { value: 'megaphone', label: 'Megaphone' },
  { value: 'flag', label: 'Flag' },
  { value: 'scroll-text', label: 'Scroll' },
  { value: 'radio', label: 'Radio' },
  { value: 'network', label: 'Network' },
  { value: 'globe', label: 'Globe' },
]

const ICONS: Record<string, LucideIcon> = {
  scale: Scale,
  eye: Eye,
  'graduation-cap': GraduationCap,
  'shield-check': ShieldCheck,
  'heart-handshake': HeartHandshake,
  landmark: Landmark,
  'messages-square': MessagesSquare,
  'calendar-check': CalendarCheck,
  workflow: Workflow,
  handshake: Handshake,
  megaphone: Megaphone,
  flag: Flag,
  'scroll-text': ScrollText,
  radio: Radio,
  network: Network,
  globe: Globe,
}

export function aboutIcon(name: string | undefined | null): LucideIcon {
  if (!name) return Scale
  return ICONS[name] ?? Scale
}
