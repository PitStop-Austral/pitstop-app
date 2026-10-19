import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { MaintenanceAlertsRepository } from '../src/modules/maintenance-alerts/maintenance-alerts.repository';
import { MaintenancesRepository } from '../src/modules/maintenances/maintenances.repository';
import { KpisRepository } from '../src/modules/kpis/kpis.repository';
import { buildKpiWindows } from '../src/modules/kpis/kpi-dates';
import { KpiService } from '../src/modules/kpis/kpi.service';
import { SchedulesRepository } from '../src/modules/schedules/schedules.repository';
import { VehiclesRepository } from '../src/modules/vehicles/vehicles.repository';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Alert resolution evidence (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let alerts: MaintenanceAlertsRepository;
  let maintenances: MaintenancesRepository;
  let schedules: SchedulesRepository;
  let kpis: KpisRepository;
  let vehicles: VehiclesRepository;
  let userId: string;
  let vehicleId: string;
  const scheduleIds: string[] = [];
  const runIds: string[] = [];
  const windows = buildKpiWindows('2026-10-21');

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL;
    if (!databaseUrl || !new URL(databaseUrl).pathname.slice(1).endsWith('_test')) {
      throw new Error(
        'TEST_DATABASE_URL must point to a dedicated PostgreSQL database ending in _test',
      );
    }
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    await prisma.$connect();
    const client = prisma as unknown as PrismaService;
    schedules = new SchedulesRepository(client);
    alerts = new MaintenanceAlertsRepository(client);
    maintenances = new MaintenancesRepository(client, schedules);
    kpis = new KpisRepository(client);
    vehicles = new VehiclesRepository(client);
    const suffix = randomUUID();
    const user = await prisma.user.create({
      data: {
        firebaseUid: `alert-cycle-${suffix}`,
        email: `alert-cycle-${suffix}@example.com`,
        name: 'Alert Cycle Test',
      },
    });
    userId = user.id;
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId: userId,
        brand: 'Ford',
        model: 'Focus',
        year: 2020,
        fuel: 'NAFTA',
        plate: `AC${suffix.slice(0, 5).toUpperCase()}`,
        mileage: 51000,
      },
    });
    vehicleId = vehicle.id;
  });

  afterAll(async () => {
    if (prisma) {
      if (runIds.length) {
        await prisma.kpiResult.deleteMany({ where: { runId: { in: runIds } } });
        await prisma.kpiRun.deleteMany({ where: { id: { in: runIds } } });
      }
      if (scheduleIds.length)
        await prisma.maintenanceAlertDelivery.deleteMany({
          where: { scheduleId: { in: scheduleIds } },
        });
      if (vehicleId) {
        await prisma.maintenanceAlertCycle.deleteMany({ where: { vehicleId } });
        await prisma.vehicle.delete({ where: { id: vehicleId } });
      }
      if (userId) await prisma.user.delete({ where: { id: userId } });
      await prisma.$disconnect();
    }
  });

  async function readAlert(kpiWindows = windows) {
    const sources = await kpis.readDailySources(kpiWindows);
    return sources.alertResolution;
  }

  it('deduplicates devices and updates the measured resolution when a service changes', async () => {
    const schedule = await prisma.schedule.create({
      data: {
        vehicleId,
        type: 'Aceite',
        normalizedType: 'aceite',
        intervalMonths: 6,
        intervalKm: 10000,
        baselineDate: new Date('2026-04-21T00:00:00.000Z'),
        baselineMileage: 42000,
      },
    });
    scheduleIds.push(schedule.id);
    const evidence = {
      scheduleId: schedule.id,
      vehicleId,
      normalizedType: 'aceite',
      dueKey: '2026-10-21:52000',
      dueDate: new Date('2026-10-21T00:00:00.000Z'),
      dueMileage: 52000,
    };
    const deliveries = await Promise.all(
      [randomUUID(), randomUUID()].map((installationId) =>
        prisma.maintenanceAlertDelivery.create({
          data: {
            scheduleId: schedule.id,
            installationId,
            dueKey: evidence.dueKey,
            dueDate: evidence.dueDate,
            dueMileage: evidence.dueMileage,
          },
        }),
      ),
    );
    await Promise.all(
      deliveries.map((delivery, index) =>
        alerts.markSent(delivery.id, `message-${index}`, evidence),
      ),
    );
    const cycles = await prisma.maintenanceAlertCycle.findMany({
      where: { scheduleId: schedule.id },
    });
    expect(cycles).toHaveLength(1);
    expect(
      await prisma.maintenanceAlertDelivery.count({
        where: { cycleId: cycles[0].id, status: 'SENT' },
      }),
    ).toBe(2);
    expect(await readAlert()).toMatchObject({
      timelyCount: 0n,
      evaluableCount: 1n,
      missingDeliveryCount: 0n,
      incompleteCycleCount: 0n,
    });

    const created = await maintenances.createWithMileageUpdate(userId, vehicleId, {
      type: 'Aceite',
      category: 'MANTENIMIENTO',
      date: new Date('2026-10-21T00:00:00.000Z'),
      mileage: 52000,
      workshop: null,
      cost: null,
      notes: null,
    });
    expect(await readAlert()).toMatchObject({
      timelyCount: 1n,
      evaluableCount: 1n,
      missingDeliveryCount: 0n,
      incompleteCycleCount: 0n,
    });
    const snapshot = await new KpiService(kpis, {
      now: () => new Date('2026-10-22T12:00:00.000Z'),
    }).calculateDaily({ date: '2026-10-21', env: 'dev' });
    runIds.push(snapshot.runId);
    expect(snapshot.measurements).toContainEqual({ kpi_id: 'alert_resolution_rate', value: 100 });
    expect(snapshot.diagnostics).toHaveLength(6);
    expect(snapshot.diagnostics[1]).toMatchObject({ numerator: '1', denominator: '1' });
    expect(await prisma.kpiResult.count({ where: { runId: snapshot.runId } })).toBe(6);
    await maintenances.updateWithMileageUpdate(vehicleId, created.maintenance.id, {
      date: new Date('2026-10-22T00:00:00.000Z'),
    });
    expect(await readAlert()).toMatchObject({ timelyCount: 0n, evaluableCount: 1n });
    await maintenances.updateWithMileageUpdate(vehicleId, created.maintenance.id, {
      date: new Date('2026-10-21T00:00:00.000Z'),
    });
    expect(await readAlert()).toMatchObject({ timelyCount: 1n, evaluableCount: 1n });
    await maintenances.updateWithMileageUpdate(vehicleId, created.maintenance.id, {
      type: 'Filtros',
    });
    expect(await readAlert()).toMatchObject({ timelyCount: 0n, evaluableCount: 1n });
    await maintenances.updateWithMileageUpdate(vehicleId, created.maintenance.id, {
      type: 'Aceite',
    });
    expect(await readAlert()).toMatchObject({ timelyCount: 1n, evaluableCount: 1n });
    await schedules.updateWithBaseline({
      id: schedule.id,
      vehicleId,
      fallbackDate: new Date('2026-10-19T00:00:00.000Z'),
      resolve: () => ({
        type: 'Aceite',
        normalizedType: 'aceite',
        intervalMonths: 7,
        intervalKm: 10000,
        resetBaseline: false,
      }),
    });
    expect(await readAlert()).toMatchObject({ timelyCount: 0n, evaluableCount: 0n });
    await maintenances.delete(vehicleId, created.maintenance.id);
    expect(
      await prisma.maintenanceAlertCycle.findUnique({ where: { id: cycles[0].id } }),
    ).toMatchObject({
      canceledAt: expect.any(Date),
      resolvedMaintenanceId: null,
      resolvedAt: null,
    });
    await schedules.delete(vehicleId, schedule.id);
    expect(
      await prisma.maintenanceAlertDelivery.count({ where: { scheduleId: schedule.id } }),
    ).toBe(2);
  });

  it('waits for observed mileage and accepts a service at the exact mileage limit', async () => {
    const schedule = await prisma.schedule.create({
      data: {
        vehicleId,
        type: 'Correa',
        normalizedType: 'correa',
        intervalKm: 10000,
        baselineDate: new Date('2026-01-01T00:00:00.000Z'),
        baselineMileage: 43000,
      },
    });
    scheduleIds.push(schedule.id);
    const delivery = await prisma.maintenanceAlertDelivery.create({
      data: {
        scheduleId: schedule.id,
        installationId: randomUUID(),
        dueKey: 'none:53000',
        dueMileage: 53000,
      },
    });
    await alerts.markSent(delivery.id, 'km-message', {
      scheduleId: schedule.id,
      vehicleId,
      normalizedType: 'correa',
      dueKey: 'none:53000',
      dueDate: null,
      dueMileage: 53000,
    });
    expect(await readAlert()).toMatchObject({
      evaluableCount: 0n,
      missingDeliveryCount: 0n,
      incompleteCycleCount: 0n,
    });
    await vehicles.updateMileageIfNotDecreased(vehicleId, userId, 53000);
    expect(await readAlert()).toMatchObject({ evaluableCount: 1n, timelyCount: 0n });
    const created = await maintenances.createWithMileageUpdate(userId, vehicleId, {
      type: 'Correa',
      category: 'MANTENIMIENTO',
      date: new Date('2026-10-21T00:00:00.000Z'),
      mileage: 53000,
      workshop: null,
      cost: null,
      notes: null,
    });
    expect(await readAlert()).toMatchObject({ evaluableCount: 1n, timelyCount: 1n });
    await maintenances.delete(vehicleId, created.maintenance.id);
    await schedules.delete(vehicleId, schedule.id);
  });

  it('assigns a retroactive replacement to the cycle containing its service date', async () => {
    const schedule = await prisma.schedule.create({
      data: {
        vehicleId,
        type: 'Bujias',
        normalizedType: 'bujias',
        intervalKm: 10000,
        baselineDate: new Date('2026-01-01T00:00:00.000Z'),
        baselineMileage: 40000,
      },
    });
    scheduleIds.push(schedule.id);
    const firstDelivery = await prisma.maintenanceAlertDelivery.create({
      data: {
        scheduleId: schedule.id,
        installationId: randomUUID(),
        dueKey: 'none:50000',
        dueMileage: 50000,
      },
    });
    await alerts.markSent(firstDelivery.id, 'first-cycle-message', {
      scheduleId: schedule.id,
      vehicleId,
      normalizedType: 'bujias',
      dueKey: 'none:50000',
      dueDate: null,
      dueMileage: 50000,
      sentAt: new Date('2026-10-01T12:00:00.000Z'),
    });
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: { baselineMileage: 50000 },
    });
    const secondDelivery = await prisma.maintenanceAlertDelivery.create({
      data: {
        scheduleId: schedule.id,
        installationId: randomUUID(),
        dueKey: 'none:60000',
        dueMileage: 60000,
      },
    });
    await alerts.markSent(secondDelivery.id, 'second-cycle-message', {
      scheduleId: schedule.id,
      vehicleId,
      normalizedType: 'bujias',
      dueKey: 'none:60000',
      dueDate: null,
      dueMileage: 60000,
      sentAt: new Date('2026-10-10T12:00:00.000Z'),
    });

    const created = await maintenances.createWithMileageUpdate(userId, vehicleId, {
      type: 'Bujias',
      category: 'MANTENIMIENTO',
      date: new Date('2026-10-05T00:00:00.000Z'),
      mileage: 50000,
      workshop: null,
      cost: null,
      notes: null,
    });
    const cycles = await prisma.maintenanceAlertCycle.findMany({
      where: { scheduleId: schedule.id },
      orderBy: { firstSentAt: 'asc' },
    });

    expect(cycles).toHaveLength(2);
    expect(cycles[0]).toMatchObject({ resolvedMaintenanceId: created.maintenance.id });
    expect(cycles[1]).toMatchObject({ resolvedMaintenanceId: null });

    await maintenances.delete(vehicleId, created.maintenance.id);
    await schedules.delete(vehicleId, schedule.id);
  });

  it('counts exact date and combined limits while leaving late and open cycles untimely', async () => {
    const before = await readAlert();
    const cycleIds = Array.from({ length: 5 }, () => randomUUID());
    const resolution = (date: string, mileage: number) => ({
      resolvedMaintenanceId: randomUUID(),
      resolvedServiceDate: new Date(date),
      resolvedServiceMileage: mileage,
      resolvedAt: new Date('2026-10-21T12:00:00.000Z'),
    });
    await prisma.maintenanceAlertCycle.createMany({
      data: [
        {
          id: cycleIds[0],
          scheduleId: randomUUID(),
          dueKey: '2026-10-21:none',
          vehicleId,
          normalizedType: 'fecha-exacta',
          dueDate: new Date('2026-10-21T00:00:00.000Z'),
          firstSentAt: new Date('2026-10-01T12:00:00.000Z'),
          ruleVersion: '1',
          ...resolution('2026-10-21T00:00:00.000Z', 54000),
        },
        {
          id: cycleIds[1],
          scheduleId: randomUUID(),
          dueKey: '2026-10-21:55000',
          vehicleId,
          normalizedType: 'limite-combinado-exacto',
          dueDate: new Date('2026-10-21T00:00:00.000Z'),
          dueMileage: 55000,
          mileageReachedAt: new Date('2026-10-20T12:00:00.000Z'),
          firstSentAt: new Date('2026-10-01T12:00:00.000Z'),
          ruleVersion: '1',
          ...resolution('2026-10-21T00:00:00.000Z', 55000),
        },
        {
          id: cycleIds[2],
          scheduleId: randomUUID(),
          dueKey: '2026-10-21:55000',
          vehicleId,
          normalizedType: 'limite-combinado-tarde',
          dueDate: new Date('2026-10-21T00:00:00.000Z'),
          dueMileage: 55000,
          mileageReachedAt: new Date('2026-10-20T12:00:00.000Z'),
          firstSentAt: new Date('2026-10-01T12:00:00.000Z'),
          ruleVersion: '1',
          ...resolution('2026-10-21T00:00:00.000Z', 55001),
        },
        {
          id: cycleIds[3],
          scheduleId: randomUUID(),
          dueKey: '2026-10-20:none',
          vehicleId,
          normalizedType: 'fecha-tarde',
          dueDate: new Date('2026-10-20T00:00:00.000Z'),
          firstSentAt: new Date('2026-10-01T12:00:00.000Z'),
          ruleVersion: '1',
          ...resolution('2026-10-21T00:00:00.000Z', 54000),
        },
        {
          id: cycleIds[4],
          scheduleId: randomUUID(),
          dueKey: '2026-10-20:none',
          vehicleId,
          normalizedType: 'sin-resolver',
          dueDate: new Date('2026-10-20T00:00:00.000Z'),
          firstSentAt: new Date('2026-10-01T12:00:00.000Z'),
          ruleVersion: '1',
        },
      ],
    });

    const after = await readAlert();
    expect(after.evaluableCount - before.evaluableCount).toBe(5n);
    expect(after.timelyCount - before.timelyCount).toBe(2n);

    await prisma.maintenanceAlertCycle.updateMany({
      where: { id: { in: cycleIds } },
      data: { canceledAt: new Date() },
    });
  });

  it('does not count a resolution registered after the requested cutoff', async () => {
    const cutoffWindows = buildKpiWindows('2026-10-17');
    const cycle = await prisma.maintenanceAlertCycle.create({
      data: {
        scheduleId: randomUUID(),
        dueKey: '2026-10-17:none',
        vehicleId,
        normalizedType: 'registro-posterior',
        dueDate: new Date('2026-10-17T00:00:00.000Z'),
        firstSentAt: new Date('2026-10-01T12:00:00.000Z'),
        resolvedMaintenanceId: randomUUID(),
        resolvedServiceDate: new Date('2026-10-17T00:00:00.000Z'),
        resolvedServiceMileage: 54000,
        resolvedAt: new Date('2026-10-18T04:00:00.000Z'),
        ruleVersion: '1',
      },
    });

    expect(await readAlert(cutoffWindows)).toMatchObject({
      evaluableCount: 1n,
      timelyCount: 0n,
    });

    await prisma.maintenanceAlertCycle.update({
      where: { id: cycle.id },
      data: { canceledAt: new Date() },
    });
  });

  it('rejects services from another vehicle, type, or pre-send date', async () => {
    const before = await readAlert();
    const schedule = await prisma.schedule.create({
      data: {
        vehicleId,
        type: 'Direccion',
        normalizedType: 'direccion',
        intervalMonths: 1,
        baselineDate: new Date('2026-09-21T00:00:00.000Z'),
        baselineMileage: 54000,
      },
    });
    scheduleIds.push(schedule.id);
    const delivery = await prisma.maintenanceAlertDelivery.create({
      data: {
        scheduleId: schedule.id,
        installationId: randomUUID(),
        dueKey: '2026-10-21:none',
        dueDate: new Date('2026-10-21T00:00:00.000Z'),
      },
    });
    await alerts.markSent(delivery.id, 'isolation-message', {
      scheduleId: schedule.id,
      vehicleId,
      normalizedType: 'direccion',
      dueKey: '2026-10-21:none',
      dueDate: new Date('2026-10-21T00:00:00.000Z'),
      dueMileage: null,
      sentAt: new Date('2026-10-10T12:00:00.000Z'),
    });
    const otherVehicle = await prisma.vehicle.create({
      data: {
        ownerId: userId,
        brand: 'Ford',
        model: 'Ka',
        year: 2019,
        fuel: 'NAFTA',
        plate: `OV${randomUUID().slice(0, 5).toUpperCase()}`,
        mileage: 54000,
      },
    });
    await prisma.maintenance.create({
      data: {
        vehicleId: otherVehicle.id,
        type: 'Direccion',
        category: 'MANTENIMIENTO',
        date: new Date('2026-10-15T00:00:00.000Z'),
        mileage: 54000,
      },
    });
    const wrongType = await maintenances.createWithMileageUpdate(userId, vehicleId, {
      type: 'Suspension',
      category: 'MANTENIMIENTO',
      date: new Date('2026-10-15T00:00:00.000Z'),
      mileage: 54000,
      workshop: null,
      cost: null,
      notes: null,
    });
    const preSend = await maintenances.createWithMileageUpdate(userId, vehicleId, {
      type: 'Direccion',
      category: 'MANTENIMIENTO',
      date: new Date('2026-10-09T00:00:00.000Z'),
      mileage: 54000,
      workshop: null,
      cost: null,
      notes: null,
    });

    const after = await readAlert();
    expect(after.evaluableCount - before.evaluableCount).toBe(1n);
    expect(after.timelyCount - before.timelyCount).toBe(0n);
    expect(
      await prisma.maintenanceAlertCycle.findUnique({
        where: { scheduleId_dueKey: { scheduleId: schedule.id, dueKey: '2026-10-21:none' } },
      }),
    ).toMatchObject({ resolvedMaintenanceId: null, resolvedAt: null });

    await maintenances.delete(vehicleId, wrongType.maintenance.id);
    await maintenances.delete(vehicleId, preSend.maintenance.id);
    await schedules.delete(vehicleId, schedule.id);
    await prisma.vehicle.delete({ where: { id: otherVehicle.id } });
  });

  it('keeps FAILED deliveries cycle-free and rolls back a partial SENT transition', async () => {
    const schedule = await prisma.schedule.create({
      data: {
        vehicleId,
        type: 'Bateria',
        normalizedType: 'bateria',
        intervalMonths: 1,
        baselineDate: new Date('2026-09-21T00:00:00.000Z'),
        baselineMileage: 54000,
      },
    });
    scheduleIds.push(schedule.id);
    const deliveryData = {
      scheduleId: schedule.id,
      dueKey: '2026-10-21:none',
      dueDate: new Date('2026-10-21T00:00:00.000Z'),
    };
    const failed = await prisma.maintenanceAlertDelivery.create({
      data: { ...deliveryData, installationId: randomUUID() },
    });
    await alerts.markFailed(failed.id, 'messaging/server-unavailable');
    expect(await prisma.maintenanceAlertCycle.count({ where: { scheduleId: schedule.id } })).toBe(
      0,
    );
    expect(
      await prisma.maintenanceAlertDelivery.findUnique({ where: { id: failed.id } }),
    ).toMatchObject({
      status: 'FAILED',
      cycleId: null,
    });

    const rollback = await prisma.maintenanceAlertDelivery.create({
      data: { ...deliveryData, installationId: randomUUID() },
    });
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS "pit73_fail_delivery_update" ON "MaintenanceAlertDelivery"',
    );
    await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS "pit73_fail_delivery_update"()');
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "pit73_fail_delivery_update"() RETURNS trigger AS $$
      BEGIN
        IF NEW."fcmMessageId" = 'force-rollback' THEN
          RAISE EXCEPTION 'forced rollback';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "pit73_fail_delivery_update"
      BEFORE UPDATE ON "MaintenanceAlertDelivery"
      FOR EACH ROW EXECUTE FUNCTION "pit73_fail_delivery_update"()
    `);
    try {
      await expect(
        alerts.markSent(rollback.id, 'force-rollback', {
          ...deliveryData,
          vehicleId,
          normalizedType: 'bateria',
          dueMileage: null,
          sentAt: new Date('2026-10-20T12:00:00.000Z'),
        }),
      ).rejects.toThrow();
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER IF EXISTS "pit73_fail_delivery_update" ON "MaintenanceAlertDelivery"',
      );
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS "pit73_fail_delivery_update"()');
    }
    expect(await prisma.maintenanceAlertCycle.count({ where: { scheduleId: schedule.id } })).toBe(
      0,
    );
    expect(
      await prisma.maintenanceAlertDelivery.findUnique({ where: { id: rollback.id } }),
    ).toMatchObject({ status: 'PENDING', cycleId: null, fcmMessageId: null });

    await schedules.delete(vehicleId, schedule.id);
  });

  it('preserves legacy SENT deliveries and persists observable coverage diagnostics', async () => {
    const schedule = await prisma.schedule.create({
      data: {
        vehicleId,
        type: 'Filtros',
        normalizedType: 'filtros',
        intervalKm: 10000,
        baselineDate: new Date('2026-01-01T00:00:00.000Z'),
        baselineMileage: 42000,
      },
    });
    scheduleIds.push(schedule.id);
    await prisma.maintenanceAlertDelivery.create({
      data: {
        scheduleId: schedule.id,
        installationId: randomUUID(),
        dueKey: 'none:52000',
        dueMileage: 52000,
        status: 'SENT',
        finishedAt: new Date('2026-10-20T12:00:00.000Z'),
      },
    });
    await prisma.maintenanceAlertCycle.create({
      data: {
        scheduleId: schedule.id,
        dueKey: 'legacy-incomplete',
        vehicleId,
        normalizedType: 'filtros',
        firstSentAt: new Date('2026-10-20T12:00:00.000Z'),
        ruleVersion: '0',
      },
    });
    expect(await readAlert()).toMatchObject({
      missingDeliveryCount: 1n,
      incompleteCycleCount: 1n,
    });

    const snapshot = await new KpiService(kpis, {
      now: () => new Date('2026-10-22T12:00:00.000Z'),
    }).calculateDaily({ date: '2026-10-21', env: 'dev' });
    runIds.push(snapshot.runId);
    expect(snapshot.measurements).not.toContainEqual(
      expect.objectContaining({ kpi_id: 'alert_resolution_rate' }),
    );
    expect(snapshot.diagnostics[1]).toMatchObject({
      status: 'NO_DATA',
      diagnosticCode: 'ALERT_RESOLUTION_EVIDENCE_MISSING',
      numerator: '1',
      denominator: '1',
      sampleCount: '2',
    });
    expect(
      await prisma.kpiResult.findUnique({
        where: {
          runId_kpiId: { runId: snapshot.runId, kpiId: 'alert_resolution_rate' },
        },
      }),
    ).toMatchObject({ numerator: 1n, denominator: 1n, sampleCount: 2n });
  });
});
