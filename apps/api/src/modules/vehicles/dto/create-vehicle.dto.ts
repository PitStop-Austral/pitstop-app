import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { FuelType, TransmissionType } from '../../../generated/prisma/client';
import { normalizeVehiclePlate } from '../vehicle-normalization';

export const PLATE_PATTERN = /^([A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/;
export const MAX_VEHICLE_MILEAGE = 2_147_483_647;
export const MAX_OIL_LITERS = 99.99;
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

export class CreateVehicleDto {
  @Transform(({ value }) => trim(value))
  @IsString()
  @IsNotEmpty()
  brand: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @IsNotEmpty()
  model: string;

  @IsInt()
  @Min(1900)
  @Max(MAX_VEHICLE_YEAR)
  year: number;

  @IsEnum(FuelType)
  fuel: FuelType;

  @Transform(({ value }) => normalizePlate(value))
  @IsString()
  @Matches(PLATE_PATTERN)
  plate: string;

  @IsInt()
  @Min(0)
  @Max(MAX_VEHICLE_MILEAGE)
  mileage: number;

  @Transform(({ value }) => normalizeNickname(value))
  @IsOptional()
  @IsString()
  nickname?: string | null;

  @Transform(({ value }) => trim(value))
  @IsOptional()
  @IsString()
  engineOilType?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_OIL_LITERS)
  engineOilLiters?: number | null;

  @Transform(({ value }) => trim(value))
  @IsOptional()
  @IsString()
  gearboxOilType?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_OIL_LITERS)
  gearboxOilLiters?: number | null;

  @IsOptional()
  @IsEnum(TransmissionType)
  transmission?: TransmissionType | null;

  @Transform(({ value }) => trim(value))
  @IsOptional()
  @IsString()
  frontTireSize?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_VEHICLE_MILEAGE)
  frontTirePressurePsi?: number | null;

  @Transform(({ value }) => trim(value))
  @IsOptional()
  @IsString()
  rearTireSize?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_VEHICLE_MILEAGE)
  rearTirePressurePsi?: number | null;

  @Transform(({ value }) => trim(value))
  @IsOptional()
  @IsString()
  highBeam?: string | null;

  @Transform(({ value }) => trim(value))
  @IsOptional()
  @IsString()
  lowBeam?: string | null;

  @Transform(({ value }) => trim(value))
  @IsOptional()
  @IsString()
  fogLight?: string | null;
}
