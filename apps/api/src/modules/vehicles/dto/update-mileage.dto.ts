import { IsInt, Max, Min } from 'class-validator';
import { MAX_VEHICLE_MILEAGE } from './create-vehicle.dto';

export class UpdateMileageDto {
  @IsInt()
  @Min(0)
  @Max(MAX_VEHICLE_MILEAGE)
  mileage: number;
}
