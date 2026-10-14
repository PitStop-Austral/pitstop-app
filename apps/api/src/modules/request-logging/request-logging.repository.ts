import { Injectable } from '@nestjs/common';
import type { HttpRequestOutcome, HttpRequestTrafficKind } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CreateHttpRequestLog = {
  id: string;
  method: string;
  route: string | null;
  startedAt: Date;
  endedAt: Date;
  durationMs: number;
  statusCode: number | null;
  outcome: HttpRequestOutcome;
  trafficKind: HttpRequestTrafficKind;
};

@Injectable()
export class RequestLoggingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateHttpRequestLog): Promise<void> {
    await this.prisma.httpRequestLog.create({ data });
  }
}
