import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { MaintenanceCategory } from '../../../generated/prisma/client';
import { MAX_VEHICLE_MILEAGE } from '../../vehicles/dto/create-vehicle.dto';
import {
  DATE_PATTERN,
  MAX_MAINTENANCE_COST,
  normalizeOptionalText,
  trim,
} from './create-maintenance.dto';

// Hand-written instead of PartialType: @IsOptional would also accept null for the required
// columns and surface as a database error instead of a 400.
export class UpdateMaintenanceDto {
  @Transform(({ value }) => trim(value))
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  type?: string;

  @Transform(({ value }) => trim(value))
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(MaintenanceCategory)
  category?: MaintenanceCategory;

  @Transform(({ value }) => trim(value))
  @ValidateIf((_object, value) => value !== undefined)
  @Matches(DATE_PATTERN)
  @IsDateString({ strict: true, strictSeparator: true })
  date?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(MAX_VEHICLE_MILEAGE)
  mileage?: number;

  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(80)
  workshop?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MAINTENANCE_COST)
  cost?: number | null;

  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
