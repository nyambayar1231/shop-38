import { RiImageLine } from '@remixicon/react'

/** A small square image for table rows, with a placeholder when there is none. */
export function Thumbnail({ src }: { src: string | null }) {
  return (
    <div className="flex size-9 items-center justify-center overflow-hidden rounded-md border bg-muted">
      {src ? (
        <img src={src} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <RiImageLine className="size-4 text-muted-foreground" aria-hidden />
      )}
    </div>
  )
}
