import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersRepository } from './users.repository';

describe('UsersRepository', () => {
  let repository: UsersRepository;
  let findUnique: jest.Mock;
  let create: jest.Mock;
  let update: jest.Mock;

  beforeEach(async () => {
    findUnique = jest.fn();
    create = jest.fn();
    update = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersRepository,
        { provide: PrismaService, useValue: { user: { findUnique, create, update } } },
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

  it('updates the user when email or name changed', async () => {
    const existing = { id: 'uuid-1', firebaseUid: 'uid-1', email: 'old@b.com', name: 'Old Name' };
    findUnique.mockResolvedValue(existing);
    const updated = { ...existing, email: 'new@b.com', name: 'New Name' };
    update.mockResolvedValue(updated);

    const result = await repository.syncByFirebaseUid('uid-1', 'new@b.com', 'New Name');

    expect(update).toHaveBeenCalledWith({
      where: { firebaseUid: 'uid-1' },
      data: { email: 'new@b.com', name: 'New Name' },
    });
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
});
