import { Module } from '@nestjs/common';
import {
  REQUEST_LOGGING_CLOCK,
  RequestLoggingMiddleware,
  systemRequestLoggingClock,
} from './request-logging.middleware';
import { RequestLoggingRepository } from './request-logging.repository';
import { RequestLoggingService } from './request-logging.service';

@Module({
  providers: [
    RequestLoggingMiddleware,
    RequestLoggingRepository,
    RequestLoggingService,
    { provide: REQUEST_LOGGING_CLOCK, useValue: systemRequestLoggingClock },
  ],
})
export class RequestLoggingModule {}
