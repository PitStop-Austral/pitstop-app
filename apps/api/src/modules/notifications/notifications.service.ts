import { Injectable } from '@nestjs/common';
import { RegisterNotificationDeviceDto } from './dto/register-notification-device.dto';
import {
  NotificationsRepository,
  type RegisteredNotificationDevice,
} from './notifications.repository';

@Injectable()
export class NotificationsService {
  constructor(private readonly notificationsRepository: NotificationsRepository) {}

  registerDevice(
    userId: string,
    dto: RegisterNotificationDeviceDto,
  ): Promise<RegisteredNotificationDevice> {
    return this.notificationsRepository.register(userId, dto.installationId, dto.token);
  }

  removeDevice(userId: string, installationId: string): Promise<void> {
    return this.notificationsRepository.remove(userId, installationId);
  }

  markPromptShown(userId: string): Promise<void> {
    return this.notificationsRepository.markPromptShown(userId);
  }
}
