/**
 * DentalFlow - Servicio WhatsApp Cloud API (Meta)
 */

require('dotenv').config();
const axios = require('axios');

const DEMO_MODE      = process.env.DEMO_MODE === 'true';
const WA_TOKEN       = process.env.WHATSAPP_TOKEN;
const WA_PHONE_ID    = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WA_API_VERSION = 'v19.0';
const WA_API_BASE    = `https://graph.facebook.com/${WA_API_VERSION}/${WA_PHONE_ID}/messages`;

function normalizarTelefono(telefono) {
  let t = telefono.replace(/[\s\-()]/g, '').replace(/^\+/, '');
  if (/^9\d{8}$/.test(t)) t = '51' + t;
  return t;
}

function headers() {
  return { 'Authorization': 'Bearer ' + WA_TOKEN, 'Content-Type': 'application/json' };
}

/**
 * Envía mensaje de texto libre (solo funciona si el paciente escribió en las últimas 24h)
 */
async function sendMessage(telefono, mensaje) {
  const to = normalizarTelefono(telefono);

  if (DEMO_MODE || !WA_TOKEN || WA_TOKEN === 'EAAxxxxxxxxxx') {
    console.log('[WhatsApp Demo] Para: +' + to + ' | ' + mensaje);
    return { success: true, demo: true };
  }

  try {
    const res = await axios.post(WA_API_BASE, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: mensaje }
    }, { headers: headers(), timeout: 10000 });

    const messageId = res.data?.messages?.[0]?.id || null;
    console.log('[WhatsApp] Texto enviado a +' + to + ' - ID: ' + messageId);
    return { success: true, messageId };
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('[WhatsApp] Error texto a +' + to + ': ' + errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Envía mensaje usando la plantilla aprobada "recordatorio_cita"
 * Variables: {{1}}=nombre, {{2}}=clinica, {{3}}=fecha, {{4}}=hora
 */
async function sendTemplate(telefono, { nombre, clinica, fecha, hora }) {
  const to = normalizarTelefono(telefono);

  if (DEMO_MODE || !WA_TOKEN || WA_TOKEN === 'EAAxxxxxxxxxx') {
    console.log(`[WhatsApp Demo] Template a +${to} | ${nombre} | ${clinica} | ${fecha} ${hora}`);
    return { success: true, demo: true };
  }

  try {
    const res = await axios.post(WA_API_BASE, {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: 'recordatorio_cita',
        language: { code: process.env.WA_TEMPLATE_LANG || 'es_PE' },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', text: nombre  },
            { type: 'text', text: clinica },
            { type: 'text', text: fecha   },
            { type: 'text', text: hora    },
          ]
        }]
      }
    }, { headers: headers(), timeout: 10000 });

    const messageId = res.data?.messages?.[0]?.id || null;
    console.log(`[WhatsApp] Template enviado a +${to} - ID: ${messageId}`);
    return { success: true, messageId };
  } catch (err) {
    const fullError = err.response?.data || err.message;
    const errorMsg  = err.response?.data?.error?.message || err.message;
    console.error(`[WhatsApp] Error template a +${to}:`, JSON.stringify(fullError));
    return { success: false, error: errorMsg };
  }
}

async function replyMessage(telefono, mensaje) {
  return sendMessage(telefono, mensaje);
}

module.exports = { sendMessage, sendTemplate, replyMessage };
