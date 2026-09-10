import { IsUUID } from 'class-validator';

export class SetActiveVehicleDto {
  @IsUUID()
  vehicleId: string;
}
