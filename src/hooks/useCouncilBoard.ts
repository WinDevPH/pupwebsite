import { useEffect, useState } from 'react'
import {
  listCouncilMembers,
  type CouncilBoard,
  type CouncilMemberRecord,
  type CouncilSection,
} from '@/lib/council-members-api'

export type CouncilSeat = {
  role: string
  name: string
  vacant?: boolean
  photo?: string
}

export function memberToSeat(item: CouncilMemberRecord): CouncilSeat {
  return {
    role: item.role,
    name: item.name,
    vacant: item.vacant,
    photo: item.photo ?? undefined,
  }
}

/** Public roster for a board — uses admin-pinned A.Y. (or latest published). */
export function useCouncilBoard(board: CouncilBoard) {
  const [year, setYear] = useState<string | null>(null)
  const [pinned, setPinned] = useState(false)
  const [items, setItems] = useState<CouncilMemberRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    void listCouncilMembers({ board }).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setItems([])
        setYear(null)
        setPinned(false)
        setError(result.error)
        setLoading(false)
        return
      }
      setItems(result.data.items)
      setYear(result.data.academicYear ?? null)
      setPinned(result.data.displayMode === 'pinned')
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [board])

  function bySection(section: CouncilSection) {
    return items.filter((item) => item.section === section).map(memberToSeat)
  }

  return { year, pinned, items, loading, error, bySection }
}

export function councilYearKicker(label: string, year: string | null) {
  return year ? `${label} · A.Y. ${year}` : label
}
