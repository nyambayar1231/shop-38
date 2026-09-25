/**
 * S3 access for presigned uploads. File bytes never pass through the Worker: it
 * signs a URL, the client PUTs straight to S3, and afterwards the Worker asks S3
 * what actually arrived.
 *
 * aws4fetch, not the AWS SDK: SigV4 is all we need here, and it runs on the
 * Workers runtime's own WebCrypto with no Node polyfills and a tiny bundle.
 */
import { AwsClient, AwsV4Signer } from 'aws4fetch';
import type { AppEnv } from '../env.js';

/** Long enough for a slow connection to finish, short enough that a leaked URL is soon useless. */
export const UPLOAD_URL_TTL_SECONDS = 10 * 60;

/** Every object lives under one prefix, so an S3 lifecycle rule can target them. */
const KEY_PREFIX = 'uploads';

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

export type PresignedUpload = {
  method: 'PUT';
  url: string;
  /** Send these exactly. They are part of the signature, so S3 rejects any other value. */
  headers: Record<string, string>;
  expiresAt: string;
};

export type StoredObject = {
  size: number;
  contentType: string | null;
};

type StorageBindings = AppEnv['Bindings'];

/**
 * `uploads/<uuid>.<ext>`. The server picks the name: a client filename can collide,
 * contain anything, or be guessed. The extension comes from the validated content
 * type, not from the filename.
 */
export function buildObjectKey(contentType: string): string {
  const ext = EXTENSION_BY_CONTENT_TYPE[contentType];
  return `${KEY_PREFIX}/${crypto.randomUUID()}${ext ? `.${ext}` : ''}`;
}

export function createStorage(env: StorageBindings) {
  const config = readConfig(env);
  // Virtual-hosted-style URL. Keys are always `[a-z0-9-/.]`, so they need no encoding.
  const objectUrl = (key: string) =>
    `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
  const credentials = {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: 's3',
    region: config.region,
  };
  // HEAD is safe to retry, but aws4fetch retries 10 times by default. That can hold
  // a request open for tens of seconds while S3 is failing.
  const client = new AwsClient({ ...credentials, retries: 2 });

  return {
    publicUrl: (key: string) =>
      config.publicBaseUrl ? `${config.publicBaseUrl}/${key}` : objectUrl(key),

    /**
     * A query-signed PUT URL. With `allHeaders`, Content-Type and Content-Length are
     * part of the signature (aws4fetch leaves them out by default). A body of any
     * other length or type then fails with 403 SignatureDoesNotMatch, so S3 itself
     * enforces the size limit.
     */
    async presignPut(key: string, contentType: string, size: number): Promise<PresignedUpload> {
      const url = new URL(objectUrl(key));
      url.searchParams.set('X-Amz-Expires', String(UPLOAD_URL_TTL_SECONDS));
      const headers = { 'content-type': contentType, 'content-length': String(size) };

      const signed = await new AwsV4Signer({
        ...credentials,
        method: 'PUT',
        url: url.toString(),
        headers,
        signQuery: true,
        allHeaders: true,
      }).sign();

      return {
        method: 'PUT',
        url: signed.url.toString(),
        // Browsers refuse to set Content-Length themselves and take it from the
        // body, so only Content-Type is the client's job.
        headers: { 'Content-Type': contentType },
        expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString(),
      };
    },

    /**
     * What S3 holds at `key`, or `null` if nothing is there. This is what confirms an
     * upload: S3 is asked, the client is not trusted.
     *
     * S3 answers 403, not 404, for a missing key when the caller lacks s3:ListBucket.
     * Grant it, or an upload that never happened shows up as a storage failure.
     */
    async head(key: string): Promise<StoredObject | null> {
      const res = await client.fetch(objectUrl(key), { method: 'HEAD' });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`S3 HEAD ${key} failed with ${res.status}`);

      const size = Number(res.headers.get('content-length'));
      if (!Number.isSafeInteger(size)) throw new Error(`S3 HEAD ${key} returned no content-length`);
      return { size, contentType: res.headers.get('content-type') };
    },
  };
}

export type Storage = ReturnType<typeof createStorage>;

function readConfig(env: StorageBindings) {
  const required = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'S3_BUCKET'] as const;
  const missing = required.filter((name) => !env[name]);
  if (missing.length > 0) {
    // A deploy problem, not a client one. Report it clearly and let it be a 500.
    throw new Error(`S3 storage is not configured: missing ${missing.join(', ')}`);
  }
  return {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    region: env.AWS_REGION,
    bucket: env.S3_BUCKET,
    publicBaseUrl: env.S3_PUBLIC_URL?.replace(/\/+$/, '') || undefined,
  };
}
