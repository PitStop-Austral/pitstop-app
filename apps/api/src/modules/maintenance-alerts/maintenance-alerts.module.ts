import { Module } from '@nestjs/common';
import { CronSecretGuard } from './cron-secret.guard';
import { MaintenanceAlertsController } from './maintenance-alerts.controller';
import { MaintenanceAlertsRepository } from './maintenance-alerts.repository';
import { MaintenanceAlertsService } from './maintenance-alerts.service';
import { MileageRemindersRepository } from './mileage-reminders.repository';
import { MileageRemindersService } from './mileage-reminders.service';

@Module({
  controllers: [MaintenanceAlertsController],
  providers: [
    CronSecretGuard,
    MaintenanceAlertsRepository,
    MaintenanceAlertsService,
    MileageRemindersRepository,
    MileageRemindersService,
  ],
})
export class MaintenanceAlertsModule {}
