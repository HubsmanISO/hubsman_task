import 'dotenv/config';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HubsmanClientService, PendingNotification } from '../hubsman-client/hubsman-client.service';
import { GraphMailerService } from '../graph-mailer/graph-mailer.service';

export interface TaskMetrics {
  totalRuns: number;
  lastRunAt: string | null;
  lastRunDurationMs: number;
  totalProcessed: number;
  totalSent: number;
  totalFailed: number;
  isProcessing: boolean;
  lastError: string | null;
}

@Injectable()
export class NotificationsTaskService {
  private readonly logger = new Logger(NotificationsTaskService.name);
  private isProcessing = false;

  private metrics: TaskMetrics = {
    totalRuns: 0,
    lastRunAt: null,
    lastRunDurationMs: 0,
    totalProcessed: 0,
    totalSent: 0,
    totalFailed: 0,
    isProcessing: false,
    lastError: null,
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly hubsmanClient: HubsmanClientService,
    private readonly graphMailer: GraphMailerService,
  ) {}

  /**
   * Tarea Cron ejecutada periódicamente para despachar correos pendientes.
   * Respeta la regla de CRON_SCHEDULE del .env con fallback a cada 20 segundos.
   */
  @Cron(process.env.CRON_SCHEDULE || '*/20 * * * * *')
  async handleCron(): Promise<void> {
    await this.processPendingNotifications('CRON_DISPATCH');
  }

  /**
   * Ciclo principal de procesamiento de notificaciones pendientes.
   * Itera sobre los backends configurados (ej: hubsman-v2 y hubsman-core).
   * Cuenta con bloqueo de concurrencia para evitar ejecuciones solapadas.
   */
  async processPendingNotifications(triggeredBy: string = 'MANUAL'): Promise<{
    processed: number;
    sent: number;
    failed: number;
    durationMs: number;
  }> {
    if (this.isProcessing) {
      this.logger.warn(`[${triggeredBy}] Ya existe un ciclo de envío en ejecución. Omitiendo este turno.`);
      return { processed: 0, sent: 0, failed: 0, durationMs: 0 };
    }

    this.isProcessing = true;
    this.metrics.isProcessing = true;
    const startTime = Date.now();
    this.metrics.totalRuns += 1;
    this.metrics.lastRunAt = new Date().toISOString();

    const rawBatchSize =
      this.configService.get<number>('app.batchSize') ||
      parseInt(process.env.BATCH_SIZE || '10', 10);
    const batchSize = Math.max(1, isNaN(rawBatchSize) ? 10 : rawBatchSize);

    let cycleProcessed = 0;
    let cycleSent = 0;
    let cycleFailed = 0;

    const targetUrls = this.hubsmanClient.getBaseUrls();

    try {
      this.logger.log(`\n⏳ ============================================================`);
      this.logger.log(`🚀 [${triggeredBy}] Iniciando ciclo de despacho (Lote máx: ${batchSize} por backend)...`);

      for (const targetUrl of targetUrls) {
        let pendingList: PendingNotification[] = [];
        try {
          pendingList = await this.hubsmanClient.fetchPendingNotifications(batchSize, targetUrl);
        } catch (fetchErr: any) {
          // Si el backend no está encendido o responde con error, se notifica y se pasa al siguiente
          this.logger.debug(`[${targetUrl}] No disponible o sin conexión (${fetchErr.message})`);
          continue;
        }

        if (!pendingList || pendingList.length === 0) {
          this.logger.log(`💤 [${targetUrl}] No hay notificaciones pendientes.`);
          continue;
        }

        this.logger.log(`📬 [${targetUrl}] Se encontraron ${pendingList.length} notificación(es) pendiente(s).`);

        for (let i = 0; i < pendingList.length; i++) {
          const item = pendingList[i];
          const recipientDisplayName = item.recipientName || (item as any).recipient_name;
          this.logger.log(`\n[${i + 1}/${pendingList.length}] Procesando [${item.id}] desde ${targetUrl}`);
          this.logger.log(`   Destinatario: ${item.recipient} (${recipientDisplayName || 'Sin nombre'})`);
          this.logger.log(`   Asunto: "${item.subject}"`);
          this.logger.log(`   Evento: ${item.event || 'GENÉRICO'}`);

          // Validación básica
          if (!item.recipient || !item.html) {
            const validationErr = 'Registro inválido: falta destinatario o contenido HTML.';
            this.logger.error(`   ❌ ${validationErr}`);
            await this.hubsmanClient.updateNotificationStatus(item.id, 'failed', validationErr, targetUrl);
            cycleFailed++;
            continue;
          }

          // Enviar correo vía Microsoft Graph API (Office 365)
          const sendResult = await this.graphMailer.sendMail({
            to: item.recipient,
            toName: recipientDisplayName,
            subject: item.subject,
            html: item.html,
            sender: item.sender,
          });

          // Actualizar estado en el backend correspondiente
          if (sendResult.success) {
            this.logger.log(`   ✅ Correo enviado exitosamente vía Microsoft Graph.`);
            await this.hubsmanClient.updateNotificationStatus(item.id, 'sent', null, targetUrl);
            cycleSent++;
          } else {
            const errMsg = sendResult.error || 'Error al enviar por Microsoft Graph';
            this.logger.error(`   ❌ Falló el envío del correo: ${errMsg}`);
            await this.hubsmanClient.updateNotificationStatus(item.id, 'failed', errMsg, targetUrl);
            cycleFailed++;
          }
        }

        cycleProcessed += pendingList.length;
      }

      this.metrics.totalProcessed += cycleProcessed;
      this.metrics.totalSent += cycleSent;
      this.metrics.totalFailed += cycleFailed;
      this.metrics.lastError = null;

      const durationMs = Date.now() - startTime;
      this.metrics.lastRunDurationMs = durationMs;

      this.logger.log(`\n🏁 [${triggeredBy}] Ciclo completado en ${durationMs}ms:`);
      this.logger.log(`   • Total procesados: ${cycleProcessed}`);
      this.logger.log(`   • Enviados con éxito: ${cycleSent}`);
      this.logger.log(`   • Fallidos: ${cycleFailed}`);
      this.logger.log(`============================================================\n`);

      return {
        processed: cycleProcessed,
        sent: cycleSent,
        failed: cycleFailed,
        durationMs,
      };
    } catch (err: any) {
      const errMsg = err.message || 'Error inesperado durante el ciclo de despacho';
      this.logger.error(`💥 Error crítico en ciclo de despacho: ${errMsg}`, err.stack);
      this.metrics.lastError = errMsg;
      const durationMs = Date.now() - startTime;
      this.metrics.lastRunDurationMs = durationMs;
      return { processed: cycleProcessed, sent: cycleSent, failed: cycleFailed, durationMs };
    } finally {
      this.isProcessing = false;
      this.metrics.isProcessing = false;
    }
  }

  /**
   * Retorna las métricas actuales del servicio worker.
   */
  getMetrics(): TaskMetrics {
    return { ...this.metrics };
  }
}
