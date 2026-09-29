import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { MAX_VEHICLE_MILEAGE } from '../../vehicles/dto/create-vehicle.dto';

export class CreateScheduleDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  type: string;

  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  @Max(MAX_VEHICLE_MILEAGE)
  intervalMonths?: number | null;

  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  @Max(MAX_VEHICLE_MILEAGE)
  intervalKm?: number | null;
}
