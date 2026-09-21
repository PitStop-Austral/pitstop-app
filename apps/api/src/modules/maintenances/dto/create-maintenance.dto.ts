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
} from 'class-validator';
import { MaintenanceCategory } from '../../../generated/prisma/client';
import { MAX_VEHICLE_MILEAGE } from '../../vehicles/dto/create-vehicle.dto';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_MAINTENANCE_COST = 9_999_999_999.99;

function trim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeOptionalText(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value.trim() || null;
}

export class CreateMaintenanceDto {
  @Transform(({ value }) => trim(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  type: string;

  @Transform(({ value }) => trim(value))
  @IsEnum(MaintenanceCategory)
  category: MaintenanceCategory;

  @Transform(({ value }) => trim(value))
  @Matches(DATE_PATTERN)
  @IsDateString({ strict: true, strictSeparator: true })
  date: string;

  @IsInt()
  @Min(0)
  @Max(MAX_VEHICLE_MILEAGE)
  mileage: number;

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
