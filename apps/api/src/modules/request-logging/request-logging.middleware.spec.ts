import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import { waitUntil } from '@vercel/functions';
import type { NextFunction, Request, Response } from 'express';
import { RequestLoggingMiddleware } from './request-logging.middleware';
import { RequestLoggingService } from './request-logging.service';

jest.mock('@vercel/functions', () => ({ waitUntil: jest.fn() }));

describe('RequestLoggingMiddleware', () => {
  let record: jest.MockedFunction<RequestLoggingService['record']>;
  let now: jest.Mock;
  let middleware: RequestLoggingMiddleware;

  beforeEach(() => {
    jest.mocked(waitUntil).mockClear();
    record = jest.fn().mockResolvedValue(undefined);
    now = jest.fn().mockReturnValueOnce(100).mockReturnValueOnce(225);
    middleware = new RequestLoggingMiddleware({ record } as unknown as RequestLoggingService, {
      now,
    });
  });

  function observe(request: Partial<Request>, statusCode = 200) {
    const response = Object.assign(new EventEmitter(), { statusCode }) as Response;
    const next = jest.fn() as NextFunction;

    middleware.use(request as Request, response, next);

    return { response, next };
  }

  it('records one completed request using the resolved route template and monotonic duration', async () => {
    const { response, next } = observe({ method: 'POST', route: { path: '/vehicles/:id' } }, 201);

    response.emit('finish');
    response.emit('close');
    await Promise.resolve();

    expect(next).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        route: '/vehicles/:id',
        durationMs: 125,
        statusCode: 201,
        outcome: 'COMPLETED',
        trafficKind: 'APPLICATION',
      }),
    );
  });

  it('records an aborted request without treating the default status as successful', async () => {
    const { response } = observe({ method: 'GET' });

    response.emit('close');
    await Promise.resolve();

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        route: null,
        statusCode: null,
        outcome: 'ABORTED',
        trafficKind: 'UNMATCHED',
      }),
    );
  });

  it('classifies the daily KPI endpoint as reporting traffic', async () => {
    const { response } = observe({
      method: 'GET',
      route: { path: '/internal/kpis/daily' },
    });

    response.emit('finish');
    await Promise.resolve();

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/internal/kpis/daily',
        trafficKind: 'REPORTING',
      }),
    );
  });

  it('keeps the original response intact when persistence fails', async () => {
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    record.mockRejectedValue(new Error('database unavailable: password=secret'));
    const { response } = observe({ method: 'GET', route: { path: '/health' } }, 200);

    response.emit('finish');
    await Promise.resolve();
    await Promise.resolve();

    expect(response.statusCode).toBe(200);
    expect(logger).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'HTTP request log persistence failed',
        errorCode: 'PERSISTENCE_FAILED',
      }),
    );
    expect(JSON.stringify(logger.mock.calls[0][0])).not.toContain('password=secret');
    logger.mockRestore();
  });

  it('keeps the Vercel lifetime promise pending until persistence completes', async () => {
    let resolveRecord: () => void;
    record.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveRecord = resolve;
      }),
    );
    const { response } = observe({ method: 'GET', route: { path: '/' } });
    const telemetry = jest.mocked(waitUntil).mock.calls[0][0];
    let telemetryResolved = false;
    void telemetry.then(() => {
      telemetryResolved = true;
    });

    response.emit('finish');
    await Promise.resolve();

    expect(telemetryResolved).toBe(false);
    resolveRecord!();
    await telemetry;
    expect(telemetryResolved).toBe(true);
  });
});
