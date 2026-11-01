import { IsInt, Max, Min } from 'class-validator';

export class UpdatePreferencesDto {
  @IsInt({ message: 'Ingresá una cantidad de días entera, entre 0 y 3650' })
  @Min(0, { message: 'Ingresá una cantidad de días entera, entre 0 y 3650' })
  @Max(3650, { message: 'Ingresá una cantidad de días entera, entre 0 y 3650' })
  upcomingThresholdDays: number;

  @IsInt({ message: 'Ingresá una cantidad de kilómetros entera, entre 0 y 500.000' })
  @Min(0, { message: 'Ingresá una cantidad de kilómetros entera, entre 0 y 500.000' })
  @Max(500000, { message: 'Ingresá una cantidad de kilómetros entera, entre 0 y 500.000' })
  upcomingThresholdKm: number;
}
