import { createHash, timingSafeEqual } from 'node:crypto';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class CronSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.CRON_SECRET;
    const provided = this.extractBearerToken(context.switchToHttp().getRequest<Request>());

    if (!expected || !provided || !this.matches(expected, provided)) {
      throw new UnauthorizedException('Invalid or missing cron secret');
    }

    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return undefined;
    const token = header.slice(7);
    return token.length > 0 ? token : undefined;
  }

  private matches(expected: string, provided: string): boolean {
    const digest = (value: string) => createHash('sha256').update(value).digest();
    return timingSafeEqual(digest(expected), digest(provided));
  }
}
