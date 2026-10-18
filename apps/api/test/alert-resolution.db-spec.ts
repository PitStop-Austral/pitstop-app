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

  async function readAlert() {
    const sources = await kpis.readDailySources(windows);
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
      evidenceMissing: false,
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
      evidenceMissing: false,
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
    await schedules.delete(vehicleId, schedule.id);
    await maintenances.delete(vehicleId, created.maintenance.id);
    expect(
      await prisma.maintenanceAlertCycle.findUnique({ where: { id: cycles[0].id } }),
    ).toMatchObject({
      canceledAt: expect.any(Date),
      resolvedMaintenanceId: null,
      resolvedAt: null,
    });
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
    expect(await readAlert()).toMatchObject({ evaluableCount: 0n, evidenceMissing: false });
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

  it('reports missing historical evidence rather than a partial percentage', async () => {
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
    expect(await readAlert()).toMatchObject({ evidenceMissing: true });
  });
});
