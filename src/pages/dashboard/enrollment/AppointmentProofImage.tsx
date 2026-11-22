import { useEffect, useState } from 'react'
import { ImageOff, Loader2 } from 'lucide-react'
import { appointmentProofUrl } from '@/lib/enrollment-appointments-api'
import { cn } from '@/lib/utils'

type ProofVariant = 'full' | 'panel' | 'thumb'

type AppointmentProofImageProps = {
  appointmentId: number
  proofName?: string
  variant?: ProofVariant
  className?: string
  imgClassName?: string
}

export function AppointmentProofImage({
  appointmentId,
  proofName = 'Payment proof',
  variant = 'full',
  className,
  imgClassName,
}: AppointmentProofImageProps) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    async function loadProof() {
      setLoading(true)
      setFailed(false)
      setSrc(null)
      try {
        const response = await fetch(appointmentProofUrl(appointmentId), {
          credentials: 'include',
          headers: { Accept: 'image/*,application/octet-stream' },
        })
        if (!response.ok) throw new Error('missing')
        const contentType = response.headers.get('content-type') || ''
        if (contentType.includes('application/json')) throw new Error('missing')
        const blob = await response.blob()
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      } catch {
        if (!cancelled) {
          setFailed(true)
          setSrc(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadProof()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [appointmentId])

  if (variant === 'thumb') {
    return (
      <div
        className={cn(
          'relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900',
          className,
        )}
        title={proofName}
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin text-zinc-400" aria-hidden />
        ) : failed || !src ? (
          <ImageOff className="size-3.5 text-zinc-300 dark:text-zinc-600" aria-hidden />
        ) : (
          <img
            src={src}
            alt={proofName}
            className={cn('size-full object-cover', imgClassName)}
          />
        )}
      </div>
    )
  }

  if (variant === 'panel') {
    return (
      <div className={cn('relative min-h-[11rem] bg-zinc-50 dark:bg-zinc-900', className)}>
        {loading ? (
          <div className="flex min-h-[11rem] items-center justify-center gap-2 text-[13px] text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading proof…
          </div>
        ) : failed || !src ? (
          <div className="flex min-h-[11rem] flex-col items-center justify-center gap-2 px-4 py-8 text-center">
            <ImageOff className="h-7 w-7 text-zinc-300 dark:text-zinc-600" aria-hidden />
            <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-200">
              Proof file unavailable
            </p>
            <p className="max-w-sm text-[12px] leading-5 text-zinc-500">
              The image is on record but missing from storage. Replace it with a new upload.
            </p>
          </div>
        ) : (
          <img
            src={src}
            alt={proofName || 'Payment proof preview'}
            className={cn('max-h-44 w-full object-cover', imgClassName)}
          />
        )}
      </div>
    )
  }

  return (
    <div className={cn('overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800', className)}>
      {loading ? (
        <div className="flex min-h-[12rem] items-center justify-center gap-2 bg-zinc-50 text-[13px] text-zinc-500 dark:bg-zinc-900">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading proof…
        </div>
      ) : failed || !src ? (
        <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 bg-zinc-50 px-4 py-8 text-center dark:bg-zinc-900">
          <ImageOff className="h-8 w-8 text-zinc-300 dark:text-zinc-600" aria-hidden />
          <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-200">
            Proof file unavailable
          </p>
          <p className="max-w-sm text-[12px] leading-5 text-zinc-500">
            The image could not be loaded from storage. Ask the student to re-upload, or replace it
            from Edit.
          </p>
        </div>
      ) : (
        <img
          src={src}
          alt={proofName || 'Payment proof'}
          className={cn(
            'max-h-[28rem] w-full object-contain bg-zinc-50 dark:bg-zinc-900',
            imgClassName,
          )}
        />
      )}
    </div>
  )
}
