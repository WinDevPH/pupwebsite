import { unreachableServerMessage } from '@/lib/unreachable-server'
export type AboutTextSection = { text: string }

export type AboutListItem = {
  icon: string
  title: string
  text: string
}

export type AboutHistoryItem = {
  when: string
  title: string
  text: string
  note: string
}

export type AboutListSection = { items: AboutListItem[] }
export type AboutHistorySection = { items: AboutHistoryItem[] }

export type AboutSectionKey =
  | 'mission'
  | 'vision'
  | 'values'
  | 'goals'
  | 'mandate'
  | 'agenda'
  | 'history'

export type AboutSections = {
  mission: AboutTextSection
  vision: AboutTextSection
  values: AboutListSection
  goals: AboutListSection
  mandate: AboutListSection
  agenda: AboutListSection
  history: AboutHistorySection
}

type ApiFailure = { ok: false; error: string; status: number }
type ApiOk<T> = { ok: true; data: T }

async function request<T>(path: string, init?: RequestInit): Promise<ApiOk<T> | ApiFailure> {
  try {
    const response = await fetch(path, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
      ...init,
    })
    const payload = (await response.json().catch(() => null)) as
      | ({ ok?: boolean; error?: string } & T)
      | null

    if (!response.ok || !payload?.ok) {
      return {
        ok: false,
        error: payload?.error || 'Something went wrong. Please try again.',
        status: response.status,
      }
    }

    return { ok: true, data: payload as T }
  } catch {
    return {
      ok: false,
      error: unreachableServerMessage(),
      status: 0,
    }
  }
}

export const ABOUT_SECTION_KEYS: AboutSectionKey[] = [
  'mission',
  'vision',
  'values',
  'goals',
  'mandate',
  'agenda',
  'history',
]

/** Hardcoded fallbacks matching the original The Council page copy. */
export const ABOUT_CONTENT_DEFAULTS: AboutSections = {
  mission: {
    text: 'The PUP College of Law Student Council, in cognizance of its vision, commits itself to act as the unifying and motivating force among the law studentry and student activities related to them. Its focus is to promote the welfare of the law students in line with the mission-vision of the Polytechnic University of the Philippines. Among others, it shall be the forefront in protecting and upholding the democratic rights and welfare of the students, maintaining institutional integrity, and serving as the primary representation of all law students in administrative and academic affairs.',
  },
  vision: {
    text: 'The PUP College of Law Student Council envisions itself as the premier law student government of the Polytechnic University of the Philippines which unites, empowers, and motivates the student body toward the realization of their legal and professional goals, working toward the common good, justice, and the rule of law in the spirit of dedicated service.',
  },
  values: {
    items: [
      {
        icon: 'scale',
        title: 'The Rule of Law & Constitutionalism',
        text: 'Acting as the steadfast vanguard of the Philippine Constitution and laws, upholding legal integrity, and ensuring that all actions respect established legal frameworks.',
      },
      {
        icon: 'graduation-cap',
        title: 'Academic Excellence',
        text: 'Promoting continuous growth in the legal profession through novel and vital studies designed to contribute profound knowledge to the Philippine legal system.',
      },
      {
        icon: 'shield-check',
        title: 'Ethical Conduct & Integrity',
        text: 'Securing the highest standard of ethical conduct for council members, students, and the legal profession as a whole, strictly prohibiting the use of council names or property for personal gain.',
      },
      {
        icon: 'heart-handshake',
        title: 'Fundamental Human Rights & Dignity',
        text: 'Unwaveringly upholding fundamental respect for human dignity, the protection of individual rights and liberties, equality, and justice for every individual.',
      },
      {
        icon: 'landmark',
        title: 'Democratic Representation & Due Process',
        text: "Safeguarding every student's right to due process, equal protection, active participation in governance, and freedom of expression.",
      },
      {
        icon: 'eye',
        title: 'Transparency & Accountability',
        text: 'Providing the student body with accessible records, documents, and papers pertaining to all official acts, transactions, and decisions of the Council.',
      },
    ],
  },
  goals: {
    items: [
      {
        icon: 'messages-square',
        title: 'Participatory Governance',
        text: 'To establish digital avenues, online helpdesks, and feedback networks where law students can easily stay updated on council activities, raise concerns, and suggest improvements.',
      },
      {
        icon: 'calendar-check',
        title: 'Ease of Doing Student Activities',
        text: 'To streamline administrative processes and recommend efficient requirements, enabling local law student organizations and committees to execute academic and extracurricular events expeditiously.',
      },
      {
        icon: 'workflow',
        title: 'Efficient and Effective Internal Organization',
        text: 'To establish necessary administrative committees, streamline internal council protocols, and harmonize the functions of the Student Council with class beadles and recognized organizations.',
      },
      {
        icon: 'scale',
        title: 'Genuine Student Representation',
        text: 'To champion law student rights to due process and equal protection, expedite the adoption of student-centric policies, and ensure inclusive transparency in administrative and academic affairs.',
      },
      {
        icon: 'graduation-cap',
        title: 'Academic & Welfare Transition Support',
        text: "To implement projects, masterclasses, and resource drives that address law students' academic pressures and schedule transitions.",
      },
      {
        icon: 'handshake',
        title: 'Responsible and Unified Student Council',
        text: 'To cultivate a deep sense of camaraderie, integrity, and ethical responsibility among all Council officers and class representatives.',
      },
      {
        icon: 'megaphone',
        title: 'Legal Campaigns & Advocacies',
        text: 'To implement relevant and timely advocacy initiatives that increase awareness of social realities and position law students at the forefront of justice and nation-building.',
      },
      {
        icon: 'heart-handshake',
        title: 'Socio-Civic and Community Engagement',
        text: "To spearhead meaningful community-oriented programs aligned with the legal profession's commitment to public service.",
      },
      {
        icon: 'flag',
        title: 'Lawan Identity & Culture',
        text: 'To carry out initiatives and communications that highlight the diverse talents, resilience, and exceptionality within the PUP College of Law studentry.',
      },
      {
        icon: 'scroll-text',
        title: 'Council Transparency',
        text: 'To provide the student body with accessible platform, including this centralized website, to view Board Resolutions, financial liquidation reports, and project statuses.',
      },
      {
        icon: 'radio',
        title: 'Transformational Public Presence',
        text: "To expand the council's digital reach, establish modern information dissemination systems, and ensure seamless communication across all law student batches.",
      },
      {
        icon: 'network',
        title: 'Inter-Org & Local Alliance Work',
        text: "To fully realize the council's role as the central channel of communication among law student organizations, the Bar Operations, and the Student Journal.",
      },
      {
        icon: 'globe',
        title: 'Establishment of External Networks',
        text: 'To foster strong connections with external law student associations, bar organizations, and legal sectors outside the University.',
      },
    ],
  },
  mandate: {
    items: [
      {
        icon: 'workflow',
        title: 'Projects and policies',
        text: 'The PUP COL SC is the forefront project manager of all student projects and policies, committed to ensuring the attainment of transformative objectives for all its initiatives, from initiation and formulation to implementation and conclusion.',
      },
      {
        icon: 'handshake',
        title: 'With the College',
        text: 'The PUP COL SC works hand-in-hand with the College of Law administration, the Dean’s Office, faculty members, and different student organizations to accomplish and implement key academic and student-welfare events.',
      },
    ],
  },
  agenda: {
    items: [
      {
        icon: 'heart-handshake',
        title: 'Student welfare',
        text: 'We are seeing a year of sustainable student-welfare activities and programs at every front, both a culmination of all rigorous academic efforts and the beginning of a long journey toward the legal profession. The path of legal education may, at times, be filled with pressure and tests of endurance, but through our passion for justice and truth, we will strive forward.',
      },
      {
        icon: 'scale',
        title: 'Rule of law',
        text: 'Relieving our identities as resolute law students and future advocates in these demanding times, we will face all hurdles and establish milestones, in genuine representation of the PUP College of Law student body. Together, let us uphold excellence, service, and the rule of law!',
      },
    ],
  },
  history: {
    items: [
      {
        when: 'On record',
        title: 'Registered with the SEC',
        text: 'SEC Reg. No. 2022030045051-05. The Council keeps this registration with the Securities and Exchange Commission and remains the student government of the College of Law.',
        note: 'Student Council register',
      },
      {
        when: '2013',
        title: 'The College offers the Juris Doctor',
        text: 'The College opened with the Bachelor of Laws. In 2013, PUP was among the first law schools in the Philippines to offer the Juris Doctor program.',
        note: 'PUP College of Law',
      },
      {
        when: 'August 19, 2008',
        title: 'Council officers take their oath',
        text: 'Officers of the PUP College of Law Supreme Student Council took their oath at the University President’s office. Dean Atty. Roseller De La Pena escorted them. The oath bound each officer to the duties of the Council, its Constitution, and its laws.',
        note: 'Oath of office, recorded that day',
      },
      {
        when: 'May 25, 2001',
        title: 'The College of Law is established',
        text: 'The PUP Board of Regents approved Resolution No. 115, Series of 2001, so the College of Law could open in the first semester of A.Y. 2001–2002. In January 2001 the University President asked the Dean of the College of Accountancy and Law to prepare the proposal under DECS Order No. 27 and CHED Memorandum Order No. 46, series of 1996. The University Academic Council endorsed it in a letter dated the same day.',
        note: 'PUP College of Law',
      },
    ],
  },
}

