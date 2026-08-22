import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HealthRepository } from './health.repository';

export interface DatabaseHealth {
  database: 'up';
}

@Injectable()
export class HealthService {
  constructor(private readonly healthRepository: HealthRepository) {}

  async checkDatabase(): Promise<DatabaseHealth> {
    try {
      await this.healthRepository.checkDatabase();
    } catch {
      throw new ServiceUnavailableException('Database is unavailable');
    }

    return { database: 'up' };
  }
}
