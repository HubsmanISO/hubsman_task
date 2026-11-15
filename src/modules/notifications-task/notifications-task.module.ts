import { Module } from '@nestjs/common';
import { NotificationsTaskService } from './notifications-task.service';
import { NotificationsTaskController } from './notifications-task.controller';
import { GraphMailerModule } from '../graph-mailer/graph-mailer.module';
import { HubsmanClientModule } from '../hubsman-client/hubsman-client.module';

@Module({
  imports: [GraphMailerModule, HubsmanClientModule],
  controllers: [NotificationsTaskController],
  providers: [NotificationsTaskService],
  exports: [NotificationsTaskService],
})
export class NotificationsTaskModule {}
