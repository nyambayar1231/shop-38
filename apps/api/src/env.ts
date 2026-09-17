import type { Hyperdrive } from '@cloudflare/workers-types';
import type { Database } from '@shop-38/db';

export type AppEnv = {
  Bindings: {
    HYPERDRIVE: Hyperdrive;
  };
  Variables: {
    db: Database;
  };
};
