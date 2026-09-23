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
  let findOwned: jest.MockedFunction<MaintenancesRepository['findOwned']>;
  let updateWithMileageUpdate: jest.MockedFunction<
    MaintenancesRepository['updateWithMileageUpdate']
  >;
  let deleteMaintenance: jest.MockedFunction<MaintenancesRepository['delete']>;

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
    findOwned = jest.fn();
    updateWithMileageUpdate = jest.fn();
    deleteMaintenance = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenancesService,
        {
          provide: MaintenancesRepository,
          useValue: {
            createWithMileageUpdate,
            findManyByVehicle,
            findOwned,
            updateWithMileageUpdate,
            delete: deleteMaintenance,
          },
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
    findOwnedById.mockResolvedValue({ id: maintenance.vehicleId, mileage: 60000, photoPath: null });
    findManyByVehicle.mockResolvedValue([maintenance]);

    await expect(service.findByVehicle('user-1', maintenance.vehicleId)).resolves.toEqual([
      { ...maintenance, date: '2026-09-17', cost: 42000 },
    ]);
    expect(findManyByVehicle).toHaveBeenCalledWith(maintenance.vehicleId);
  });

  it('returns an empty list for a vehicle without maintenances', async () => {
    findOwnedById.mockResolvedValue({ id: maintenance.vehicleId, mileage: 60000, photoPath: null });
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

  describe('single maintenance', () => {
    const { vehicleId, id } = maintenance;
    const response = { ...maintenance, date: '2026-09-17', cost: 42000 };

    it('returns an owned maintenance scoped to its vehicle', async () => {
      findOwned.mockResolvedValue(maintenance);

      await expect(service.findOne('user-1', vehicleId, id)).resolves.toEqual(response);
      expect(findOwned).toHaveBeenCalledWith('user-1', vehicleId, id);
    });

    it('hides a maintenance of another user or vehicle behind not found', async () => {
      findOwned.mockResolvedValue(null);

      await expect(service.findOne('user-2', vehicleId, id)).rejects.toThrow(NotFoundException);
    });

    it('updates only the fields that were sent', async () => {
      findOwned.mockResolvedValue(maintenance);
      updateWithMileageUpdate.mockResolvedValue(maintenance);

      await service.update('user-1', vehicleId, id, {
        type: ' Revisión de dirección ',
        date: '2026-09-10',
        mileage: 70000,
      });
      expect(updateWithMileageUpdate).toHaveBeenCalledWith(vehicleId, id, {
        type: 'Revisión de dirección',
        date: new Date('2026-09-10T00:00:00.000Z'),
        mileage: 70000,
      });
    });

    it('keeps the saved cost when a partial update does not send it', async () => {
      findOwned.mockResolvedValue(maintenance);
      updateWithMileageUpdate.mockResolvedValue(maintenance);

      // Mirrors the ValidationPipe output: omitted fields exist on the DTO as undefined.
      await service.update('user-1', vehicleId, id, { notes: 'x', cost: undefined });
      expect(updateWithMileageUpdate).toHaveBeenCalledWith(vehicleId, id, { notes: 'x' });
    });

    it('clears optional fields sent as null or empty', async () => {
      findOwned.mockResolvedValue(maintenance);
      updateWithMileageUpdate.mockResolvedValue(maintenance);

      await service.update('user-1', vehicleId, id, { cost: null, workshop: '', notes: ' ' });
      expect(updateWithMileageUpdate).toHaveBeenCalledWith(vehicleId, id, {
        cost: null,
        workshop: null,
        notes: null,
      });
    });

    it('rejects a date after today in Argentina', async () => {
      findOwned.mockResolvedValue(maintenance);

      await expect(service.update('user-1', vehicleId, id, { date: '2026-09-18' })).rejects.toThrow(
        BadRequestException,
      );
      expect(updateWithMileageUpdate).not.toHaveBeenCalled();
    });

    it('does not update a maintenance of another user', async () => {
      findOwned.mockResolvedValue(null);

      await expect(service.update('user-2', vehicleId, id, { notes: 'x' })).rejects.toThrow(
        NotFoundException,
      );
      expect(updateWithMileageUpdate).not.toHaveBeenCalled();
    });

    it('deletes an owned maintenance', async () => {
      findOwned.mockResolvedValue(maintenance);

      await service.remove('user-1', vehicleId, id);
      expect(deleteMaintenance).toHaveBeenCalledWith(vehicleId, id);
    });

    it('turns a maintenance deleted before the update into not found', async () => {
      findOwned.mockResolvedValue(maintenance);
      updateWithMileageUpdate.mockRejectedValue({ code: 'P2025' });

      await expect(service.update('user-1', vehicleId, id, { notes: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('turns a maintenance deleted before the delete into not found', async () => {
      findOwned.mockResolvedValue(maintenance);
      deleteMaintenance.mockRejectedValue({ code: 'P2025' });

      await expect(service.remove('user-1', vehicleId, id)).rejects.toThrow(NotFoundException);
    });

    it('rethrows other database errors unchanged', async () => {
      const error = { code: 'P2002' };
      findOwned.mockResolvedValue(maintenance);
      updateWithMileageUpdate.mockRejectedValue(error);
      deleteMaintenance.mockRejectedValue(error);

      await expect(service.update('user-1', vehicleId, id, { notes: 'x' })).rejects.toBe(error);
      await expect(service.remove('user-1', vehicleId, id)).rejects.toBe(error);
    });

    it('does not delete a maintenance of another user', async () => {
      findOwned.mockResolvedValue(null);

      await expect(service.remove('user-2', vehicleId, id)).rejects.toThrow(NotFoundException);
      expect(deleteMaintenance).not.toHaveBeenCalled();
    });
  });
});
