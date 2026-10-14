import { Injectable } from '@nestjs/common';
import { RequestLoggingRepository, type CreateHttpRequestLog } from './request-logging.repository';

@Injectable()
export class RequestLoggingService {
  constructor(private readonly requestLoggingRepository: RequestLoggingRepository) {}

  record(log: CreateHttpRequestLog): Promise<void> {
    return this.requestLoggingRepository.create(log);
  }
}
