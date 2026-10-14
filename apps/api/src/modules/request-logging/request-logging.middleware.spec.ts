import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { RequestLoggingMiddleware } from './request-logging.middleware';
import { RequestLoggingService } from './request-logging.service';

describe('RequestLoggingMiddleware', () => {
  let record: jest.MockedFunction<RequestLoggingService['record']>;
  let now: jest.Mock;
  let middleware: RequestLoggingMiddleware;

  beforeEach(() => {
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

  it('keeps the original response intact when persistence fails', async () => {
    const error = new Error('database unavailable');
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    record.mockRejectedValue(error);
    const { response } = observe({ method: 'GET', route: { path: '/health' } }, 200);

    response.emit('finish');
    await Promise.resolve();
    await Promise.resolve();

    expect(response.statusCode).toBe(200);
    expect(logger).toHaveBeenCalledWith('Failed to persist HTTP request log', error);
    logger.mockRestore();
  });
});
