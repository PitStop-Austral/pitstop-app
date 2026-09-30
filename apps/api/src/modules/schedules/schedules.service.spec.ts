import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { VehiclesRepository } from '../vehicles/vehicles.repository';
import { SchedulesRepository } from './schedules.repository';
import type { ScheduleView } from './schedules.repository';
import { argentinaDateToday, SchedulesService } from './schedules.service';

describe('SchedulesService', () => {
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const vehicleId = '22222222-2222-4222-8222-222222222222';
  const owner = { id: ownerId, upcomingThresholdDays: 30, upcomingThresholdKm: 1500 };
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
        service.create(owner, vehicleId, { type: ' Filtros ', intervalMonths, intervalKm }),
      ).resolves.toEqual({
        ...schedule,
        baselineDate: '2026-09-17',
        nextDueDate: '2027-03-17',
        nextDueMileage: 58000,
        remainingDays: 181,
        remainingKm: 10000,
        status: 'on_track',
        dueReason: null,
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
    await expect(service.create(owner, vehicleId, { type: 'Filtros' })).rejects.toThrow(
      BadRequestException,
    );
    expect(createWithBaseline).not.toHaveBeenCalled();
  });

  it('returns 409 for a database unique constraint collision', async () => {
    createWithBaseline.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.create(owner, vehicleId, { type: 'fIlTrOs', intervalKm: 10000 }),
    ).rejects.toThrow(ConflictException);
  });

  it('returns 404 when the vehicle disappears after the ownership check', async () => {
    createWithBaseline.mockRejectedValue({ code: 'P2025' });
    await expect(
      service.create(owner, vehicleId, { type: 'Filtros', intervalKm: 10000 }),
    ).rejects.toThrow(new NotFoundException('Vehículo no encontrado'));
  });

  it('hides an unowned vehicle for list and create', async () => {
    findOwnedById.mockResolvedValue(null);
    await expect(service.findByVehicle(owner, vehicleId)).rejects.toThrow(NotFoundException);
    await expect(
      service.create(owner, vehicleId, { type: 'Filtros', intervalKm: 10000 }),
    ).rejects.toThrow(NotFoundException);
    expect(findManyByVehicle).not.toHaveBeenCalled();
    expect(createWithBaseline).not.toHaveBeenCalled();
  });

  it('lists persisted schedules for the owned vehicle', async () => {
    findManyByVehicle.mockResolvedValue([schedule]);
    await expect(service.findByVehicle(owner, vehicleId)).resolves.toEqual([
      {
        ...schedule,
        baselineDate: '2026-09-17',
        nextDueDate: '2027-03-17',
        nextDueMileage: 58000,
        remainingDays: 181,
        remainingKm: 10000,
        status: 'on_track',
        dueReason: null,
      },
    ]);
    expect(findManyByVehicle).toHaveBeenCalledWith(vehicleId);
    expect(findOwnedById).toHaveBeenCalledWith(vehicleId, ownerId);
  });

  it('recomputes the status from the current vehicle mileage and user thresholds', async () => {
    findManyByVehicle.mockResolvedValue([schedule]);
    const statusAt = async (mileage: number, thresholds = owner) => {
      findOwnedById.mockResolvedValue({ id: vehicleId, mileage, photoPath: null });
      const [result] = await service.findByVehicle(thresholds, vehicleId);
      return result.status;
    };

    await expect(statusAt(56499)).resolves.toBe('on_track');
    await expect(statusAt(56500)).resolves.toBe('upcoming');
    await expect(statusAt(58000)).resolves.toBe('overdue');
    await expect(statusAt(56500, { ...owner, upcomingThresholdKm: 500 })).resolves.toBe('on_track');
  });

  it('keeps the Argentine calendar day late at night so the due date does not shift', async () => {
    // 2026-09-18T02:30Z is still 17/09 23:30 in Buenos Aires.
    jest.setSystemTime(new Date('2026-09-18T02:30:00.000Z'));
    expect(argentinaDateToday()).toEqual(new Date('2026-09-17T00:00:00.000Z'));

    const dueToday = {
      ...schedule,
      baselineDate: new Date('2026-03-17T00:00:00.000Z'),
      intervalKm: null,
    };
    findManyByVehicle.mockResolvedValue([dueToday]);
    const [today] = await service.findByVehicle(owner, vehicleId);
    expect(today).toMatchObject({ nextDueDate: '2026-09-17', remainingDays: 0, status: 'overdue' });

    jest.setSystemTime(new Date('2026-09-17T02:30:00.000Z'));
    const [dayBefore] = await service.findByVehicle(owner, vehicleId);
    expect(dayBefore).toMatchObject({
      nextDueDate: '2026-09-17',
      remainingDays: 1,
      status: 'upcoming',
    });
    expect(Number.isInteger(dayBefore.remainingDays)).toBe(true);
  });
});
