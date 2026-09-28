import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { VehiclesRepository } from '../vehicles/vehicles.repository';
import { SchedulesRepository } from './schedules.repository';
import type { ScheduleView } from './schedules.repository';
import { SchedulesService } from './schedules.service';

describe('SchedulesService', () => {
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const vehicleId = '22222222-2222-4222-8222-222222222222';
  const schedule: ScheduleView = {
    id: '44444444-4444-4444-8444-444444444444',
    vehicleId,
    type: 'Filtros',
    intervalMonths: 6,
    intervalKm: 10000,
    baselineDate: new Date('2026-09-17T00:00:00.000Z'),
    baselineMileage: 48000,
    createdAt: new Date('2026-09-18T00:00:00.000Z'),
    updatedAt: new Date('2026-09-18T00:00:00.000Z'),
  };
  const findOwnedById = jest.fn();
  const findManyByVehicle = jest.fn();
  const createWithBaseline = jest.fn();
  let service: SchedulesService;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-18T00:30:00.000Z'));
    jest.resetAllMocks();
    findOwnedById.mockResolvedValue({ id: vehicleId, mileage: 48000, photoPath: null });
    const module = await Test.createTestingModule({
      providers: [
        SchedulesService,
        { provide: VehiclesRepository, useValue: { findOwnedById } },
        { provide: SchedulesRepository, useValue: { findManyByVehicle, createWithBaseline } },
      ],
    }).compile();
    service = module.get(SchedulesService);
  });

  afterEach(() => jest.useRealTimers());

  it('creates all three interval combinations and serializes the baseline date', async () => {
    createWithBaseline.mockResolvedValue(schedule);
    for (const [intervalMonths, intervalKm] of [
      [6, null],
      [null, 10000],
      [6, 10000],
    ]) {
      await expect(
        service.create(ownerId, vehicleId, { type: ' Filtros ', intervalMonths, intervalKm }),
      ).resolves.toEqual({
        ...schedule,
        baselineDate: '2026-09-17',
      });
      expect(createWithBaseline).toHaveBeenLastCalledWith({
        vehicleId,
        type: 'Filtros',
        normalizedType: 'filtros',
        intervalMonths,
        intervalKm,
        fallbackDate: new Date('2026-09-17T00:00:00.000Z'),
      });
    }
  });

  it('rejects a schedule with no intervals', async () => {
    await expect(service.create(ownerId, vehicleId, { type: 'Filtros' })).rejects.toThrow(
      BadRequestException,
    );
    expect(createWithBaseline).not.toHaveBeenCalled();
  });

  it('returns 409 for a database unique constraint collision', async () => {
    createWithBaseline.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.create(ownerId, vehicleId, { type: 'fIlTrOs', intervalKm: 10000 }),
    ).rejects.toThrow(ConflictException);
  });

  it('hides an unowned vehicle for list and create', async () => {
    findOwnedById.mockResolvedValue(null);
    await expect(service.findByVehicle(ownerId, vehicleId)).rejects.toThrow(NotFoundException);
    await expect(
      service.create(ownerId, vehicleId, { type: 'Filtros', intervalKm: 10000 }),
    ).rejects.toThrow(NotFoundException);
    expect(findManyByVehicle).not.toHaveBeenCalled();
    expect(createWithBaseline).not.toHaveBeenCalled();
  });

  it('lists persisted schedules for the owned vehicle', async () => {
    findManyByVehicle.mockResolvedValue([schedule]);
    await expect(service.findByVehicle(ownerId, vehicleId)).resolves.toEqual([
      { ...schedule, baselineDate: '2026-09-17' },
    ]);
    expect(findManyByVehicle).toHaveBeenCalledWith(vehicleId);
  });
});
