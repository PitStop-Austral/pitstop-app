import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../modules/users/users.module';
import { AuthService } from './auth.service';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';

@Module({
  imports: [UsersModule],
  providers: [AuthService, { provide: APP_GUARD, useClass: FirebaseAuthGuard }],
})
export class AuthModule {}
