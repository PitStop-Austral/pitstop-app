import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceAlertDeliveryStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MaintenanceAlertsRepository } from './maintenance-alerts.repository';

describe('MaintenanceAlertsRepository', () => {
  let repository: MaintenanceAlertsRepository;
  let findSchedules: jest.Mock;
  let createDeliveries: jest.Mock;
  let updateDelivery: jest.Mock;
  let deleteDevice: jest.Mock;
  let findDeviceForCleanup: jest.Mock;
  let disableUserNotifications: jest.Mock;
  let findDevices: jest.Mock;
  let findCurrentSchedules: jest.Mock;
  let findCurrentSchedule: jest.Mock;
  let queryRaw: jest.Mock;

  beforeEach(async () => {
    findSchedules = jest.fn().mockResolvedValue([]);
    createDeliveries = jest.fn().mockResolvedValue([]);
    updateDelivery = jest.fn();
    deleteDevice = jest.fn();
    findDeviceForCleanup = jest.fn().mockResolvedValue({ userId: 'owner-id' });
    disableUserNotifications = jest.fn();
    findDevices = jest.fn().mockResolvedValue([]);
    findCurrentSchedules = jest.fn().mockResolvedValue([]);
    findCurrentSchedule = jest.fn().mockResolvedValue(null);
    queryRaw = jest.fn().mockResolvedValue([]);
    const transactionClient = {
      $queryRaw: queryRaw,
      notificationDevice: {
        deleteMany: deleteDevice,
        findFirst: findDeviceForCleanup,
        findMany: findDevices,
      },
      user: { updateMany: disableUserNotifications },
      schedule: {
        findMany: findCurrentSchedules,
        findUnique: findCurrentSchedule,
      },
      maintenanceAlertCycle: { findMany: jest.fn().mockResolvedValue([]) },
      maintenance: { findMany: jest.fn().mockResolvedValue([]) },
      maintenanceAlertDelivery: {
        createManyAndReturn: createDeliveries,
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          scheduleId: '11111111-1111-4111-8111-111111111111',
          status: MaintenanceAlertDeliveryStatus.PENDING,
        }),
        update: updateDelivery,
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceAlertsRepository,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(async (callback) => callback(transactionClient)),
            schedule: { findMany: findSchedules },
            maintenanceAlertDelivery: {
              createManyAndReturn: createDeliveries,
              update: updateDelivery,
            },
          },
        },
      ],
    }).compile();

    repository = module.get(MaintenanceAlertsRepository);
  });

  it('selects only schedules with an enabled owner and at least one device', async () => {
    await repository.findEligibleSchedules();

    expect(findSchedules).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          vehicle: {
            owner: {
              notificationsEnabled: true,
              notificationDevices: { some: {} },
            },
          },
        },
      }),
    );
  });

  it('claims only unique delivery rows and returns the inserted claims', async () => {
    const input = {
      scheduleId: '11111111-1111-4111-8111-111111111111',
      installationId: '22222222-2222-4222-8222-222222222222',
      notificationDeviceId: '33333333-3333-4333-8333-333333333333',
      dueKey: '2026-10-20:52000',
      dueDate: new Date('2026-10-20T00:00:00.000Z'),
      dueMileage: 52000,
      ownerId: '44444444-4444-4444-8444-444444444444',
      token: 'current-token',
      vehicleId: '55555555-5555-4555-8555-555555555555',
      normalizedType: 'aceite',
    };
    const {
      ownerId: _ownerId,
      token: _token,
      vehicleId: _vehicleId,
      normalizedType: _normalizedType,
      ...claim
    } = input;
    findDevices.mockResolvedValue([
      {
        id: input.notificationDeviceId,
        userId: input.ownerId,
        installationId: input.installationId,
        token: input.token,
      },
    ]);
    findCurrentSchedules.mockResolvedValue([
      {
        id: input.scheduleId,
        vehicleId: input.vehicleId,
        normalizedType: input.normalizedType,
        intervalMonths: 6,
        intervalKm: 10000,
        baselineDate: new Date('2026-04-20T00:00:00.000Z'),
        baselineMileage: 42000,
        vehicle: { ownerId: input.ownerId },
      },
    ]);
    createDeliveries.mockResolvedValue([{ id: 'claim-id', ...claim }]);

    await expect(repository.claimDeliveries([input])).resolves.toEqual([
      { id: 'claim-id', ...claim },
    ]);
    expect(createDeliveries).toHaveBeenCalledWith(
      expect.objectContaining({ data: [claim], skipDuplicates: true }),
    );
  });

  it('skips claims whose device ownership or token changed', async () => {
    await expect(
      repository.claimDeliveries([
        {
          scheduleId: '11111111-1111-4111-8111-111111111111',
          installationId: '22222222-2222-4222-8222-222222222222',
          notificationDeviceId: '33333333-3333-4333-8333-333333333333',
          dueKey: '2026-10-20:52000',
          dueDate: new Date('2026-10-20T00:00:00.000Z'),
          dueMileage: 52000,
          ownerId: '44444444-4444-4444-8444-444444444444',
          token: 'stale-token',
          vehicleId: '55555555-5555-4555-8555-555555555555',
          normalizedType: 'aceite',
        },
      ]),
    ).resolves.toEqual([]);
    expect(createDeliveries).not.toHaveBeenCalled();
  });

  it('skips a claim when the locked schedule no longer has the candidate due occurrence', async () => {
    const input = {
      scheduleId: '11111111-1111-4111-8111-111111111111',
      installationId: '22222222-2222-4222-8222-222222222222',
      notificationDeviceId: '33333333-3333-4333-8333-333333333333',
      dueKey: '2026-10-20:52000',
      dueDate: new Date('2026-10-20T00:00:00.000Z'),
      dueMileage: 52000,
      ownerId: '44444444-4444-4444-8444-444444444444',
      token: 'current-token',
      vehicleId: '55555555-5555-4555-8555-555555555555',
      normalizedType: 'aceite',
    };
    findDevices.mockResolvedValue([
      {
        id: input.notificationDeviceId,
        userId: input.ownerId,
        installationId: input.installationId,
        token: input.token,
      },
    ]);
    findCurrentSchedules.mockResolvedValue([
      {
        id: input.scheduleId,
        vehicleId: input.vehicleId,
        normalizedType: input.normalizedType,
        intervalMonths: null,
        intervalKm: 20000,
        baselineDate: new Date('2026-01-01T00:00:00.000Z'),
        baselineMileage: 42000,
        vehicle: { ownerId: input.ownerId },
      },
    ]);

    await expect(repository.claimDeliveries([input])).resolves.toEqual([]);
    expect(createDeliveries).not.toHaveBeenCalled();
  });

  it('runs delivery only while the exact current device row is locked', async () => {
    queryRaw.mockResolvedValue([{ id: 'device-id' }]);
    const scheduleContext = {
      scheduleId: '11111111-1111-4111-8111-111111111111',
      dueKey: 'none:52000',
      vehicleId: '55555555-5555-4555-8555-555555555555',
      normalizedType: 'aceite',
      ownerId: 'owner-id',
    };
    findCurrentSchedule.mockResolvedValue({
      id: scheduleContext.scheduleId,
      vehicleId: scheduleContext.vehicleId,
      normalizedType: scheduleContext.normalizedType,
      intervalMonths: null,
      intervalKm: 10000,
      baselineDate: new Date('2026-01-01T00:00:00.000Z'),
      baselineMileage: 42000,
      vehicle: { ownerId: scheduleContext.ownerId },
    });
    const action = jest.fn().mockResolvedValue('sent');

    await expect(
      repository.withCurrentDeviceLock(
        {
          id: 'device-id',
          ownerId: 'owner-id',
          installationId: 'installation-id',
          token: 'current-token',
        },
        scheduleContext,
        action,
      ),
    ).resolves.toBe('sent');
    expect(action).toHaveBeenCalledTimes(1);

    findCurrentSchedule.mockResolvedValue(null);
    await expect(
      repository.withCurrentDeviceLock(
        {
          id: 'device-id',
          ownerId: 'owner-id',
          installationId: 'installation-id',
          token: 'current-token',
        },
        scheduleContext,
        action,
      ),
    ).resolves.toBeNull();
    expect(action).toHaveBeenCalledTimes(1);

    queryRaw.mockResolvedValue([]);
    await expect(
      repository.withCurrentDeviceLock(
        {
          id: 'device-id',
          ownerId: 'new-owner-id',
          installationId: 'installation-id',
          token: 'current-token',
        },
        scheduleContext,
        action,
      ),
    ).resolves.toBeNull();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('records sent and failed outcomes without exposing delivery details', async () => {
    await repository.markSent('delivery-id', 'message-id');
    await repository.markFailed('delivery-id', 'messaging/server-unavailable');

    expect(updateDelivery).toHaveBeenNthCalledWith(1, {
      where: { id: 'delivery-id' },
      data: {
        status: MaintenanceAlertDeliveryStatus.SENT,
        fcmMessageId: 'message-id',
        finishedAt: expect.any(Date),
      },
    });
    expect(updateDelivery).toHaveBeenNthCalledWith(2, {
      where: { id: 'delivery-id' },
      data: {
        status: MaintenanceAlertDeliveryStatus.FAILED,
        errorCode: 'messaging/server-unavailable',
        finishedAt: expect.any(Date),
      },
    });
  });

  it('removes an invalid device only while its token still matches', async () => {
    await repository.removeDeviceIfTokenMatches('device-id', 'stale-token');

    expect(findDeviceForCleanup).toHaveBeenCalledWith({
      where: { id: 'device-id', token: 'stale-token' },
      select: { userId: true },
    });
    expect(deleteDevice).toHaveBeenCalledWith({
      where: { id: 'device-id', token: 'stale-token' },
    });
    expect(disableUserNotifications).toHaveBeenCalledWith({
      where: { id: 'owner-id', notificationDevices: { none: {} } },
      data: { notificationsEnabled: false },
    });
  });

  it('keeps the account preference when the invalid token was already rotated', async () => {
    findDeviceForCleanup.mockResolvedValue(null);

    await repository.removeDeviceIfTokenMatches('device-id', 'rotated-token');

    expect(deleteDevice).not.toHaveBeenCalled();
    expect(disableUserNotifications).not.toHaveBeenCalled();
  });
});
