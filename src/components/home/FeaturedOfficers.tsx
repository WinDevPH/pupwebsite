import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Gavel, GraduationCap, Users } from 'lucide-react'
import biato from '@/assets/council/people/biato.jpg'
import briones from '@/assets/council/people/briones.jpg'
import cuyugan from '@/assets/council/people/cuyugan.jpg'
import deLeon from '@/assets/council/people/de-leon.jpg'
import festin from '@/assets/council/people/festin.jpg'
import guadana from '@/assets/council/people/guadana.jpg'
import orante from '@/assets/council/people/orante.jpg'
import pago from '@/assets/council/people/pago.jpg'
import ramos from '@/assets/council/people/ramos.jpg'
import rana from '@/assets/council/people/rana.jpg'
import salazar from '@/assets/council/people/salazar.jpg'
import sanchez from '@/assets/council/people/sanchez.jpg'
import santos from '@/assets/council/people/santos.jpg'
import sarabia from '@/assets/council/people/sarabia.jpg'
import tercero from '@/assets/council/people/tercero.jpg'
import toribio from '@/assets/council/people/toribio.jpg'
import velasco from '@/assets/council/people/velasco.jpg'
import { SectionKicker } from '@/components/ui/SectionKicker'
import studentCouncil from '@/assets/logos/student-council.png'
import { Reveal } from '@/components/motion/Reveal'
import { useHashScroll } from '@/hooks/useHashScroll'
import { cn } from '@/lib/utils'

const academicYear = 'A.Y. 2026–2027'

type Officer = {
  role: string
  name: string
  photo?: string
  vacant?: boolean
  lead?: boolean
}

const rosterTabs = [
  { id: 'officers', label: 'Officers', icon: Users },
  { id: 'commissioners', label: 'Commissioners', icon: Gavel },
  { id: 'advisers', label: 'Advisers', icon: GraduationCap },
] as const

type RosterTab = (typeof rosterTabs)[number]['id']

const batches: { label: string; columns: string; officers: Officer[] }[] = [
  {
    label: 'Executive board',
    columns: 'sm:grid-cols-2 xl:grid-cols-4',
    officers: [
      { role: 'President', name: 'Toribio, Russel Angelo O.', photo: toribio, lead: true },
      { role: 'Vice President Internal', name: 'de Leon, Kristoffer Red S.', photo: deLeon },
      { role: 'Vice President External', name: 'Salazar, Marvin L.', photo: salazar },
      { role: 'Secretary-General', name: 'Velasco, Jesca O.', photo: velasco },
      { role: 'Finance Officer', name: 'Biato, Yvonne', photo: biato },
      { role: 'Auditor', name: 'Orante, Amaziah Perseus G.', photo: orante },
      { role: 'Communications Officer', name: 'Tercero, Shein', photo: tercero },
    ],
  },
  {
    label: 'Year representatives',
    columns: 'sm:grid-cols-2 lg:grid-cols-4',
    officers: [
      { role: 'Year 1', name: 'Roxas, Jayson', photo: ramos },
      { role: 'Year 2', name: 'Rana, John Ivan H.', photo: rana },
      { role: 'Year 3', name: 'Guadaña, Almira P.', photo: guadana },
      { role: 'Year 4', name: 'Vacant', vacant: true },
    ],
  },
  {
    label: 'Associates',
    columns: 'sm:grid-cols-2 lg:grid-cols-3',
    officers: [
      { role: 'Presidential Affairs', name: 'Jessica Mae T. Asuncion' },
      { role: 'Internal Affairs', name: 'Aldrich R. Sanchez', photo: sanchez },
      { role: 'Secretariat', name: 'Cherie An M. Sarabia', photo: sarabia },
      { role: 'External Affairs', name: 'Gleanna Marie B. Cuyugan', photo: cuyugan },
      { role: 'Social Media Management', name: 'Jenina Denisse R. Cabrera' },
    ],
  },
]

