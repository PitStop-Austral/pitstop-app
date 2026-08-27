import type { INestApplication } from '@nestjs/common';

const DEFAULT_WEB_ORIGIN = 'http://localhost:3000';

export function configureCors(
  app: INestApplication,
  origin = process.env.CORS_ORIGIN || DEFAULT_WEB_ORIGIN,
): void {
  app.enableCors({ origin });
}
