import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { MAX_VEHICLE_MILEAGE } from '../../vehicles/dto/create-vehicle.dto';

// 20 years. Larger values push the due date outside JavaScript's Date range.
export const MAX_SCHEDULE_INTERVAL_MONTHS = 240;

export class CreateScheduleDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  type: string;

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
