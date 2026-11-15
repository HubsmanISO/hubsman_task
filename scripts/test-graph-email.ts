import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

async function runTest() {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const fromEmail = process.env.AZURE_MAIL_FROM || 'hubsmannotificaciones@hubsman.com';
  const recipient = process.argv[2] || 'tecnologia@hubsman.com';

  console.log('====================================================');
  console.log('  TEST DE ENVÍO DIRECTO DESDE TASK-SERVICES');
  console.log('====================================================');
  console.log(`Tenant ID:     ${tenantId ? tenantId.substring(0, 8) + '...' : '(NO CONFIG)'}`);
  console.log(`Client ID:     ${clientId ? clientId.substring(0, 8) + '...' : '(NO CONFIG)'}`);
  console.log(`Buzón origen:  ${fromEmail}`);
  console.log(`Destinatario:  ${recipient}`);
  console.log('----------------------------------------------------');

  if (!tenantId || !clientId || !clientSecret) {
    console.error('❌ Falta configurar credenciales de Azure en .env');
    process.exit(1);
  }

  // 1. Obtener token
  console.log('[1/2] Solicitando token de acceso...');
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
  const tokenRes = await axios.post(
    tokenUrl,
    new URLSearchParams({
      client_id: clientId,
      scope: 'https://graph.microsoft.com/.default',
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
  );

  const token = tokenRes.data.access_token;
  console.log('✅ Token obtenido con éxito.');

  // 2. Enviar email
  console.log(`[2/2] Enviando email a ${recipient}...`);
  const sendUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(fromEmail)}/sendMail`;
  const mailPayload = {
    message: {
      subject: `[Task-Services] Verificación de worker (${new Date().toLocaleTimeString('es-ES')})`,
      body: {
        contentType: 'HTML',
        content: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #2563eb;">Task Services Worker - Microsoft Graph</h2>
            <p>Este correo confirma que el microservicio <strong>task-services</strong> puede comunicarse correctamente con Microsoft 365.</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}</p>
          </div>
        `,
      },
      toRecipients: [
        {
          emailAddress: {
            address: recipient,
            name: recipient.split('@')[0],
          },
        },
      ],
    },
    saveToSentItems: false,
  };

  await axios.post(sendUrl, mailPayload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  console.log('🎉 ¡CORREO ENVIADO CON ÉXITO!');
  console.log('====================================================');
}

runTest().catch((err) => {
  console.error('❌ Error en test:', err.response?.data || err.message);
  process.exit(1);
});
