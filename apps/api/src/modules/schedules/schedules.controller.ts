import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { User } from '../../generated/prisma/client';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import type { ScheduleResponse } from './schedules.mapper';
import { SchedulesService } from './schedules.service';

@Controller('vehicles/:vehicleId/schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  findAll(
    @CurrentUser() user: User,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
  ): Promise<ScheduleResponse[]> {
    return this.schedulesService.findByVehicle(user, vehicleId);
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Body() dto: CreateScheduleDto,
  ): Promise<ScheduleResponse> {
    return this.schedulesService.create(user, vehicleId, dto);
  }
}
