import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FuelType } from '../../generated/prisma/client';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehiclesRepository, VehicleView } from './vehicles.repository';
import { VehiclesService } from './vehicles.service';

describe('VehiclesService', () => {
  let service: VehiclesService;
  let findByOwner: jest.MockedFunction<VehiclesRepository['findByOwner']>;
  let findOwnedById: jest.MockedFunction<VehiclesRepository['findOwnedById']>;
  let createAndSetActive: jest.MockedFunction<VehiclesRepository['createAndSetActive']>;
  let update: jest.MockedFunction<VehiclesRepository['update']>;
  let deleteAndReassignActive: jest.MockedFunction<VehiclesRepository['deleteAndReassignActive']>;

  const vehicle: VehicleView = {
    id: 'vehicle-1',
    brand: 'Honda',
    model: 'Civic',
    year: 2021,
    fuel: FuelType.NAFTA,
    plate: 'AF812KM',
    mileage: 48000,
    nickname: null,
    createdAt: new Date('2026-09-03T00:00:00.000Z'),
    updatedAt: new Date('2026-09-03T00:00:00.000Z'),
  };

  const createDto: CreateVehicleDto = {
    brand: 'Honda',
    model: 'Civic',
    year: 2021,
    fuel: FuelType.NAFTA,
    plate: 'AF812KM',
    mileage: 48000,
    nickname: null,
  };

  beforeEach(async () => {
    findByOwner = jest.fn();
    findOwnedById = jest.fn();
    createAndSetActive = jest.fn();
    update = jest.fn();
    deleteAndReassignActive = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehiclesService,
        {
          provide: VehiclesRepository,
          useValue: {
            findByOwner,
            findOwnedById,
            createAndSetActive,
            update,
            deleteAndReassignActive,
          },
        },
      ],
    }).compile();

    service = module.get<VehiclesService>(VehiclesService);
  });

  it('creates the vehicle and delegates active-vehicle assignment atomically', async () => {
    createAndSetActive.mockResolvedValue(vehicle);

    await expect(service.create('user-1', createDto)).resolves.toBe(vehicle);
    expect(createAndSetActive).toHaveBeenCalledWith('user-1', {
      ...createDto,
      nickname: null,
    });
  });

  it('normalizes a spaced lowercase plate before creating the vehicle', async () => {
    createAndSetActive.mockResolvedValue(vehicle);

    await service.create('user-1', { ...createDto, plate: 'af 812 km' });

    expect(createAndSetActive).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ plate: 'AF812KM' }),
    );
  });

  it('returns a conflict when the owner already has the plate', async () => {
    createAndSetActive.mockRejectedValue({ code: 'P2002' });

    await expect(service.create('user-1', createDto)).rejects.toThrow(ConflictException);
  });

  it('returns not found when editing another user vehicle', async () => {
    findOwnedById.mockResolvedValue(null);

    await expect(service.update('user-1', 'vehicle-2', { model: 'Golf' })).rejects.toThrow(
      NotFoundException,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('updates only the supplied fields and normalizes the plate', async () => {
    findOwnedById.mockResolvedValue({ id: vehicle.id });
    update.mockResolvedValue(vehicle);

    await expect(
      service.update('user-1', vehicle.id, { plate: ' af 812 km ', nickname: '' }),
    ).resolves.toBe(vehicle);
    expect(update).toHaveBeenCalledWith(vehicle.id, { plate: 'AF812KM', nickname: null });
  });

  it('deletes an owned vehicle through the atomic repository operation', async () => {
    findOwnedById.mockResolvedValue({ id: vehicle.id });

    await expect(service.remove('user-1', vehicle.id)).resolves.toBeUndefined();
    expect(deleteAndReassignActive).toHaveBeenCalledWith('user-1', vehicle.id);
  });

  it('returns not found when deleting another user vehicle', async () => {
    findOwnedById.mockResolvedValue(null);

    await expect(service.remove('user-1', 'vehicle-2')).rejects.toThrow(NotFoundException);
    expect(deleteAndReassignActive).not.toHaveBeenCalled();
  });
});
