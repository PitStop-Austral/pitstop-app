import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let register: jest.MockedFunction<NotificationsRepository['register']>;
  let remove: jest.MockedFunction<NotificationsRepository['remove']>;
  let markPromptShown: jest.MockedFunction<NotificationsRepository['markPromptShown']>;

  beforeEach(async () => {
    register = jest.fn();
    remove = jest.fn();
    markPromptShown = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: NotificationsRepository,
          useValue: { register, remove, markPromptShown },
        },
      ],
    }).compile();

    service = module.get(NotificationsService);
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

  it('removes only the authenticated user installation', async () => {
    await service.removeDevice('user-1', '11111111-1111-4111-8111-111111111111');

    expect(remove).toHaveBeenCalledWith('user-1', '11111111-1111-4111-8111-111111111111');
  });

  it('marks the notification prompt for the authenticated user', async () => {
    await service.markPromptShown('user-1');

    expect(markPromptShown).toHaveBeenCalledWith('user-1');
  });
});