const advisers: Officer[] = [
  { role: 'Dean, PUP College of Law', name: 'Atty. Gemy Lito L. Festin, LL.M.', photo: festin, lead: true },
  { role: 'Lead Faculty Adviser', name: 'Atty. Czarina C. Santos-Mahilum', photo: santos },
  { role: 'Lead Faculty Adviser', name: 'Atty. Rex Norman E. Briones, LL.M.', photo: briones },
  { role: 'Lead Faculty Adviser', name: 'Atty. Leslie Faye P. Pago', photo: pago },
  { role: 'Lead Faculty Adviser', name: 'Atty. Kim Ranielle E. Abis' },
]

const commissioners: Officer[] = [
  { role: 'Chairperson', name: 'Russel Angelo O. Toribio', photo: toribio, lead: true },
  { role: 'Commissioner', name: 'Kristoffer Red S. De Leon', photo: deLeon },
  { role: 'Commissioner', name: 'Marvin L. Salazar', photo: salazar },
  { role: 'Commissioner and Clerk to the Commission', name: 'Jesca O. Velasco', photo: velasco },
  { role: 'Commissioner', name: 'Ma. Yvonne B. Biato', photo: biato },
  { role: 'Commissioner', name: 'Amaziah Perseus G. Orante', photo: orante },
  { role: 'Commissioner', name: 'Shein Tercero', photo: tercero },
  { role: 'Commissioner', name: 'Jayson G. Ramos', photo: ramos },
  { role: 'Commissioner', name: 'John Ivan H. Rana', photo: rana },
  { role: 'Commissioner', name: 'Almira P. Guadaña', photo: guadana },
]

const rosterCounts: Record<RosterTab, number> = {
  officers: batches.reduce((total, batch) => total + batch.officers.length, 0),
  advisers: advisers.length,
  commissioners: commissioners.length,
}

