import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FuelType, Prisma, TransmissionType } from '../../generated/prisma/client';
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

    await expect(service.create('user-1', createDto)).resolves.toEqual(vehicle);
    expect(createAndSetActive).toHaveBeenCalledWith('user-1', {
      ...createDto,
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
    });
  });

  it('normalizes and returns a complete technical sheet', async () => {
    const savedVehicle: VehicleView = {
      ...vehicle,
      engineOilType: '5W-30 sintético',
      engineOilLiters: new Prisma.Decimal('4.2'),
      gearboxOilType: 'ATF DW-1',
      gearboxOilLiters: new Prisma.Decimal('3.1'),
      transmission: TransmissionType.MANUAL,
      frontTireSize: '215/50 R17',
      frontTirePressurePsi: 32,
      rearTireSize: '215/50 R17',
      rearTirePressurePsi: 30,
      highBeam: 'H11',
      lowBeam: 'H7',
      fogLight: 'H8',
    };
    createAndSetActive.mockResolvedValue(savedVehicle);

    await expect(
      service.create('user-1', {
        ...createDto,
        engineOilType: ' 5W-30 sintético ',
        engineOilLiters: 4.2,
        gearboxOilType: ' ATF DW-1 ',
        gearboxOilLiters: 3.1,
        transmission: TransmissionType.MANUAL,
        frontTireSize: ' 215/50 R17 ',
        frontTirePressurePsi: 32,
        rearTireSize: ' 215/50 R17 ',
        rearTirePressurePsi: 30,
        highBeam: ' H11 ',
        lowBeam: ' H7 ',
        fogLight: ' H8 ',
      }),
    ).resolves.toEqual({
      ...savedVehicle,
      engineOilLiters: 4.2,
      gearboxOilLiters: 3.1,
    });
    expect(createAndSetActive).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        engineOilType: '5W-30 sintético',
        gearboxOilType: 'ATF DW-1',
        frontTireSize: '215/50 R17',
        rearTireSize: '215/50 R17',
        highBeam: 'H11',
        lowBeam: 'H7',
        fogLight: 'H8',
      }),
    );
  });

  it('stores cleared technical text as null', async () => {
    createAndSetActive.mockResolvedValue(vehicle);

    await service.create('user-1', {
      ...createDto,
      engineOilType: ' ',
      gearboxOilType: '',
      frontTireSize: ' ',
      rearTireSize: '',
      highBeam: ' ',
      lowBeam: '',
      fogLight: ' ',
    });

    expect(createAndSetActive).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        engineOilType: null,
        gearboxOilType: null,
        frontTireSize: null,
        rearTireSize: null,
        highBeam: null,
        lowBeam: null,
        fogLight: null,
      }),
    );
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
    ).resolves.toEqual(vehicle);
    expect(update).toHaveBeenCalledWith(vehicle.id, { plate: 'AF812KM', nickname: null });
  });

  it('clears supplied technical fields without changing omitted ones', async () => {
    findOwnedById.mockResolvedValue({ id: vehicle.id });
    update.mockResolvedValue(vehicle);

    await service.update('user-1', vehicle.id, {
      engineOilType: '',
      engineOilLiters: null,
      transmission: null,
      frontTirePressurePsi: null,
      fogLight: ' ',
    });

    expect(update).toHaveBeenCalledWith(vehicle.id, {
      engineOilType: null,
      engineOilLiters: null,
      transmission: null,
      frontTirePressurePsi: null,
      fogLight: null,
    });
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
