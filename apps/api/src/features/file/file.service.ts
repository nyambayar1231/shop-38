import { and, eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { schema } from '@shop-38/db';
import type { Database } from '@shop-38/db';
import type { CreateUploadInput } from '@shop-38/contracts';
import { buildObjectKey, type Storage } from '../../lib/storage.js';

export const getFileById = async (db: Database, id: string) => {
  const [row] = await db.select().from(schema.file).where(eq(schema.file.id, id));
  return row;
};

/**
 * Records that an upload is expected and hands out the URL for it. Nothing has
 * been uploaded yet, so the row starts `pending` and has no `url`.
 *
 * The URL is signed before the insert, so a signing failure leaves no row behind.
 */
export const createUpload = async (
  db: Database,
  storage: Storage,
  { filename, contentType, size }: CreateUploadInput,
) => {
  const key = buildObjectKey(contentType);
  const upload = await storage.presignPut(key, contentType, size);
  const [file] = await db
    .insert(schema.file)
    .values({ key, name: filename, contentType, size, status: 'pending' })
    .returning();
  return { file, upload };
};

const conflict = (error: string) =>
  new HTTPException(409, { res: Response.json({ error }, { status: 409 }) });

/**
 * Marks the file `uploaded` once S3 confirms the object exists with the signed
 * size and type. Idempotent, so a client that retries after a dropped response
 * gets the same row back instead of an error.
 */
export const completeUpload = async (db: Database, storage: Storage, id: string) => {
  const file = await getFileById(db, id);
  if (!file || file.status === 'uploaded') return file;

  const object = await storage.head(file.key);
  if (!object) throw conflict('upload_incomplete');
  // Both values were signed into the URL, so these should never differ. If they
  // do, the object did not come from our URL, and it is not recorded.
  if (object.size !== file.size || object.contentType !== file.contentType) {
    throw conflict('upload_mismatch');
  }

  // The status guard makes two concurrent completions safe: one wins the update,
  // and the other re-reads the row the winner wrote.
  const [updated] = await db
    .update(schema.file)
    .set({ status: 'uploaded', url: storage.publicUrl(file.key), uploadedAt: new Date() })
    .where(and(eq(schema.file.id, id), eq(schema.file.status, 'pending')))
    .returning();
  return updated ?? getFileById(db, id);
};
