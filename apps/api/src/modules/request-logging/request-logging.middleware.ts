import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Inject, Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import { waitUntil } from '@vercel/functions';
import type { NextFunction, Request, Response } from 'express';
import type { HttpRequestOutcome, HttpRequestTrafficKind } from '../../generated/prisma/client';
import type { CreateHttpRequestLog } from './request-logging.repository';
import { RequestLoggingService } from './request-logging.service';

export type RequestLoggingClock = { now(): number };

export const REQUEST_LOGGING_CLOCK = Symbol('REQUEST_LOGGING_CLOCK');

export const systemRequestLoggingClock: RequestLoggingClock = { now: () => performance.now() };

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggingMiddleware.name);

  constructor(
    private readonly requestLoggingService: RequestLoggingService,
    @Inject(REQUEST_LOGGING_CLOCK) private readonly clock: RequestLoggingClock,
  ) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const startedAt = new Date();
    const startedAtMonotonic = this.clock.now();
    const id = randomUUID();
    let finalized = false;
    let resolveTelemetry: () => void;
    const telemetry = new Promise<void>((resolve) => {
      resolveTelemetry = resolve;
    });

    waitUntil(telemetry);

    const finalize = (outcome: HttpRequestOutcome) => {
      if (finalized) return;
      finalized = true;
      response.off('finish', onFinish);
      response.off('close', onClose);

      const endedAt = new Date();
      const durationMs = this.durationSince(startedAtMonotonic);
      const route = this.routeTemplate(request);
      const log: CreateHttpRequestLog = {
        id,
        method: request.method,
        route,
        startedAt,
        endedAt,
        durationMs,
        statusCode: outcome === 'COMPLETED' ? response.statusCode : null,
        outcome,
        trafficKind: this.trafficKind(route),
      };

      void this.requestLoggingService
        .record(log)
        .catch(() => {
          this.logger.error({
            message: 'HTTP request log persistence failed',
            requestId: id,
            errorCode: 'PERSISTENCE_FAILED',
          });
        })
        .finally(resolveTelemetry);
    };

    const onFinish = () => finalize('COMPLETED');
    const onClose = () => finalize('ABORTED');

    response.once('finish', onFinish);
    response.once('close', onClose);
    next();
  }

  private durationSince(startedAtMonotonic: number): number {
    const durationMs = this.clock.now() - startedAtMonotonic;
    return Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  }

  private routeTemplate(request: Request): string | null {
    const path = request.route?.path;
    return typeof path === 'string' ? path : null;
  }

  private trafficKind(route: string | null): HttpRequestTrafficKind {
    if (route === null) return 'UNMATCHED';
    if (route === '/health' || route === '/health/db') return 'HEALTH';
    return 'APPLICATION';
  }
}
