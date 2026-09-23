import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { User } from '../../generated/prisma/client';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import type { MaintenanceResponse } from './maintenances.mapper';
import { MaintenancesService } from './maintenances.service';

@Controller('vehicles/:vehicleId/maintenances')
export class MaintenancesController {
  constructor(private readonly maintenancesService: MaintenancesService) {}

  @Get()
  findAll(
    @CurrentUser() user: User,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
  ): Promise<MaintenanceResponse[]> {
    return this.maintenancesService.findByVehicle(user.id, vehicleId);
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Body() dto: CreateMaintenanceDto,
  ): Promise<MaintenanceResponse> {
    return this.maintenancesService.create(user.id, vehicleId, dto);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: User,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MaintenanceResponse> {
    return this.maintenancesService.findOne(user.id, vehicleId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMaintenanceDto,
  ): Promise<MaintenanceResponse> {
    return this.maintenancesService.update(user.id, vehicleId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: User,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.maintenancesService.remove(user.id, vehicleId, id);
  }
}
