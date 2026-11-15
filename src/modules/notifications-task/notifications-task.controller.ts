import { Controller, Get, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsTaskService, TaskMetrics } from './notifications-task.service';

@Controller()
export class NotificationsTaskController {
  constructor(
    private readonly taskService: NotificationsTaskService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  getRoot() {
    return {
      service: 'task-services',
      name: 'Task Services Worker - Microsoft Graph Email Dispatcher',
      status: 'UP',
      timestamp: new Date().toISOString(),
      cronSchedule: this.configService.get<string>('app.cronSchedule') || '*/20 * * * * *',
      hubsmanApiUrl: this.configService.get<string>('app.hubsmanApiUrl') || 'http://localhost:5000',
      batchSize: this.configService.get<number>('app.batchSize') || 10,
    };
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('tasks/status')
  getStatus(): { metrics: TaskMetrics; config: Record<string, any> } {
    return {
      metrics: this.taskService.getMetrics(),
      config: {
        hubsmanApiUrl: this.configService.get<string>('app.hubsmanApiUrl'),
        batchSize: this.configService.get<number>('app.batchSize'),
        cronSchedule: this.configService.get<string>('app.cronSchedule'),
        mailFrom: this.configService.get<string>('app.azureMailFrom'),
      },
    };
  }

  @Post('tasks/trigger')
  @HttpCode(HttpStatus.OK)
  async triggerTask() {
    const result = await this.taskService.processPendingNotifications('HTTP_TRIGGER');
    return {
      message: 'Ciclo de despacho ejecutado correctamente',
      result,
    };
  }
}
