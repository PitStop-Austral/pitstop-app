import { randomUUID } from 'node:crypto';
import {
  BadGatewayException,
  ConflictException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  FirebaseService,
  getFirebaseMessagingErrorCode,
  isStaleFirebaseMessagingTokenError,
} from '../../firebase/firebase.service';
import { RegisterNotificationDeviceDto } from './dto/register-notification-device.dto';
import {
  NotificationsRepository,
  type RegisteredNotificationDevice,
} from './notifications.repository';

export type TestNotificationResult = {
  messageId: string;
  testId: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly firebaseService: FirebaseService,
  ) {}

  registerDevice(
    userId: string,
    dto: RegisterNotificationDeviceDto,
  ): Promise<RegisteredNotificationDevice> {
    return this.notificationsRepository.register(userId, dto.installationId, dto.token);
  }

  removeDevice(userId: string, installationId: string): Promise<void> {
    return this.notificationsRepository.remove(userId, installationId);
  }

  async sendTestNotification(
    userId: string,
    installationId: string,
  ): Promise<TestNotificationResult> {
    if (process.env.NOTIFICATION_TEST_ENABLED !== 'true') {
      throw new NotFoundException('Prueba de notificaciones no disponible');
    }

    const device = await this.notificationsRepository.findOwnedForDelivery(userId, installationId);
    if (!device) {
      throw new NotFoundException('Prueba de notificaciones no disponible');
    }
    if (!device.user.notificationsEnabled) {
      throw new ConflictException('Las notificaciones no están activadas');
    }

    const testId = randomUUID();

    try {
      const messageId = await this.firebaseService.sendMessage({
        token: device.token,
        data: {
          kind: 'test',
          notificationId: testId,
          title: 'Notificación de prueba',
          body: 'Las notificaciones de PitStop están activadas.',
        },
      });
      return { messageId, testId };
    } catch (error) {
      const errorCode = getFirebaseMessagingErrorCode(error);
      if (isStaleFirebaseMessagingTokenError(error)) {
        await this.notificationsRepository.removeIfTokenMatches(device.id, device.token);
        throw new GoneException(
          'El dispositivo ya no puede recibir notificaciones. Activá las notificaciones nuevamente.',
        );
      }

      this.logger.error(`Firebase notification test failed with code: ${errorCode ?? 'unknown'}`);
      throw new BadGatewayException('No pudimos enviar la notificación de prueba');
    }
  }

  markPromptShown(userId: string): Promise<void> {
    return this.notificationsRepository.markPromptShown(userId);
  }
}
