import { Module } from '@nestjs/common';
import { CronSecretGuard } from '../maintenance-alerts/cron-secret.guard';
import { KpiService, KPI_CLOCK, systemKpiClock } from './kpi.service';
import { KpisController } from './kpis.controller';
import { KpisRepository } from './kpis.repository';

@Module({
  controllers: [KpisController],
  providers: [
    CronSecretGuard,
    KpiService,
    KpisRepository,
    { provide: KPI_CLOCK, useValue: systemKpiClock },
  ],
  exports: [KpisRepository],
})
export class KpisModule {}
