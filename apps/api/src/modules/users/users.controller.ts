import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { User } from '../../generated/prisma/client';
import { SetActiveVehicleDto } from './dto/set-active-vehicle.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import type { ProfileSummary } from './users.repository';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: User): Promise<User> {
    return this.usersService.getMe(user);
  }

  @Get('me/profile-summary')
  getProfileSummary(@CurrentUser() user: User): Promise<ProfileSummary> {
    return this.usersService.getProfileSummary(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: User, @Body() dto: UpdateMeDto): Promise<User> {
    return this.usersService.updateMe(user.id, dto);
  }

  @Patch('me/active-vehicle')
  setActiveVehicle(@CurrentUser() user: User, @Body() dto: SetActiveVehicleDto): Promise<User> {
    return this.usersService.setActiveVehicle(user.id, dto);
  }
}
