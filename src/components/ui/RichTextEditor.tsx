import { useEffect, useId, useRef, type ReactNode } from 'react'
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Strikethrough,
  Underline,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { plainTextToHtml, sanitizeRichHtml } from '@/lib/rich-text'

type RichTextEditorProps = {
  value: string
  onChange: (html: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  minHeightClassName?: string
  toolbarExtra?: ReactNode
  'aria-label'?: string
}

type FormatCommand =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikeThrough'
  | 'insertUnorderedList'
  | 'insertOrderedList'

function runCommand(command: FormatCommand) {
  document.execCommand(command, false)
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => {
        // Keep selection inside the editor.
        event.preventDefault()
      }}
      onClick={onClick}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-md text-zinc-600 outline-none transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-brand-500/35 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50',
        active && 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200',
      )}
    >
      {children}
    </button>
  )
}

export function RichTextEditor({
  value,
  onChange,
  disabled = false,
  placeholder = 'Write here…',
  className,
  minHeightClassName = 'min-h-[8rem]',
  toolbarExtra,
  'aria-label': ariaLabel = 'Rich text editor',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const lastHtml = useRef('')
  const editorId = useId()

  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const next = plainTextToHtml(value)
    if (next === lastHtml.current) return
    if (el.innerHTML === next) {
      lastHtml.current = next
      return
    }
    el.innerHTML = next
    lastHtml.current = next
  }, [value])

  function emitChange() {
    const el = editorRef.current
    if (!el) return
    const html = sanitizeRichHtml(el.innerHTML)
    lastHtml.current = html
    if (html !== value) onChange(html)
  }

  function apply(command: FormatCommand) {
    if (disabled) return
    editorRef.current?.focus()
    runCommand(command)
    emitChange()
  }

  function applyLink() {
    if (disabled) return
    editorRef.current?.focus()
    const existing = document.queryCommandValue('createLink')
    const next = window.prompt('Link URL', existing || 'https://')
    if (next === null) return
    const trimmed = next.trim()
    if (trimmed === '') {
      document.execCommand('unlink', false)
    } else {
      document.execCommand('createLink', false, trimmed)
    }
    emitChange()
  }

  const empty = sanitizeRichHtml(value) === ''

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-zinc-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.02)] transition focus-within:border-brand-500 focus-within:ring-[3px] focus-within:ring-brand-500/18 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-within:border-brand-400 dark:focus-within:ring-brand-400/22',
        disabled && 'opacity-60',
        className,
      )}
    >
      <div
        role="toolbar"
        aria-label="Formatting"
        aria-controls={editorId}
        className="flex flex-wrap items-center gap-0.5 border-b border-zinc-200/90 bg-zinc-50/90 px-1.5 py-1 dark:border-zinc-800 dark:bg-zinc-900/80"
      >
        <ToolbarButton label="Bold" disabled={disabled} onClick={() => apply('bold')}>
          <Bold className="size-3.5" aria-hidden />
        </ToolbarButton>
        <ToolbarButton label="Italic" disabled={disabled} onClick={() => apply('italic')}>
          <Italic className="size-3.5" aria-hidden />
        </ToolbarButton>
        <ToolbarButton label="Underline" disabled={disabled} onClick={() => apply('underline')}>
          <Underline className="size-3.5" aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label="Strikethrough"
          disabled={disabled}
          onClick={() => apply('strikeThrough')}
        >
          <Strikethrough className="size-3.5" aria-hidden />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" aria-hidden />
        <ToolbarButton
          label="Bulleted list"
          disabled={disabled}
          onClick={() => apply('insertUnorderedList')}
        >
          <List className="size-3.5" aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          disabled={disabled}
          onClick={() => apply('insertOrderedList')}
        >
          <ListOrdered className="size-3.5" aria-hidden />
        </ToolbarButton>
        <ToolbarButton label="Link" disabled={disabled} onClick={applyLink}>
          <Link2 className="size-3.5" aria-hidden />
        </ToolbarButton>
        {toolbarExtra ? (
          <>
            <span className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" aria-hidden />
            {toolbarExtra}
          </>
        ) : null}
      </div>

      <div className="relative">
        {empty ? (
          <span className="pointer-events-none absolute top-2.5 left-3 text-[13px] text-zinc-400 dark:text-zinc-500">
            {placeholder}
          </span>
        ) : null}
        <div
          id={editorId}
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={emitChange}
          onBlur={emitChange}
          className={cn(
            'rich-text-editor w-full px-3 py-2.5 text-[13px] leading-6 text-zinc-900 outline-none dark:text-zinc-100',
            minHeightClassName,
            '[&_a]:text-brand-700 [&_a]:underline dark:[&_a]:text-brand-300',
            '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5',
            '[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5',
            '[&_p]:my-0 [&_p+p]:mt-2',
          )}
        />
      </div>
    </div>
  )
}

export function RichTextContent({
  html,
  className,
}: {
  html: string
  className?: string
}) {
  const clean = sanitizeRichHtml(plainTextToHtml(html))
  if (!clean) return null
  return (
    <div
      className={cn(
        'rich-text-content text-sm leading-6 text-zinc-600 dark:text-zinc-400',
        '[&_a]:font-medium [&_a]:text-brand-700 [&_a]:underline dark:[&_a]:text-brand-300',
        '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
        '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
        '[&_p]:my-0 [&_p+p]:mt-2',
        '[&_strong]:font-semibold [&_b]:font-semibold',
        '[&_em]:italic [&_i]:italic',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}
