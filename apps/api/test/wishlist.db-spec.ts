import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaClient } from '../src/generated/prisma/client';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
  cert: jest.fn(),
}));
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({ verifyIdToken: jest.fn() })),
  FirebaseAuthError: class FirebaseAuthError extends Error {},
}));

describe('Wishlist API (PostgreSQL)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let vehicleId: string;
  let otherVehicleId: string;
  const userIds: string[] = [];

  const runId = randomUUID();
  const owner = { uid: `wishlist-api-a-${runId}`, token: 'token-a' };
  const stranger = { uid: `wishlist-api-b-${runId}`, token: 'token-b' };
  const auth = (user: { token: string }) => `Bearer ${user.token}`;

  async function createUser(uid: string) {
    const user = await prisma.user.create({
      data: { firebaseUid: uid, email: `${uid}@example.com`, name: 'Wishlist API Driver' },
    });
    userIds.push(user.id);
    return user;
  }

  function createVehicle(ownerId: string, plate: string) {
    return prisma.vehicle.create({
      data: {
        ownerId,
        brand: 'Honda',
        model: 'Civic',
        year: 2021,
        fuel: 'NAFTA',
        plate,
        mileage: 48000,
      },
    });
  }

  function addItem(body: object, user = owner, targetVehicleId = vehicleId) {
    return request(app.getHttpServer())
      .post(`/vehicles/${targetVehicleId}/wishlist`)
      .set('Authorization', auth(user))
      .send(body);
  }

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL;
    if (!databaseUrl || !new URL(databaseUrl).pathname.slice(1).endsWith('_test')) {
      throw new Error(
        'TEST_DATABASE_URL must point to a dedicated PostgreSQL database ending in _test',
      );
    }

    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    await prisma.$connect();

    const ownerUser = await createUser(owner.uid);
    await createUser(stranger.uid);
    vehicleId = (await createVehicle(ownerUser.id, 'AF812KM')).id;
    otherVehicleId = (await createVehicle(ownerUser.id, 'AB123CD')).id;

    const usersByToken = { [owner.token]: owner.uid, [stranger.token]: stranger.uid };
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(FirebaseService)
      .useValue({
        verifyIdToken: jest.fn((token: string) => {
          const uid = usersByToken[token];
          return Promise.resolve({ uid, email: `${uid}@example.com`, name: 'Wishlist API Driver' });
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  beforeEach(async () => {
    await prisma.wishlistItem.deleteMany({
      where: { vehicleId: { in: [vehicleId, otherVehicleId] } },
    });
  });

  afterAll(async () => {
    if (app) await app.close();
    if (!prisma) return;
    // Vehicles cascade to their wishlist items and maintenances.
    await prisma.vehicle.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it('creates an item and returns the price as a number', async () => {
    const response = await addItem({
      name: 'Llantas deportivas 17"',
      estimatedPrice: 480000.5,
      priority: 'BAJA',
      note: 'Modelo negro mate',
    }).expect(201);

    expect(response.body).toEqual({
      id: expect.any(String),
      vehicleId,
      name: 'Llantas deportivas 17"',
      estimatedPrice: 480000.5,
      priority: 'BAJA',
      note: 'Modelo negro mate',
      purchased: false,
      purchasedAt: null,
      createdAt: expect.any(String),
    });
  });

  it('returns the validation message for an invalid body', async () => {
    const response = await addItem({ name: '   ', estimatedPrice: -1 }).expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining([
        'Ingresá el nombre del deseo',
        'El precio tiene que ser un número mayor o igual a 0',
      ]),
    );
  });

  it('lists pending items by priority, newest first, with purchased ones last', async () => {
    const purchasedHigh = (await addItem({ name: 'Comprado alta', priority: 'ALTA' })).body;
    const pendingLow = (await addItem({ name: 'Pendiente baja', priority: 'BAJA' })).body;
    const olderMedium = (await addItem({ name: 'Media vieja' })).body;
    const newerMedium = (await addItem({ name: 'Media nueva', priority: 'MEDIA' })).body;
    const pendingHigh = (await addItem({ name: 'Pendiente alta', priority: 'ALTA' })).body;
    await prisma.wishlistItem.update({
      where: { id: olderMedium.id },
      data: { createdAt: new Date(Date.parse(newerMedium.createdAt) - 60_000) },
    });
    await request(app.getHttpServer())
      .patch(`/vehicles/${vehicleId}/wishlist/${purchasedHigh.id}/purchased`)
      .set('Authorization', auth(owner))
      .send({ purchased: true })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get(`/vehicles/${vehicleId}/wishlist`)
      .set('Authorization', auth(owner))
      .expect(200);

    expect(response.body.map((item: { id: string }) => item.id)).toEqual([
      pendingHigh.id,
      newerMedium.id,
      olderMedium.id,
      pendingLow.id,
      purchasedHigh.id,
    ]);
  });

  it('marks and unmarks an item, keeping the original date when marked twice', async () => {
    const item = (await addItem({ name: 'Cubre asientos' })).body;
    const path = `/vehicles/${vehicleId}/wishlist/${item.id}/purchased`;
    const mark = (purchased: boolean) =>
      request(app.getHttpServer())
        .patch(path)
        .set('Authorization', auth(owner))
        .send({ purchased })
        .expect(200);

    const marked = (await mark(true)).body;
    expect(marked.purchased).toBe(true);
    expect(marked.purchasedAt).toEqual(expect.any(String));

    const markedAgain = (await mark(true)).body;
    expect(markedAgain.purchasedAt).toBe(marked.purchasedAt);

    const unmarked = (await mark(false)).body;
    expect(unmarked).toMatchObject({ purchased: false, purchasedAt: null });
  });

  it('deletes only the requested item', async () => {
    const kept = (await addItem({ name: 'Se queda' })).body;
    const removed = (await addItem({ name: 'Se va' })).body;
    const otherVehicleItem = (await addItem({ name: 'Otro auto' }, owner, otherVehicleId)).body;
    const maintenance = await prisma.maintenance.create({
      data: {
        vehicleId,
        type: 'Cambio de aceite',
        category: 'MANTENIMIENTO',
        date: new Date('2026-09-17T00:00:00.000Z'),
        mileage: 48000,
      },
    });

    await request(app.getHttpServer())
      .delete(`/vehicles/${vehicleId}/wishlist/${removed.id}`)
      .set('Authorization', auth(owner))
      .expect(204);

    const remaining = await prisma.wishlistItem.findMany({
      where: { vehicleId: { in: [vehicleId, otherVehicleId] } },
      select: { id: true },
    });
    expect(remaining.map(({ id }) => id).sort()).toEqual([kept.id, otherVehicleItem.id].sort());
    await expect(
      prisma.maintenance.findUnique({ where: { id: maintenance.id } }),
    ).resolves.not.toBeNull();
  });

  it("returns 404 for an item on another of the owner's vehicles", async () => {
    const otherVehicleItem = (await addItem({ name: 'Otro auto' }, owner, otherVehicleId)).body;

    const path = `/vehicles/${vehicleId}/wishlist/${otherVehicleItem.id}`;
    for (const call of [
      () => request(app.getHttpServer()).patch(`${path}/purchased`).send({ purchased: true }),
      () => request(app.getHttpServer()).delete(path),
    ]) {
      const response = await call().set('Authorization', auth(owner)).expect(404);
      expect(response.body.message).toBe('Deseo no encontrado');
    }
  });

  it("hides another user's vehicle behind 404 on every route", async () => {
    const item = (await addItem({ name: 'Ajeno' })).body;
    const base = `/vehicles/${vehicleId}/wishlist`;

    for (const call of [
      () => request(app.getHttpServer()).get(base),
      () => request(app.getHttpServer()).post(base).send({ name: 'Intruso' }),
      () =>
        request(app.getHttpServer())
          .patch(`${base}/${item.id}/purchased`)
          .send({ purchased: true }),
      () => request(app.getHttpServer()).delete(`${base}/${item.id}`),
    ]) {
      const response = await call().set('Authorization', auth(stranger)).expect(404);
      expect(response.body.message).toBe('Vehículo no encontrado');
    }

    const stored = await prisma.wishlistItem.findMany({ where: { vehicleId } });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ id: item.id, purchased: false });
  });

  it('requires a token', async () => {
    await request(app.getHttpServer()).get(`/vehicles/${vehicleId}/wishlist`).expect(401);
  });
});
