import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface SendMailParams {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  sender?: string | null;
  replyTo?: string | null;
}

export interface SendMailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class GraphMailerService {
  private readonly logger = new Logger(GraphMailerService.name);
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Obtiene o refresca el token de acceso OAuth2 para Microsoft Graph API.
   * Cuenta con almacenamiento en memoria caché y verificación de expiración previa.
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now();
    // Si aún tiene al menos 60 segundos de vigencia, reutilizar el token en caché
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60000) {
      return this.cachedToken.token;
    }

    const tenantId = this.configService.get<string>('app.azureTenantId') || process.env.AZURE_TENANT_ID;
    const clientId = this.configService.get<string>('app.azureClientId') || process.env.AZURE_CLIENT_ID;
    const clientSecret = this.configService.get<string>('app.azureClientSecret') || process.env.AZURE_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
      throw new Error(
        'Credenciales de Microsoft Azure incompletas. Verifique AZURE_TENANT_ID, AZURE_CLIENT_ID y AZURE_CLIENT_SECRET en .env',
      );
    }

    const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      client_id: clientId,
      scope: 'https://graph.microsoft.com/.default',
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    });

    try {
      this.logger.debug('Solicitando nuevo token de acceso a Microsoft Azure Entra ID...');
      const response = await axios.post<{
        access_token: string;
        expires_in: number;
        token_type: string;
      }>(tokenUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      });

      const expiresInSeconds = Number(response.data.expires_in) || 3600;
      this.cachedToken = {
        token: response.data.access_token,
        expiresAt: now + expiresInSeconds * 1000,
      };

      this.logger.debug(
        `Token OAuth2 de Microsoft Graph renovado exitosamente (Vigencia: ${expiresInSeconds}s)`,
      );
      return this.cachedToken.token;
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error_description ||
        err.response?.data?.error ||
        err.message ||
        'Error desconocido al conectar con Microsoft Azure';
      this.logger.error(`Error de autenticación con Azure OAuth2: ${errorMsg}`);
      throw new Error(`Fallo de autenticación con Microsoft Azure: ${errorMsg}`);
    }
  }

  /**
   * Envía un correo electrónico a través del endpoint sendMail de Microsoft Graph API v1.0
   */
  async sendMail(params: SendMailParams): Promise<SendMailResult> {
    const sender =
      params.sender?.trim() ||
      this.configService.get<string>('app.azureMailFrom') ||
      process.env.AZURE_MAIL_FROM ||
      'hubsmannotificaciones@hubsman.com';

    const fromName =
      this.configService.get<string>('app.mailFromName') ||
      process.env.MAIL_FROM_NAME ||
      'Hubsman';

    const replyTo =
      params.replyTo?.trim() ||
      this.configService.get<string>('app.mailReplyTo') ||
      process.env.MAIL_REPLY_TO ||
      'tecnologia@hubsman.com';

    const accessToken = await this.getAccessToken();
    const sendMailUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`;

    const payload = {
      message: {
        subject: params.subject,
        body: {
          contentType: 'HTML',
          content: params.html,
        },
        toRecipients: [
          {
            emailAddress: {
              address: params.to.trim(),
              name: params.toName?.trim() || params.to.split('@')[0],
            },
          },
        ],
        replyTo: [
          {
            emailAddress: {
              address: replyTo,
              name: fromName,
            },
          },
        ],
      },
      saveToSentItems: false,
    };

    try {
      this.logger.log(`Enviando correo vía Graph a ${params.to} desde ${sender} (Asunto: "${params.subject}")`);

      const response = await axios.post(sendMailUrl, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      // Microsoft Graph sendMail retorna 202 Accepted
      if (response.status >= 200 && response.status < 300) {
        const messageId = `graph-${Date.now()}`;
        this.logger.log(`Correo enviado satisfactoriamente a ${params.to} (MessageId: ${messageId})`);
        return {
          success: true,
          messageId,
        };
      }

      throw new Error(`Respuesta HTTP inesperada de Microsoft Graph: ${response.status}`);
    } catch (err: any) {
      const errorData = err.response?.data;
      const errorMsg =
        errorData?.error?.message ||
        errorData?.error_description ||
        err.message ||
        'Error desconocido en Microsoft Graph';

      this.logger.error(`Error enviando correo a ${params.to} desde ${sender}: ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }
}
