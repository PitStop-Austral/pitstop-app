import { Test, TestingModule } from '@nestjs/testing';
import { FuelType } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VehiclesRepository, VehicleView } from './vehicles.repository';

describe('VehiclesRepository', () => {
  let repository: VehiclesRepository;
  let transaction: jest.Mock;
  let create: jest.Mock;
  let deleteVehicle: jest.Mock;
  let findOwnedVehicle: jest.Mock;
  let findReplacement: jest.Mock;
  let findTransactionUser: jest.Mock;
  let lockOwner: jest.Mock;
  let updateManyAndReturn: jest.Mock;
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
    engineOilType: null,
    engineOilLiters: null,
    gearboxOilType: null,
    gearboxOilLiters: null,
    transmission: null,
    frontTireSize: null,
    frontTirePressurePsi: null,
    rearTireSize: null,
    rearTirePressurePsi: null,
    highBeam: null,
    lowBeam: null,
    fogLight: null,
    createdAt: new Date('2026-09-03T00:00:00.000Z'),
    updatedAt: new Date('2026-09-03T00:00:00.000Z'),
  };

  beforeEach(async () => {
    create = jest.fn().mockResolvedValue(vehicle);
    deleteVehicle = jest.fn();
    findOwnedVehicle = jest.fn();
    findReplacement = jest.fn();
    findTransactionUser = jest.fn();
    lockOwner = jest.fn();
    updateManyAndReturn = jest.fn();
    updateUser = jest.fn().mockResolvedValue({ id: 'user-1', activeVehicleId: vehicle.id });
    transaction = jest.fn(async (callback) =>
      callback({
        $queryRaw: lockOwner,
        vehicle: { create, delete: deleteVehicle, findFirst: findReplacement },
        user: { findUnique: findTransactionUser, update: updateUser },
      }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehiclesRepository,
        {
          provide: PrismaService,
          useValue: {
            $transaction: transaction,
            user: { update: updateUser },
            vehicle: { findFirst: findOwnedVehicle, updateManyAndReturn },
          },
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
      engineOilType: vehicle.engineOilType,
      engineOilLiters: null,
      gearboxOilType: vehicle.gearboxOilType,
      gearboxOilLiters: null,
      transmission: vehicle.transmission,
      frontTireSize: vehicle.frontTireSize,
      frontTirePressurePsi: vehicle.frontTirePressurePsi,
      rearTireSize: vehicle.rearTireSize,
      rearTirePressurePsi: vehicle.rearTirePressurePsi,
      highBeam: vehicle.highBeam,
      lowBeam: vehicle.lowBeam,
      fogLight: vehicle.fogLight,
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

  it('sets the selected vehicle as active for its owner', async () => {
    await expect(repository.setActiveVehicle('user-1', vehicle.id)).resolves.toEqual({
      id: 'user-1',
      activeVehicleId: vehicle.id,
    });

    expect(updateUser).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { activeVehicleId: vehicle.id },
    });
  });

  it('finds an owned vehicle with its current mileage', async () => {
    findOwnedVehicle.mockResolvedValue({ id: vehicle.id, mileage: vehicle.mileage });

    await expect(repository.findOwnedById(vehicle.id, 'user-1')).resolves.toEqual({
      id: vehicle.id,
      mileage: vehicle.mileage,
    });
    expect(findOwnedVehicle).toHaveBeenCalledWith({
      where: { id: vehicle.id, ownerId: 'user-1' },
      select: { id: true, mileage: true },
    });
  });

  it('updates mileage only when the stored value is not greater', async () => {
    updateManyAndReturn.mockResolvedValue([{ ...vehicle, mileage: 50000 }]);

    await expect(
      repository.updateMileageIfNotDecreased(vehicle.id, 'user-1', 50000),
    ).resolves.toEqual({ ...vehicle, mileage: 50000 });
    expect(updateManyAndReturn).toHaveBeenCalledWith({
      where: { id: vehicle.id, ownerId: 'user-1', mileage: { lte: 50000 } },
      data: { mileage: 50000 },
      select: expect.any(Object),
    });
  });

  it('does not update mileage when another request already stored a greater value', async () => {
    updateManyAndReturn.mockResolvedValue([]);

    await expect(
      repository.updateMileageIfNotDecreased(vehicle.id, 'user-1', 49000),
    ).resolves.toBeNull();
  });

  it('deletes the active vehicle and assigns the oldest remaining one in one transaction', async () => {
    findTransactionUser.mockResolvedValue({ activeVehicleId: vehicle.id });
    findReplacement.mockResolvedValue({ id: 'vehicle-2' });

    await expect(repository.deleteAndReassignActive('user-1', vehicle.id)).resolves.toBeUndefined();

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(lockOwner).toHaveBeenCalledTimes(1);
    expect(deleteVehicle).toHaveBeenCalledWith({ where: { id: vehicle.id } });
    expect(findReplacement).toHaveBeenCalledWith({
      where: { ownerId: 'user-1' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    expect(updateUser).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { activeVehicleId: 'vehicle-2' },
    });
  });

  it('clears the active vehicle when deleting the last one', async () => {
    findTransactionUser.mockResolvedValue({ activeVehicleId: vehicle.id });
    findReplacement.mockResolvedValue(null);

    await repository.deleteAndReassignActive('user-1', vehicle.id);

    expect(updateUser).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { activeVehicleId: null },
    });
  });
});
