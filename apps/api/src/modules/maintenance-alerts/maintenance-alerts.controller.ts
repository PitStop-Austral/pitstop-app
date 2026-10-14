import { Controller, Get, UseGuards } from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { CronSecretGuard } from './cron-secret.guard';
import {
  MaintenanceAlertsService,
  type MaintenanceAlertRunResult,
} from './maintenance-alerts.service';

@Public()
@UseGuards(CronSecretGuard)
@Controller('cron/maintenance-alerts')
export class MaintenanceAlertsController {
  constructor(private readonly maintenanceAlertsService: MaintenanceAlertsService) {}

  @Get()
  run(): Promise<MaintenanceAlertRunResult> {
    return this.maintenanceAlertsService.runDailyReview();
  }
}
