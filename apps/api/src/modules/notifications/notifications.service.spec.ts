import {
  BadGatewayException,
  ConflictException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FirebaseService } from '../../firebase/firebase.service';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let register: jest.MockedFunction<NotificationsRepository['register']>;
  let updatePreferences: jest.MockedFunction<NotificationsRepository['updatePreferences']>;
  let remove: jest.MockedFunction<NotificationsRepository['remove']>;
  let markPromptShown: jest.MockedFunction<NotificationsRepository['markPromptShown']>;
  let findOwnedForDelivery: jest.MockedFunction<NotificationsRepository['findOwnedForDelivery']>;
  let removeIfTokenMatches: jest.MockedFunction<NotificationsRepository['removeIfTokenMatches']>;
  let sendMessage: jest.MockedFunction<FirebaseService['sendMessage']>;

  const userId = '11111111-1111-4111-8111-111111111111';
  const installationId = '22222222-2222-4222-8222-222222222222';
  const deliveryDevice = {
    id: '33333333-3333-4333-8333-333333333333',
    token: 'fcm-token',
    user: { notificationsEnabled: true },
  };

  beforeEach(async () => {
    register = jest.fn();
    updatePreferences = jest.fn();
    remove = jest.fn();
    markPromptShown = jest.fn();
    findOwnedForDelivery = jest.fn().mockResolvedValue(deliveryDevice);
    removeIfTokenMatches = jest.fn();
    sendMessage = jest.fn();
    process.env.NOTIFICATION_TEST_ENABLED = 'true';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: NotificationsRepository,
          useValue: {
            register,
            updatePreferences,
            remove,
            markPromptShown,
            findOwnedForDelivery,
            removeIfTokenMatches,
          },
        },
        {
          provide: FirebaseService,
          useValue: { sendMessage },
        },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  afterEach(() => {
    delete process.env.NOTIFICATION_TEST_ENABLED;
  });

  it('registers a device for the authenticated user and exposes no token', async () => {
    register.mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      installationId: '11111111-1111-4111-8111-111111111111',
    });

    await expect(
      service.registerDevice('user-1', {
        installationId: '11111111-1111-4111-8111-111111111111',
        token: 'fcm-token',
      }),
    ).resolves.toEqual({
      id: '22222222-2222-4222-8222-222222222222',
      installationId: '11111111-1111-4111-8111-111111111111',
    });
    expect(register).toHaveBeenCalledWith(
      'user-1',
      '11111111-1111-4111-8111-111111111111',
      'fcm-token',
    );
  });

  it.each([true, false])('updates notification preferences to %s', async (enabled) => {
    updatePreferences.mockResolvedValue({ notificationsEnabled: enabled });

    await expect(service.updatePreferences(userId, enabled)).resolves.toEqual({
      notificationsEnabled: enabled,
    });
    expect(updatePreferences).toHaveBeenCalledWith(userId, enabled);
  });

  it('rejects enabling notifications when the user has no registered device', async () => {
    updatePreferences.mockResolvedValue(null);

    await expect(service.updatePreferences(userId, true)).rejects.toThrow(
      'Activá las notificaciones en este dispositivo',
    );
  });

  it('removes only the authenticated user installation', async () => {
    await service.removeDevice('user-1', '11111111-1111-4111-8111-111111111111');

    expect(remove).toHaveBeenCalledWith('user-1', '11111111-1111-4111-8111-111111111111');
  });

  it('marks the notification prompt for the authenticated user', async () => {
    await service.markPromptShown('user-1');

    expect(markPromptShown).toHaveBeenCalledWith('user-1');
  });

  it('hides the test endpoint when the feature flag is disabled', async () => {
    process.env.NOTIFICATION_TEST_ENABLED = 'false';

    await expect(service.sendTestNotification(userId, installationId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findOwnedForDelivery).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('hides missing or foreign installations', async () => {
    findOwnedForDelivery.mockResolvedValue(null);

    await expect(service.sendTestNotification(userId, installationId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('rejects delivery when the user preference is disabled', async () => {
    findOwnedForDelivery.mockResolvedValue({
      ...deliveryDevice,
      user: { notificationsEnabled: false },
    });

    await expect(service.sendTestNotification(userId, installationId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('sends a fixed data-only payload and correlates the response with its test id', async () => {
    sendMessage.mockResolvedValue('projects/test/messages/message-1');

    const result = await service.sendTestNotification(userId, installationId);

    expect(result).toEqual({
      messageId: 'projects/test/messages/message-1',
      testId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      ),
    });
    expect(findOwnedForDelivery).toHaveBeenCalledWith(userId, installationId);
    expect(sendMessage).toHaveBeenCalledWith({
      token: deliveryDevice.token,
      data: {
        kind: 'test',
        notificationId: result.testId,
        title: 'Notificación de prueba',
        body: 'Las notificaciones de PitStop están activadas.',
      },
    });
    expect(sendMessage.mock.calls[0]?.[0]).not.toHaveProperty('notification');
  });

  it.each(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'])(
    'cleans a stale token and returns gone for %s',
    async (code) => {
      sendMessage.mockRejectedValue({ code });

      await expect(service.sendTestNotification(userId, installationId)).rejects.toBeInstanceOf(
        GoneException,
      );
      expect(removeIfTokenMatches).toHaveBeenCalledWith(deliveryDevice.id, deliveryDevice.token);
    },
  );

  it('uses the token from the failed send as the cleanup precondition', async () => {
    sendMessage.mockRejectedValue({ code: 'messaging/invalid-registration-token' });

    await expect(service.sendTestNotification(userId, installationId)).rejects.toBeInstanceOf(
      GoneException,
    );
    expect(removeIfTokenMatches).toHaveBeenCalledWith(deliveryDevice.id, 'fcm-token');
  });

  it('maps transient Firebase failures to bad gateway without deleting the device', async () => {
    sendMessage.mockRejectedValue({ code: 'messaging/server-unavailable' });

    await expect(service.sendTestNotification(userId, installationId)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(removeIfTokenMatches).not.toHaveBeenCalled();
  });
});
