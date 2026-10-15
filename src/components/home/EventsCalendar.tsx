import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import {
  BookMarked,
  BookOpen,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardPen,
  GraduationCap,
  LayoutGrid,
  ListFilter,
  ScrollText,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import examPhoto from '@/assets/calendar/exam.jpg'
import { SectionKicker } from '@/components/ui/SectionKicker'
import defensePhoto from '@/assets/calendar/defense.jpg'
import holidayPhoto from '@/assets/calendar/holiday.jpg'
import enrollmentPhoto from '@/assets/calendar/enrollment.jpg'
import { cn } from '@/lib/utils'
import { easeOut } from '@/lib/motion'
import { Reveal } from '@/components/motion/Reveal'
import { useHashScroll } from '@/hooks/useHashScroll'
import emptyCalendar from '@/assets/calendar/empty.jpg'

type Kind = 'holiday' | 'exam' | 'enrollment' | 'academic'

type CalEvent = {
  id: string
  title: string
  start: string
  end: string
  kind: Kind
}

const kindMeta: Record<
  Kind,
  {
    label: string
    chip: string
    bar: string
    accent: string
    badge: string
    tone: string
    image: string
    icon: LucideIcon
  }
> = {
  holiday: {
    label: 'Holiday',
    chip: 'bg-gold-100 text-brand-950',
    bar: 'bg-gold-500',
    accent: 'border-l-gold-500',
    badge: 'bg-gold-500 text-brand-950',
    tone: 'text-gold-600',
    image: holidayPhoto,
    icon: Sun,
  },
  exam: {
    label: 'Examination',
    chip: 'bg-brand-100 text-brand-800',
    bar: 'bg-brand-700',
    accent: 'border-l-brand-700',
    badge: 'bg-brand-700 text-white',
    tone: 'text-brand-700',
    image: examPhoto,
    icon: GraduationCap,
  },
  enrollment: {
    label: 'Enrollment',
    chip: 'bg-brand-50 text-brand-700',
    bar: 'bg-brand-400',
    accent: 'border-l-brand-400',
    badge: 'bg-brand-600 text-white',
    tone: 'text-brand-600',
    image: enrollmentPhoto,
    icon: ClipboardPen,
  },
  academic: {
    label: 'Academic',
    chip: 'bg-maroon-100 text-maroon-800',
    bar: 'bg-maroon-700',
    accent: 'border-l-maroon-700',
    badge: 'bg-maroon-700 text-white',
    tone: 'text-maroon-700',
    image: defensePhoto,
    icon: BookOpen,
  },
}

const events: CalEvent[] = [
  { id: 'encoding-1', title: 'Encoding of subject offerings', start: '2026-05-18', end: '2026-05-22', kind: 'academic' },
  { id: 'enroll-1st', title: 'First year onsite enrollment', start: '2026-06-01', end: '2026-06-30', kind: 'enrollment' },
  { id: 'independence', title: 'Independence Day', start: '2026-06-12', end: '2026-06-12', kind: 'holiday' },
  { id: 'col-council-jun', title: 'COL special academic council', start: '2026-06-15', end: '2026-06-15', kind: 'academic' },
  { id: 'enroll-2nd-a', title: 'Second year onsite enrollment', start: '2026-06-19', end: '2026-06-19', kind: 'enrollment' },
  { id: 'enroll-2nd-b', title: 'Second year onsite enrollment', start: '2026-06-22', end: '2026-06-22', kind: 'enrollment' },
  { id: 'enroll-34', title: 'Third and fourth year enrollment', start: '2026-06-23', end: '2026-06-23', kind: 'enrollment' },
  { id: 'manila-2026', title: 'Manila Day', start: '2026-06-24', end: '2026-06-24', kind: 'holiday' },
  { id: 'commencement-jun', title: 'Year-end commencement exercises', start: '2026-06-25', end: '2026-06-26', kind: 'academic' },
  { id: 'enroll-irregular', title: 'Irregular students enrollment', start: '2026-06-29', end: '2026-07-01', kind: 'enrollment' },
  { id: 'univ-council', title: 'University academic council', start: '2026-06-30', end: '2026-06-30', kind: 'academic' },
  { id: 'adjust-jul', title: 'Adjustment period', start: '2026-07-02', end: '2026-07-03', kind: 'academic' },
  { id: 'faculty-jul', title: 'Faculty meeting', start: '2026-07-04', end: '2026-07-04', kind: 'academic' },
  { id: 'sem1-start', title: 'First semester starts', start: '2026-07-08', end: '2026-07-08', kind: 'academic' },
  { id: 'orientation-jul', title: 'Student orientation', start: '2026-07-08', end: '2026-07-11', kind: 'academic' },
  { id: 'tuition-jul', title: 'Last day to pay tuition and fees', start: '2026-07-23', end: '2026-07-23', kind: 'academic' },
  { id: 'withdraw-jul', title: 'Last day to file a withdrawal', start: '2026-07-23', end: '2026-07-23', kind: 'academic' },
  { id: 'commencement-aug', title: 'University year-end commencement', start: '2026-08-18', end: '2026-08-20', kind: 'academic' },
  { id: 'heroes', title: 'National Heroes Day', start: '2026-08-31', end: '2026-08-31', kind: 'holiday' },
  { id: 'bar-1', title: 'Bar examinations, day 1', start: '2026-09-06', end: '2026-09-06', kind: 'exam' },
  { id: 'bar-2', title: 'Bar examinations, day 2', start: '2026-09-09', end: '2026-09-09', kind: 'exam' },
  { id: 'bar-3', title: 'Bar examinations, day 3', start: '2026-09-13', end: '2026-09-13', kind: 'exam' },
  { id: 'midterm-1', title: 'Midterm examinations', start: '2026-09-18', end: '2026-09-24', kind: 'exam' },
  { id: 'midyear-filing', title: 'Mid-year graduation filing', start: '2026-09-30', end: '2026-10-15', kind: 'academic' },
  { id: 'thesis', title: 'Thesis defense', start: '2026-10-10', end: '2026-10-11', kind: 'exam' },
  { id: 'encoding-oct', title: 'Encoding of subject offerings', start: '2026-10-16', end: '2026-10-20', kind: 'academic' },
  { id: 'all-saints', title: "All Saints' Day", start: '2026-11-01', end: '2026-11-01', kind: 'holiday' },
  { id: 'all-souls', title: "All Souls' Day", start: '2026-11-02', end: '2026-11-02', kind: 'holiday' },
  { id: 'finals-1', title: 'Final examinations', start: '2026-11-06', end: '2026-11-12', kind: 'exam' },
  { id: 'sem1-end', title: 'End of first semester', start: '2026-11-12', end: '2026-11-12', kind: 'academic' },
  { id: 'grades-1', title: 'Encoding of grades', start: '2026-11-13', end: '2026-11-19', kind: 'academic' },
  { id: 'grade-sheets-1', title: 'Submission of grade sheets', start: '2026-11-20', end: '2026-11-21', kind: 'academic' },
  { id: 'enroll-nov-1', title: 'First year onsite enrollment', start: '2026-11-23', end: '2026-11-23', kind: 'enrollment' },
  { id: 'enroll-nov-2', title: 'Second year onsite enrollment', start: '2026-11-24', end: '2026-11-24', kind: 'enrollment' },
  { id: 'enroll-nov-34', title: 'Third and fourth year enrollment', start: '2026-11-25', end: '2026-11-25', kind: 'enrollment' },
  { id: 'enroll-nov-irr', title: 'Irregular students enrollment', start: '2026-11-26', end: '2026-11-27', kind: 'enrollment' },
  { id: 'faculty-nov', title: 'Faculty meeting', start: '2026-11-28', end: '2026-11-28', kind: 'academic' },
  { id: 'bonifacio', title: 'Bonifacio Day', start: '2026-11-30', end: '2026-11-30', kind: 'holiday' },
  { id: 'sem2-start', title: 'Second semester starts', start: '2026-12-02', end: '2026-12-02', kind: 'academic' },
  { id: 'adjust-dec', title: 'Adjustment period', start: '2026-12-01', end: '2026-12-04', kind: 'academic' },
  { id: 'orientation-dec', title: 'Student orientation', start: '2026-12-02', end: '2026-12-04', kind: 'academic' },
  { id: 'immaculate', title: 'Feast of the Immaculate Conception', start: '2026-12-08', end: '2026-12-08', kind: 'holiday' },
  { id: 'pupclee-app-1', title: 'PUPCLEE batch 1 application', start: '2026-12-09', end: '2026-12-09', kind: 'exam' },
  { id: 'tuition-dec', title: 'Last day to pay tuition and fees', start: '2026-12-17', end: '2026-12-17', kind: 'academic' },
  { id: 'withdraw-dec', title: 'Last day to file a withdrawal', start: '2026-12-17', end: '2026-12-17', kind: 'academic' },
  { id: 'christmas-break', title: 'Christmas vacation', start: '2026-12-20', end: '2027-01-03', kind: 'holiday' },
  { id: 'christmas-eve', title: 'Christmas Eve', start: '2026-12-24', end: '2026-12-24', kind: 'holiday' },
  { id: 'christmas', title: 'Christmas Day', start: '2026-12-25', end: '2026-12-25', kind: 'holiday' },
  { id: 'rizal', title: 'Rizal Day', start: '2026-12-30', end: '2026-12-30', kind: 'holiday' },
  { id: 'nye', title: "New Year's Eve", start: '2026-12-31', end: '2026-12-31', kind: 'holiday' },
  { id: 'nyd', title: "New Year's Day", start: '2027-01-01', end: '2027-01-01', kind: 'holiday' },
  { id: 'classes-resume', title: 'Classes resume', start: '2027-01-04', end: '2027-01-04', kind: 'academic' },
  { id: 'pupclee-deadline', title: 'PUPCLEE batch 1 application deadline', start: '2027-01-22', end: '2027-01-22', kind: 'exam' },
  { id: 'lunar', title: 'Lunar New Year', start: '2027-02-06', end: '2027-02-06', kind: 'holiday' },
  { id: 'pupclee-written-1', title: 'PUPCLEE batch 1 written exam', start: '2027-02-07', end: '2027-02-07', kind: 'exam' },
  { id: 'midterm-2', title: 'Midterm examinations', start: '2027-02-18', end: '2027-02-23', kind: 'exam' },
  { id: 'yearend-filing', title: 'Year-end graduation filing', start: '2027-02-17', end: '2027-02-28', kind: 'academic' },
  { id: 'edsa', title: 'EDSA Revolution anniversary', start: '2027-02-25', end: '2027-02-25', kind: 'holiday' },
  { id: 'pupclee-app-2', title: 'PUPCLEE batch 2 application', start: '2027-03-01', end: '2027-03-01', kind: 'exam' },
  { id: 'pupclee-interview-1', title: 'PUPCLEE batch 1 interview', start: '2027-03-06', end: '2027-03-07', kind: 'exam' },
  { id: 'eid', title: 'Eid al-Fitr', start: '2027-03-10', end: '2027-03-10', kind: 'holiday' },
  { id: 'pupclee-results-1', title: 'PUPCLEE batch 1 results', start: '2027-03-22', end: '2027-03-22', kind: 'exam' },
  { id: 'maundy', title: 'Maundy Thursday', start: '2027-03-25', end: '2027-03-25', kind: 'holiday' },
  { id: 'good-friday', title: 'Good Friday', start: '2027-03-26', end: '2027-03-26', kind: 'holiday' },
  { id: 'black-saturday', title: 'Black Saturday', start: '2027-03-27', end: '2027-03-27', kind: 'holiday' },
  { id: 'pupclee-permits', title: 'PUPCLEE batch 2 permits', start: '2027-03-29', end: '2027-03-29', kind: 'exam' },
  { id: 'kagitingan', title: 'Araw ng Kagitingan', start: '2027-04-09', end: '2027-04-09', kind: 'holiday' },
  { id: 'finals-grad', title: 'Finals, graduating students', start: '2027-04-15', end: '2027-04-21', kind: 'exam' },
  { id: 'grades-grad', title: 'Encoding of graduating grades', start: '2027-04-22', end: '2027-04-23', kind: 'academic' },
  { id: 'pupclee-docs', title: 'PUPCLEE batch 2 document deadline', start: '2027-04-23', end: '2027-04-23', kind: 'exam' },
  { id: 'finals-nongrad', title: 'Finals, non-graduating students', start: '2027-04-22', end: '2027-04-28', kind: 'exam' },
  { id: 'sem2-end', title: 'Second semester ends', start: '2027-04-28', end: '2027-04-28', kind: 'academic' },
  { id: 'grades-nongrad', title: 'Encoding of non-graduating grades', start: '2027-05-03', end: '2027-05-05', kind: 'academic' },
  { id: 'grade-sheets-2', title: 'Submission of grade sheets', start: '2027-05-06', end: '2027-05-14', kind: 'academic' },
  { id: 'pupclee-written-2', title: 'PUPCLEE batch 2 written exam', start: '2027-05-09', end: '2027-05-09', kind: 'exam' },
  { id: 'pupclee-interview-2', title: 'PUPCLEE batch 2 interview', start: '2027-05-29', end: '2027-05-30', kind: 'exam' },
  { id: 'pupclee-results-2', title: 'PUPCLEE batch 2 results', start: '2027-06-07', end: '2027-06-07', kind: 'exam' },
  { id: 'col-council-jun27', title: 'COL special academic council', start: '2027-06-18', end: '2027-06-18', kind: 'academic' },
  { id: 'manila-2027', title: 'Manila Day', start: '2027-06-24', end: '2027-06-24', kind: 'holiday' },
  { id: 'commencement-jun27', title: 'Year-end commencement exercises', start: '2027-06-28', end: '2027-06-29', kind: 'academic' },
]

const eventDescriptions: Record<string, string> = {
  'encoding-1': 'Subjects for the coming term are encoded before enrollment opens.',
  'enroll-1st': 'First-year students enroll onsite at the College of Law.',
  independence: 'Regular holiday. No classes.',
  'col-council-jun': 'The College of Law academic council meets on this date.',
  'enroll-2nd-a': 'Second-year students enroll onsite.',
  'enroll-2nd-b': 'Second-year students enroll onsite.',
  'enroll-34': 'Third-year and fourth-year students enroll onsite.',
  'manila-2026': 'City holiday in Manila. No classes.',
  'commencement-jun': 'Year-end graduation rites for the College of Law.',
  'enroll-irregular': 'Students with an irregular load enroll onsite.',
  'univ-council': 'The university academic council meets on this date.',
  'adjust-jul': 'Students may add or drop subjects during this period.',
  'faculty-jul': 'Faculty meet before classes begin.',
  'sem1-start': 'Classes for the first semester begin.',
  'orientation-jul': 'Incoming students are oriented on college policies and schedules.',
  'tuition-jul': 'Deadline to settle tuition and fees for the semester.',
  'withdraw-jul': 'Last day a student may file a withdrawal for the term.',
  'commencement-aug': 'University-wide year-end graduation rites.',
  heroes: 'Regular holiday. No classes.',
  'bar-1': 'First day of the bar examinations.',
  'bar-2': 'Second day of the bar examinations.',
  'bar-3': 'Third day of the bar examinations.',
  'midterm-1': 'Midterm examinations for the first semester.',
  'midyear-filing': 'Students file for mid-year graduation within this period.',
  thesis: 'Scheduled defense for thesis candidates.',
  'encoding-oct': 'Subjects for the next term are encoded before enrollment.',
  'all-saints': 'Regular holiday. No classes.',
  'all-souls': 'Special non-working day. No classes.',
  'finals-1': 'Final examinations for the first semester.',
  'sem1-end': 'Last day of classes for the first semester.',
  'grades-1': 'Faculty encode grades after the final examinations.',
  'grade-sheets-1': 'Grade sheets are submitted to the college.',
  'enroll-nov-1': 'First-year students enroll onsite for the second semester.',
  'enroll-nov-2': 'Second-year students enroll onsite for the second semester.',
  'enroll-nov-34': 'Third-year and fourth-year students enroll onsite for the second semester.',
  'enroll-nov-irr': 'Students with an irregular load enroll for the second semester.',
  'faculty-nov': 'Faculty meet before the second semester begins.',
  bonifacio: 'Regular holiday. No classes.',
  'sem2-start': 'Classes for the second semester begin.',
  'adjust-dec': 'Students may add or drop subjects during this period.',
  'orientation-dec': 'Students are oriented at the start of the second semester.',
  immaculate: 'Regular holiday. No classes.',
  'pupclee-app-1': 'Application opens for the first batch of the College of Law entrance exam.',
  'tuition-dec': 'Deadline to settle tuition and fees for the second semester.',
  'withdraw-dec': 'Last day a student may file a withdrawal for the second semester.',
  'christmas-break': 'Classes are suspended for the Christmas vacation.',
  'christmas-eve': 'Holiday. No classes.',
  christmas: 'Regular holiday. No classes.',
  rizal: 'Regular holiday. No classes.',
  nye: 'Holiday. No classes.',
  nyd: 'Regular holiday. No classes.',
  'classes-resume': 'Classes resume after the Christmas vacation.',
  'pupclee-deadline': 'Last day to apply for the first batch of the entrance exam.',
  lunar: 'Special non-working day. No classes.',
  'pupclee-written-1': 'Written entrance examination for the first batch.',
  'midterm-2': 'Midterm examinations for the second semester.',
  'yearend-filing': 'Students file for year-end graduation within this period.',
  edsa: 'Holiday observance. No classes.',
  'pupclee-app-2': 'Application opens for the second batch of the entrance exam.',
  'pupclee-interview-1': 'Interview schedule for the first batch of entrance examinees.',
  eid: 'Regular holiday. No classes.',
  'pupclee-results-1': 'Results are released for the first batch of the entrance exam.',
  maundy: 'Regular holiday. No classes.',
  'good-friday': 'Regular holiday. No classes.',
  'black-saturday': 'Holiday. No classes.',
  'pupclee-permits': 'Examination permits are released for the second batch.',
  kagitingan: 'Regular holiday. No classes.',
  'finals-grad': 'Final examinations for graduating students.',
  'grades-grad': 'Faculty encode grades of graduating students.',
  'pupclee-docs': 'Deadline to submit documents for the second batch of the entrance exam.',
  'finals-nongrad': 'Final examinations for students who are not graduating.',
  'sem2-end': 'Last day of classes for the second semester.',
  'grades-nongrad': 'Faculty encode grades of non-graduating students.',
  'grade-sheets-2': 'Grade sheets for the second semester are submitted.',
  'pupclee-written-2': 'Written entrance examination for the second batch.',
  'pupclee-interview-2': 'Interview schedule for the second batch of entrance examinees.',
  'pupclee-results-2': 'Results are released for the second batch of the entrance exam.',
  'col-council-jun27': 'The College of Law academic council meets on this date.',
  'manila-2027': 'City holiday in Manila. No classes.',
  'commencement-jun27': 'Year-end graduation rites for the College of Law.',
}

const weekdayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const filters = [
  { id: 'all', label: 'All', icon: LayoutGrid },
  { id: 'holiday', label: 'Holidays', icon: Sun },
  { id: 'exam', label: 'Exams', icon: GraduationCap },
  { id: 'enrollment', label: 'Enrollment', icon: ClipboardPen },
  { id: 'academic', label: 'Academic', icon: BookOpen },
] as const

type FilterId = (typeof filters)[number]['id']

const monthFormat = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' })
const dayFormat = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })

function dateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function parseKey(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function eventsOn(key: string, filter: FilterId) {
  return events.filter(
    (item) => item.start <= key && key <= item.end && (filter === 'all' || item.kind === filter),
  )
}

function spanDays(item: CalEvent) {
  const start = parseKey(item.start).getTime()
  const end = parseKey(item.end).getTime()
  return Math.round((end - start) / 86_400_000) + 1
}

function gridEvents(key: string, filter: FilterId) {
  return eventsOn(key, filter).map((item) => ({
    item,
    labeled: item.start === key || spanDays(item) <= 3,
  }))
}

function lengthLabel(item: CalEvent) {
  const days = spanDays(item)
  return days === 1 ? '1 day' : `${days} days`
}

function shortRange(start: string, end: string) {
  const from = parseKey(start)
  const to = parseKey(end)
  if (start === end) return dayFormat.format(from)
  const sameYear = from.getFullYear() === to.getFullYear()
  const startLabel = new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  }).format(from)
  return `${startLabel} – ${dayFormat.format(to)}`
}

function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1)
  const mondayIndex = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - mondayIndex)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

function dayLabel(date: Date) {
  const day = String(date.getDate()).padStart(2, '0')
  if (date.getDate() !== 1) return day
  const month = date.toLocaleDateString('en-PH', { month: 'short' })
  return `${day} ${month}`
}

