import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceAlertDeliveryStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MileageRemindersRepository,
  type MileageReminderCandidate,
} from './mileage-reminders.repository';

describe('MileageRemindersRepository', () => {
  let repository: MileageRemindersRepository;
  let findEligibleVehicles: jest.Mock;
  let findDevice: jest.Mock;
  let findVehicle: jest.Mock;
  let findDelivery: jest.Mock;
  let createDeliveries: jest.Mock;
  let reclaimDelivery: jest.Mock;
  let updateDelivery: jest.Mock;

  const candidate: MileageReminderCandidate = {
    vehicleId: '11111111-1111-4111-8111-111111111111',
    ownerId: '22222222-2222-4222-8222-222222222222',
    mileageUpdatedAt: new Date('2026-10-01T15:00:00.000Z'),
    installationId: '33333333-3333-4333-8333-333333333333',
    notificationDeviceId: '44444444-4444-4444-8444-444444444444',
    token: 'current-token',
    periodKey: '2026-10-01T15:00:00.000Z#1',
  };

  const claim = {
    id: '55555555-5555-4555-8555-555555555555',
    vehicleId: candidate.vehicleId,
    installationId: candidate.installationId,
    notificationDeviceId: candidate.notificationDeviceId,
    periodKey: candidate.periodKey,
  };

  beforeEach(async () => {
    findEligibleVehicles = jest.fn().mockResolvedValue([]);
    findDevice = jest.fn().mockResolvedValue({
      userId: candidate.ownerId,
      installationId: candidate.installationId,
      token: candidate.token,
    });
    findVehicle = jest.fn().mockResolvedValue({
      id: candidate.vehicleId,
      ownerId: candidate.ownerId,
      mileageUpdatedAt: candidate.mileageUpdatedAt,
      owner: { notificationsEnabled: true },
    });
    findDelivery = jest.fn().mockResolvedValue(null);
    createDeliveries = jest.fn().mockResolvedValue([claim]);
    reclaimDelivery = jest.fn().mockResolvedValue([]);
    updateDelivery = jest.fn();
    const transactionClient = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      vehicle: { findUnique: findVehicle },
      notificationDevice: {
        findUnique: findDevice,
        findFirst: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn(),
      },
      mileageReminderDelivery: {
        findUnique: findDelivery,
        createManyAndReturn: createDeliveries,
        updateManyAndReturn: reclaimDelivery,
      },
      user: { updateMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MileageRemindersRepository,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(async (callback) => callback(transactionClient)),
            vehicle: { findMany: findEligibleVehicles },
            mileageReminderDelivery: { update: updateDelivery },
          },
        },
      ],
    }).compile();

    repository = module.get(MileageRemindersRepository);
  });

  it('selects only stale vehicles whose owner enabled notifications and has a device', async () => {
    const cutoff = new Date('2026-10-01T15:00:00.000Z');

    await repository.findEligibleVehicles(cutoff);

    expect(findEligibleVehicles).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          mileageUpdatedAt: { lte: cutoff },
          owner: {
            notificationsEnabled: true,
            notificationDevices: { some: {} },
          },
        },
      }),
    );
  });

  it('creates the first claim for a period', async () => {
    await expect(repository.claimDelivery(candidate)).resolves.toEqual(claim);
    expect(createDeliveries).toHaveBeenCalledWith({
      data: {
        vehicleId: candidate.vehicleId,
        installationId: candidate.installationId,
        periodKey: candidate.periodKey,
        notificationDeviceId: candidate.notificationDeviceId,
      },
      skipDuplicates: true,
      select: expect.any(Object),
    });
  });

  it('skips an existing sent or pending claim', async () => {
    findDelivery.mockResolvedValue({
      ...claim,
      status: MaintenanceAlertDeliveryStatus.SENT,
    });

    await expect(repository.claimDelivery(candidate)).resolves.toBeNull();
    expect(createDeliveries).not.toHaveBeenCalled();
    expect(reclaimDelivery).not.toHaveBeenCalled();
  });

  it('atomically retries a failed claim with the current device', async () => {
    findDelivery.mockResolvedValue({
      ...claim,
      status: MaintenanceAlertDeliveryStatus.FAILED,
    });
    reclaimDelivery.mockResolvedValue([claim]);

    await expect(repository.claimDelivery(candidate)).resolves.toEqual(claim);
    expect(reclaimDelivery).toHaveBeenCalledWith({
      where: { id: claim.id, status: MaintenanceAlertDeliveryStatus.FAILED },
      data: {
        notificationDeviceId: candidate.notificationDeviceId,
        status: MaintenanceAlertDeliveryStatus.PENDING,
        fcmMessageId: null,
        errorCode: null,
        attemptedAt: expect.any(Date),
        finishedAt: null,
      },
      select: expect.any(Object),
    });
  });

  it('rejects a claim after mileage was confirmed again', async () => {
    findVehicle.mockResolvedValue({
      id: candidate.vehicleId,
      ownerId: candidate.ownerId,
      mileageUpdatedAt: new Date('2026-10-31T15:00:00.000Z'),
      owner: { notificationsEnabled: true },
    });

    await expect(repository.claimDelivery(candidate)).resolves.toBeNull();
    expect(findDelivery).not.toHaveBeenCalled();
  });

  it('records sent and failed outcomes', async () => {
    await repository.markSent(claim.id, 'message-id');
    await repository.markFailed(claim.id, 'messaging/server-unavailable');

    expect(updateDelivery).toHaveBeenNthCalledWith(1, {
      where: { id: claim.id },
      data: {
        status: MaintenanceAlertDeliveryStatus.SENT,
        fcmMessageId: 'message-id',
        finishedAt: expect.any(Date),
      },
    });
    expect(updateDelivery).toHaveBeenNthCalledWith(2, {
      where: { id: claim.id },
      data: {
        status: MaintenanceAlertDeliveryStatus.FAILED,
        errorCode: 'messaging/server-unavailable',
        finishedAt: expect.any(Date),
      },
    });
  });
});
