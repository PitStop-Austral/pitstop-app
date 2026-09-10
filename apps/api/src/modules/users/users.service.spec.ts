import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { User } from '../../generated/prisma/client';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let findOwnedVehicle: jest.MockedFunction<UsersRepository['findOwnedVehicle']>;
  let setActiveVehicle: jest.MockedFunction<UsersRepository['setActiveVehicle']>;

  const user = {
    id: 'user-1',
    firebaseUid: 'firebase-user-1',
    email: 'driver@example.com',
    name: 'Driver',
    activeVehicleId: 'vehicle-1',
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  } satisfies User;

  beforeEach(async () => {
    findOwnedVehicle = jest.fn();
    setActiveVehicle = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: { findOwnedVehicle, setActiveVehicle } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('changes the active vehicle when it belongs to the user', async () => {
    findOwnedVehicle.mockResolvedValue({ id: 'vehicle-2' });
    const updatedUser = { ...user, activeVehicleId: 'vehicle-2' };
    setActiveVehicle.mockResolvedValue(updatedUser);

    await expect(service.setActiveVehicle(user.id, { vehicleId: 'vehicle-2' })).resolves.toBe(
      updatedUser,
    );
    expect(setActiveVehicle).toHaveBeenCalledWith(user.id, 'vehicle-2');
  });

  it('rejects another user vehicle', async () => {
    findOwnedVehicle.mockResolvedValue(null);

    await expect(service.setActiveVehicle(user.id, { vehicleId: 'vehicle-2' })).rejects.toThrow(
      NotFoundException,
    );
    expect(setActiveVehicle).not.toHaveBeenCalled();
  });

  it('returns null for a stale active vehicle', async () => {
    findOwnedVehicle.mockResolvedValue(null);

    await expect(service.getMe(user)).resolves.toEqual({ ...user, activeVehicleId: null });
  });
});
