import { IsDateString, IsIn, IsString, Matches } from 'class-validator';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const DAILY_KPI_ENVIRONMENTS = ['dev', 'prod'] as const;
export type DailyKpiEnvironment = (typeof DAILY_KPI_ENVIRONMENTS)[number];

export class DailyKpisQueryDto {
  @IsString()
  @Matches(DATE_PATTERN)
  @IsDateString({ strict: true, strictSeparator: true })
  date: string;

  @IsString()
  @IsIn(DAILY_KPI_ENVIRONMENTS)
  env: DailyKpiEnvironment;
}
