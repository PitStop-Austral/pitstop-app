import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { User } from '../../generated/prisma/client';

@Controller()
export class UsersController {
  @Get('me')
  getMe(@CurrentUser() user: User): User {
    return user;
  }
}
