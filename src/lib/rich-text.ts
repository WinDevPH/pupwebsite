const ALLOWED_TAGS = new Set([
  'P',
  'BR',
  'STRONG',
  'B',
  'EM',
  'I',
  'U',
  'S',
  'STRIKE',
  'UL',
  'OL',
  'LI',
  'A',
])

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** Convert plain text (legacy rows) into basic HTML paragraphs. */
export function plainTextToHtml(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed
  return trimmed
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n').map((line) => escapeHtml(line)).join('<br>')
      return `<p>${lines || '<br>'}</p>`
    })
    .join('')
}

export function stripHtml(value: string) {
  if (!value) return ''
  if (typeof document === 'undefined') {
    return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  const root = document.createElement('div')
  root.innerHTML = value
  return (root.textContent || '').replace(/\s+/g, ' ').trim()
}

export function isEmptyRichText(value: string) {
  return stripHtml(value) === ''
}

/** Keep only a small formatting whitelist for stored HTML. */
export function sanitizeRichHtml(dirty: string) {
  if (!dirty.trim()) return ''
  if (typeof document === 'undefined') return dirty

  const template = document.createElement('template')
  template.innerHTML = dirty

  const walk = (node: Node) => {
    const children = [...node.childNodes]
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) continue
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.parentNode?.removeChild(child)
        continue
      }

      const el = child as HTMLElement
      const tag = el.tagName.toUpperCase()

      if (!ALLOWED_TAGS.has(tag)) {
        const parent = el.parentNode
        if (!parent) continue
        while (el.firstChild) parent.insertBefore(el.firstChild, el)
        parent.removeChild(el)
        continue
      }

      // Drop all attributes except safe href on anchors.
      const attrs = [...el.attributes]
      for (const attr of attrs) {
        if (tag === 'A' && attr.name.toLowerCase() === 'href') continue
        el.removeAttribute(attr.name)
      }

      if (tag === 'A') {
        const href = (el.getAttribute('href') || '').trim()
        if (!/^https?:\/\//i.test(href) && !href.startsWith('mailto:') && !href.startsWith('/')) {
          el.removeAttribute('href')
        } else {
          el.setAttribute('href', href)
          el.setAttribute('rel', 'noopener noreferrer')
          if (/^https?:\/\//i.test(href)) el.setAttribute('target', '_blank')
        }
      }

      walk(el)
    }
  }

  walk(template.content)
  const cleaned = template.innerHTML.trim()
  return isEmptyRichText(cleaned) ? '' : cleaned
}
