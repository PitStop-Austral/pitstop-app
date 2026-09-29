import { SchedulesRepository } from './schedules.repository';

describe('SchedulesRepository', () => {
  const vehicleId = '22222222-2222-4222-8222-222222222222';
  const fallbackDate = new Date('2026-09-17T00:00:00.000Z');
  const findUniqueOrThrow = jest.fn();
  const findFirst = jest.fn();
  const create = jest.fn();
  const transaction = jest.fn(async (callback) =>
    callback({
      vehicle: { findUniqueOrThrow },
      maintenance: { findFirst },
      schedule: { create },
    }),
  );
  const repository = new SchedulesRepository({ $transaction: transaction } as never);
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
    transaction.mockImplementation(async (callback) =>
      callback({
        vehicle: { findUniqueOrThrow },
        maintenance: { findFirst },
        schedule: { create },
      }),
    );
    findUniqueOrThrow.mockResolvedValue({ mileage: 48000 });
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
});
