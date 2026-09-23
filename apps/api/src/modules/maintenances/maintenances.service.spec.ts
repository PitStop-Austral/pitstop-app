import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceCategory, Prisma } from '../../generated/prisma/client';
import { VehiclesRepository } from '../vehicles/vehicles.repository';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { MaintenancesRepository, MaintenanceView } from './maintenances.repository';
import { MaintenancesService } from './maintenances.service';

describe('MaintenancesService', () => {
  let service: MaintenancesService;
  let findOwnedById: jest.MockedFunction<VehiclesRepository['findOwnedById']>;
  let createWithMileageUpdate: jest.MockedFunction<
    MaintenancesRepository['createWithMileageUpdate']
  >;
  let findManyByVehicle: jest.MockedFunction<MaintenancesRepository['findManyByVehicle']>;

  const dto: CreateMaintenanceDto = {
    type: 'Cambio de aceite',
    category: MaintenanceCategory.MANTENIMIENTO,
    date: '2026-09-17',
    mileage: 60500,
    workshop: 'Lubricentro',
    cost: 42000,
    notes: null,
  };

  const maintenance: MaintenanceView = {
    id: '33333333-3333-4333-8333-333333333333',
    vehicleId: '22222222-2222-4222-8222-222222222222',
    ...dto,
    date: new Date('2026-09-17T00:00:00.000Z'),
    workshop: 'Lubricentro',
    cost: new Prisma.Decimal(42000),
    notes: null,
    createdAt: new Date('2026-09-17T12:00:00.000Z'),
    updatedAt: new Date('2026-09-17T12:00:00.000Z'),
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-18T00:30:00.000Z'));
    findOwnedById = jest.fn();
    createWithMileageUpdate = jest.fn();
    findManyByVehicle = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenancesService,
        {
          provide: MaintenancesRepository,
          useValue: { createWithMileageUpdate, findManyByVehicle },
        },
        {
          provide: VehiclesRepository,
          useValue: { findOwnedById },
        },
      ],
    }).compile();

    service = module.get(MaintenancesService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a maintenance for an owned vehicle on the current Argentina date', async () => {
    findOwnedById.mockResolvedValue({ id: maintenance.vehicleId, mileage: 60000, photoPath: null });
    createWithMileageUpdate.mockResolvedValue(maintenance);

    await expect(service.create('user-1', maintenance.vehicleId, dto)).resolves.toEqual({
      ...maintenance,
      date: '2026-09-17',
      cost: 42000,
    });
    expect(createWithMileageUpdate).toHaveBeenCalledWith(maintenance.vehicleId, {
      ...dto,
      date: new Date('2026-09-17T00:00:00.000Z'),
      workshop: 'Lubricentro',
      cost: 42000,
      notes: null,
    });
  });

  it('hides an absent or unowned vehicle behind not found', async () => {
    findOwnedById.mockResolvedValue(null);

    await expect(service.create('user-1', maintenance.vehicleId, dto)).rejects.toThrow(
      NotFoundException,
    );
    expect(createWithMileageUpdate).not.toHaveBeenCalled();
  });

  it('rejects a date after today in Argentina', async () => {
    findOwnedById.mockResolvedValue({ id: maintenance.vehicleId, mileage: 60000, photoPath: null });

    await expect(
      service.create('user-1', maintenance.vehicleId, { ...dto, date: '2026-09-18' }),
    ).rejects.toThrow(BadRequestException);
    expect(createWithMileageUpdate).not.toHaveBeenCalled();
  });

  it('lists the maintenances of an owned vehicle as responses', async () => {
    findOwnedById.mockResolvedValue({ id: maintenance.vehicleId, mileage: 60000 });
    findManyByVehicle.mockResolvedValue([maintenance]);

    await expect(service.findByVehicle('user-1', maintenance.vehicleId)).resolves.toEqual([
      { ...maintenance, date: '2026-09-17', cost: 42000 },
    ]);
    expect(findManyByVehicle).toHaveBeenCalledWith(maintenance.vehicleId);
  });

  it('returns an empty list for a vehicle without maintenances', async () => {
    findOwnedById.mockResolvedValue({ id: maintenance.vehicleId, mileage: 60000 });
    findManyByVehicle.mockResolvedValue([]);

    await expect(service.findByVehicle('user-1', maintenance.vehicleId)).resolves.toEqual([]);
  });

  it('hides an absent or unowned vehicle behind not found when listing', async () => {
    findOwnedById.mockResolvedValue(null);

    await expect(service.findByVehicle('user-1', maintenance.vehicleId)).rejects.toThrow(
      NotFoundException,
    );
    expect(findManyByVehicle).not.toHaveBeenCalled();
  });
});
