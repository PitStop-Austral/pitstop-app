import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

function trim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateMeDto {
  @Transform(({ value }) => trim(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;
}
