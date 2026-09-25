import type { InferResponseType } from 'hono/client'
import { UPLOAD_CONTENT_TYPES, type UploadContentType } from '@shop-38/contracts'
import { apiClient } from '@/lib/api-client'

export type UploadedFile = InferResponseType<(typeof apiClient.files)[':id']['complete']['$post'], 200>

const isUploadContentType = (type: string): type is UploadContentType =>
  (UPLOAD_CONTENT_TYPES as readonly string[]).includes(type)

/**
 * Uploads `file` straight to S3 and returns the stored record. The API only signs
 * the URL and confirms the result; the bytes never pass through it.
 */
export async function uploadFile(file: File, signal?: AbortSignal): Promise<UploadedFile> {
  if (!isUploadContentType(file.type)) throw new Error('Энэ төрлийн файл оруулах боломжгүй')

  const created = await apiClient.files.$post(
    { json: { filename: file.name, contentType: file.type, size: file.size } },
    { init: { signal } },
  )
  if (!created.ok) throw new Error('Файл оруулах эрх авч чадсангүй')
  const { file: pending, upload } = await created.json()

  // Content-Type is signed into the URL and must match exactly. The browser sets
  // Content-Length from the body, which must equal the declared size.
  const put = await fetch(upload.url, {
    method: upload.method,
    headers: upload.headers,
    body: file,
    signal,
  })
  if (!put.ok) throw new Error('Файлыг хадгалж чадсангүй')

  const completed = await apiClient.files[':id'].complete.$post(
    { param: { id: pending.id } },
    { init: { signal } },
  )
  if (!completed.ok) throw new Error('Файлын бүртгэлийг баталгаажуулж чадсангүй')
  return completed.json()
}
