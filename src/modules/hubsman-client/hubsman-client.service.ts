import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface PendingNotification {
  id: string;
  companyId?: string | null;
  type: string;
  status: string;
  recipient: string;
  recipientName?: string | null;
  sender: string;
  subject: string;
  html: string;
  event?: string | null;
  createdByUserId?: string | null;
  createdByUserName?: string | null;
  metadata?: Record<string, any> | null;
  errorMessage?: string | null;
  sentAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class HubsmanClientService {
  private readonly logger = new Logger(HubsmanClientService.name);

  constructor(private readonly configService: ConfigService) {}

  public getBaseUrls(): string[] {
    const raw =
      this.configService.get<string>('app.hubsmanApiUrl') ||
      process.env.HUBSMAN_API_URL ||
      'http://localhost:5000,http://localhost:30066';
    return raw
      .split(',')
      .map((u) => u.trim().replace(/\/$/, ''))
      .filter(Boolean);
  }

  private get baseUrl(): string {
    const urls = this.getBaseUrls();
    return urls[0] || 'http://localhost:5000';
  }

  private get serviceApiKey(): string {
    return (
      this.configService.get<string>('app.serviceApiKey') ||
      process.env.SERVICE_API_KEY ||
      'hubsman_task_service_secret_key_2026'
    );
  }

  /**
   * Obtiene la lista de notificaciones pendientes desde el backend de Hubsman (FIFO).
   * Respeta el tamaño de lote configurado por BATCH_SIZE (mínimo 1).
   */
  async fetchPendingNotifications(
    limit: number = 10,
    targetBaseUrl?: string,
  ): Promise<PendingNotification[]> {
    const baseUrl = (targetBaseUrl || this.baseUrl).replace(/\/$/, '');
    const effectiveLimit = Math.max(1, limit);
    const url = `${baseUrl}/send-notifications/pending?limit=${effectiveLimit}`;

    try {
      this.logger.debug(`Consultando notificaciones pendientes en: ${url}`);

      const response = await axios.get(url, {
        headers: {
          'x-service-key': this.serviceApiKey,
          Accept: 'application/json',
        },
        timeout: 8000,
      });

      // Soporta tanto array directo [...] como { data: [...] }
      const body = response.data;
      if (Array.isArray(body)) {
        return body;
      }
      if (body && Array.isArray(body.data)) {
        return body.data;
      }

      this.logger.warn(`Respuesta inesperada al obtener pendientes: ${JSON.stringify(body)}`);
      return [];
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Error desconocido al contactar a Hubsman Backend';
      throw new Error(`Fallo de conexión con ${url}: ${errorMsg}`);
    }
  }

  /**
   * Actualiza el estado de una notificación en el backend de Hubsman (sent o failed).
   */
  async updateNotificationStatus(
    id: string,
    status: 'sent' | 'failed' | 'pending',
    errorMessage?: string | null,
    targetBaseUrl?: string,
  ): Promise<boolean> {
    const baseUrl = (targetBaseUrl || this.baseUrl).replace(/\/$/, '');
    const url = `${baseUrl}/send-notifications/${id}/status`;

    const payload = {
      status,
      sentAt: status === 'sent' ? new Date().toISOString() : null,
      errorMessage: errorMessage ?? null,
    };

    try {
      this.logger.debug(`Actualizando estado de notificación [${id}] a "${status}" en ${url}...`);

      const response = await axios.patch(url, payload, {
        headers: {
          'x-service-key': this.serviceApiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 8000,
      });

      if (response.status >= 200 && response.status < 300) {
        this.logger.log(`Estado de notificación [${id}] actualizado a "${status}" con éxito.`);
        return true;
      }

      return false;
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Error al actualizar estado en Hubsman';
      this.logger.error(`Error al invocar PATCH ${url}: ${errorMsg}`);
      return false;
    }
  }
}
