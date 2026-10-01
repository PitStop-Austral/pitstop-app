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
  const findById = jest.fn();
  const createWithBaseline = jest.fn();
  const updateWithBaseline = jest.fn();
  const deleteSchedule = jest.fn();
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
        {
          provide: SchedulesRepository,
          useValue: {
            findManyByVehicle,
            findById,
            createWithBaseline,
            updateWithBaseline,
            delete: deleteSchedule,
          },
        },
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

  it('returns one owned schedule with the central due calculation', async () => {
    findById.mockResolvedValue(schedule);
    await expect(service.findOne(owner, vehicleId, schedule.id)).resolves.toMatchObject({
      id: schedule.id,
      baselineDate: '2026-09-17',
      nextDueDate: '2027-03-17',
      nextDueMileage: 58000,
    });
    expect(findById).toHaveBeenCalledWith(vehicleId, schedule.id);
  });

  it('updates intervals without resetting the baseline', async () => {
    updateWithBaseline.mockResolvedValue({ ...schedule, intervalMonths: null, intervalKm: 12000 });

    await service.update(owner, vehicleId, schedule.id, {
      intervalMonths: null,
      intervalKm: 12000,
    });

    expect(updateWithBaseline).toHaveBeenCalledWith({
      id: schedule.id,
      vehicleId,
      fallbackDate: new Date('2026-09-17T00:00:00.000Z'),
      resolve: expect.any(Function),
    });
    const [{ resolve }] = updateWithBaseline.mock.calls[0];
    expect(resolve(schedule)).toEqual({
      type: 'Filtros',
      normalizedType: 'filtros',
      intervalMonths: null,
      intervalKm: 12000,
      resetBaseline: false,
    });
  });

  it('resets the baseline when the normalized type changes', async () => {
    const updated = {
      ...schedule,
      type: 'Cambio de aceite',
      baselineDate: new Date('2026-08-10T00:00:00.000Z'),
      baselineMileage: 45000,
    };
    updateWithBaseline.mockResolvedValue(updated);

    await service.update(owner, vehicleId, schedule.id, { type: ' Cambio de aceite ' });

    const [{ resolve }] = updateWithBaseline.mock.calls[0];
    expect(resolve(schedule)).toEqual(
      expect.objectContaining({
        type: 'Cambio de aceite',
        normalizedType: 'cambio de aceite',
        resetBaseline: true,
      }),
    );
  });

  it('keeps the baseline for a casing-only type edit', async () => {
    updateWithBaseline.mockResolvedValue({ ...schedule, type: 'FILTROS' });
    await service.update(owner, vehicleId, schedule.id, { type: 'FILTROS' });
    const [{ resolve }] = updateWithBaseline.mock.calls[0];
    expect(resolve(schedule)).toEqual(expect.objectContaining({ resetBaseline: false }));
  });

  it('merges a partial edit with the row read inside the transaction', async () => {
    updateWithBaseline.mockResolvedValue({
      ...schedule,
      type: 'Cambio de aceite',
      baselineMileage: 45000,
      intervalKm: 12000,
    });
    await service.update(owner, vehicleId, schedule.id, { intervalKm: 12000 });
    const [{ resolve }] = updateWithBaseline.mock.calls[0];
    const concurrentlyRenamed = {
      ...schedule,
      type: 'Cambio de aceite',
      baselineMileage: 45000,
    };

    expect(resolve(concurrentlyRenamed)).toEqual({
      type: 'Cambio de aceite',
      normalizedType: 'cambio de aceite',
      intervalMonths: 6,
      intervalKm: 12000,
      resetBaseline: false,
    });
  });

  it('rejects an update that clears both intervals', async () => {
    updateWithBaseline.mockImplementation(({ resolve }) => resolve(schedule));
    await expect(
      service.update(owner, vehicleId, schedule.id, {
        intervalMonths: null,
        intervalKm: null,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns 409 when an edit collides with another schedule type', async () => {
    updateWithBaseline.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.update(owner, vehicleId, schedule.id, { type: 'Cambio de aceite' }),
    ).rejects.toThrow(ConflictException);
  });

  it('deletes an owned schedule', async () => {
    findById.mockResolvedValue(schedule);
    await expect(service.remove(owner, vehicleId, schedule.id)).resolves.toBeUndefined();
    expect(deleteSchedule).toHaveBeenCalledWith(vehicleId, schedule.id);
  });

  it('returns 404 when a schedule is missing or disappears during a mutation', async () => {
    findById.mockResolvedValue(null);
    await expect(service.findOne(owner, vehicleId, schedule.id)).rejects.toThrow(
      new NotFoundException('Frecuencia no encontrada'),
    );

    findById.mockResolvedValue(schedule);
    deleteSchedule.mockRejectedValue({ code: 'P2025' });
    await expect(service.remove(owner, vehicleId, schedule.id)).rejects.toThrow(
      new NotFoundException('Frecuencia no encontrada'),
    );
  });

  it('does not read or mutate schedules when the vehicle is unowned', async () => {
    findOwnedById.mockResolvedValue(null);
    await expect(service.findOne(owner, vehicleId, schedule.id)).rejects.toThrow(NotFoundException);
    await expect(service.update(owner, vehicleId, schedule.id, {})).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.remove(owner, vehicleId, schedule.id)).rejects.toThrow(NotFoundException);
    expect(findById).not.toHaveBeenCalled();
    expect(updateWithBaseline).not.toHaveBeenCalled();
    expect(deleteSchedule).not.toHaveBeenCalled();
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