export function EventsCalendar() {
  const reduce = useReducedMotion() === true
  const today = useMemo(() => new Date(), [])
  const todayKey = dateKey(today)
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState(todayKey)
  const [kind, setKind] = useState<FilterId>('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const filterRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  useHashScroll('calendar')
  const filtering = kind !== 'all'

  useEffect(() => {
    if (!filterOpen) {
      setMenuPos(null)
      return
    }
    function place() {
      const el = filterRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) })
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setFilterOpen(false)
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node
      if (filterRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setFilterOpen(false)
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
  }, [filterOpen])

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const cells = monthCells(year, month)
  const selectedEvents = eventsOn(selected, kind)
  const selectedDate = parseKey(selected)
  const viewingToday = selected === todayKey
  const nextEvent = events
    .filter((item) => item.start > selected && (kind === 'all' || item.kind === kind))
    .sort((a, b) => a.start.localeCompare(b.start))[0]

  function openDate(key: string) {
    const date = parseKey(key)
    setSelected(key)
    setCursor(new Date(date.getFullYear(), date.getMonth(), 1))
  }

  function shiftMonth(amount: number) {
    const next = new Date(year, month + amount, 1)
    setCursor(next)
    const key = dateKey(next)
    setSelected(next.getFullYear() === today.getFullYear() && next.getMonth() === today.getMonth() ? todayKey : key)
  }

  return (
    <section id="calendar" aria-labelledby="calendar-title" className="scroll-mt-28 bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-[clamp(3rem,2rem+3.2vw,5rem)] sm:px-6 lg:px-8">
        <Reveal>
        <header className="mx-auto max-w-3xl text-center">
          <SectionKicker icon={CalendarDays}>Calendar</SectionKicker>
          <h2
            id="calendar-title"
            className="mt-[clamp(0.85rem,0.5rem+1vw,1.25rem)] font-hero text-[clamp(1.85rem,0.9rem+3vw,3.75rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950"
          >
            Upcoming <span className="text-brand-600">events</span>
          </h2>
          <p className="mx-auto mt-[clamp(0.75rem,0.4rem+1vw,1.15rem)] max-w-lg text-[clamp(0.875rem,0.82rem+0.2vw,0.95rem)] leading-relaxed text-zinc-500">
            Examinations, enrollment, and holiday breaks from the A.Y. 2026–2027 academic calendar.
          </p>
        </header>
        </Reveal>

        <Reveal delay={0.08} className="mt-[clamp(1.5rem,1rem+1.5vw,2.25rem)] overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="grid items-stretch lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0">
          <div className="flex items-center gap-2 border-b border-zinc-100 p-3 sm:p-4">
            <button
              type="button"
              onClick={() => openDate(todayKey)}
              className="inline-flex h-9 shrink-0 items-center rounded-lg border border-zinc-200 px-3 text-sm font-medium text-brand-800 transition-colors hover:bg-zinc-50"
            >
              Today
            </button>
            <div className="inline-flex h-9 min-w-0 items-center rounded-lg border border-zinc-200">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className="inline-flex size-9 shrink-0 items-center justify-center text-brand-800 transition-colors hover:bg-zinc-50"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <h3 className="min-w-0 truncate px-1 text-center text-sm font-semibold text-brand-950 sm:min-w-[9.5rem]">
                {monthFormat.format(cursor)}
              </h3>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className="inline-flex size-9 shrink-0 items-center justify-center text-brand-800 transition-colors hover:bg-zinc-50"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
            <div className="relative ml-auto shrink-0" ref={filterRef}>
              <button
                type="button"
                onClick={() => setFilterOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={filterOpen}
                className={cn(
                  'relative inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold transition-colors sm:px-3',
                  filtering
                    ? 'border-brand-700 bg-brand-700 text-white'
                    : 'border-zinc-200 bg-white text-brand-950 hover:bg-zinc-50',
                )}
              >
                <ListFilter className="size-3.5" strokeWidth={2.1} aria-hidden />
                Filter
                {filtering ? (
                  <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-white ring-2 ring-brand-700" />
                ) : null}
              </button>
              {filterOpen && menuPos
                ? createPortal(
                    <div
                      ref={menuRef}
                      role="menu"
                      style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 60 }}
                      className="w-64 rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg"
                    >
                  <div className="flex items-center gap-2 px-2 py-2">
                    <div className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-700">
                      <ListFilter className="size-3.5" strokeWidth={2.1} aria-hidden />
                    </div>
                    <div className="min-w-0 leading-tight">
                      <p className="text-[13px] font-semibold text-brand-950">Filters</p>
                      <p className="text-[11.5px] text-zinc-500">Event type</p>
                    </div>
                  </div>
                  <div className="border-t border-zinc-100 py-1">
                    {filters.map((item) => {
                      const selectedFilter = kind === item.id
                      const count =
                        item.id === 'all' ? events.length : events.filter((event) => event.kind === item.id).length
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={selectedFilter}
                          onClick={() => {
                            setKind(item.id)
                            setFilterOpen(false)
                          }}
                          className={cn(
                            'flex h-10 w-full items-center justify-between gap-3 rounded-xl px-2.5 text-left text-[13px] font-medium',
                            selectedFilter ? 'bg-brand-50 text-brand-800' : 'text-brand-950 hover:bg-zinc-50',
                          )}
                        >
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <item.icon className="size-3.5 shrink-0" aria-hidden />
                            {item.label}
                          </span>
                          <span className="text-xs text-zinc-500">{count}</span>
                        </button>
                      )
                    })}
                  </div>
                  {filtering ? (
                    <div className="border-t border-zinc-100 px-2 py-2 text-center">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setKind('all')
                          setFilterOpen(false)
                        }}
                        className="text-xs font-semibold text-brand-700 hover:text-brand-600"
                      >
                        Clear filters
                      </button>
                    </div>
                  ) : null}
                    </div>,
                    document.body,
                  )
                : null}
            </div>
          </div>

          <motion.div
            key={`${cursor.getFullYear()}-${cursor.getMonth()}`}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, ease: easeOut }}
            className="@container m-2 min-w-0 rounded-xl border border-zinc-200 p-2 sm:m-3 sm:p-3"
          >
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {weekdayLabels.map((label) => (
                <div key={label} className="px-1 pb-2 text-left text-[10px] font-medium text-zinc-400 sm:text-xs">
                  <span className="sm:hidden">{label.slice(0, 3)}</span>
                  <span className="hidden sm:inline">{label}</span>
                </div>
              ))}
              {cells.map((date) => {
                const key = dateKey(date)
                const inMonth = date.getMonth() === month
                const listed = gridEvents(key, kind)
                const labeled = listed.filter((entry) => entry.labeled)
                const shown = labeled.slice(0, 3)
                const extra = labeled.length - shown.length
                const bars = listed.filter((entry) => !entry.labeled).slice(0, 2)
                const isToday = key === todayKey
                const isSelected = selected === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => openDate(key)}
                    aria-pressed={isSelected}
                    aria-current={isToday ? 'date' : undefined}
                    className={cn(
                      'flex min-h-[4.25rem] flex-col rounded-lg border bg-white p-1 text-left sm:min-h-24 sm:rounded-xl sm:p-2 lg:min-h-[7.25rem]',
                      inMonth ? 'border-zinc-200' : 'border-zinc-100 bg-zinc-50/70',
                      isToday && 'border-brand-100 bg-brand-50',
                      isSelected && 'border-dashed border-brand-600',
                    )}
                  >
                    <span
                      className={cn(
                        'text-[10px] font-medium tabular-nums sm:text-xs',
                        isToday ? 'font-semibold text-brand-700' : inMonth ? 'text-brand-950' : 'text-zinc-400',
                      )}
                    >
                      {dayLabel(date)}
                    </span>
                    <span className="mt-1 hidden min-w-0 flex-col gap-1 @[32rem]:flex">
                      {shown.map(({ item }) => (
                        <span key={item.id} className="flex min-w-0 items-center gap-1">
                          <span className={cn('h-3 w-0.5 shrink-0 rounded-full', kindMeta[item.kind].bar)} aria-hidden />
                          <span className="truncate text-[10px] leading-tight font-medium text-brand-950">{item.title}</span>
                        </span>
                      ))}
                      {bars.map(({ item }) => (
                        <span key={item.id} className="flex min-w-0 items-center gap-1">
                          <span className={cn('h-1 w-8 shrink-0 rounded-full', kindMeta[item.kind].bar)} aria-hidden />
                          <span className="sr-only">{item.title}</span>
                        </span>
                      ))}
                      {extra > 0 ? (
                        <span className="self-start rounded bg-brand-700 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                          +{extra}
                        </span>
                      ) : null}
                    </span>
                    {listed.length > 0 ? (
                      <span className="mt-auto flex flex-col gap-1 pt-1 @[32rem]:hidden" aria-hidden>
                        {listed.slice(0, 2).map(({ item }) => (
                          <span key={item.id} className={cn('h-1 w-full rounded-full', kindMeta[item.kind].bar)} />
                        ))}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </motion.div>
          </div>

          <aside className="flex flex-col border-t border-zinc-200 bg-white p-4 shadow-none sm:p-5 lg:border-t-0 lg:border-l">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-3">
              <h3 className="text-lg font-semibold tracking-tight text-zinc-950">Schedule</h3>
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-500">
                <CalendarDays className="size-3.5 text-brand-700" aria-hidden />
                {viewingToday ? 'Today, ' : ''}
                {dayFormat.format(selectedDate)}
              </p>
            </div>
            <motion.div
              key={`${selected}-${kind}`}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: easeOut }}
              className="flex min-h-0 flex-1 flex-col"
            >
            {selectedEvents.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-3 py-8 text-center">
                <img
                  src={emptyCalendar}
                  alt=""
                  width={640}
                  height={640}
                  className="h-36 w-auto max-w-full object-contain"
                />
                <h4 className="mt-4 font-display text-xl font-medium text-brand-950">No events on this day</h4>
                <p className="mt-1.5 max-w-[16rem] text-sm leading-6 text-zinc-500">
                  The academic calendar has nothing listed for {dayFormat.format(selectedDate)}.
                </p>
                {nextEvent ? (
                  <button
                    type="button"
                    onClick={() => openDate(nextEvent.start)}
                    className="mt-5 inline-flex h-9 items-center rounded-lg border border-brand-200 px-3 text-sm font-semibold text-brand-800 hover:bg-brand-50"
                  >
                    Next date · {dayFormat.format(parseKey(nextEvent.start))}
                  </button>
                ) : null}
              </div>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {selectedEvents.map((item) => {
                  const meta = kindMeta[item.kind]
                  const Icon = meta.icon
                  const days = spanDays(item)
                  return (
                    <li key={item.id} className="flex overflow-hidden rounded-lg border border-zinc-200 bg-white">
                      <div className={cn('w-1 shrink-0', meta.bar)} aria-hidden />
                      <div className="relative w-[5.25rem] shrink-0 self-stretch">
                        <img
                          src={meta.image}
                          alt=""
                          width={168}
                          height={168}
                          className="absolute inset-0 size-full object-cover"
                        />
                        <span
                          className={cn(
                            'absolute right-1 bottom-1 inline-flex size-8 flex-col items-center justify-center rounded-full leading-none ring-2 ring-white',
                            meta.badge,
                          )}
                          aria-label={lengthLabel(item)}
                        >
                          <span className="text-[11px] font-bold">{days}</span>
                          <span className="text-[6px] font-semibold tracking-wide uppercase">
                            {days === 1 ? 'day' : 'days'}
                          </span>
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col px-3 py-2.5">
                        <p className="flex items-center gap-1.5">
                          <span className={cn('flex size-5 items-center justify-center rounded-md', meta.badge)}>
                            <Icon className="size-3" aria-hidden />
                          </span>
                          <span className={cn('text-[11px] font-semibold tracking-[0.12em] uppercase', meta.tone)}>
                            {meta.label}
                          </span>
                        </p>
                        <p className="mt-1.5 text-sm leading-5 font-semibold text-zinc-950">{item.title}</p>
                        <p className="mt-1 line-clamp-2 text-[12px] leading-4 text-zinc-600">
                          {eventDescriptions[item.id]}
                        </p>
                        <p className={cn('mt-1.5 flex items-center gap-1.5 text-[12px] leading-4', meta.tone)}>
                          <CalendarRange className="size-3.5 shrink-0" aria-hidden />
                          <span className="min-w-0 text-zinc-500">{shortRange(item.start, item.end)}</span>
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            </motion.div>
          </aside>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <nav
            aria-label="Quick links"
            className="mx-auto mt-[clamp(1.5rem,1rem+1.5vw,2.25rem)] max-w-3xl"
          >
            <p className="text-center text-[11px] font-semibold tracking-[0.16em] text-brand-700 uppercase">
              Quick links
            </p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                {
                  label: 'Student Handbook',
                  to: '/documents/student-handbook',
                  description: 'Policies and guidelines for PUP law students.',
                  icon: BookMarked,
                },
                {
                  label: 'Guidelines',
                  to: '/documents/guidelines',
                  description: 'Official Council guidelines and procedures.',
                  icon: ScrollText,
                },
              ].map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="group flex h-full items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3.5 py-3 transition-colors hover:border-brand-200"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-brand-100 text-brand-700">
                      <item.icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-sm font-semibold text-zinc-950">{item.label}</span>
                      <span className="mt-0.5 block text-[13px] leading-5 text-zinc-500">{item.description}</span>
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 text-zinc-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand-700"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Reveal>
      </div>
    </section>
  )
}