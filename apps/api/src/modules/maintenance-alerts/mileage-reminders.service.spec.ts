import { Test, TestingModule } from '@nestjs/testing';
import { FirebaseService } from '../../firebase/firebase.service';
import {
  MileageRemindersRepository,
  type EligibleMileageReminderVehicle,
} from './mileage-reminders.repository';
import { MileageRemindersService } from './mileage-reminders.service';

const vehicleId = '11111111-1111-4111-8111-111111111111';
const ownerId = '22222222-2222-4222-8222-222222222222';
const deviceId = '33333333-3333-4333-8333-333333333333';
const installationId = '44444444-4444-4444-8444-444444444444';

function eligibleVehicle(): EligibleMileageReminderVehicle {
  return {
    id: vehicleId,
    brand: 'Honda',
    model: 'Civic',
    nickname: 'El Rojo',
    plate: 'AF812KM',
    mileageUpdatedAt: new Date('2026-10-01T15:00:00.000Z'),
    owner: {
      id: ownerId,
      notificationDevices: [{ id: deviceId, installationId, token: 'current-token' }],
    },
  };
}

describe('MileageRemindersService', () => {
  let service: MileageRemindersService;
  let findEligibleVehicles: jest.MockedFunction<MileageRemindersRepository['findEligibleVehicles']>;
  let claimDelivery: jest.MockedFunction<MileageRemindersRepository['claimDelivery']>;
  let withCurrentContextLock: jest.MockedFunction<
    MileageRemindersRepository['withCurrentContextLock']
  >;
  let markSent: jest.MockedFunction<MileageRemindersRepository['markSent']>;
  let markFailed: jest.MockedFunction<MileageRemindersRepository['markFailed']>;
  let removeDeviceIfTokenMatches: jest.MockedFunction<
    MileageRemindersRepository['removeDeviceIfTokenMatches']
  >;
  let sendDataMessage: jest.MockedFunction<FirebaseService['sendDataMessage']>;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-31T15:00:00.000Z'));
    findEligibleVehicles = jest.fn().mockResolvedValue([eligibleVehicle()]);
    claimDelivery = jest.fn().mockImplementation(async (candidate) => ({
      id: 'delivery-id',
      vehicleId: candidate.vehicleId,
      installationId: candidate.installationId,
      notificationDeviceId: candidate.notificationDeviceId,
      periodKey: candidate.periodKey,
    }));
    withCurrentContextLock = jest.fn().mockImplementation(async (_candidate, action) => action());
    markSent = jest.fn();
    markFailed = jest.fn();
    removeDeviceIfTokenMatches = jest.fn();
    sendDataMessage = jest.fn().mockResolvedValue('projects/test/messages/message-id');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MileageRemindersService,
        {
          provide: MileageRemindersRepository,
          useValue: {
            findEligibleVehicles,
            claimDelivery,
            withCurrentContextLock,
            markSent,
            markFailed,
            removeDeviceIfTokenMatches,
          },
        },
        { provide: FirebaseService, useValue: { sendDataMessage } },
      ],
    }).compile();

    service = module.get(MileageRemindersService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends one data message for an eligible vehicle and device', async () => {
    await expect(service.runDailyReview()).resolves.toEqual({
      sent: 1,
      failed: 0,
      skipped: 0,
    });
    expect(findEligibleVehicles).toHaveBeenCalledWith(new Date('2026-10-01T15:00:00.000Z'));
    expect(claimDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicleId,
        ownerId,
        installationId,
        periodKey: '2026-10-01T15:00:00.000Z#1',
      }),
    );
    expect(sendDataMessage).toHaveBeenCalledWith('current-token', {
      kind: 'mileage-reminder',
      notificationId: 'delivery-id',
      title: 'Actualizá el kilometraje',
      body: 'El Rojo (AF812KM): pasaron 30 días desde la última actualización.',
      vehicleId,
    });
    expect(markSent).toHaveBeenCalledWith('delivery-id', 'projects/test/messages/message-id');
  });

  it('skips a delivery already claimed by another run', async () => {
    claimDelivery.mockResolvedValue(null);

    await expect(service.runDailyReview()).resolves.toEqual({
      sent: 0,
      failed: 0,
      skipped: 1,
    });
    expect(sendDataMessage).not.toHaveBeenCalled();
  });

  it('does not send when the vehicle or device changed after the claim', async () => {
    withCurrentContextLock.mockResolvedValue(null);

    await expect(service.runDailyReview()).resolves.toEqual({
      sent: 0,
      failed: 1,
      skipped: 0,
    });
    expect(sendDataMessage).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalledWith('delivery-id', 'context-changed');
  });

  it('removes a stale token and continues with another device', async () => {
    const secondDeviceId = '55555555-5555-4555-8555-555555555555';
    const secondInstallationId = '66666666-6666-4666-8666-666666666666';
    findEligibleVehicles.mockResolvedValue([
      {
        ...eligibleVehicle(),
        owner: {
          ...eligibleVehicle().owner,
          notificationDevices: [
            { id: deviceId, installationId, token: 'stale-token' },
            {
              id: secondDeviceId,
              installationId: secondInstallationId,
              token: 'working-token',
            },
          ],
        },
      },
    ]);
    claimDelivery.mockImplementation(async (candidate) => ({
      id: `delivery-${candidate.notificationDeviceId}`,
      vehicleId: candidate.vehicleId,
      installationId: candidate.installationId,
      notificationDeviceId: candidate.notificationDeviceId,
      periodKey: candidate.periodKey,
    }));
    sendDataMessage
      .mockRejectedValueOnce({ code: 'messaging/invalid-registration-token' })
      .mockResolvedValueOnce('projects/test/messages/working');

    await expect(service.runDailyReview()).resolves.toEqual({
      sent: 1,
      failed: 1,
      skipped: 0,
    });
    expect(markFailed).toHaveBeenCalledWith(
      `delivery-${deviceId}`,
      'messaging/invalid-registration-token',
    );
    expect(removeDeviceIfTokenMatches).toHaveBeenCalledWith(deviceId, 'stale-token');
    expect(markSent).toHaveBeenCalledWith(
      `delivery-${secondDeviceId}`,
      'projects/test/messages/working',
    );
  });

  it('does nothing when the repository finds no eligible vehicles', async () => {
    findEligibleVehicles.mockResolvedValue([]);

    await expect(service.runDailyReview()).resolves.toEqual({
      sent: 0,
      failed: 0,
      skipped: 0,
    });
    expect(claimDelivery).not.toHaveBeenCalled();
  });
});
