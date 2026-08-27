import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '../../generated/prisma/client';

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): User => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return request.user as User;
});
