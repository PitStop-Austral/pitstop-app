import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

config({ path: './.env', quiet: true });

export default defineConfig({
  schema: 'prisma/',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Migrations need Neon's direct (non-pooled) connection.
    // Locally there's no pooler, so DIRECT_URL is unset and this falls back to DATABASE_URL.
    url: process.env.DIRECT_URL || env('DATABASE_URL'),
  },
});
