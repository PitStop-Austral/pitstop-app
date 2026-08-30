import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../dist/create-app';

let appPromise: ReturnType<typeof createApp> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  appPromise ??= createApp();
  const app = await appPromise;
  app.getHttpAdapter().getInstance()(req, res);
}
