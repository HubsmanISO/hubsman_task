import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { GraphMailerModule } from './modules/graph-mailer/graph-mailer.module';
import { HubsmanClientModule } from './modules/hubsman-client/hubsman-client.module';
import { NotificationsTaskModule } from './modules/notifications-task/notifications-task.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ScheduleModule.forRoot(),
    GraphMailerModule,
    HubsmanClientModule,
    NotificationsTaskModule,
  ],
})
export class AppModule {}
