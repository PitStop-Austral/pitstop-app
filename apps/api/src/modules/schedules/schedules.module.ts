import { Module } from '@nestjs/common';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { SchedulesController } from './schedules.controller';
import { SchedulesRepository } from './schedules.repository';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [VehiclesModule],
  controllers: [SchedulesController],
  providers: [SchedulesRepository, SchedulesService],
  exports: [SchedulesRepository, SchedulesService],
})
export class SchedulesModule {}
