import { sql } from 'drizzle-orm';
import { pgTable, text, uuid, timestamp, index, pgEnum, bigint, check } from 'drizzle-orm/pg-core';
import { FILE_STATUSES } from '@shop-38/contracts';

export const fileStatus = pgEnum('file_status', FILE_STATUSES);

/**
 * An object in S3. The API never handles the bytes: the client PUTs them to a
 * presigned URL, and this row records what arrived.
 */
export const file = pgTable(
  'file',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Where the object is in the bucket. A random name the server picks, never the client's filename. */
    key: text('key').unique().notNull(),
    /** The name the client uploaded it with, used for display. */
    name: text('name').notNull(),
    contentType: text('content_type').notNull(),
    /** Signed into the upload URL, then checked against S3 when the upload is completed. */
    size: bigint('size', { mode: 'number' }).notNull(),
    /** Public URL of the object. Set only after S3 confirms the upload. */
    url: text('url'),
    status: fileStatus('status').notNull().default('pending'),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // For a future sweep of abandoned uploads: pending rows, oldest first.
    index('file_status_created_at_idx').on(t.status, t.createdAt),
    check('file_size_positive', sql`${t.size} > 0`),
    check(
      'file_uploaded_has_url',
      sql`${t.status} <> 'uploaded' or (${t.url} is not null and ${t.uploadedAt} is not null)`,
    ),
  ],
);
