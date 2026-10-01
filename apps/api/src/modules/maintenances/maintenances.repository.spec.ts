import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceCategory, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateMaintenanceData,
  MaintenancesRepository,
  MaintenanceView,
} from './maintenances.repository';

describe('MaintenancesRepository', () => {
  let repository: MaintenancesRepository;
  let transaction: jest.Mock;
  let createMaintenance: jest.Mock;
  let countMaintenances: jest.Mock;
  let lockOwner: jest.Mock;
  let updateVehicleMileage: jest.Mock;
  let findManyMaintenances: jest.Mock;
  let updateMaintenance: jest.Mock;

  const vehicleId = '22222222-2222-4222-8222-222222222222';
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const data: CreateMaintenanceData = {
    type: 'Cambio de aceite',
    category: MaintenanceCategory.MANTENIMIENTO,
    date: new Date('2026-09-17T00:00:00.000Z'),
    mileage: 60500,
    workshop: null,
    cost: 42000,
    notes: null,
  };
  const maintenance: MaintenanceView = {
    id: '33333333-3333-4333-8333-333333333333',
    vehicleId,
    ...data,
    cost: new Prisma.Decimal(42000),
    createdAt: new Date('2026-09-17T12:00:00.000Z'),
    updatedAt: new Date('2026-09-17T12:00:00.000Z'),
  };

  beforeEach(async () => {
    createMaintenance = jest.fn().mockResolvedValue(maintenance);
    countMaintenances = jest.fn().mockResolvedValue(0);
    lockOwner = jest.fn().mockResolvedValue([{ id: ownerId }]);
    updateVehicleMileage = jest.fn().mockResolvedValue({ count: 1 });
    findManyMaintenances = jest.fn().mockResolvedValue([maintenance]);
    updateMaintenance = jest.fn().mockResolvedValue(maintenance);
    transaction = jest.fn(async (callback) =>
      callback({
        $queryRaw: lockOwner,
        maintenance: {
          count: countMaintenances,
          create: createMaintenance,
          update: updateMaintenance,
        },
        vehicle: { updateMany: updateVehicleMileage },
      }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenancesRepository,
        {
          provide: PrismaService,
          useValue: {
            $transaction: transaction,
            maintenance: { findMany: findManyMaintenances },
          },
        },
      ],
    }).compile();

    repository = module.get(MaintenancesRepository);
  });

  it('lists a vehicle maintenances newest first, breaking ties by creation', async () => {
    await expect(repository.findManyByVehicle(vehicleId)).resolves.toEqual([maintenance]);
    expect(findManyMaintenances).toHaveBeenCalledWith({
      where: { vehicleId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: expect.any(Object),
    });
  });

  it('creates the maintenance and only raises mileage in one transaction', async () => {
    await expect(repository.createWithMileageUpdate(ownerId, vehicleId, data)).resolves.toEqual({
      maintenance,
      isFirstMaintenance: true,
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(lockOwner).toHaveBeenCalledTimes(1);
    expect(countMaintenances).toHaveBeenCalledWith({ where: { vehicle: { ownerId } } });
    expect(createMaintenance).toHaveBeenCalledWith({
      data: { ...data, vehicleId },
      select: expect.any(Object),
    });
    expect(updateVehicleMileage).toHaveBeenCalledWith({
      where: { id: vehicleId, mileage: { lt: 60500 } },
      data: { mileage: 60500 },
    });
  });

  it.each([60500, 50000])(
    'leaves equal or greater saved mileage unchanged for a submitted value of %i',
    async (mileage) => {
      updateVehicleMileage.mockResolvedValue({ count: 0 });

      await expect(
        repository.createWithMileageUpdate(ownerId, vehicleId, { ...data, mileage }),
      ).resolves.toEqual({ maintenance, isFirstMaintenance: true });
      expect(updateVehicleMileage).toHaveBeenCalledWith({
        where: { id: vehicleId, mileage: { lt: mileage } },
        data: { mileage },
      });
    },
  );

  it('reports later maintenance records across all owned vehicles', async () => {
    countMaintenances.mockResolvedValue(3);

    await expect(repository.createWithMileageUpdate(ownerId, vehicleId, data)).resolves.toEqual({
      maintenance,
      isFirstMaintenance: false,
    });
  });

  it('updates the maintenance and only raises mileage in one transaction', async () => {
    await expect(
      repository.updateWithMileageUpdate(vehicleId, maintenance.id, { mileage: 70000 }),
    ).resolves.toBe(maintenance);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(updateMaintenance).toHaveBeenCalledWith({
      where: { id: maintenance.id, vehicleId },
      data: { mileage: 70000 },
      select: expect.any(Object),
    });
    expect(updateVehicleMileage).toHaveBeenCalledWith({
      where: { id: vehicleId, mileage: { lt: 70000 } },
      data: { mileage: 70000 },
    });
  });

  it('leaves the vehicle untouched when the mileage is not updated', async () => {
    await repository.updateWithMileageUpdate(vehicleId, maintenance.id, { notes: null });
    expect(updateVehicleMileage).not.toHaveBeenCalled();
  });
});
