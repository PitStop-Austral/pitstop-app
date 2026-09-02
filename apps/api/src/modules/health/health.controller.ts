import { Controller, Get } from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import type { DatabaseHealth } from './health.service';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  checkLiveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Public()
  @Get('db')
  checkDatabase(): Promise<DatabaseHealth> {
    return this.healthService.checkDatabase();
  }
}
