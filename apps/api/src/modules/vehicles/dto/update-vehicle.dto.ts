import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { FuelType } from '../../../generated/prisma/client';
import { MAX_VEHICLE_MILEAGE, PLATE_PATTERN } from './create-vehicle.dto';
import { normalizeVehiclePlate } from '../vehicle-normalization';

const MAX_VEHICLE_YEAR = new Date().getFullYear() + 1;

function trim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizePlate(value: unknown): unknown {
  return typeof value === 'string' ? normalizeVehiclePlate(value) : value;
}

function normalizeNickname(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const nickname = value.trim();
  return nickname.length > 0 ? nickname : null;
}

export class UpdateVehicleDto {
  @Transform(({ value }) => trim(value))
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  brand?: string;

  @Transform(({ value }) => trim(value))
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  model?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1900)
  @Max(MAX_VEHICLE_YEAR)
  year?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(FuelType)
  fuel?: FuelType;

  @Transform(({ value }) => normalizePlate(value))
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(PLATE_PATTERN)
  plate?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(MAX_VEHICLE_MILEAGE)
  mileage?: number;

  @Transform(({ value }) => normalizeNickname(value))
  @IsOptional()
  @IsString()
  nickname?: string | null;
}
