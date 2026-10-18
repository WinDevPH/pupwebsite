import { useCallback, useEffect, useState } from 'react'

export type CropSession = {
  url: string
  name: string
  mime: string
}

export function validateImageUpload(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return 'Use a JPG, PNG, WEBP, or GIF image.'
  }
  if (file.size > 20 * 1024 * 1024) {
    return 'Image is too large. Max size is 20 MB.'
  }
  return null
}

export function useImageCropUpload() {
  const [cropSession, setCropSession] = useState<CropSession | null>(null)

  const closeCrop = useCallback(() => {
    setCropSession((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return null
    })
  }, [])

  useEffect(() => {
    return () => {
      setCropSession((prev) => {
        if (prev) URL.revokeObjectURL(prev.url)
        return null
      })
    }
  }, [])

  function openCrop(
    file: File | null | undefined,
    options?: { busy?: boolean; onInvalid?: (message: string) => void },
  ) {
    if (!file || options?.busy) return false
    const error = validateImageUpload(file)
    if (error) {
      options?.onInvalid?.(error)
      return false
    }
    setCropSession((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return {
        url: URL.createObjectURL(file),
        name: file.name,
        mime: file.type || 'image/jpeg',
      }
    })
    return true
  }

  return { cropSession, openCrop, closeCrop }
}
