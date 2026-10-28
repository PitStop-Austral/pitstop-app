import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { User } from '../../generated/prisma/client';
import { VehiclesRepository } from '../vehicles/vehicles.repository';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let getProfileSummary: jest.MockedFunction<UsersRepository['getProfileSummary']>;
  let updateName: jest.MockedFunction<UsersRepository['updateName']>;
  let findOwnedById: jest.MockedFunction<VehiclesRepository['findOwnedById']>;
  let setActiveVehicle: jest.MockedFunction<VehiclesRepository['setActiveVehicle']>;

  const user = {
    id: 'user-1',
    firebaseUid: 'firebase-user-1',
    email: 'driver@example.com',
    name: 'Driver',
    activeVehicleId: 'vehicle-1',
    upcomingThresholdDays: 30,
    upcomingThresholdKm: 1500,
    notificationsEnabled: false,
    notificationPromptShownAt: null,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  } satisfies User;

  beforeEach(async () => {
    getProfileSummary = jest.fn();
    updateName = jest.fn();
    findOwnedById = jest.fn();
    setActiveVehicle = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: { getProfileSummary, updateName } },
        { provide: VehiclesRepository, useValue: { findOwnedById, setActiveVehicle } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('changes the active vehicle when it belongs to the user', async () => {
    findOwnedById.mockResolvedValue({ id: 'vehicle-2', mileage: 48000, photoPath: null });
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

  it('returns the profile summary for the authenticated user', async () => {
    const summary = { vehicleCount: 0, serviceCount: 0 };
    getProfileSummary.mockResolvedValue(summary);

    await expect(service.getProfileSummary(user.id)).resolves.toBe(summary);
    expect(getProfileSummary).toHaveBeenCalledWith(user.id);
  });

  it('updates only the authenticated user name', async () => {
    const updated = { ...user, name: 'Ada Lovelace' };
    updateName.mockResolvedValue(updated);

    await expect(service.updateMe(user.id, { name: 'Ada Lovelace' })).resolves.toBe(updated);
    expect(updateName).toHaveBeenCalledWith(user.id, 'Ada Lovelace');
  });
});
