import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('AppModule (e2e)', () => {
  let app: INestApplication<App>;
  let queryRaw: jest.Mock;

  beforeEach(async () => {
    queryRaw = jest.fn().mockResolvedValue([{ result: 1 }]);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: queryRaw,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
  });

  it('/health/db (GET)', () => {
    return request(app.getHttpServer()).get('/health/db').expect(200).expect({ database: 'up' });
  });

  it('/health/db (GET) returns 503 when the database is unavailable', () => {
    queryRaw.mockRejectedValue(new Error('connection failed'));

    return request(app.getHttpServer()).get('/health/db').expect(503);
  });

  afterEach(async () => {
    await app.close();
  });
});
