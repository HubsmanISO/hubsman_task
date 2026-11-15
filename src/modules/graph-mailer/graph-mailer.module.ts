import { Module } from '@nestjs/common';
import { GraphMailerService } from './graph-mailer.service';

@Module({
  providers: [GraphMailerService],
  exports: [GraphMailerService],
})
export class GraphMailerModule {}
