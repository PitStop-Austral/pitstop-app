import { Controller, Get, UseGuards } from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { CronSecretGuard } from './cron-secret.guard';
import {
  MaintenanceAlertsService,
  type MaintenanceAlertRunResult,
} from './maintenance-alerts.service';
import {
  MileageRemindersService,
  type MileageReminderRunResult,
} from './mileage-reminders.service';

export type DailyAlertRunResult = MaintenanceAlertRunResult & {
  mileageReminders: MileageReminderRunResult;
};

@Public()
@UseGuards(CronSecretGuard)
@Controller('cron/maintenance-alerts')
export class MaintenanceAlertsController {
  constructor(
    private readonly maintenanceAlertsService: MaintenanceAlertsService,
    private readonly mileageRemindersService: MileageRemindersService,
  ) {}

  @Get()
  async run(): Promise<DailyAlertRunResult> {
    const maintenanceAlerts = await this.maintenanceAlertsService.runDailyReview();
    const mileageReminders = await this.mileageRemindersService.runDailyReview();
    return { ...maintenanceAlerts, mileageReminders };
  }
}
