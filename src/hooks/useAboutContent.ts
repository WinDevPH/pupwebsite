import { useEffect, useState } from 'react'
import {
  ABOUT_CONTENT_DEFAULTS,
  getAboutContent,
  type AboutSections,
} from '@/lib/about-content-api'

export function useAboutContent() {
  const [sections, setSections] = useState<AboutSections>(ABOUT_CONTENT_DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    void getAboutContent().then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setSections(ABOUT_CONTENT_DEFAULTS)
        setError(result.error)
        setLoading(false)
        return
      }
      setSections(result.data.sections)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { sections, loading, error }
}
