import { useCallback, useEffect, useRef, useState } from 'react'
import type { SnackToast } from '@/components/ui/Snackbar'

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number }

export type CmsRow<F> = {
  key: string
  id?: number
  form: F
  saving: boolean
  dirty: boolean
}

type Options<F, R extends { id: number }> = {
  /** Human label used in toasts, e.g. "Organization". */
  label: string
  list: () => Promise<ApiResult<{ items: R[] }>>
  toForm: (record: R) => F
  emptyForm: () => F
  create: (form: F) => Promise<ApiResult<{ item: R }>>
  update: (id: number, form: F) => Promise<ApiResult<{ item: R }>>
  remove: (id: number) => Promise<ApiResult<unknown>>
}

let draftSeq = 0

/** Row-based CRUD state for compact CMS editors (organizations, FAQ, shop, documents). */
export function useCmsRows<F, R extends { id: number }>(options: Options<F, R>) {
  const optionsRef = useRef(options)
  optionsRef.current = options

  const [rows, setRows] = useState<CmsRow<F>[]>([])
  const [loading, setLoading] = useState(true)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [toast, setToast] = useState<SnackToast | null>(null)

  const showToast = useCallback((message: string, variant: SnackToast['variant']) => {
    setToast({ id: Date.now(), message, variant })
  }, [])

  const handleFailure = useCallback(
    (result: { error: string; status: number }) => {
      if (result.status === 401 || result.status === 403) {
        setNeedsLogin(true)
        return
      }
      showToast(result.error, 'error')
    },
    [showToast],
  )

  const reload = useCallback(async () => {
    setLoading(true)
    const result = await optionsRef.current.list()
    if (!result.ok) {
      handleFailure(result)
      setRows([])
      setLoading(false)
      return
    }
    setNeedsLogin(false)
    setRows(
      result.data.items.map((record) => ({
        key: `row-${record.id}`,
        id: record.id,
        form: optionsRef.current.toForm(record),
        saving: false,
        dirty: false,
      })),
    )
    setLoading(false)
  }, [handleFailure])

  useEffect(() => {
    void reload()
  }, [reload])

  const patchRow = useCallback((key: string, patch: Partial<CmsRow<F>>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }, [])

  const edit = useCallback((key: string, patch: Partial<F>) => {
    setRows((current) =>
      current.map((row) =>
        row.key === key ? { ...row, form: { ...row.form, ...patch }, dirty: true } : row,
      ),
    )
  }, [])

  const add = useCallback((patch?: Partial<F>) => {
    draftSeq += 1
    setRows((current) => [
      ...current,
      {
        key: `draft-${draftSeq}`,
        form: { ...optionsRef.current.emptyForm(), ...patch },
        saving: false,
        dirty: true,
      },
    ])
  }, [])

  const save = useCallback(
    async (key: string) => {
      const row = rows.find((item) => item.key === key)
      if (!row || row.saving) return
      const { label, create, update, toForm } = optionsRef.current
      patchRow(key, { saving: true })
      const result =
        row.id === undefined ? await create(row.form) : await update(row.id, row.form)
      if (!result.ok) {
        patchRow(key, { saving: false })
        handleFailure(result)
        return
      }
      const record = result.data.item
      setRows((current) =>
        current.map((item) =>
          item.key === key
            ? { key: `row-${record.id}`, id: record.id, form: toForm(record), saving: false, dirty: false }
            : item,
        ),
      )
      showToast(`${label} saved.`, 'success')
    },
    [handleFailure, patchRow, rows, showToast],
  )

  const remove = useCallback(
    async (key: string) => {
      const row = rows.find((item) => item.key === key)
      if (!row || row.saving) return
      if (row.id === undefined) {
        setRows((current) => current.filter((item) => item.key !== key))
        return
      }
      if (!window.confirm(`Delete this ${optionsRef.current.label.toLowerCase()}?`)) return
      patchRow(key, { saving: true })
      const result = await optionsRef.current.remove(row.id)
      if (!result.ok) {
        patchRow(key, { saving: false })
        handleFailure(result)
        return
      }
      setRows((current) => current.filter((item) => item.key !== key))
      showToast(`${optionsRef.current.label} deleted.`, 'success')
    },
    [handleFailure, patchRow, rows, showToast],
  )

  return { rows, loading, needsLogin, toast, setToast, showToast, reload, edit, add, save, remove }
}
