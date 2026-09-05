import { Test, TestingModule } from '@nestjs/testing';
import { FuelType } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VehiclesRepository, VehicleView } from './vehicles.repository';

describe('VehiclesRepository', () => {
  let repository: VehiclesRepository;
  let transaction: jest.Mock;
  let create: jest.Mock;
  let updateUser: jest.Mock;

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

  beforeEach(async () => {
    create = jest.fn().mockResolvedValue(vehicle);
    updateUser = jest.fn().mockResolvedValue({ id: 'user-1', activeVehicleId: vehicle.id });
    transaction = jest.fn(async (callback) =>
      callback({ vehicle: { create }, user: { update: updateUser } }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehiclesRepository,
        {
          provide: PrismaService,
          useValue: { $transaction: transaction },
        },
      ],
    }).compile();

    repository = module.get<VehiclesRepository>(VehiclesRepository);
  });

  it('creates a vehicle and marks it active in one transaction', async () => {
    const data = {
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      fuel: vehicle.fuel,
      plate: vehicle.plate,
      mileage: vehicle.mileage,
      nickname: vehicle.nickname,
    };

    await expect(repository.createAndSetActive('user-1', data)).resolves.toBe(vehicle);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: { ...data, ownerId: 'user-1' },
      select: expect.any(Object),
    });
    expect(updateUser).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { activeVehicleId: vehicle.id },
    });
  });
});
