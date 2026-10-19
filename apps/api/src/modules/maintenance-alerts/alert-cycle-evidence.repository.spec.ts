import { reconcileAlertResolutions } from './alert-cycle-evidence.repository';

describe('alert cycle resolution reconciliation', () => {
  it('does not reuse a later cycle service to repair an earlier cycle', async () => {
    const update = jest.fn();
    const cycle = (id: string, firstSentAt: string, resolvedMaintenanceId: string | null) => ({
      id,
      scheduleId: 'schedule-1',
      vehicleId: 'vehicle-1',
      normalizedType: 'aceite',
      firstSentAt: new Date(firstSentAt),
      canceledAt: null,
      resolvedMaintenanceId,
      resolvedServiceDate: null,
      resolvedServiceMileage: null,
      resolvedAt: null,
    });
    const transaction = {
      maintenanceAlertCycle: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            cycle('old-cycle', '2026-10-01T12:00:00.000Z', 'deleted-service'),
            cycle('new-cycle', '2026-10-10T12:00:00.000Z', null),
          ]),
        update,
      },
      maintenance: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'new-service',
            type: 'Aceite',
            date: new Date('2026-10-11T00:00:00.000Z'),
            mileage: 52000,
            createdAt: new Date('2026-10-11T12:00:00.000Z'),
          },
        ]),
      },
    };

    await reconcileAlertResolutions(transaction as never, 'vehicle-1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'old-cycle' },
      data: {
        resolvedMaintenanceId: null,
        resolvedServiceDate: null,
        resolvedServiceMileage: null,
        resolvedAt: null,
      },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'new-cycle' },
      data: expect.objectContaining({ resolvedMaintenanceId: 'new-service' }),
    });
  });

  it('assigns a retroactively registered service to the cycle containing its service date', async () => {
    const update = jest.fn();
    const cycle = (id: string, firstSentAt: string) => ({
      id,
      scheduleId: 'schedule-1',
      vehicleId: 'vehicle-1',
      normalizedType: 'aceite',
      firstSentAt: new Date(firstSentAt),
      canceledAt: null,
      resolvedMaintenanceId: null,
      resolvedServiceDate: null,
      resolvedServiceMileage: null,
      resolvedAt: null,
    });
    const transaction = {
      maintenanceAlertCycle: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            cycle('old-cycle', '2026-10-01T12:00:00.000Z'),
            cycle('new-cycle', '2026-10-10T12:00:00.000Z'),
          ]),
        update,
      },
      maintenance: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'retroactive-service',
            type: 'Aceite',
            date: new Date('2026-10-05T00:00:00.000Z'),
            mileage: 50000,
            createdAt: new Date('2026-10-12T12:00:00.000Z'),
          },
        ]),
      },
    };

    await reconcileAlertResolutions(transaction as never, 'vehicle-1');

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'old-cycle' },
      data: expect.objectContaining({ resolvedMaintenanceId: 'retroactive-service' }),
    });
  });

  it('invalidates a canceled cycle when its resolving service was deleted', async () => {
    const update = jest.fn();
    const transaction = {
      maintenanceAlertCycle: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'canceled-cycle',
            scheduleId: 'schedule-1',
            vehicleId: 'vehicle-1',
            normalizedType: 'aceite',
            firstSentAt: new Date('2026-10-01T12:00:00.000Z'),
            canceledAt: new Date('2026-10-12T12:00:00.000Z'),
            resolvedMaintenanceId: 'deleted-service',
            resolvedServiceDate: new Date('2026-10-05T00:00:00.000Z'),
            resolvedServiceMileage: 50000,
            resolvedAt: new Date('2026-10-05T12:00:00.000Z'),
          },
        ]),
        update,
      },
      maintenance: { findMany: jest.fn().mockResolvedValue([]) },
    };

    await reconcileAlertResolutions(transaction as never, 'vehicle-1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'canceled-cycle' },
      data: {
        resolvedMaintenanceId: null,
        resolvedServiceDate: null,
        resolvedServiceMileage: null,
        resolvedAt: null,
      },
    });
  });
});
