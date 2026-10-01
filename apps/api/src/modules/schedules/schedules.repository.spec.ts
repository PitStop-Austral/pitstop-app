import { SchedulesRepository } from './schedules.repository';

describe('SchedulesRepository', () => {
  const vehicleId = '22222222-2222-4222-8222-222222222222';
  const fallbackDate = new Date('2026-09-17T00:00:00.000Z');
  const findUniqueOrThrow = jest.fn();
  const findFirst = jest.fn();
  const findSchedule = jest.fn();
  const findScheduleOrThrow = jest.fn();
  const create = jest.fn();
  const update = jest.fn();
  const deleteSchedule = jest.fn();
  const transactionClient = {
    vehicle: { findUniqueOrThrow },
    maintenance: { findFirst },
    schedule: { create, findFirstOrThrow: findScheduleOrThrow, update },
  };
  const transaction = jest.fn(
    async (callback: (client: typeof transactionClient) => Promise<unknown>, _options?: unknown) =>
      callback(transactionClient),
  );
  const repository = new SchedulesRepository({
    $transaction: transaction,
    schedule: { findFirst: findSchedule, delete: deleteSchedule },
  } as never);
  const input = {
    vehicleId,
    type: 'Filtros',
    normalizedType: 'filtros',
    intervalMonths: 6,
    intervalKm: 10000,
    fallbackDate,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    transaction.mockImplementation(async (callback) => callback(transactionClient));
    findUniqueOrThrow.mockResolvedValue({ mileage: 48000 });
    findScheduleOrThrow.mockResolvedValue({
      id: 'schedule-id',
      vehicleId,
      type: 'Filtros',
      intervalMonths: 6,
      intervalKm: 10000,
      baselineDate: fallbackDate,
      baselineMileage: 48000,
      createdAt: fallbackDate,
      updatedAt: fallbackDate,
    });
  });

  it('uses the latest matching maintenance as the baseline', async () => {
    const lastService = { date: new Date('2026-09-10T00:00:00.000Z'), mileage: 43000 };
    findFirst.mockResolvedValue(lastService);
    await repository.createWithBaseline(input);
    expect(findFirst).toHaveBeenCalledWith({
      where: { vehicleId, type: { equals: 'Filtros', mode: 'insensitive' } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: { date: true, mileage: true },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ baselineDate: lastService.date, baselineMileage: 43000 }),
      }),
    );
  });

  it('uses the vehicle mileage and current date when no matching service exists', async () => {
    findFirst.mockResolvedValue(null);
    await repository.createWithBaseline(input);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ baselineDate: fallbackDate, baselineMileage: 48000 }),
      }),
    );
  });

  it('finds a schedule only inside its vehicle', async () => {
    await repository.findById(vehicleId, 'schedule-id');
    expect(findSchedule).toHaveBeenCalledWith({
      where: { id: 'schedule-id', vehicleId },
      select: expect.any(Object),
    });
  });

  it('updates intervals without querying or changing the baseline', async () => {
    await repository.updateWithBaseline({
      id: 'schedule-id',
      vehicleId,
      fallbackDate,
      resolve: () => ({
        type: 'Filtros',
        normalizedType: 'filtros',
        intervalMonths: null,
        intervalKm: 10000,
        resetBaseline: false,
      }),
    });
    expect(findUniqueOrThrow).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'schedule-id', vehicleId },
        data: {
          type: 'Filtros',
          normalizedType: 'filtros',
          intervalMonths: null,
          intervalKm: 10000,
        },
      }),
    );
  });

  it('recalculates the baseline when the type changes', async () => {
    const lastService = { date: new Date('2026-09-11T00:00:00.000Z'), mileage: 44000 };
    findFirst.mockResolvedValue(lastService);
    await repository.updateWithBaseline({
      id: 'schedule-id',
      vehicleId,
      fallbackDate,
      resolve: () => ({
        type: 'Cambio de aceite',
        normalizedType: 'cambio de aceite',
        intervalMonths: 6,
        intervalKm: 10000,
        resetBaseline: true,
      }),
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          baselineDate: lastService.date,
          baselineMileage: lastService.mileage,
        }),
      }),
    );
  });

  it('retries the full serializable transaction after a write conflict', async () => {
    const currentRows = [
      {
        id: 'schedule-id',
        vehicleId,
        type: 'Filtros',
        intervalMonths: 6,
        intervalKm: 10000,
        baselineDate: fallbackDate,
        baselineMileage: 48000,
        createdAt: fallbackDate,
        updatedAt: fallbackDate,
      },
      {
        id: 'schedule-id',
        vehicleId,
        type: 'Cambio de aceite',
        intervalMonths: 6,
        intervalKm: 10000,
        baselineDate: new Date('2026-09-10T00:00:00.000Z'),
        baselineMileage: 44000,
        createdAt: fallbackDate,
        updatedAt: new Date('2026-09-18T00:00:00.000Z'),
      },
    ];
    const resolve = jest.fn((current) => ({
      type: current.type,
      normalizedType: current.type.toLocaleLowerCase('es-AR'),
      intervalMonths: current.intervalMonths,
      intervalKm: 12000,
      resetBaseline: false,
    }));
    let attempt = 0;
    transaction.mockImplementation(async (callback, options) => {
      expect(options).toEqual({ isolationLevel: 'Serializable' });
      findScheduleOrThrow.mockResolvedValueOnce(currentRows[attempt]);
      const result = await callback(transactionClient);
      attempt++;
      if (attempt === 1) throw { code: 'P2034' };
      return result;
    });

    await repository.updateWithBaseline({
      id: 'schedule-id',
      vehicleId,
      fallbackDate,
      resolve,
    });

    expect(resolve).toHaveBeenCalledTimes(2);
    expect(resolve).toHaveBeenLastCalledWith(currentRows[1]);
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'Cambio de aceite', intervalKm: 12000 }),
      }),
    );
  });

  it('deletes only the schedule inside its vehicle', async () => {
    await repository.delete(vehicleId, 'schedule-id');
    expect(deleteSchedule).toHaveBeenCalledWith({
      where: { id: 'schedule-id', vehicleId },
    });
  });
});
