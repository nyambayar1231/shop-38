/** Longest side, in pixels, of a stored image. Enough for a sharp full-width product photo. */
const MAX_DIMENSION = 2000

/** Types the picker accepts before conversion. HEIC/HEIF is what iPhones shoot. */
export const PICKABLE_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/heic',
  'image/heif',
] as const

/** 50 MiB. The original only has to fit in memory; what gets uploaded is much smaller. */
export const MAX_PICKED_BYTES = 50 * 1024 * 1024

/** Some browsers leave `File.type` empty for HEIC, so the extension counts too. */
export const isHeic = (file: File) =>
  file.type === 'image/heic' || file.type === 'image/heif' || /\.hei[cf]$/i.test(file.name)

export const isPickableImage = (file: File) =>
  isHeic(file) || (PICKABLE_IMAGE_TYPES as readonly string[]).includes(file.type)

/**
 * Safari decodes HEIC natively; other browsers need the WASM decoder, which is
 * loaded only the first time it is needed.
 */
async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch (error) {
    if (!isHeic(file)) throw error
    const { heicTo } = await import('heic-to')
    return createImageBitmap(await heicTo({ blob: file, type: 'image/jpeg', quality: 0.95 }))
  }
}

const replaceExtension = (name: string, extension: string) =>
  `${name.replace(/\.[^.]+$/, '') || 'image'}.${extension}`

/**
 * Turns a picked photo into what is worth storing: at most `MAX_DIMENSION` px on
 * the long side, re-encoded as WebP. Re-drawing also drops EXIF metadata, such as
 * the GPS location phones write into every photo.
 *
 * GIFs pass through untouched, since drawing one to a canvas keeps only its first frame.
 */
export async function prepareImage(file: File): Promise<File> {
  if (file.type === 'image/gif') return file

  const bitmap = await decode(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const canvas = new OffscreenCanvas(
    Math.round(bitmap.width * scale),
    Math.round(bitmap.height * scale),
  )
  const context = canvas.getContext('2d')
  if (!context) throw new Error('2D canvas context is unavailable')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  let blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 })
  // Safari cannot encode WebP and silently returns PNG instead. Fall back to JPEG,
  // or to PNG for a PNG source, so transparency is not lost.
  if (blob.type !== 'image/webp') {
    blob =
      file.type === 'image/png'
        ? await canvas.convertToBlob({ type: 'image/png' })
        : await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 })
  }

  const extension = blob.type.split('/')[1] === 'jpeg' ? 'jpg' : blob.type.split('/')[1]
  return new File([blob], replaceExtension(file.name, extension), { type: blob.type })
}
