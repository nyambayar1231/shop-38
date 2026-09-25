import { z } from 'zod';

/**
 * Uploaded objects are served publicly, so only types that are safe to serve are
 * accepted. No `text/html`, `image/svg+xml` or other scriptable types: those can
 * run script in a visitor's browser.
 */
export const UPLOAD_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
] as const;

export type UploadContentType = (typeof UPLOAD_CONTENT_TYPES)[number];

/** 10 MiB. S3 enforces it too, because the exact size is signed into the upload URL. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const createUploadSchema = z.object({
  /** The name to show for the file. It is never used as the S3 key. */
  filename: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(/^[^\p{Cc}/\\]+$/u, 'must not contain control characters or path separators'),
  contentType: z.enum(UPLOAD_CONTENT_TYPES),
  /**
   * The exact size in bytes (`File.size` in a browser). It is signed into the URL,
   * so S3 rejects a PUT whose body is any other length.
   */
  size: z.int().positive().max(MAX_UPLOAD_BYTES),
});

export type CreateUploadInput = z.infer<typeof createUploadSchema>;

export const fileIdParamSchema = z.object({
  id: z.uuid(),
});
