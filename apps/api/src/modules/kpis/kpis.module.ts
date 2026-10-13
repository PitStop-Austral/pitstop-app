import { Module } from '@nestjs/common';
import { KpisRepository } from './kpis.repository';

@Module({
  providers: [KpisRepository],
  exports: [KpisRepository],
})
export class KpisModule {}
