/** Load an image URL as a data URL. */
export async function loadImageDataUrl(src: string): Promise<string> {
  const absolute = /^https?:|^data:|^blob:/i.test(src) ? src : new URL(src, window.location.href).href
  const response = await fetch(absolute)
  const blob = await response.blob()
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function loadHtmlImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Logo failed to load'))
    img.src = dataUrl
  })
}

/**
 * Fit a logo to its natural outline on a solid header color, with a white
 * silhouette stroke so the crest/seal reads clearly on purple.
 */
export async function renderLogoWithWhiteOutline(
  src: string,
  sizePx: number,
  options?: {
    headerBg?: [number, number, number]
    outlinePx?: number
    transparentBg?: boolean
  },
): Promise<string> {
  const headerBg = options?.headerBg ?? ([95, 24, 184] as [number, number, number])
  const outlinePx = Math.max(0, Math.round(options?.outlinePx ?? sizePx * 0.045))
  const transparentBg = options?.transparentBg ?? false

  const dataUrl = await loadImageDataUrl(src)
  const img = await loadHtmlImage(dataUrl)

  const canvas = document.createElement('canvas')
  canvas.width = sizePx
  canvas.height = sizePx
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  if (transparentBg) {
    ctx.clearRect(0, 0, sizePx, sizePx)
  } else {
    ctx.fillStyle = `rgb(${headerBg[0]}, ${headerBg[1]}, ${headerBg[2]})`
    ctx.fillRect(0, 0, sizePx, sizePx)
  }

  const pad = outlinePx + 1
  const inner = Math.max(1, sizePx - pad * 2)
  const scale = Math.min(inner / img.width, inner / img.height)
  const drawW = img.width * scale
  const drawH = img.height * scale
  const dx = (sizePx - drawW) / 2
  const dy = (sizePx - drawH) / 2

  const stamp = document.createElement('canvas')
  stamp.width = sizePx
  stamp.height = sizePx
  const stampCtx = stamp.getContext('2d')
  if (!stampCtx) throw new Error('Canvas unavailable')
  stampCtx.drawImage(img, dx, dy, drawW, drawH)

  if (outlinePx > 0) {
    // Solid white silhouette of the logo shape
    const silhouette = document.createElement('canvas')
    silhouette.width = sizePx
    silhouette.height = sizePx
    const silCtx = silhouette.getContext('2d')
    if (!silCtx) throw new Error('Canvas unavailable')
    silCtx.drawImage(stamp, 0, 0)
    silCtx.globalCompositeOperation = 'source-in'
    silCtx.fillStyle = '#ffffff'
    silCtx.fillRect(0, 0, sizePx, sizePx)

    // Ring of offsets → white outline following the alpha edge
    for (let y = -outlinePx; y <= outlinePx; y += 1) {
      for (let x = -outlinePx; x <= outlinePx; x += 1) {
        if (x * x + y * y > outlinePx * outlinePx) continue
        if (x === 0 && y === 0) continue
        ctx.drawImage(silhouette, x, y)
      }
    }
  }

  ctx.drawImage(stamp, 0, 0)
  return canvas.toDataURL('image/png')
}
