import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { MaintenanceAlertDeliveryStatus, PrismaClient } from '../src/generated/prisma/client';
import {
  MaintenanceAlertsRepository,
  type MaintenanceAlertClaimCandidate,
} from '../src/modules/maintenance-alerts/maintenance-alerts.repository';
import { PrismaService } from '../src/prisma/prisma.service';
import { FirebaseService } from '../src/firebase/firebase.service';
import { MileageRemindersRepository } from '../src/modules/maintenance-alerts/mileage-reminders.repository';
import { MileageRemindersService } from '../src/modules/maintenance-alerts/mileage-reminders.service';
import { NotificationsRepository } from '../src/modules/notifications/notifications.repository';
import { VehiclesRepository } from '../src/modules/vehicles/vehicles.repository';

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

describe('Mileage reminder deliveries (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let service: MileageRemindersService;
  let notificationsRepository: NotificationsRepository;
  let vehiclesRepository: VehiclesRepository;
  let sendDataMessage: jest.Mock;
  const userIds: string[] = [];
  const vehicleIds: string[] = [];

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL;
    if (!databaseUrl || !new URL(databaseUrl).pathname.slice(1).endsWith('_test')) {
      throw new Error(
        'TEST_DATABASE_URL must point to a dedicated PostgreSQL database ending in _test',
      );
    }

    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    await prisma.$connect();
    const prismaService = prisma as unknown as PrismaService;
    const repository = new MileageRemindersRepository(prismaService);
    sendDataMessage = jest.fn().mockResolvedValue('projects/test/messages/reminder');
    service = new MileageRemindersService(repository, {
      sendDataMessage,
    } as unknown as FirebaseService);
    notificationsRepository = new NotificationsRepository(prismaService);
    vehiclesRepository = new VehiclesRepository(prismaService);
  });

  afterEach(async () => {
    if (vehicleIds.length > 0) {
      await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds.splice(0) } } });
    }
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
    }
    if (sendDataMessage) {
      sendDataMessage.mockReset().mockResolvedValue('projects/test/messages/reminder');
    }
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  async function createReminderVehicle(mileageUpdatedAt: Date, notificationsEnabled = true) {
    const suffix = randomUUID();
    const user = await prisma.user.create({
      data: {
        firebaseUid: `mileage-reminder-${suffix}`,
        email: `mileage-reminder-${suffix}@example.com`,
        name: 'Mileage Reminder Driver',
        notificationsEnabled,
      },
    });
    userIds.push(user.id);
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId: user.id,
        brand: 'Honda',
        model: 'Civic',
        year: 2021,
        fuel: 'NAFTA',
        plate: `MR${suffix.slice(0, 3).toUpperCase()}AA`,
        mileage: 48250,
        mileageUpdatedAt,
      },
    });
    vehicleIds.push(vehicle.id);
    const device = await prisma.notificationDevice.create({
      data: {
        userId: user.id,
        installationId: randomUUID(),
        token: `mileage-token-${randomUUID()}`,
      },
    });
    return { user, vehicle, device };
  }

  it('sends once across repeated and concurrent reviews for the same period', async () => {
    const now = new Date('2026-10-31T15:00:00.000Z');
    const { vehicle } = await createReminderVehicle(new Date('2026-10-01T15:00:00.000Z'));

    const runs = await Promise.all([service.runDailyReview(now), service.runDailyReview(now)]);
    expect(runs.reduce((total, run) => total + run.sent, 0)).toBe(1);
    await expect(service.runDailyReview(now)).resolves.toEqual({
      sent: 0,
      failed: 0,
      skipped: 1,
    });
    await expect(
      prisma.mileageReminderDelivery.count({
        where: { vehicleId: vehicle.id, status: MaintenanceAlertDeliveryStatus.SENT },
      }),
    ).resolves.toBe(1);
    expect(sendDataMessage).toHaveBeenCalledTimes(1);
  });

  it('starts at 30 days and creates a new delivery at 60 days', async () => {
    const mileageUpdatedAt = new Date('2026-10-01T15:00:00.000Z');
    const { vehicle } = await createReminderVehicle(mileageUpdatedAt);

    await expect(service.runDailyReview(new Date('2026-10-30T15:00:00.000Z'))).resolves.toEqual({
      sent: 0,
      failed: 0,
      skipped: 0,
    });
    await expect(
      service.runDailyReview(new Date('2026-10-31T15:00:00.000Z')),
    ).resolves.toMatchObject({ sent: 1 });
    await expect(
      service.runDailyReview(new Date('2026-11-15T15:00:00.000Z')),
    ).resolves.toMatchObject({ sent: 0, skipped: 1 });
    await expect(
      service.runDailyReview(new Date('2026-11-30T15:00:00.000Z')),
    ).resolves.toMatchObject({ sent: 1 });
    await expect(
      prisma.mileageReminderDelivery.count({ where: { vehicleId: vehicle.id } }),
    ).resolves.toBe(2);
  });

  it('retries a failed delivery without creating another row', async () => {
    const now = new Date('2026-10-31T15:00:00.000Z');
    const { vehicle } = await createReminderVehicle(new Date('2026-10-01T15:00:00.000Z'));
    sendDataMessage.mockRejectedValueOnce({ code: 'messaging/server-unavailable' });

    await expect(service.runDailyReview(now)).resolves.toMatchObject({ failed: 1 });
    await expect(service.runDailyReview(now)).resolves.toMatchObject({ sent: 1 });
    await expect(
      prisma.mileageReminderDelivery.count({ where: { vehicleId: vehicle.id } }),
    ).resolves.toBe(1);
  });

  it('stops being eligible immediately after confirming the mileage', async () => {
    const now = new Date('2026-10-31T15:00:00.000Z');
    const { user, vehicle } = await createReminderVehicle(new Date('2026-09-01T15:00:00.000Z'));
    await vehiclesRepository.updateMileageIfNotDecreased(vehicle.id, user.id, vehicle.mileage, now);

    await expect(service.runDailyReview(now)).resolves.toEqual({
      sent: 0,
      failed: 0,
      skipped: 0,
    });
  });

  it('ignores users who disabled notifications', async () => {
    const now = new Date('2026-10-31T15:00:00.000Z');
    await createReminderVehicle(new Date('2026-09-01T15:00:00.000Z'), false);

    await expect(service.runDailyReview(now)).resolves.toEqual({
      sent: 0,
      failed: 0,
      skipped: 0,
    });
    expect(sendDataMessage).not.toHaveBeenCalled();
  });

  it('does not commit an opt-out while a validated delivery is in progress', async () => {
    const now = new Date('2026-10-31T15:00:00.000Z');
    const { user } = await createReminderVehicle(new Date('2026-09-01T15:00:00.000Z'));
    let signalDeliveryStarted = () => {};
    const deliveryStarted = new Promise<void>((resolve) => {
      signalDeliveryStarted = resolve;
    });
    let releaseDelivery = () => {};
    const deliveryCanFinish = new Promise<void>((resolve) => {
      releaseDelivery = resolve;
    });
    sendDataMessage.mockImplementationOnce(async () => {
      signalDeliveryStarted();
      await deliveryCanFinish;
      return 'projects/test/messages/reminder';
    });

    const review = service.runDailyReview(now);
    await deliveryStarted;
    const optOut = notificationsRepository.updatePreferences(user.id, false);
    await expect(
      Promise.race([
        optOut.then(() => 'updated'),
        new Promise<string>((resolve) => setTimeout(() => resolve('waiting'), 50)),
      ]),
    ).resolves.toBe('waiting');

    releaseDelivery();
    await expect(review).resolves.toMatchObject({ sent: 1 });
    await expect(optOut).resolves.toEqual({ notificationsEnabled: false });
  });
});
