import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { ConfirmDeleteDialog } from '@/components/portal/ConfirmDeleteDialog'
import {
  catalogInput,
  catalogTextarea,
  catalogToolbarIconBtn,
  formWorkspacePrimaryBtnCls,
  tableCheckboxCls,
  workspaceCatalogToolbarIconCls,
  workspaceFormHintCls,
  workspaceFormLabelCls,
} from '@/components/portal/register-ui'
import {
  deleteChatFaq,
  listChatFaqs,
  saveChatFaq,
  type ChatFaqRecord,
} from '@/lib/chat-api'
import { cn } from '@/lib/utils'

type Draft = {
  key: string
  id: number
  question: string
  answer: string
  sortOrder: number
  published: boolean
  dirty: boolean
  saving: boolean
}

type ToastFn = (message: string, variant: 'success' | 'error') => void

function toDraft(item: ChatFaqRecord): Draft {
  return {
    key: String(item.id),
    id: item.id,
    question: item.question,
    answer: item.answer,
    sortOrder: item.sortOrder,
    published: item.published,
    dirty: false,
    saving: false,
  }
}

export function ChatFaqsEditor({ showToast }: { showToast: ToastFn }) {
  const [items, setItems] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadBusy, setReloadBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Draft | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (opts?.soft) setReloadBusy(true)
      const result = await listChatFaqs(true)
      if (!result.ok) {
        showToast(result.error, 'error')
        setLoading(false)
        setReloadBusy(false)
        return
      }
      setItems((result.data.items ?? []).map(toDraft))
      setLoading(false)
      setReloadBusy(false)
    },
    [showToast],
  )

  useEffect(() => {
    void load()
  }, [load])

  const publishedCount = useMemo(() => items.filter((item) => item.published && item.id > 0).length, [items])
  const shownKeys = useMemo(
    () => new Set(items.filter((item) => item.published && item.id > 0).map((item) => item.key)),
    [items],
  )

  function patch(key: string, next: Partial<Draft>) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...next, dirty: true } : item)))
  }

  async function save(item: Draft) {
    const question = item.question.trim()
    const answer = item.answer.trim()
    if (!question || !answer) {
      showToast('Add both a question and an answer.', 'error')
      return
    }
    setItems((prev) => prev.map((row) => (row.key === item.key ? { ...row, saving: true } : row)))
    const result = await saveChatFaq({
      id: item.id > 0 ? item.id : undefined,
      question,
      answer,
      sortOrder: item.sortOrder,
      published: item.published,
    })
    if (!result.ok) {
      setItems((prev) => prev.map((row) => (row.key === item.key ? { ...row, saving: false } : row)))
      showToast(result.error, 'error')
      return
    }
    const saved = toDraft(result.data.item)
    setItems((prev) => prev.map((row) => (row.key === item.key ? saved : row)))
    showToast(item.id > 0 ? 'Question saved.' : 'Question added.', 'success')
  }

  async function move(index: number, direction: -1 | 1) {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= items.length) return
    const a = items[index]
    const b = items[nextIndex]
    if (a.id <= 0 || b.id <= 0) {
      showToast('Save new questions before reordering.', 'error')
      return
    }
    const resultA = await saveChatFaq({
      id: a.id,
      question: a.question.trim(),
      answer: a.answer.trim(),
      sortOrder: b.sortOrder,
      published: a.published,
    })
    const resultB = await saveChatFaq({
      id: b.id,
      question: b.question.trim(),
      answer: b.answer.trim(),
      sortOrder: a.sortOrder,
      published: b.published,
    })
    if (!resultA.ok) {
      showToast(resultA.error, 'error')
      return
    }
    if (!resultB.ok) {
      showToast(resultB.error, 'error')
      return
    }
    await load({ soft: true })
  }

  function addQuestion() {
    const nextOrder = items.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1
    setItems((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}`,
        id: 0,
        question: '',
        answer: '',
        sortOrder: nextOrder,
        published: true,
        dirty: true,
        saving: false,
      },
    ])
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">Suggested questions</p>
          <p className={cn(workspaceFormHintCls, 'mt-0.5')}>
            Published questions appear in the help desk, in this order. Visitors tap one to see its answer in
            the chat.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800 dark:bg-brand-500/15 dark:text-brand-200">
            {publishedCount} published
          </span>
          <button
            type="button"
            title="Reload questions"
            aria-label="Reload questions"
            onClick={() => void load({ soft: true })}
            className={catalogToolbarIconBtn}
          >
            <RefreshCw
              className={`${workspaceCatalogToolbarIconCls} ${reloadBusy ? 'animate-spin' : 'opacity-85'}`}
              aria-hidden
            />
          </button>
          <button type="button" onClick={addQuestion} className={formWorkspacePrimaryBtnCls}>
            <Plus className="size-4" aria-hidden />
            Add question
          </button>
        </div>
      </div>

      <div
        data-lenis-prevent
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
      >
        {loading ? (
          <p className="flex items-center gap-2 py-8 text-sm text-zinc-500">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading questions…
          </p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-12 text-center">
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">No suggested questions</p>
            <p className="mt-1 max-w-sm text-[13px] leading-5 text-zinc-500">
              Add a question and answer. Published items appear in the public help desk.
            </p>
            <button type="button" onClick={addQuestion} className={cn(formWorkspacePrimaryBtnCls, 'mt-4')}>
              <Plus className="size-4" aria-hidden />
              Add question
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item, index) => (
              <li
                key={item.key}
                className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 sm:p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                    {item.id > 0 ? `Question ${index + 1}` : 'New question'}
                    {shownKeys.has(item.key) ? ' · shown in chat' : ''}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Move up"
                      aria-label="Move up"
                      disabled={index === 0 || item.saving}
                      onClick={() => void move(index, -1)}
                      className={catalogToolbarIconBtn}
                    >
                      <ChevronUp className={workspaceCatalogToolbarIconCls} aria-hidden />
                    </button>
                    <button
                      type="button"
                      title="Move down"
                      aria-label="Move down"
                      disabled={index === items.length - 1 || item.saving}
                      onClick={() => void move(index, 1)}
                      className={catalogToolbarIconBtn}
                    >
                      <ChevronDown className={workspaceCatalogToolbarIconCls} aria-hidden />
                    </button>
                    <button
                      type="button"
                      title="Delete question"
                      aria-label="Delete question"
                      disabled={item.saving}
                      onClick={() => {
                        if (item.id <= 0) {
                          setItems((prev) => prev.filter((row) => row.key !== item.key))
                          return
                        }
                        setPendingDelete(item)
                      }}
                      className={catalogToolbarIconBtn}
                    >
                      <Trash2 className={workspaceCatalogToolbarIconCls} aria-hidden />
                    </button>
                  </div>
                </div>
                <label className="block space-y-1.5">
                  <span className={workspaceFormLabelCls}>Question</span>
                  <input
                    type="text"
                    maxLength={240}
                    value={item.question}
                    disabled={item.saving}
                    onChange={(event) => patch(item.key, { question: event.target.value })}
                    placeholder="How do I book a locker?"
                    className={catalogInput}
                  />
                </label>
                <label className="mt-3 block space-y-1.5">
                  <span className={workspaceFormLabelCls}>Answer</span>
                  <textarea
                    maxLength={1500}
                    value={item.answer}
                    disabled={item.saving}
                    onChange={(event) => patch(item.key, { answer: event.target.value })}
                    placeholder="Write the reply visitors will see in chat."
                    className={cn(catalogTextarea, 'min-h-[6.5rem]')}
                  />
                </label>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-zinc-800 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      className={tableCheckboxCls}
                      checked={item.published}
                      disabled={item.saving}
                      onChange={(event) => patch(item.key, { published: event.target.checked })}
                    />
                    Published
                  </label>
                  <button
                    type="button"
                    disabled={item.saving || (!item.dirty && item.id > 0)}
                    onClick={() => void save(item)}
                    className={formWorkspacePrimaryBtnCls}
                  >
                    {item.saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    {item.id > 0 ? 'Save' : 'Add'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pendingDelete ? (
        <ConfirmDeleteDialog
          title={pendingDelete.question.trim() || 'Untitled question'}
          noun="suggested question"
          description="This question will no longer appear in the help desk."
          busy={deleting}
          onCancel={() => {
            if (!deleting) setPendingDelete(null)
          }}
          onConfirm={() => {
            void (async () => {
              setDeleting(true)
              const result = await deleteChatFaq(pendingDelete.id)
              setDeleting(false)
              if (!result.ok) {
                showToast(result.error, 'error')
                return
              }
              setPendingDelete(null)
              setItems((prev) => prev.filter((row) => row.key !== pendingDelete.key))
              showToast('Question deleted.', 'success')
            })()
          }}
        />
      ) : null}
    </div>
  )
}
