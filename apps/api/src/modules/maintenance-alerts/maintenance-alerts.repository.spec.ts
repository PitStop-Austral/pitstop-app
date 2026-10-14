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
  let findDevices: jest.Mock;
  let queryRaw: jest.Mock;

  beforeEach(async () => {
    findSchedules = jest.fn().mockResolvedValue([]);
    createDeliveries = jest.fn().mockResolvedValue([]);
    updateDelivery = jest.fn();
    deleteDevice = jest.fn();
    findDevices = jest.fn().mockResolvedValue([]);
    queryRaw = jest.fn().mockResolvedValue([]);
    const transactionClient = {
      $queryRaw: queryRaw,
      notificationDevice: { findMany: findDevices },
      maintenanceAlertDelivery: { createManyAndReturn: createDeliveries },
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
            notificationDevice: { deleteMany: deleteDevice },
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
    };
    const { ownerId: _ownerId, token: _token, ...claim } = input;
    findDevices.mockResolvedValue([
      {
        id: input.notificationDeviceId,
        userId: input.ownerId,
        installationId: input.installationId,
        token: input.token,
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
        },
      ]),
    ).resolves.toEqual([]);
    expect(createDeliveries).not.toHaveBeenCalled();
  });

  it('runs delivery only while the exact current device row is locked', async () => {
    queryRaw.mockResolvedValue([{ id: 'device-id' }]);
    const action = jest.fn().mockResolvedValue('sent');

    await expect(
      repository.withCurrentDeviceLock(
        {
          id: 'device-id',
          ownerId: 'owner-id',
          installationId: 'installation-id',
          token: 'current-token',
        },
        action,
      ),
    ).resolves.toBe('sent');
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

    expect(deleteDevice).toHaveBeenCalledWith({
      where: { id: 'device-id', token: 'stale-token' },
    });
  });
});
