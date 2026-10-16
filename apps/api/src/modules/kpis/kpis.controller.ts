import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { CronSecretGuard } from '../maintenance-alerts/cron-secret.guard';
import { DailyKpisQueryDto } from './dto/daily-kpis-query.dto';
import { KpiService, type DailyKpisResponse } from './kpi.service';

@Public()
@UseGuards(CronSecretGuard)
@Controller('internal/kpis')
export class KpisController {
  constructor(private readonly kpiService: KpiService) {}

  @Get('daily')
  @Header('Cache-Control', 'no-store')
  calculateDaily(@Query() query: DailyKpisQueryDto): Promise<DailyKpisResponse> {
    return this.kpiService.calculateDaily(query);
  }
}
