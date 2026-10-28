import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersRepository } from './users.repository';

describe('UsersRepository', () => {
  let repository: UsersRepository;
  let findUnique: jest.Mock;
  let create: jest.Mock;
  let update: jest.Mock;
  let countVehicles: jest.Mock;
  let countMaintenances: jest.Mock;
  let transaction: jest.Mock;

  beforeEach(async () => {
    findUnique = jest.fn();
    create = jest.fn();
    update = jest.fn();
    countVehicles = jest.fn();
    countMaintenances = jest.fn();
    transaction = jest.fn((operations: Promise<unknown>[]) => Promise.all(operations));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersRepository,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique, create, update },
            vehicle: { count: countVehicles },
            maintenance: { count: countMaintenances },
            $transaction: transaction,
          },
        },
      ],
    }).compile();

    repository = module.get<UsersRepository>(UsersRepository);
  });

  it('creates the user when none exists for the firebaseUid', async () => {
    findUnique.mockResolvedValue(null);
    const created = { id: 'uuid-1', firebaseUid: 'uid-1', email: 'a@b.com', name: 'Ada' };
    create.mockResolvedValue(created);

    const result = await repository.syncByFirebaseUid('uid-1', 'a@b.com', 'Ada');

    expect(create).toHaveBeenCalledWith({
      data: { firebaseUid: 'uid-1', email: 'a@b.com', name: 'Ada' },
    });
    expect(update).not.toHaveBeenCalled();
    expect(result).toBe(created);
  });

  it('updates only the email and preserves the stored name for an existing user', async () => {
    const existing = {
      id: 'uuid-1',
      firebaseUid: 'uid-1',
      email: 'old@b.com',
      name: 'Old Name',
      notificationsEnabled: true,
      notificationPromptShownAt: new Date('2026-10-01T12:00:00.000Z'),
    };
    findUnique.mockResolvedValue(existing);
    const updated = { ...existing, email: 'new@b.com' };
    update.mockResolvedValue(updated);

    const result = await repository.syncByFirebaseUid('uid-1', 'new@b.com', 'New Name');

    expect(update).toHaveBeenCalledWith({
      where: { firebaseUid: 'uid-1' },
      data: { email: 'new@b.com' },
    });
    expect(updated.notificationsEnabled).toBe(true);
    expect(updated.notificationPromptShownAt).toBe(existing.notificationPromptShownAt);
    expect(create).not.toHaveBeenCalled();
    expect(result).toBe(updated);
  });

  it('does not write when nothing changed', async () => {
    const existing = { id: 'uuid-1', firebaseUid: 'uid-1', email: 'a@b.com', name: 'Ada' };
    findUnique.mockResolvedValue(existing);

    const result = await repository.syncByFirebaseUid('uid-1', 'a@b.com', 'Ada');

    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });

  it('does not overwrite an existing name when only the token name changed', async () => {
    const existing = { id: 'uuid-1', firebaseUid: 'uid-1', email: 'a@b.com', name: 'Saved Name' };
    findUnique.mockResolvedValue(existing);

    const result = await repository.syncByFirebaseUid('uid-1', 'a@b.com', 'Firebase Name');

    expect(update).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });

  it('counts only vehicles and services owned by the user in one transaction', async () => {
    countVehicles.mockResolvedValue(2);
    countMaintenances.mockResolvedValue(13);

    await expect(repository.getProfileSummary('user-1')).resolves.toEqual({
      vehicleCount: 2,
      serviceCount: 13,
    });
    expect(countVehicles).toHaveBeenCalledWith({ where: { ownerId: 'user-1' } });
    expect(countMaintenances).toHaveBeenCalledWith({
      where: { vehicle: { ownerId: 'user-1' } },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('returns zero counts for a user without vehicles or services', async () => {
    countVehicles.mockResolvedValue(0);
    countMaintenances.mockResolvedValue(0);

    await expect(repository.getProfileSummary('user-1')).resolves.toEqual({
      vehicleCount: 0,
      serviceCount: 0,
    });
  });

  it('updates a name by user id', async () => {
    const updated = { id: 'user-1', name: 'Ada Lovelace' };
    update.mockResolvedValue(updated);

    await expect(repository.updateName('user-1', 'Ada Lovelace')).resolves.toBe(updated);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { name: 'Ada Lovelace' },
    });
  });
});
