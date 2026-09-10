import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { User } from '../../generated/prisma/client';
import { SetActiveVehicleDto } from './dto/set-active-vehicle.dto';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: User): Promise<User> {
    return this.usersService.getMe(user);
  }

  @Patch('me/active-vehicle')
  setActiveVehicle(@CurrentUser() user: User, @Body() dto: SetActiveVehicleDto): Promise<User> {
    return this.usersService.setActiveVehicle(user.id, dto);
  }
}
