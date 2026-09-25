import type { Hyperdrive } from '@cloudflare/workers-types';
import type { Database } from '@shop-38/db';

export type AppEnv = {
  Bindings: {
    HYPERDRIVE: Hyperdrive;
    /** Secret. An IAM user limited to s3:PutObject, s3:GetObject and s3:ListBucket on the bucket. */
    AWS_ACCESS_KEY_ID: string;
    /** Secret. */
    AWS_SECRET_ACCESS_KEY: string;
    AWS_REGION: string;
    S3_BUCKET: string;
    /**
     * Optional base URL for the stored public `url`, e.g. a CloudFront domain.
     * Defaults to the bucket's own S3 URL.
     */
    S3_PUBLIC_URL?: string;
  };
  Variables: {
    db: Database;
  };
};
