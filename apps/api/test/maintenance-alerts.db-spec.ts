import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { MaintenanceAlertDeliveryStatus, PrismaClient } from '../src/generated/prisma/client';
import {
  MaintenanceAlertsRepository,
  type MaintenanceAlertClaimCandidate,
} from '../src/modules/maintenance-alerts/maintenance-alerts.repository';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Maintenance alert claims (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let repository: MaintenanceAlertsRepository;
  let userId: string;
  let vehicleId: string;

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL;
    if (!databaseUrl || !new URL(databaseUrl).pathname.slice(1).endsWith('_test')) {
      throw new Error(
        'TEST_DATABASE_URL must point to a dedicated PostgreSQL database ending in _test',
      );
    }

    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    await prisma.$connect();
    repository = new MaintenanceAlertsRepository(prisma as unknown as PrismaService);

    const suffix = randomUUID();
    const user = await prisma.user.create({
      data: {
        firebaseUid: `maintenance-alert-${suffix}`,
        email: `maintenance-alert-${suffix}@example.com`,
        name: 'Alert Test Driver',
        notificationsEnabled: true,
      },
    });
    userId = user.id;
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId: user.id,
        brand: 'Ford',
        model: 'Focus',
        year: 2020,
        fuel: 'NAFTA',
        plate: `AL${suffix.slice(0, 5).toUpperCase()}`,
        mileage: 60000,
      },
    });
    vehicleId = vehicle.id;
  });

  afterAll(async () => {
    if (vehicleId) {
      const schedules = await prisma.schedule.findMany({
        where: { vehicleId },
        select: { id: true },
      });
      await prisma.maintenanceAlertDelivery.deleteMany({
        where: { scheduleId: { in: schedules.map(({ id }) => id) } },
      });
      await prisma.maintenanceAlertCycle.deleteMany({ where: { vehicleId } });
      await prisma.vehicle.delete({ where: { id: vehicleId } });
    }
    if (userId) await prisma.user.delete({ where: { id: userId } });
    if (prisma) await prisma.$disconnect();
  });

  it('claims each due occurrence once and preserves results after device removal', async () => {
    const installationId = randomUUID();
    const schedule = await prisma.schedule.create({
      data: {
        vehicleId,
        type: 'Aceite',
        normalizedType: 'aceite',
        intervalKm: 10000,
        baselineDate: new Date('2026-01-01T00:00:00.000Z'),
        baselineMileage: 50000,
      },
    });
    const device = await prisma.notificationDevice.create({
      data: {
        userId,
        installationId,
        token: `alert-token-${randomUUID()}`,
      },
    });
    const firstDue: MaintenanceAlertClaimCandidate = {
      scheduleId: schedule.id,
      installationId,
      notificationDeviceId: device.id,
      dueKey: 'none:60000',
      dueDate: null,
      dueMileage: 60000,
      ownerId: userId,
      token: device.token,
      vehicleId,
      normalizedType: 'aceite',
    };

    const concurrentClaims = await Promise.all([
      repository.claimDeliveries([firstDue]),
      repository.claimDeliveries([firstDue]),
    ]);
    expect(concurrentClaims.flat()).toHaveLength(1);
    await expect(repository.claimDeliveries([firstDue])).resolves.toEqual([]);

    const firstClaim = concurrentClaims.flat()[0];
    expect(firstClaim).toBeDefined();
    await repository.markSent(firstClaim!.id, 'projects/test/messages/accepted');

    await prisma.schedule.update({
      where: { id: schedule.id },
      data: { baselineMileage: 60000 },
    });
    const secondDue = { ...firstDue, dueKey: 'none:70000', dueMileage: 70000 };
    await expect(repository.claimDeliveries([secondDue])).resolves.toHaveLength(1);

    await prisma.notificationDevice.delete({ where: { id: device.id } });
    await expect(
      prisma.maintenanceAlertDelivery.findUniqueOrThrow({ where: { id: firstClaim!.id } }),
    ).resolves.toMatchObject({
      status: MaintenanceAlertDeliveryStatus.SENT,
      fcmMessageId: 'projects/test/messages/accepted',
      notificationDeviceId: null,
    });
  });

  it('serializes account transfers with delivery and rejects the stale owner afterward', async () => {
    const suffix = randomUUID();
    const newOwner = await prisma.user.create({
      data: {
        firebaseUid: `maintenance-alert-new-owner-${suffix}`,
        email: `maintenance-alert-new-owner-${suffix}@example.com`,
        name: 'New Alert Owner',
      },
    });
    const installationId = randomUUID();
    const token = `transfer-token-${randomUUID()}`;
    const schedule = await prisma.schedule.create({
      data: {
        vehicleId,
        type: 'Filtros',
        normalizedType: 'filtros',
        intervalKm: 10000,
        baselineDate: new Date('2026-01-01T00:00:00.000Z'),
        baselineMileage: 50000,
      },
    });
    const device = await prisma.notificationDevice.create({
      data: { userId, installationId, token },
    });
    const candidate: MaintenanceAlertClaimCandidate = {
      scheduleId: schedule.id,
      installationId,
      notificationDeviceId: device.id,
      dueKey: 'none:60000',
      dueDate: null,
      dueMileage: 60000,
      ownerId: userId,
      token,
      vehicleId,
      normalizedType: 'filtros',
    };

    let releaseDelivery = () => {};
    const deliveryCanFinish = new Promise<void>((resolve) => {
      releaseDelivery = resolve;
    });
    let signalLocked = () => {};
    const deviceLocked = new Promise<void>((resolve) => {
      signalLocked = resolve;
    });

    const delivery = repository.withCurrentDeviceLock(
      { id: device.id, ownerId: userId, installationId, token },
      candidate,
      async () => {
        signalLocked();
        await deliveryCanFinish;
        return 'sent';
      },
    );
    await deviceLocked;
    const transfer = prisma.notificationDevice.update({
      where: { id: device.id },
      data: { userId: newOwner.id },
    });

    await expect(
      Promise.race([
        transfer.then(() => 'transferred'),
        new Promise<string>((resolve) => setTimeout(() => resolve('waiting'), 50)),
      ]),
    ).resolves.toBe('waiting');
    releaseDelivery();
    await expect(delivery).resolves.toBe('sent');
    await transfer;

    await expect(repository.claimDeliveries([candidate])).resolves.toEqual([]);

    await prisma.notificationDevice.delete({ where: { id: device.id } });
    await prisma.user.delete({ where: { id: newOwner.id } });
  });

  it('rejects a stale candidate after its schedule changes or is deleted', async () => {
    const installationId = randomUUID();
    const schedule = await prisma.schedule.create({
      data: {
        vehicleId,
        type: 'Correa',
        normalizedType: 'correa',
        intervalKm: 10000,
        baselineDate: new Date('2026-01-01T00:00:00.000Z'),
        baselineMileage: 50000,
      },
    });
    const device = await prisma.notificationDevice.create({
      data: { userId, installationId, token: `stale-schedule-${randomUUID()}` },
    });
    const candidate: MaintenanceAlertClaimCandidate = {
      scheduleId: schedule.id,
      installationId,
      notificationDeviceId: device.id,
      dueKey: 'none:60000',
      dueDate: null,
      dueMileage: 60000,
      ownerId: userId,
      token: device.token,
      vehicleId,
      normalizedType: 'correa',
    };

    let releaseDelivery = () => {};
    const deliveryCanFinish = new Promise<void>((resolve) => {
      releaseDelivery = resolve;
    });
    let signalLocked = () => {};
    const scheduleLocked = new Promise<void>((resolve) => {
      signalLocked = resolve;
    });
    const delivery = repository.withCurrentDeviceLock(
      {
        id: device.id,
        ownerId: userId,
        installationId,
        token: device.token,
      },
      candidate,
      async () => {
        signalLocked();
        await deliveryCanFinish;
        return 'sent';
      },
    );
    await scheduleLocked;
    const scheduleUpdate = prisma.schedule.update({
      where: { id: schedule.id },
      data: { intervalKm: 20000 },
    });
    await expect(
      Promise.race([
        scheduleUpdate.then(() => 'updated'),
        new Promise<string>((resolve) => setTimeout(() => resolve('waiting'), 50)),
      ]),
    ).resolves.toBe('waiting');
    releaseDelivery();
    await expect(delivery).resolves.toBe('sent');
    await scheduleUpdate;
    await expect(repository.claimDeliveries([candidate])).resolves.toEqual([]);

    await prisma.schedule.delete({ where: { id: schedule.id } });
    await expect(repository.claimDeliveries([candidate])).resolves.toEqual([]);
    await expect(
      prisma.maintenanceAlertDelivery.count({ where: { scheduleId: schedule.id } }),
    ).resolves.toBe(0);
    await prisma.notificationDevice.delete({ where: { id: device.id } });
  });
});