export function FeaturedOfficers() {
  const [tab, setTab] = useState<RosterTab>('officers')
  useHashScroll('officers')

  return (
    <section id="officers" aria-labelledby="featured-officers-title" className="scroll-mt-28 overflow-hidden bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-[clamp(2.5rem,1.6rem+3vw,5rem)] sm:px-6 lg:px-8">
        <Reveal>
          <header className="mx-auto max-w-3xl text-center">
            <SectionKicker icon={Users}>Officers</SectionKicker>
            <h2
              id="featured-officers-title"
              className="mt-[clamp(0.85rem,0.5rem+1vw,1.25rem)] font-hero text-[clamp(1.85rem,0.9rem+3vw,3.75rem)] leading-[0.95] font-normal tracking-tight text-balance text-brand-950"
            >
              Featured Council <span className="text-brand-600">Officers</span>
            </h2>
            <p className="mx-auto mt-[clamp(0.75rem,0.4rem+1vw,1.15rem)] max-w-lg text-[clamp(0.875rem,0.82rem+0.2vw,0.95rem)] leading-relaxed text-zinc-500">
              Officers, advisers, and the Commission on Appointments for{' '}
              <span className="whitespace-nowrap">{academicYear}</span>.
            </p>
          </header>
        </Reveal>

        <div
          role="tablist"
          aria-label="Council roster"
          className="mx-auto mt-[clamp(1.25rem,0.8rem+1.2vw,1.75rem)] flex w-max max-w-full gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-white p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onKeyDown={(event) => onRosterKeyDown(event, tab, setTab)}
        >
          {rosterTabs.map((item) => {
            const selected = tab === item.id
            const Icon = item.icon
            return (
              <button
                key={item.id}
                id={`roster-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="roster-panel"
                tabIndex={selected ? 0 : -1}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors sm:px-3 sm:py-2 sm:text-sm',
                  selected ? 'bg-brand-700 text-white' : 'text-zinc-500 hover:bg-brand-50 hover:text-brand-800',
                )}
                onClick={() => setTab(item.id)}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                {item.label}
                <span
                  className={cn(
                    'inline-flex min-w-5 items-center justify-center rounded-md px-1 text-[10px] leading-4 font-semibold tabular-nums',
                    selected ? 'bg-white/15 text-gold-300' : 'bg-brand-50 text-brand-700',
                  )}
                >
                  {rosterCounts[item.id]}
                </span>
              </button>
            )
          })}
        </div>

        <div
          id="roster-panel"
          role="tabpanel"
          aria-labelledby={`roster-tab-${tab}`}
          className="mt-6 space-y-8"
        >
          {tab === 'officers'
            ? batches.map((batch) => (
                <OfficerBatch key={batch.label} label={batch.label} columns={batch.columns} officers={batch.officers} />
              ))
            : null}
          {tab === 'advisers' ? (
            <OfficerBatch label="Advisory board" columns="sm:grid-cols-2 lg:grid-cols-3" officers={advisers} />
          ) : null}
          {tab === 'commissioners' ? (
            <OfficerBatch
              label="Commission on Appointments"
              columns="sm:grid-cols-2 xl:grid-cols-4"
              officers={commissioners}
            />
          ) : null}
        </div>
      </div>
    </section>
  )
}

function OfficerBatch({
  label,
  columns,
  officers,
}: {
  label: string
  columns: string
  officers: Officer[]
}) {
  return (
    <div>
      <div className="flex items-center gap-4">
        <span aria-hidden className="h-px flex-1 bg-zinc-200" />
        <h3 className="text-[11px] font-semibold tracking-[0.16em] text-brand-700 uppercase">{label}</h3>
        <span aria-hidden className="h-px flex-1 bg-zinc-200" />
      </div>
      <ul
        aria-label={label}
        className={cn(
          'mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          'sm:grid sm:snap-none sm:overflow-visible',
          columns,
        )}
      >
        {officers.map((officer) => (
          <li key={`${officer.role}-${officer.name}`} className="w-[17.25rem] shrink-0 snap-start sm:w-auto">
            <OfficerCard officer={officer} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function OfficerCard({ officer }: { officer: Officer }) {
  const photo = Boolean(officer.photo) && !officer.vacant

  return (
    <article
      className={cn(
        'flex h-full items-center gap-3 rounded-2xl border bg-white p-2.5',
        officer.vacant ? 'border-dashed border-zinc-300' : 'border-zinc-200',
        officer.lead && 'border-gold-400',
      )}
    >
      {photo ? (
        <img
          src={officer.photo}
          alt=""
          width={160}
          height={160}
          className="size-16 shrink-0 rounded-xl bg-zinc-100 object-cover object-[center_18%] sm:size-[4.5rem]"
        />
      ) : (
        <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-brand-50 sm:size-[4.5rem]">
          <img
            src={studentCouncil}
            alt=""
            width={48}
            height={48}
            className={cn('size-10 rounded-full bg-white object-contain p-0.5', officer.vacant && 'opacity-40')}
          />
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-[10px] leading-3 font-semibold tracking-[0.12em] text-brand-700 uppercase">
          {officer.role}
        </span>
        <span className="mt-1 block text-sm leading-5 font-semibold text-brand-950">{officer.name}</span>
        <span className="mt-0.5 block text-[11px] leading-4 text-zinc-400">{academicYear}</span>
      </span>
    </article>
  )
}

function onRosterKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  tab: RosterTab,
  setTab: (id: RosterTab) => void,
) {
  const index = rosterTabs.findIndex((item) => item.id === tab)
  if (index < 0) return
  const next =
    event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? rosterTabs[(index + 1) % rosterTabs.length]
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? rosterTabs[(index - 1 + rosterTabs.length) % rosterTabs.length]
        : event.key === 'Home'
          ? rosterTabs[0]
          : event.key === 'End'
            ? rosterTabs[rosterTabs.length - 1]
            : null
  if (!next) return
  event.preventDefault()
  setTab(next.id)
  document.getElementById(`roster-tab-${next.id}`)?.focus()
}
