import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { User } from '../../generated/prisma/client';
import { VehiclesRepository } from '../vehicles/vehicles.repository';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let findOwnedById: jest.MockedFunction<VehiclesRepository['findOwnedById']>;
  let setActiveVehicle: jest.MockedFunction<VehiclesRepository['setActiveVehicle']>;

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
    findOwnedById = jest.fn();
    setActiveVehicle = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: VehiclesRepository, useValue: { findOwnedById, setActiveVehicle } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('changes the active vehicle when it belongs to the user', async () => {
    findOwnedById.mockResolvedValue({ id: 'vehicle-2' });
    const updatedUser = { ...user, activeVehicleId: 'vehicle-2' };
    setActiveVehicle.mockResolvedValue(updatedUser);

    await expect(service.setActiveVehicle(user.id, { vehicleId: 'vehicle-2' })).resolves.toBe(
      updatedUser,
    );
    expect(setActiveVehicle).toHaveBeenCalledWith(user.id, 'vehicle-2');
  });

  it('rejects another user vehicle', async () => {
    findOwnedById.mockResolvedValue(null);

    await expect(service.setActiveVehicle(user.id, { vehicleId: 'vehicle-2' })).rejects.toThrow(
      NotFoundException,
    );
    expect(setActiveVehicle).not.toHaveBeenCalled();
  });

  it('returns null for a stale active vehicle', async () => {
    findOwnedById.mockResolvedValue(null);

    await expect(service.getMe(user)).resolves.toEqual({ ...user, activeVehicleId: null });
  });
});
