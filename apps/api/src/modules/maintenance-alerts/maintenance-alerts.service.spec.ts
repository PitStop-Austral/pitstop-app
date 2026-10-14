import { Test, TestingModule } from '@nestjs/testing';
import { FirebaseService } from '../../firebase/firebase.service';
import {
  MaintenanceAlertsRepository,
  type EligibleAlertSchedule,
  type MaintenanceAlertClaimCandidate,
} from './maintenance-alerts.repository';
import { MaintenanceAlertsService } from './maintenance-alerts.service';

const scheduleId = '11111111-1111-4111-8111-111111111111';
const vehicleId = '22222222-2222-4222-8222-222222222222';
const deviceId = '33333333-3333-4333-8333-333333333333';
const installationId = '44444444-4444-4444-8444-444444444444';
const ownerId = '88888888-8888-4888-8888-888888888888';

function eligibleSchedule(
  overrides: Partial<
    Pick<EligibleAlertSchedule, 'id' | 'baselineDate' | 'intervalMonths' | 'intervalKm'>
  > = {},
): EligibleAlertSchedule {
  return {
    id: scheduleId,
    type: 'Cambio de aceite',
    intervalMonths: 6,
    intervalKm: 10000,
    baselineDate: new Date('2026-04-20T00:00:00.000Z'),
    baselineMileage: 42000,
    vehicle: {
      id: vehicleId,
      brand: 'Honda',
      model: 'Civic',
      nickname: 'El Rojo',
      plate: 'AF812KM',
      mileage: 51000,
      owner: {
        id: ownerId,
        upcomingThresholdDays: 30,
        upcomingThresholdKm: 1500,
        notificationDevices: [{ id: deviceId, installationId, token: 'fcm-token' }],
      },
    },
    ...overrides,
  };
}

