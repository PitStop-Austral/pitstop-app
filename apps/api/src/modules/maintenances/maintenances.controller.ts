import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { User } from '../../generated/prisma/client';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import type { MaintenanceResponse } from './maintenances.mapper';
import { MaintenancesService } from './maintenances.service';

@Controller('vehicles/:vehicleId/maintenances')
export class MaintenancesController {
  constructor(private readonly maintenancesService: MaintenancesService) {}

  @Post()
  create(
    @CurrentUser() user: User,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Body() dto: CreateMaintenanceDto,
  ): Promise<MaintenanceResponse> {
    return this.maintenancesService.create(user.id, vehicleId, dto);
  }
}
