export type CropAreaPixels = {
  x: number
  y: number
  width: number
  height: number
}

export type AspectPreset = {
  id: string
  label: string
  /** null = free / original */
  value: number | null
}

export const coverAspectPresets: AspectPreset[] = [
  { id: '16:9', label: '16:9', value: 16 / 9 },
  { id: '4:3', label: '4:3', value: 4 / 3 },
  { id: '1:1', label: '1:1', value: 1 },
  { id: '3:4', label: '3:4', value: 3 / 4 },
  { id: 'free', label: 'Free', value: null },
]

export const portraitAspectPresets: AspectPreset[] = [
  { id: '3:4', label: '3:4', value: 3 / 4 },
  { id: '1:1', label: '1:1', value: 1 },
  { id: '4:5', label: '4:5', value: 4 / 5 },
  { id: '16:9', label: '16:9', value: 16 / 9 },
  { id: 'free', label: 'Free', value: null },
]

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () => reject(new Error('Could not load image for crop.')))
    image.crossOrigin = 'anonymous'
    image.src = src
  })
}

/** Draw the cropped region to a canvas and return a Blob. */
export async function getCroppedImageBlob(
  imageSrc: string,
  crop: CropAreaPixels,
  options?: { mime?: string; quality?: number; fileName?: string },
): Promise<File> {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  const width = Math.max(1, Math.round(crop.width))
  const height = Math.max(1, Math.round(crop.height))
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not prepare crop canvas.')

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    width,
    height,
  )

  const mime =
    options?.mime && options.mime !== 'image/gif' ? options.mime : 'image/jpeg'
  const quality = options?.quality ?? 0.92

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) reject(new Error('Could not export cropped image.'))
        else resolve(result)
      },
      mime,
      quality,
    )
  })

  const base = (options?.fileName || 'image').replace(/\.[^.]+$/, '')
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
  return new File([blob], `${base}-cropped.${ext}`, { type: mime })
}
