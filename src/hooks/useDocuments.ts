import { useEffect, useState } from 'react'
import { listDocuments, type DocumentCategory, type DocumentRecord } from '@/lib/documents-api'

export function useDocuments(category: DocumentCategory) {
  const [items, setItems] = useState<DocumentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    void listDocuments({ category }).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setItems([])
        setError(result.error)
        setLoading(false)
        return
      }
      setItems(result.data.items)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [category])

  return { items, loading, error }
}
