import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  const port = parseInt(process.env.PORT || '5001', 10);
  await app.listen(port);

  logger.log(`================================================================`);
  logger.log(`🚀 Task Services Worker iniciado exitosamente`);
  logger.log(`📡 Puerto HTTP: http://localhost:${port}`);
  logger.log(`💓 Healthcheck: http://localhost:${port}/health`);
  logger.log(`📊 Métricas:    http://localhost:${port}/tasks/status`);
  logger.log(`⚡ Disparo Manual: POST http://localhost:${port}/tasks/trigger`);
  logger.log(`⏱️  Cron Schedule: ${process.env.CRON_SCHEDULE || '*/20 * * * * *'}`);
  logger.log(`🏢 Hubsman API: ${process.env.HUBSMAN_API_URL || 'http://localhost:5000'}`);
  logger.log(`📧 Microsoft 365 Buzón: ${process.env.AZURE_MAIL_FROM || 'hubsmannotificaciones@hubsman.com'}`);
  logger.log(`================================================================`);
}

bootstrap().catch((err) => {
  console.error('Error al inicializar Task Services Worker:', err);
  process.exit(1);
});
