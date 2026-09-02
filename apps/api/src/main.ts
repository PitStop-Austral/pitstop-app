import { config } from 'dotenv';
import { createApp } from './create-app';

config({ path: './.env', quiet: true });

async function bootstrap() {
  const app = await createApp();
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
