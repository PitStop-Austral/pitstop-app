import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
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
  let verifyIdToken: jest.Mock;
  let findUnique: jest.Mock;
  let create: jest.Mock;
  let findManyVehicles: jest.Mock;
  let findOwnedVehicle: jest.Mock;
  let createVehicle: jest.Mock;
  let deleteVehicle: jest.Mock;
  let findReplacement: jest.Mock;
  let findTransactionUser: jest.Mock;
  let updateVehicle: jest.Mock;
  let updateActiveUser: jest.Mock;
  let transaction: jest.Mock;

  const authenticatedUser = {
    id: '11111111-1111-4111-8111-111111111111',
    firebaseUid: 'firebase-uid-1',
    email: 'driver@example.com',
    name: 'Driver One',
    activeVehicleId: null,
  };

  const vehicle = {
    id: '22222222-2222-4222-8222-222222222222',
    brand: 'Honda',
    model: 'Civic',
    year: 2021,
    fuel: 'NAFTA',
    plate: 'AF812KM',
    mileage: 48000,
    nickname: null,
    createdAt: new Date('2026-09-03T00:00:00.000Z'),
    updatedAt: new Date('2026-09-03T00:00:00.000Z'),
  };

  const serializedVehicle = {
    ...vehicle,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
  };

  beforeEach(async () => {
    queryRaw = jest.fn().mockResolvedValue([{ result: 1 }]);
    verifyIdToken = jest.fn();
    findUnique = jest.fn();
    create = jest.fn();
    findManyVehicles = jest.fn();
    findOwnedVehicle = jest.fn();
    createVehicle = jest.fn();
    deleteVehicle = jest.fn();
    findReplacement = jest.fn();
    findTransactionUser = jest.fn();
    updateVehicle = jest.fn();
    updateActiveUser = jest.fn();
    transaction = jest.fn(async (callback) =>
      callback({
        vehicle: { create: createVehicle, delete: deleteVehicle, findFirst: findReplacement },
        user: { findUnique: findTransactionUser, update: updateActiveUser },
      }),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: queryRaw,
        $transaction: transaction,
        user: { findUnique, create },
        vehicle: {
          findMany: findManyVehicles,
          findFirst: findOwnedVehicle,
          update: updateVehicle,
        },
      })
      .overrideProvider(FirebaseService)
      .useValue({
        verifyIdToken,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  function authenticate() {
    verifyIdToken.mockResolvedValue({
      uid: authenticatedUser.firebaseUid,
      email: authenticatedUser.email,
      name: authenticatedUser.name,
    });
    findUnique.mockResolvedValue(authenticatedUser);
  }

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

  describe('/vehicles', () => {
    it('requires authentication', () => {
      return request(app.getHttpServer()).get('/vehicles').expect(401);
    });

    it('requires authentication to delete a vehicle', () => {
      return request(app.getHttpServer()).delete(`/vehicles/${vehicle.id}`).expect(401);
    });

    it('lists only the authenticated user vehicles', async () => {
      authenticate();
      findManyVehicles.mockResolvedValue([vehicle]);

      await request(app.getHttpServer())
        .get('/vehicles')
        .set('Authorization', 'Bearer valid-token')
        .expect(200)
        .expect([serializedVehicle]);

      expect(findManyVehicles).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerId: authenticatedUser.id } }),
      );
    });

    it('creates a vehicle and canonicalizes a formatted plate', async () => {
      authenticate();
      createVehicle.mockResolvedValue(vehicle);
      updateActiveUser.mockResolvedValue({ ...authenticatedUser, activeVehicleId: vehicle.id });

      await request(app.getHttpServer())
        .post('/vehicles')
        .set('Authorization', 'Bearer valid-token')
        .send({
          brand: ' Honda ',
          model: 'Civic',
          year: 2021,
          fuel: 'NAFTA',
          plate: 'af 812 km',
          mileage: 48000,
        })
        .expect(201)
        .expect(serializedVehicle);

      expect(createVehicle).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            brand: 'Honda',
            ownerId: authenticatedUser.id,
            plate: 'AF812KM',
          }),
        }),
      );
      expect(updateActiveUser).toHaveBeenCalledWith({
        where: { id: authenticatedUser.id },
        data: { activeVehicleId: vehicle.id },
      });
    });

    it('rejects an invalid vehicle payload', () => {
      authenticate();

      return request(app.getHttpServer())
        .post('/vehicles')
        .set('Authorization', 'Bearer valid-token')
        .send({
          brand: '',
          model: 'Civic',
          year: 1899,
          fuel: 'NAFTA',
          plate: 'invalid',
          mileage: -1,
        })
        .expect(400);
    });

    it('returns conflict for a duplicate owner plate', () => {
      authenticate();
      transaction.mockRejectedValue({ code: 'P2002' });

      return request(app.getHttpServer())
        .post('/vehicles')
        .set('Authorization', 'Bearer valid-token')
        .send({
          brand: 'Honda',
          model: 'Civic',
          year: 2021,
          fuel: 'NAFTA',
          plate: 'AF812KM',
          mileage: 48000,
        })
        .expect(409);
    });

    it('canonicalizes a formatted plate when updating an owned vehicle', async () => {
      authenticate();
      findOwnedVehicle.mockResolvedValue({ id: vehicle.id });
      updateVehicle.mockResolvedValue(vehicle);

      await request(app.getHttpServer())
        .patch(`/vehicles/${vehicle.id}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ plate: 'af 812 km' })
        .expect(200)
        .expect(serializedVehicle);

      expect(updateVehicle).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { plate: 'AF812KM' },
          where: { id: vehicle.id },
        }),
      );
    });

    it('hides another user vehicle behind a not-found response', () => {
      authenticate();
      findOwnedVehicle.mockResolvedValue(null);

      return request(app.getHttpServer())
        .patch(`/vehicles/${vehicle.id}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ model: 'Golf' })
        .expect(404);
    });

    it('deletes an owned vehicle and clears the active vehicle when it is the last one', async () => {
      authenticate();
      findOwnedVehicle.mockResolvedValue({ id: vehicle.id });
      findTransactionUser.mockResolvedValue({ activeVehicleId: vehicle.id });
      findReplacement.mockResolvedValue(null);

      await request(app.getHttpServer())
        .delete(`/vehicles/${vehicle.id}`)
        .set('Authorization', 'Bearer valid-token')
        .expect(204);

      expect(deleteVehicle).toHaveBeenCalledWith({ where: { id: vehicle.id } });
      expect(updateActiveUser).toHaveBeenCalledWith({
        where: { id: authenticatedUser.id },
        data: { activeVehicleId: null },
      });
    });

    it('hides another user vehicle deletion behind a not-found response', () => {
      authenticate();
      findOwnedVehicle.mockResolvedValue(null);

      return request(app.getHttpServer())
        .delete(`/vehicles/${vehicle.id}`)
        .set('Authorization', 'Bearer valid-token')
        .expect(404);
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
