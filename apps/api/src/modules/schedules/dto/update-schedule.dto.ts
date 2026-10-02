import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { MAX_VEHICLE_MILEAGE } from '../../vehicles/dto/create-vehicle.dto';
import { MAX_SCHEDULE_INTERVAL_MONTHS } from './create-schedule.dto';

export class UpdateScheduleDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  type?: string;

  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  @Max(MAX_SCHEDULE_INTERVAL_MONTHS, {
    message: `Ingresá hasta ${MAX_SCHEDULE_INTERVAL_MONTHS} meses`,
  })
  intervalMonths?: number | null;

  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  @Max(MAX_VEHICLE_MILEAGE)
  intervalKm?: number | null;
}
