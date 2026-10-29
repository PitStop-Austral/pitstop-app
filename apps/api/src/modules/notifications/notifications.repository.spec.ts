import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsRepository } from './notifications.repository';

describe('NotificationsRepository', () => {
  let repository: NotificationsRepository;
  let transaction: jest.Mock;
  let lockDeviceMutations: jest.Mock;
  let deleteTransactionDevice: jest.Mock;
  let findTransactionDevice: jest.Mock;
  let upsertDevice: jest.Mock;
  let enableNotifications: jest.Mock;
  let updateTransactionUsers: jest.Mock;
  let findOwnedDevice: jest.Mock;
  let updateUsers: jest.Mock;

  const userId = '11111111-1111-4111-8111-111111111111';
  const installationId = '22222222-2222-4222-8222-222222222222';
  const device = { id: '33333333-3333-4333-8333-333333333333', installationId };
  const deliveryDevice = {
    id: device.id,
    token: 'current-token',
    user: { notificationsEnabled: true },
  };

  beforeEach(async () => {
    lockDeviceMutations = jest.fn();
    deleteTransactionDevice = jest.fn();
    findTransactionDevice = jest.fn().mockResolvedValue({ userId });
    upsertDevice = jest.fn().mockResolvedValue(device);
    enableNotifications = jest.fn();
    updateTransactionUsers = jest.fn();
    findOwnedDevice = jest.fn().mockResolvedValue(deliveryDevice);
    updateUsers = jest.fn().mockResolvedValue({ count: 1 });
    transaction = jest.fn(async (callback) =>
      callback({
        $queryRaw: lockDeviceMutations,
        notificationDevice: {
          deleteMany: deleteTransactionDevice,
          findFirst: findTransactionDevice,
          upsert: upsertDevice,
        },
        user: { update: enableNotifications, updateMany: updateTransactionUsers },
      }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsRepository,
        {
          provide: PrismaService,
          useValue: {
            $transaction: transaction,
            notificationDevice: {
              findFirst: findOwnedDevice,
            },
            user: { updateMany: updateUsers },
          },
        },
      ],
    }).compile();

    repository = module.get(NotificationsRepository);
  });

  it('rotates or transfers an installation and enables notifications atomically', async () => {
    await expect(repository.register(userId, installationId, 'new-token')).resolves.toBe(device);

    expect(lockDeviceMutations).toHaveBeenCalledTimes(1);
    expect(deleteTransactionDevice).toHaveBeenCalledWith({
      where: { token: 'new-token', installationId: { not: installationId } },
    });
    expect(upsertDevice).toHaveBeenCalledWith({
      where: { installationId },
      create: { userId, installationId, token: 'new-token' },
      update: { userId, token: 'new-token' },
      select: { id: true, installationId: true },
    });
    expect(enableNotifications).toHaveBeenCalledWith({
      where: { id: userId },
      data: { notificationsEnabled: true },
    });
  });

  it('deletes by installation and authenticated owner together', async () => {
    await repository.remove(userId, installationId);

    expect(deleteTransactionDevice).toHaveBeenCalledWith({ where: { userId, installationId } });
    expect(updateTransactionUsers).toHaveBeenCalledWith({
      where: { id: userId, notificationDevices: { none: {} } },
      data: { notificationsEnabled: false },
    });
  });

  it('disables notifications for only the authenticated user without deleting devices', async () => {
    await expect(repository.updatePreferences(userId, false)).resolves.toEqual({
      notificationsEnabled: false,
    });

    expect(updateUsers).toHaveBeenCalledWith({
      where: { id: userId },
      data: { notificationsEnabled: false },
    });
    expect(deleteTransactionDevice).not.toHaveBeenCalled();
  });

  it('enables notifications only when the authenticated user has a registered device', async () => {
    await expect(repository.updatePreferences(userId, true)).resolves.toEqual({
      notificationsEnabled: true,
    });

    expect(updateUsers).toHaveBeenCalledWith({
      where: { id: userId, notificationDevices: { some: {} } },
      data: { notificationsEnabled: true },
    });
  });

  it('reports a missing registered device without changing the preference', async () => {
    updateUsers.mockResolvedValue({ count: 0 });

    await expect(repository.updatePreferences(userId, true)).resolves.toBeNull();
  });

  it('finds a delivery target only when the installation belongs to the user', async () => {
    await expect(repository.findOwnedForDelivery(userId, installationId)).resolves.toBe(
      deliveryDevice,
    );

    expect(findOwnedDevice).toHaveBeenCalledWith({
      where: { userId, installationId },
      select: {
        id: true,
        token: true,
        user: { select: { notificationsEnabled: true } },
      },
    });
  });

  it('removes a stale device only when its token still matches the failed send', async () => {
    await repository.removeIfTokenMatches(device.id, 'stale-token');

    expect(findTransactionDevice).toHaveBeenCalledWith({
      where: { id: device.id, token: 'stale-token' },
      select: { userId: true },
    });
    expect(deleteTransactionDevice).toHaveBeenCalledWith({
      where: { id: device.id, token: 'stale-token' },
    });
    expect(updateTransactionUsers).toHaveBeenCalledWith({
      where: { id: userId, notificationDevices: { none: {} } },
      data: { notificationsEnabled: false },
    });
  });

  it('preserves preferences when the stale token no longer matches', async () => {
    findTransactionDevice.mockResolvedValue(null);

    await repository.removeIfTokenMatches(device.id, 'rotated-token');

    expect(deleteTransactionDevice).not.toHaveBeenCalled();
    expect(updateTransactionUsers).not.toHaveBeenCalled();
  });

  it('preserves the original prompt timestamp on repeated calls', async () => {
    await repository.markPromptShown(userId);

    expect(updateUsers).toHaveBeenCalledWith({
      where: { id: userId, notificationPromptShownAt: null },
      data: { notificationPromptShownAt: expect.any(Date) },
    });
  });
});
