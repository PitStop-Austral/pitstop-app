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
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
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

  @Get(':scheduleId')
  findOne(
    @CurrentUser() user: User,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
  ): Promise<ScheduleResponse> {
    return this.schedulesService.findOne(user, vehicleId, scheduleId);
  }

  @Patch(':scheduleId')
  update(
    @CurrentUser() user: User,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: UpdateScheduleDto,
  ): Promise<ScheduleResponse> {
    return this.schedulesService.update(user, vehicleId, scheduleId, dto);
  }

  @Delete(':scheduleId')
  @HttpCode(204)
  remove(
    @CurrentUser() user: User,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
  ): Promise<void> {
    return this.schedulesService.remove(user, vehicleId, scheduleId);
  }
}
