import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthRepository } from './health.repository';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let healthService: HealthService;
  let checkDatabase: jest.MockedFunction<HealthRepository['checkDatabase']>;

  beforeEach(async () => {
    checkDatabase = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: HealthRepository,
          useValue: { checkDatabase },
        },
      ],
    }).compile();

    healthService = module.get<HealthService>(HealthService);
  });

  it('reports that the database is up when the query succeeds', async () => {
    checkDatabase.mockResolvedValue();

    await expect(healthService.checkDatabase()).resolves.toEqual({ database: 'up' });
    expect(checkDatabase).toHaveBeenCalledTimes(1);
  });

  it('reports service unavailable when the query fails', async () => {
    checkDatabase.mockRejectedValue(new Error('connection failed'));

    await expect(healthService.checkDatabase()).rejects.toThrow(ServiceUnavailableException);
  });
});
