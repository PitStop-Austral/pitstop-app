import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

export async function createApp(): Promise<INestApplication> {
  if (!process.env.WEB_ORIGIN) {
    throw new Error('WEB_ORIGIN is required to configure CORS');
  }

  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.WEB_ORIGIN });
  await app.init();
  return app;
}
