import { useCallback, useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import Cropper, { type Area } from 'react-easy-crop'
import { Check, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { setPageScrollLocked } from '@/hooks/useLenis'
import {
  getCroppedImageBlob,
  type AspectPreset,
  type CropAreaPixels,
} from '@/lib/image-crop'
import { cn } from '@/lib/utils'
import 'react-easy-crop/react-easy-crop.css'

export type ImageCropDialogProps = {
  open: boolean
  imageSrc: string
  fileName?: string
  mime?: string
  title?: string
  /** Default aspect ratio (null = free). */
  aspect?: number | null
  presets?: AspectPreset[]
  onCancel: () => void
  onConfirm: (file: File) => void | Promise<void>
}

export function ImageCropDialog({
  open,
  imageSrc,
  fileName = 'image',
  mime = 'image/jpeg',
  title = 'Crop image',
  aspect: initialAspect = 16 / 9,
  presets,
  onCancel,
  onConfirm,
}: ImageCropDialogProps) {
  const titleId = useId()
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [aspect, setAspect] = useState<number | null>(initialAspect)
  const [croppedArea, setCroppedArea] = useState<CropAreaPixels | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const aspectList =
    presets ??
    ([
      { id: 'default', label: 'Frame', value: initialAspect },
      { id: 'free', label: 'Free', value: null },
    ] satisfies AspectPreset[])

  useEffect(() => {
    if (!open) return
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setAspect(initialAspect)
    setCroppedArea(null)
    setBusy(false)
    setError('')
  }, [open, imageSrc, initialAspect])

  useEffect(() => {
    if (!open) return
    setPageScrollLocked(true)
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      setPageScrollLocked(false)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, busy, onCancel])

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedArea({
      x: areaPixels.x,
      y: areaPixels.y,
      width: areaPixels.width,
      height: areaPixels.height,
    })
  }, [])

  async function handleApply() {
    if (!croppedArea || busy) return
    setBusy(true)
    setError('')
    try {
      const file = await getCroppedImageBlob(imageSrc, croppedArea, {
        mime,
        fileName,
      })
      await onConfirm(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not crop the image.')
      setBusy(false)
    }
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-brand-950/55 dark:bg-black/70"
        aria-label="Close crop"
        disabled={busy}
        onClick={() => {
          if (!busy) onCancel()
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(94dvh,44rem)] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:border dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3.5 sm:px-5 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
              Media
            </p>
            <h2
              id={titleId}
              className="truncate text-[15px] font-semibold text-zinc-900 dark:text-zinc-50"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close"
            className="inline-flex size-9 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="relative min-h-[16rem] flex-1 bg-zinc-950 sm:min-h-[22rem]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect ?? undefined}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid
            objectFit="contain"
            classes={{
              containerClassName: 'bg-zinc-950',
              mediaClassName: 'max-h-full',
            }}
          />
        </div>

        <div className="space-y-3 border-t border-zinc-100 px-4 py-3.5 sm:px-5 dark:border-zinc-800">
          <div className="flex flex-wrap gap-1.5">
            {aspectList.map((preset) => {
              const active =
                (preset.value === null && aspect === null) ||
                (preset.value !== null &&
                  aspect !== null &&
                  Math.abs(preset.value - aspect) < 0.001)
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={busy}
                  onClick={() => setAspect(preset.value)}
                  className={cn(
                    'inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-semibold transition',
                    active
                      ? 'border-brand-600 bg-brand-50 text-brand-900 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-100'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300',
                  )}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>

          <label className="flex items-center gap-3">
            <span className="w-12 shrink-0 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
              Zoom
            </span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              disabled={busy}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="h-1.5 w-full cursor-pointer accent-brand-700"
              aria-label="Zoom"
            />
          </label>

          {error ? (
            <p className="text-[12px] font-medium text-maroon-700 dark:text-maroon-300">{error}</p>
          ) : (
            <p className="text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">
              Drag to reposition. Adjust the frame so nothing important is cut off, then apply.
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-zinc-100 px-4 py-3.5 sm:px-5 dark:border-zinc-800">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="flex-1 rounded-xl"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="lg"
            className="flex-1 rounded-xl"
            disabled={busy || !croppedArea}
            onClick={() => void handleApply()}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Check className="size-4" aria-hidden />
            )}
            {busy ? 'Applying…' : 'Apply crop'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