function mergeSections(partial: Partial<AboutSections> | null | undefined): AboutSections {
  const base = structuredClone(ABOUT_CONTENT_DEFAULTS)
  if (!partial) return base
  for (const key of ABOUT_SECTION_KEYS) {
    const value = partial[key]
    if (!value) continue
    if (key === 'mission' || key === 'vision') {
      const text = typeof (value as AboutTextSection).text === 'string' ? (value as AboutTextSection).text.trim() : ''
      if (text) base[key] = { text }
      continue
    }
    if (key === 'history') {
      const items = Array.isArray((value as AboutHistorySection).items)
        ? (value as AboutHistorySection).items
        : []
      if (items.length) base.history = { items: items.map((item) => ({ ...item })) }
      continue
    }
    const items = Array.isArray((value as AboutListSection).items)
      ? (value as AboutListSection).items
      : []
    if (items.length) {
      base[key] = { items: items.map((item) => ({ ...item })) }
    }
  }
  return base
}

export async function getAboutContent() {
  const result = await request<{ sections: Partial<AboutSections> }>('/api/about-content.php')
  if (!result.ok) return result
  return { ok: true as const, data: { sections: mergeSections(result.data.sections) } }
}

export async function saveAboutSections(sections: Partial<AboutSections>) {
  const result = await request<{ sections: Partial<AboutSections>; saved: string[] }>(
    '/api/about-content.php',
    {
      method: 'PUT',
      body: JSON.stringify({ sections }),
    },
  )
  if (!result.ok) return result
  return {
    ok: true as const,
    data: { sections: mergeSections(result.data.sections), saved: result.data.saved },
  }
}

export function emptyListItem(icon = 'scale'): AboutListItem {
  return { icon, title: '', text: '' }
}

export function emptyHistoryItem(): AboutHistoryItem {
  return { when: '', title: '', text: '', note: '' }
}
