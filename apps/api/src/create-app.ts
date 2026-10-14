import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RequestLoggingMiddleware } from './modules/request-logging/request-logging.middleware';

export async function createApp(): Promise<INestApplication> {
  if (!process.env.WEB_ORIGIN) {
    throw new Error('WEB_ORIGIN is required to configure CORS');
  }

  const app = await NestFactory.create(AppModule);
  const requestLoggingMiddleware = app.get(RequestLoggingMiddleware);
  app.use(requestLoggingMiddleware.use.bind(requestLoggingMiddleware));
  app.enableCors({ origin: process.env.WEB_ORIGIN });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}
