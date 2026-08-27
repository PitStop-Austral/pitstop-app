import { NestFactory } from '@nestjs/core';
import { config } from 'dotenv';
import { AppModule } from './app.module';
import { configureCors } from './configure-cors';

config({ path: './.env', quiet: true });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureCors(app);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
