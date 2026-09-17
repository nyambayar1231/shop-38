import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs in its own process with cwd = packages/db, started by
// neither the API nor a shell that sourced .env. It must load env itself.
// Absent in CI and production, where env comes from the environment.
try {
  process.loadEnvFile('../../.env');
} catch {
  /* no .env — expected outside local dev */
}

export default defineConfig({
  schema: './src/schema/*.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
