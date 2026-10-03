import { Module } from '@nestjs/common';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { MaintenancesController } from './maintenances.controller';
import { MaintenancesRepository } from './maintenances.repository';
import { MaintenancesService } from './maintenances.service';

@Module({
  imports: [VehiclesModule, SchedulesModule],
  controllers: [MaintenancesController],
  providers: [MaintenancesRepository, MaintenancesService],
})
export class MaintenancesModule {}
