import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { User } from '../../generated/prisma/client';
import { RegisterNotificationDeviceDto } from './dto/register-notification-device.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import type {
  NotificationPreferences,
  RegisteredNotificationDevice,
} from './notifications.repository';
import { NotificationsService, type TestNotificationResult } from './notifications.service';

@Controller('me')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('notification-devices')
  @HttpCode(200)
  registerDevice(
    @CurrentUser() user: User,
    @Body() dto: RegisterNotificationDeviceDto,
  ): Promise<RegisteredNotificationDevice> {
    return this.notificationsService.registerDevice(user.id, dto);
  }

  @Patch('notification-preferences')
  @HttpCode(200)
  updatePreferences(
    @CurrentUser() user: User,
    @Body() dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    return this.notificationsService.updatePreferences(user.id, dto.enabled);
  }

  @Post('notification-devices/:installationId/test')
  @HttpCode(200)
  sendTestNotification(
    @CurrentUser() user: User,
    @Param('installationId', ParseUUIDPipe) installationId: string,
  ): Promise<TestNotificationResult> {
    return this.notificationsService.sendTestNotification(user.id, installationId);
  }

  @Delete('notification-devices/:installationId')
  @HttpCode(204)
  removeDevice(
    @CurrentUser() user: User,
    @Param('installationId', ParseUUIDPipe) installationId: string,
  ): Promise<void> {
    return this.notificationsService.removeDevice(user.id, installationId);
  }

  @Patch('notification-prompt')
  @HttpCode(204)
  markPromptShown(@CurrentUser() user: User): Promise<void> {
    return this.notificationsService.markPromptShown(user.id);
  }
}
