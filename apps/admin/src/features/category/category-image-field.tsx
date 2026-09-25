import { useEffect, useRef, useState } from 'react'
import { ImageIcon, Loader2 } from 'lucide-react'
import { MAX_UPLOAD_BYTES, UPLOAD_CONTENT_TYPES } from '@shop-38/contracts'
import { Button } from '@/components/ui/button'
import { uploadFile } from '@/lib/upload-file'

const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / (1024 * 1024)

/** Checked before anything is sent, so an obviously wrong file fails instantly and in Mongolian. */
function validateImage(file: File): string | null {
  if (!(UPLOAD_CONTENT_TYPES as readonly string[]).includes(file.type)) {
    return 'Зөвхөн JPG, PNG, WebP, AVIF эсвэл GIF зураг оруулна уу.'
  }
  if (file.size === 0) return 'Файл хоосон байна.'
  if (file.size > MAX_UPLOAD_BYTES) return `Зургийн хэмжээ ${MAX_UPLOAD_MB} МБ-аас их байж болохгүй.`
  return null
}

type CategoryImageFieldProps = {
  /** Put on the file input, so the field's `<Label htmlFor>` opens the picker. */
  id: string
  /** The image the category already has, if any. */
  initialUrl: string | null
  /** Called with the uploaded file's id, or `null` when the image is removed. */
  onChange: (fileId: string | null) => void
  onUploadingChange: (isUploading: boolean) => void
}

/**
 * Uploads a picked image straight away, so saving the form only has to send its id.
 * The current value changes only once an upload succeeds: a failed replacement
 * leaves the previous image in place instead of removing it.
 */
export function CategoryImageField({
  id,
  initialUrl,
  onChange,
  onUploadingChange,
}: CategoryImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const blobUrlsRef = useRef(new Set<string>())
  /** What the saved value shows: the existing image, or the last successful upload. */
  const [committedUrl, setCommittedUrl] = useState(initialUrl)
  /** A local preview of the file being uploaded right now. */
  const [pendingUrl, setPendingUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isUploading = pendingUrl !== null
  const previewUrl = pendingUrl ?? committedUrl

  // Closing the dialog mid-upload cancels it and frees every local preview.
  useEffect(() => {
    const blobUrls = blobUrlsRef.current
    return () => {
      abortRef.current?.abort()
      // Detach it first, so the aborted upload's `finally` skips setting state on an unmounted form.
      abortRef.current = null
      blobUrls.forEach((url) => URL.revokeObjectURL(url))
      blobUrls.clear()
    }
  }, [])

  function createPreview(file: File) {
    const url = URL.createObjectURL(file)
    blobUrlsRef.current.add(url)
    return url
  }

  function releasePreview(url: string | null) {
    if (!url || !blobUrlsRef.current.delete(url)) return
    URL.revokeObjectURL(url)
  }

  async function handleFile(file: File) {
    const problem = validateImage(file)
    if (problem) {
      setError(problem)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const localUrl = createPreview(file)
    setPendingUrl(localUrl)
    setError(null)
    onUploadingChange(true)

    try {
      const uploaded = await uploadFile(file, controller.signal)
      if (controller.signal.aborted) {
        releasePreview(localUrl)
        return
      }
      releasePreview(committedUrl)
      setCommittedUrl(localUrl)
      onChange(uploaded.id)
    } catch (uploadError) {
      releasePreview(localUrl)
      if (controller.signal.aborted) return
      setError(uploadError instanceof Error ? uploadError.message : 'Зураг оруулж чадсангүй.')
    } finally {
      // A newer pick replaced this upload, and that one owns the state from here on.
      if (abortRef.current === controller) {
        abortRef.current = null
        setPendingUrl(null)
        onUploadingChange(false)
      }
    }
  }

  function handleRemove() {
    releasePreview(committedUrl)
    setCommittedUrl(null)
    setError(null)
    onChange(null)
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-4">
        <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground" aria-hidden />
          )}
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <Loader2 className="size-5 animate-spin" aria-hidden />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            {committedUrl ? 'Зураг солих' : 'Зураг сонгох'}
          </Button>
          {committedUrl && !isUploading && (
            <Button type="button" variant="ghost" size="sm" onClick={handleRemove}>
              Зураг устгах
            </Button>
          )}
        </div>

        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={UPLOAD_CONTENT_TYPES.join(',')}
          className="sr-only"
          disabled={isUploading}
          onChange={(event) => {
            const file = event.target.files?.[0]
            // Reset, so picking the same file again after an error still fires `change`.
            event.target.value = ''
            if (file) void handleFile(file)
          }}
        />
      </div>

      <p className={error ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'} aria-live="polite">
        {error ??
          (isUploading
            ? 'Зургийг хуулж байна…'
            : `Заавал биш. JPG, PNG, WebP, AVIF эсвэл GIF, ${MAX_UPLOAD_MB} МБ хүртэл.`)}
      </p>
    </div>
  )
}
