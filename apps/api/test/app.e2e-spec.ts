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
  let createMaintenance: jest.Mock;
  let createSchedule: jest.Mock;
  let findSchedules: jest.Mock;
  let findSchedule: jest.Mock;
  let findScheduleOrThrow: jest.Mock;
  let updateSchedule: jest.Mock;
  let deleteSchedule: jest.Mock;
  let findBaselineMaintenance: jest.Mock;
  let findScheduleVehicle: jest.Mock;
  let deleteVehicle: jest.Mock;
  let findReplacement: jest.Mock;
  let findTransactionUser: jest.Mock;
  let lockOwner: jest.Mock;
  let updateVehicle: jest.Mock;
  let updateMaintenanceMileage: jest.Mock;
  let updateActiveUser: jest.Mock;
  let transaction: jest.Mock;

  const authenticatedUser = {
    id: '11111111-1111-4111-8111-111111111111',
    firebaseUid: 'firebase-uid-1',
    email: 'driver@example.com',
    name: 'Driver One',
    activeVehicleId: null,
    upcomingThresholdDays: 30,
    upcomingThresholdKm: 1500,
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
    engineOilType: null,
    engineOilLiters: null,
    gearboxOilType: null,
    gearboxOilLiters: null,
    transmission: null,
    frontTireSize: null,
    frontTirePressurePsi: null,
    rearTireSize: null,
    rearTirePressurePsi: null,
    highBeam: null,
    lowBeam: null,
    fogLight: null,
    createdAt: new Date('2026-09-03T00:00:00.000Z'),
    updatedAt: new Date('2026-09-03T00:00:00.000Z'),
  };

  const serializedVehicle = {
    ...vehicle,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
  };

  const maintenance = {
    id: '33333333-3333-4333-8333-333333333333',
    vehicleId: vehicle.id,
    type: 'Cambio de aceite',
    category: 'MANTENIMIENTO',
    date: new Date('2026-09-17T00:00:00.000Z'),
    mileage: 60500,
    workshop: 'Lubricentro',
    cost: { toNumber: () => 42000 },
    notes: null,
    createdAt: new Date('2026-09-17T12:00:00.000Z'),
    updatedAt: new Date('2026-09-17T12:00:00.000Z'),
  };

  const serializedMaintenance = {
    ...maintenance,
    date: '2026-09-17',
    cost: 42000,
    createdAt: maintenance.createdAt.toISOString(),
    updatedAt: maintenance.updatedAt.toISOString(),
  };

  const schedule = {
    id: '44444444-4444-4444-8444-444444444444',
    vehicleId: vehicle.id,
    type: 'Filtros',
    intervalMonths: 6,
    intervalKm: 10000,
    baselineDate: new Date('2026-09-17T00:00:00.000Z'),
    baselineMileage: 48000,
    createdAt: new Date('2026-09-18T00:00:00.000Z'),
    updatedAt: new Date('2026-09-18T00:00:00.000Z'),
  };

  beforeEach(async () => {
    queryRaw = jest.fn().mockResolvedValue([{ result: 1 }]);
    verifyIdToken = jest.fn();
    findUnique = jest.fn();
    create = jest.fn();
    findManyVehicles = jest.fn();
    findOwnedVehicle = jest.fn();
    createVehicle = jest.fn();
    createMaintenance = jest.fn();
    createSchedule = jest.fn();
    findSchedules = jest.fn();
    findSchedule = jest.fn();
    findScheduleOrThrow = jest.fn();
    updateSchedule = jest.fn();
    deleteSchedule = jest.fn();
    findBaselineMaintenance = jest.fn();
    findScheduleVehicle = jest.fn();
    deleteVehicle = jest.fn();
    findReplacement = jest.fn();
    findTransactionUser = jest.fn();
    lockOwner = jest.fn();
    updateVehicle = jest.fn();
    updateMaintenanceMileage = jest.fn();
    updateActiveUser = jest.fn();
    transaction = jest.fn(async (callback) =>
      callback({
        $queryRaw: lockOwner,
        maintenance: { create: createMaintenance, findFirst: findBaselineMaintenance },
        schedule: {
          create: createSchedule,
          findFirstOrThrow: findScheduleOrThrow,
          update: updateSchedule,
        },
        vehicle: {
          create: createVehicle,
          delete: deleteVehicle,
          findFirst: findReplacement,
          findUniqueOrThrow: findScheduleVehicle,
          updateMany: updateMaintenanceMileage,
        },
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
        maintenance: { findFirst: findBaselineMaintenance },
        schedule: {
          delete: deleteSchedule,
          findFirst: findSchedule,
          findMany: findSchedules,
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

  describe('/vehicles/:vehicleId/maintenances', () => {
    const payload = {
      type: 'Cambio de aceite',
      category: 'MANTENIMIENTO',
      date: '2026-09-17',
      mileage: 60500,
      workshop: 'Lubricentro',
      cost: 42000,
      notes: null,
    };

    it('requires authentication', () => {
      return request(app.getHttpServer())
        .post(`/vehicles/${vehicle.id}/maintenances`)
        .send(payload)
        .expect(401);
    });

    it('creates a maintenance for an owned vehicle', async () => {
      authenticate();
      findOwnedVehicle.mockResolvedValue({ id: vehicle.id, mileage: vehicle.mileage });
      createMaintenance.mockResolvedValue(maintenance);
      updateMaintenanceMileage.mockResolvedValue({ count: 1 });

      await request(app.getHttpServer())
        .post(`/vehicles/${vehicle.id}/maintenances`)
        .set('Authorization', 'Bearer valid-token')
        .send(payload)
        .expect(201)
        .expect(serializedMaintenance);

      expect(updateMaintenanceMileage).toHaveBeenCalledWith({
        where: { id: vehicle.id, mileage: { lt: payload.mileage } },
        data: { mileage: payload.mileage },
      });
    });

    it('rejects an invalid vehicle id', () => {
      authenticate();

      return request(app.getHttpServer())
        .post('/vehicles/not-a-uuid/maintenances')
        .set('Authorization', 'Bearer valid-token')
        .send(payload)
        .expect(400);
    });

    it('rejects an invalid payload or future date', async () => {
      authenticate();
      findOwnedVehicle.mockResolvedValue({ id: vehicle.id, mileage: vehicle.mileage });

      await request(app.getHttpServer())
        .post(`/vehicles/${vehicle.id}/maintenances`)
        .set('Authorization', 'Bearer valid-token')
        .send({ ...payload, type: '', mileage: -1 })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/vehicles/${vehicle.id}/maintenances`)
        .set('Authorization', 'Bearer valid-token')
        .send({ ...payload, date: '9999-12-31' })
        .expect(400);
    });

    it('returns not found for an absent or unowned vehicle', () => {
      authenticate();
      findOwnedVehicle.mockResolvedValue(null);

      return request(app.getHttpServer())
        .post(`/vehicles/${vehicle.id}/maintenances`)
        .set('Authorization', 'Bearer valid-token')
        .send(payload)
        .expect(404);
    });
  });

  describe('/vehicles/:vehicleId/schedules', () => {
    const path = `/vehicles/${vehicle.id}/schedules`;

    it('requires authentication', () => request(app.getHttpServer()).get(path).expect(401));

    it.each([
      { intervalMonths: 6, intervalKm: null },
      { intervalMonths: null, intervalKm: 10000 },
      { intervalMonths: 6, intervalKm: 10000 },
    ])('creates and fetches a schedule with %j', async (intervals) => {
      authenticate();
      findOwnedVehicle.mockResolvedValue({ id: vehicle.id, mileage: vehicle.mileage });
      findScheduleVehicle.mockResolvedValue({ mileage: vehicle.mileage });
      findBaselineMaintenance.mockResolvedValue(null);
      createSchedule.mockImplementation(({ data }) => Promise.resolve({ ...schedule, ...data }));
      const payload = { type: 'Filtros', ...intervals };

      const created = await request(app.getHttpServer())
        .post(path)
        .set('Authorization', 'Bearer valid-token')
        .send(payload)
        .expect(201);
      expect(created.body).toMatchObject({ ...payload, baselineMileage: vehicle.mileage });
      expect(created.body.baselineDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      findSchedules.mockResolvedValue([{ ...schedule, ...intervals }]);
      const listed = await request(app.getHttpServer())
        .get(path)
        .set('Authorization', 'Bearer valid-token')
        .expect(200);
      expect(listed.body).toHaveLength(1);
      expect(listed.body[0]).toMatchObject({ ...payload, baselineDate: '2026-09-17' });
      expect(listed.body[0]).toMatchObject({
        nextDueDate: intervals.intervalMonths ? '2027-03-17' : null,
        nextDueMileage: intervals.intervalKm ? 58000 : null,
        remainingKm: intervals.intervalKm ? 10000 - (vehicle.mileage - 48000) : null,
      });
      expect(['overdue', 'upcoming', 'on_track']).toContain(listed.body[0].status);
    });

    it.each([
      {},
      { intervalMonths: 0 },
      { intervalMonths: -1 },
      { intervalMonths: 1.5 },
      { intervalKm: 0 },
      { intervalKm: -1 },
      { intervalKm: 1.5 },
    ])('rejects missing or invalid intervals: %j', async (intervals) => {
      authenticate();
      findOwnedVehicle.mockResolvedValue({ id: vehicle.id, mileage: vehicle.mileage });
      await request(app.getHttpServer())
        .post(path)
        .set('Authorization', 'Bearer valid-token')
        .send({ type: 'Filtros', ...intervals })
        .expect(400);
    });

    it('caps intervalMonths at 240 so the due date stays in range', async () => {
      authenticate();
      findOwnedVehicle.mockResolvedValue({ id: vehicle.id, mileage: vehicle.mileage });
      findScheduleVehicle.mockResolvedValue({ mileage: vehicle.mileage });
      findBaselineMaintenance.mockResolvedValue(null);
      createSchedule.mockImplementation(({ data }) => Promise.resolve({ ...schedule, ...data }));

      const rejected = await request(app.getHttpServer())
        .post(path)
        .set('Authorization', 'Bearer valid-token')
        .send({ type: 'Filtros', intervalMonths: 241 })
        .expect(400);
      expect(rejected.body.message).toContain('Ingresá hasta 240 meses');
      expect(createSchedule).not.toHaveBeenCalled();

      const accepted = await request(app.getHttpServer())
        .post(path)
        .set('Authorization', 'Bearer valid-token')
        .send({ type: 'Filtros', intervalMonths: 240 })
        .expect(201);
      expect(accepted.body).toMatchObject({ intervalMonths: 240, intervalKm: null });
      expect(accepted.body.nextDueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('rejects an unowned vehicle', async () => {
      authenticate();
      findOwnedVehicle.mockResolvedValue(null);
      await request(app.getHttpServer())
        .post(path)
        .set('Authorization', 'Bearer valid-token')
        .send({ type: 'Filtros', intervalKm: 10000 })
        .expect(404);
      await request(app.getHttpServer())
        .get(path)
        .set('Authorization', 'Bearer valid-token')
        .expect(404);
    });

    it('turns a unique collision into a clear conflict', async () => {
      authenticate();
      findOwnedVehicle.mockResolvedValue({ id: vehicle.id, mileage: vehicle.mileage });
      findScheduleVehicle.mockResolvedValue({ mileage: vehicle.mileage });
      findBaselineMaintenance.mockResolvedValue(null);
      createSchedule.mockRejectedValue({ code: 'P2002' });
      await request(app.getHttpServer())
        .post(path)
        .set('Authorization', 'Bearer valid-token')
        .send({ type: 'fIlTrOs', intervalKm: 10000 })
        .expect(409)
        .expect(({ body }) =>
          expect(body.message).toBe('Ya existe una frecuencia para este servicio'),
        );
    });

    it('fetches one schedule with computed due values', async () => {
      authenticate();
      findOwnedVehicle.mockResolvedValue({ id: vehicle.id, mileage: vehicle.mileage });
      findSchedule.mockResolvedValue(schedule);

      await request(app.getHttpServer())
        .get(`${path}/${schedule.id}`)
        .set('Authorization', 'Bearer valid-token')
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            id: schedule.id,
            type: 'Filtros',
            baselineDate: '2026-09-17',
            nextDueDate: '2027-03-17',
            nextDueMileage: 58000,
          }),
        );
    });

    it('updates one or both intervals and returns the recalculated schedule', async () => {
      authenticate();
      findOwnedVehicle.mockResolvedValue({ id: vehicle.id, mileage: vehicle.mileage });
      findScheduleOrThrow.mockResolvedValue(schedule);
      updateSchedule.mockImplementation(({ data }) => Promise.resolve({ ...schedule, ...data }));

      await request(app.getHttpServer())
        .patch(`${path}/${schedule.id}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ intervalMonths: null, intervalKm: 12000 })
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            id: schedule.id,
            intervalMonths: null,
            intervalKm: 12000,
            baselineDate: '2026-09-17',
            nextDueDate: null,
            nextDueMileage: 60000,
          }),
        );

      expect(updateSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: schedule.id, vehicleId: vehicle.id },
          data: expect.objectContaining({ intervalMonths: null, intervalKm: 12000 }),
        }),
      );
    });

    it('rejects invalid, empty, and duplicate edits', async () => {
      authenticate();
      findOwnedVehicle.mockResolvedValue({ id: vehicle.id, mileage: vehicle.mileage });

      await request(app.getHttpServer())
        .patch(`${path}/${schedule.id}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ intervalMonths: 0 })
        .expect(400);

      findScheduleOrThrow.mockResolvedValue(schedule);
      await request(app.getHttpServer())
        .patch(`${path}/${schedule.id}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ intervalMonths: null, intervalKm: null })
        .expect(400);

      findScheduleVehicle.mockResolvedValue({ mileage: vehicle.mileage });
      findBaselineMaintenance.mockResolvedValue(null);
      updateSchedule.mockRejectedValue({ code: 'P2002' });
      await request(app.getHttpServer())
        .patch(`${path}/${schedule.id}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ type: 'Cambio de aceite' })
        .expect(409)
        .expect(({ body }) =>
          expect(body.message).toBe('Ya existe una frecuencia para este servicio'),
        );
    });

    it('deletes an owned schedule with no response body', async () => {
      authenticate();
      findOwnedVehicle.mockResolvedValue({ id: vehicle.id, mileage: vehicle.mileage });
      findSchedule.mockResolvedValue(schedule);
      deleteSchedule.mockResolvedValue(schedule);

      await request(app.getHttpServer())
        .delete(`${path}/${schedule.id}`)
        .set('Authorization', 'Bearer valid-token')
        .expect(204)
        .expect('');

      expect(deleteSchedule).toHaveBeenCalledWith({
        where: { id: schedule.id, vehicleId: vehicle.id },
      });
    });

    it('hides schedule detail and mutations for an unowned vehicle', async () => {
      authenticate();
      findOwnedVehicle.mockResolvedValue(null);
      const detailPath = `${path}/${schedule.id}`;

      await request(app.getHttpServer())
        .get(detailPath)
        .set('Authorization', 'Bearer valid-token')
        .expect(404);
      await request(app.getHttpServer())
        .patch(detailPath)
        .set('Authorization', 'Bearer valid-token')
        .send({ intervalKm: 12000 })
        .expect(404);
      await request(app.getHttpServer())
        .delete(detailPath)
        .set('Authorization', 'Bearer valid-token')
        .expect(404);

      expect(findSchedule).not.toHaveBeenCalled();
      expect(findScheduleOrThrow).not.toHaveBeenCalled();
      expect(updateSchedule).not.toHaveBeenCalled();
      expect(deleteSchedule).not.toHaveBeenCalled();
    });

    it('returns 404 when a schedule is missing or disappears during a mutation', async () => {
      authenticate();
      findOwnedVehicle.mockResolvedValue({ id: vehicle.id, mileage: vehicle.mileage });
      const detailPath = `${path}/${schedule.id}`;
      findSchedule.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(detailPath)
        .set('Authorization', 'Bearer valid-token')
        .expect(404);

      findScheduleOrThrow.mockRejectedValue({ code: 'P2025' });
      await request(app.getHttpServer())
        .patch(detailPath)
        .set('Authorization', 'Bearer valid-token')
        .send({ intervalKm: 12000 })
        .expect(404);

      findSchedule.mockResolvedValue(schedule);
      deleteSchedule.mockRejectedValue({ code: 'P2025' });
      await request(app.getHttpServer())
        .delete(detailPath)
        .set('Authorization', 'Bearer valid-token')
        .expect(404);
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
