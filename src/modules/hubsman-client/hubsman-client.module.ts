import { Module } from '@nestjs/common';
import { HubsmanClientService } from './hubsman-client.service';

@Module({
  providers: [HubsmanClientService],
  exports: [HubsmanClientService],
})
export class HubsmanClientModule {}
