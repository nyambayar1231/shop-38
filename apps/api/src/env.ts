import type { Database } from '@shop-38/db';

export type AppEnv = {
  Bindings: {
    DATABASE_URL: string;
  };
  Variables: {
    db: Database;
  };
};
