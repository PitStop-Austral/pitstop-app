import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsRepository } from './notifications.repository';

describe('NotificationsRepository', () => {
  let repository: NotificationsRepository;
  let transaction: jest.Mock;
  let lockRegistrations: jest.Mock;
  let deleteConflictingToken: jest.Mock;
  let upsertDevice: jest.Mock;
  let enableNotifications: jest.Mock;
  let deleteOwnedDevice: jest.Mock;
  let markPromptShown: jest.Mock;

  const userId = '11111111-1111-4111-8111-111111111111';
  const installationId = '22222222-2222-4222-8222-222222222222';
  const device = { id: '33333333-3333-4333-8333-333333333333', installationId };

  beforeEach(async () => {
    lockRegistrations = jest.fn();
    deleteConflictingToken = jest.fn();
    upsertDevice = jest.fn().mockResolvedValue(device);
    enableNotifications = jest.fn();
    deleteOwnedDevice = jest.fn();
    markPromptShown = jest.fn();
    transaction = jest.fn(async (callback) =>
      callback({
        $queryRaw: lockRegistrations,
        notificationDevice: { deleteMany: deleteConflictingToken, upsert: upsertDevice },
        user: { update: enableNotifications },
      }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsRepository,
        {
          provide: PrismaService,
          useValue: {
            $transaction: transaction,
            notificationDevice: { deleteMany: deleteOwnedDevice },
            user: { updateMany: markPromptShown },
          },
        },
      ],
    }).compile();

    repository = module.get(NotificationsRepository);
  });

  it('rotates or transfers an installation and enables notifications atomically', async () => {
    await expect(repository.register(userId, installationId, 'new-token')).resolves.toBe(device);

    expect(lockRegistrations).toHaveBeenCalledTimes(1);
    expect(deleteConflictingToken).toHaveBeenCalledWith({
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

    expect(deleteOwnedDevice).toHaveBeenCalledWith({ where: { userId, installationId } });
  });

  it('preserves the original prompt timestamp on repeated calls', async () => {
    await repository.markPromptShown(userId);

    expect(markPromptShown).toHaveBeenCalledWith({
      where: { id: userId, notificationPromptShownAt: null },
      data: { notificationPromptShownAt: expect.any(Date) },
    });
  });
});
