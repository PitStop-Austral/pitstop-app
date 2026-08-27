import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { FirebaseService } from './../src/firebase/firebase.service';
import { PrismaService } from './../src/prisma/prisma.service';

// firebase-admin/auth pulls in the ESM-only `jose` package, which the Node runtime loads fine
// (native require(esm)) but Jest's module loader cannot transform. Mock it so importing
// AppModule for this e2e test never touches the real firebase-admin/auth module graph.
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
  cert: jest.fn(),
}));
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({ verifyIdToken: jest.fn() })),
  FirebaseAuthError: class FirebaseAuthError extends Error {},
}));

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
      .overrideProvider(FirebaseService)
      .useValue({
        verifyIdToken: jest.fn(),
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