describe('MaintenanceAlertsService', () => {
  let service: MaintenanceAlertsService;
  let findEligibleSchedules: jest.MockedFunction<
    MaintenanceAlertsRepository['findEligibleSchedules']
  >;
  let claimDeliveries: jest.MockedFunction<MaintenanceAlertsRepository['claimDeliveries']>;
  let markSent: jest.MockedFunction<MaintenanceAlertsRepository['markSent']>;
  let markFailed: jest.MockedFunction<MaintenanceAlertsRepository['markFailed']>;
  let removeDeviceIfTokenMatches: jest.MockedFunction<
    MaintenanceAlertsRepository['removeDeviceIfTokenMatches']
  >;
  let withCurrentDeviceLock: jest.MockedFunction<
    MaintenanceAlertsRepository['withCurrentDeviceLock']
  >;
  let sendDataMessage: jest.MockedFunction<FirebaseService['sendDataMessage']>;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-13T15:00:00.000Z'));
    findEligibleSchedules = jest.fn().mockResolvedValue([]);
    let deliveryIndex = 0;
    claimDeliveries = jest.fn().mockImplementation(async (inputs) =>
      inputs.map(
        ({ ownerId: _ownerId, token: _token, ...input }: MaintenanceAlertClaimCandidate) => ({
          id: `delivery-${deliveryIndex++}`,
          ...input,
        }),
      ),
    );
    markSent = jest.fn();
    markFailed = jest.fn();
    removeDeviceIfTokenMatches = jest.fn();
    withCurrentDeviceLock = jest.fn().mockImplementation(async (_device, action) => action());
    sendDataMessage = jest.fn().mockResolvedValue('projects/test/messages/message-1');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceAlertsService,
        {
          provide: MaintenanceAlertsRepository,
          useValue: {
            findEligibleSchedules,
            claimDeliveries,
            markSent,
            markFailed,
            removeDeviceIfTokenMatches,
            withCurrentDeviceLock,
          },
        },
        { provide: FirebaseService, useValue: { sendDataMessage } },
      ],
    }).compile();

    service = module.get(MaintenanceAlertsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('selects upcoming schedules with user thresholds and sends a data-only alert', async () => {
    findEligibleSchedules.mockResolvedValue([
      eligibleSchedule(),
      eligibleSchedule({
        id: '55555555-5555-4555-8555-555555555555',
        baselineDate: new Date('2026-10-01T00:00:00.000Z'),
        intervalMonths: 12,
        intervalKm: null,
      }),
    ]);

    await expect(service.runDailyReview()).resolves.toEqual({
      selected: 1,
      claimed: 1,
      sent: 1,
      failed: 0,
    });
    expect(claimDeliveries).toHaveBeenCalledWith([
      expect.objectContaining({
        scheduleId,
        dueKey: '2026-10-20:52000',
        dueMileage: 52000,
      }),
    ]);
    expect(sendDataMessage).toHaveBeenCalledWith('fcm-token', {
      kind: 'maintenance-alert',
      notificationId: 'delivery-0',
      title: 'Mantenimiento próximo',
      body: 'El Rojo (AF812KM): Cambio de aceite',
      vehicleId,
      scheduleId,
      status: 'upcoming',
    });
    expect(markSent).toHaveBeenCalledWith('delivery-0', 'projects/test/messages/message-1');
  });

  it('does not send a delivery that was already claimed by another run', async () => {
    findEligibleSchedules.mockResolvedValue([eligibleSchedule()]);
    claimDeliveries.mockResolvedValue([]);

    await expect(service.runDailyReview()).resolves.toEqual({
      selected: 1,
      claimed: 0,
      sent: 0,
      failed: 0,
    });
    expect(sendDataMessage).not.toHaveBeenCalled();
  });

  it('does not send after the installation changes owner or token', async () => {
    findEligibleSchedules.mockResolvedValue([eligibleSchedule()]);
    withCurrentDeviceLock.mockResolvedValue(null);

    await expect(service.runDailyReview()).resolves.toEqual({
      selected: 1,
      claimed: 1,
      sent: 0,
      failed: 1,
    });
    expect(withCurrentDeviceLock).toHaveBeenCalledWith(
      { id: deviceId, ownerId, installationId, token: 'fcm-token' },
      expect.any(Function),
    );
    expect(sendDataMessage).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalledWith('delivery-0', 'device-changed');
  });

  it('continues after a Firebase failure and records each result', async () => {
    const secondInstallation = '66666666-6666-4666-8666-666666666666';
    findEligibleSchedules.mockResolvedValue([
      {
        ...eligibleSchedule(),
        vehicle: {
          ...eligibleSchedule().vehicle,
          owner: {
            ...eligibleSchedule().vehicle.owner,
            notificationDevices: [
              { id: deviceId, installationId, token: 'stale-token' },
              {
                id: '77777777-7777-4777-8777-777777777777',
                installationId: secondInstallation,
                token: 'working-token',
              },
            ],
          },
        },
      },
    ]);
    sendDataMessage
      .mockRejectedValueOnce({ code: 'messaging/invalid-registration-token' })
      .mockResolvedValueOnce('projects/test/messages/message-2');

    await expect(service.runDailyReview()).resolves.toEqual({
      selected: 2,
      claimed: 2,
      sent: 1,
      failed: 1,
    });
    expect(markFailed).toHaveBeenCalledWith('delivery-0', 'messaging/invalid-registration-token');
    expect(removeDeviceIfTokenMatches).toHaveBeenCalledWith(deviceId, 'stale-token');
    expect(markSent).toHaveBeenCalledWith('delivery-1', 'projects/test/messages/message-2');
  });

  it('delivers alerts for the same installation sequentially', async () => {
    findEligibleSchedules.mockResolvedValue([
      eligibleSchedule(),
      eligibleSchedule({
        id: '55555555-5555-4555-8555-555555555555',
        baselineDate: new Date('2026-04-21T00:00:00.000Z'),
      }),
    ]);
    let activeDeliveries = 0;
    let maximumActiveDeliveries = 0;
    sendDataMessage.mockImplementation(async () => {
      activeDeliveries += 1;
      maximumActiveDeliveries = Math.max(maximumActiveDeliveries, activeDeliveries);
      await Promise.resolve();
      activeDeliveries -= 1;
      return `projects/test/messages/message-${sendDataMessage.mock.calls.length}`;
    });

    await expect(service.runDailyReview()).resolves.toEqual({
      selected: 2,
      claimed: 2,
      sent: 2,
      failed: 0,
    });
    expect(maximumActiveDeliveries).toBe(1);
    expect(withCurrentDeviceLock).toHaveBeenCalledTimes(2);
  });

  it('surfaces persistence failures after every claimed delivery settles', async () => {
    findEligibleSchedules.mockResolvedValue([eligibleSchedule()]);
    markSent.mockRejectedValue(new Error('database unavailable'));

    await expect(service.runDailyReview()).rejects.toThrow('database unavailable');
    expect(sendDataMessage).toHaveBeenCalledTimes(1);
    expect(markFailed).not.toHaveBeenCalled();
  });

  it('leaves later deliveries claimable when a run is interrupted', async () => {
    const secondScheduleId = '55555555-5555-4555-8555-555555555555';
    findEligibleSchedules.mockResolvedValue([
      eligibleSchedule(),
      eligibleSchedule({
        id: secondScheduleId,
        baselineDate: new Date('2026-04-21T00:00:00.000Z'),
      }),
    ]);
    claimDeliveries
      .mockImplementationOnce(async ([input]) => [
        { id: 'first-delivery', ...input, notificationDeviceId: input.notificationDeviceId },
      ])
      .mockRejectedValueOnce(new Error('database unavailable'));

    await expect(service.runDailyReview()).rejects.toThrow('database unavailable');
    expect(sendDataMessage).toHaveBeenCalledTimes(1);

    claimDeliveries
      .mockResolvedValueOnce([])
      .mockImplementationOnce(async ([input]) => [
        { id: 'second-delivery', ...input, notificationDeviceId: input.notificationDeviceId },
      ]);

    await expect(service.runDailyReview()).resolves.toEqual({
      selected: 2,
      claimed: 1,
      sent: 1,
      failed: 0,
    });
    expect(sendDataMessage).toHaveBeenCalledTimes(2);
    expect(sendDataMessage.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ notificationId: 'second-delivery', scheduleId: secondScheduleId }),
    );
  });
});
