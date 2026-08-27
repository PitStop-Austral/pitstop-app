import { Global, Module } from '@nestjs/common';

import { FirebaseController } from './firebase.controller';
import { FirebaseService } from './firebase.service';

@Global()
@Module({
  controllers: [FirebaseController],
  providers: [FirebaseService],
  exports: [FirebaseService],
})
export class FirebaseModule {}
