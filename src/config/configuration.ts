export interface AppConfig {
  port: number;
  nodeEnv: string;
  hubsmanApiUrl: string;
  serviceApiKey: string;
  cronSchedule: string;
  batchSize: number;
  azureTenantId: string;
  azureClientId: string;
  azureClientSecret: string;
  azureMailFrom: string;
  mailFromName: string;
  mailReplyTo: string;
}

export default (): { app: AppConfig } => ({
  app: {
    port: parseInt(process.env.PORT || '5001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    hubsmanApiUrl: (process.env.HUBSMAN_API_URL || 'http://localhost:5000').replace(/\/$/, ''),
    serviceApiKey: process.env.SERVICE_API_KEY || 'hubsman_task_service_secret_key_2026',
    cronSchedule: process.env.CRON_SCHEDULE || '*/20 * * * * *',
    batchSize: Math.max(1, parseInt(process.env.BATCH_SIZE || '10', 10)),
    azureTenantId: process.env.AZURE_TENANT_ID || '',
    azureClientId: process.env.AZURE_CLIENT_ID || '',
    azureClientSecret: process.env.AZURE_CLIENT_SECRET || '',
    azureMailFrom: process.env.AZURE_MAIL_FROM || 'hubsmannotificaciones@hubsman.com',
    mailFromName: process.env.MAIL_FROM_NAME || 'Hubsman',
    mailReplyTo: process.env.MAIL_REPLY_TO || 'tecnologia@hubsman.com',
  },
});
