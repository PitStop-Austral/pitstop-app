import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureCors } from './../src/configure-cors';
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
  let verifyIdToken: jest.Mock;
  let findUnique: jest.Mock;
  let create: jest.Mock;

  beforeEach(async () => {
    queryRaw = jest.fn().mockResolvedValue([{ result: 1 }]);
    verifyIdToken = jest.fn();
    findUnique = jest.fn();
    create = jest.fn();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: queryRaw,
        user: { findUnique, create },
      })
      .overrideProvider(FirebaseService)
      .useValue({
        verifyIdToken,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    configureCors(app, 'http://localhost:3000');
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

  it('allows authenticated browser requests from the configured web origin', () => {
    return request(app.getHttpServer())
      .options('/me')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect(204)
      .expect('Access-Control-Allow-Origin', 'http://localhost:3000')
      .expect((response) => {
        const allowedHeaders = response.headers['access-control-allow-headers']?.toLowerCase();

        expect(allowedHeaders).toContain('authorization');
        expect(allowedHeaders).toContain('content-type');
      });
  });

  describe('/me (GET)', () => {
    it('returns 401 when the Authorization header is missing', () => {
      return request(app.getHttpServer()).get('/me').expect(401);
    });

    it('returns 401 when the token is rejected', () => {
      verifyIdToken.mockRejectedValue(new Error('invalid'));

      return request(app.getHttpServer())
        .get('/me')
        .set('Authorization', 'Bearer bad-token')
        .expect(401);
    });

    it('returns the synced user for a valid token', () => {
      verifyIdToken.mockResolvedValue({
        uid: 'firebase-uid-1',
        email: 'driver@example.com',
        name: 'Driver One',
      });
      const user = {
        id: 'uuid-1',
        firebaseUid: 'firebase-uid-1',
        email: 'driver@example.com',
        name: 'Driver One',
      };
      findUnique.mockResolvedValue(null);
      create.mockResolvedValue(user);

      return request(app.getHttpServer())
        .get('/me')
        .set('Authorization', 'Bearer valid-token')
        .expect(200)
        .expect(user);
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
