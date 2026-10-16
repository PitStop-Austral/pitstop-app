import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { DailyKpisQueryDto } from './daily-kpis-query.dto';

describe('DailyKpisQueryDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const metadata = { type: 'query' as const, metatype: DailyKpisQueryDto };

  it.each(['dev', 'prod'])('accepts a strict date and the %s environment', async (env) => {
    await expect(pipe.transform({ date: '2026-10-21', env }, metadata)).resolves.toMatchObject({
      date: '2026-10-21',
      env,
    });
  });

  it.each([
    ['missing date', { env: 'dev' }],
    ['missing environment', { date: '2026-10-21' }],
    ['alternative date format', { date: '21/10/2026', env: 'dev' }],
    ['impossible date', { date: '2026-02-30', env: 'dev' }],
    ['date with surrounding whitespace', { date: ' 2026-10-21 ', env: 'dev' }],
    ['unsupported environment', { date: '2026-10-21', env: 'staging' }],
    ['uppercase environment', { date: '2026-10-21', env: 'DEV' }],
    ['unknown query field', { date: '2026-10-21', env: 'dev', projectKey: 'secret' }],
  ])('rejects %s', async (_label, query) => {
    await expect(pipe.transform(query, metadata)).rejects.toThrow(BadRequestException);
  });
});
