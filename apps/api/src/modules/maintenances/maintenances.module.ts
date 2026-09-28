import { Module } from '@nestjs/common';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { MaintenancesController } from './maintenances.controller';
import { MaintenancesRepository } from './maintenances.repository';
import { MaintenancesService } from './maintenances.service';

@Module({
  imports: [VehiclesModule],
  controllers: [MaintenancesController],
  providers: [MaintenancesRepository, MaintenancesService],
})
export class MaintenancesModule {}
