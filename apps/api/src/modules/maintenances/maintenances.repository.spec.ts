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
  let updateVehicleMileage: jest.Mock;

  const vehicleId = '22222222-2222-4222-8222-222222222222';
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
    updateVehicleMileage = jest.fn().mockResolvedValue({ count: 1 });
    transaction = jest.fn(async (callback) =>
      callback({
        maintenance: { create: createMaintenance },
        vehicle: { updateMany: updateVehicleMileage },
      }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenancesRepository,
        {
          provide: PrismaService,
          useValue: { $transaction: transaction },
        },
      ],
    }).compile();

    repository = module.get(MaintenancesRepository);
  });

  it('creates the maintenance and only raises mileage in one transaction', async () => {
    await expect(repository.createWithMileageUpdate(vehicleId, data)).resolves.toBe(maintenance);
    expect(transaction).toHaveBeenCalledTimes(1);
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
        repository.createWithMileageUpdate(vehicleId, { ...data, mileage }),
      ).resolves.toBe(maintenance);
      expect(updateVehicleMileage).toHaveBeenCalledWith({
        where: { id: vehicleId, mileage: { lt: mileage } },
        data: { mileage },
      });
    },
  );
});
