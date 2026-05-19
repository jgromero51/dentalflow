/**
 * DentalFlow — Servicio WhatsApp Cloud API (Meta)
 *
 * Un solo número centralizado (del dueño del sistema).
 * Los mensajes se personalizan con el nombre de la clínica de cada doctor.
 * Si DEMO_MODE=true o no hay credenciales, imprime en consola.
 */

require('dotenv').config();
const axios = require('axios');

const DEMO_MODE      = process.env.DEMO_MODE === 'true';
const WA_TOKEN       = process.env.WHATSAPP_TOKEN;
const WA_PHONE_ID    = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WA_API_VERSION = 'v19.0';
const WA_API_BASE    = `https://graph.facebook.com/${WA_API_VERSION}/${WA_PHONE_ID}/messages`;

/**
 * Envía un mensaje de texto por WhatsApp.
 * @param {string} telefono - Número en formato internacional: +51912345678
 * @param {string} mensaje  - Texto del mensaje
 */
async function sendMessage(telefono, mensaje) {
  const to = telefono.replace(/^\+/, '');

  if (DEMO_MODE || !WA_TOKEN || WA_TOKEN === 'EAAxxxxxxxxxx') {
    console.log('');
    console.log('  ┌─────────────────────────────────────────┐');
    console.log('  │  📱 [DEMO] WhatsApp Message             │');
    console.log('  ├─────────────────────────────────────────┤');
    console.log(`  │  Para: +${to}`);
    console.log('  │  Mensaje:');
    mensaje.split('\n').forEach(line => console.log(`  │    ${line}`));
    console.log('  └─────────────────────────────────────────┘');
    console.log('');
    return { success: true, demo: true };
  }

  try {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: mensaje },
    };

    const response = await axios.post(WA_API_BASE, payload, {
      headers: {
        'Authorization': `Bearer ${WA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    const messageId = response.data?.messages?.[0]?.id;
    console.log(`[WhatsApp] ✅ Enviado a +${to} — ID: ${messageId}`);
    return { success: true, messageId };

  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error(`[WhatsApp] ❌ Error al enviar a +${to}: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Responde un mensaje entrante dentro de la ventana de 24h.
 * @param {string} telefono
 * @param {string} mensaje
 */
async function replyMessage(telefono, mensaje) {
  return sendMessage(telefono, mensaje);
}

module.exports = { sendMessage, replyMessage };
