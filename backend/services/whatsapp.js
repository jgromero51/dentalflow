/**
 * DentalFlow - Servicio WhatsApp Cloud API (Meta)
 */

require('dotenv').config();
const axios = require('axios');

const DEMO_MODE      = process.env.DEMO_MODE === 'true';
const WA_TOKEN       = process.env.WHATSAPP_TOKEN;
const WA_PHONE_ID    = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WA_API_VERSION = 'v19.0';
const WA_API_BASE    = 'https://graph.facebook.com/' + WA_API_VERSION + '/' + WA_PHONE_ID + '/messages';

function normalizarTelefono(telefono) {
  var t = telefono.replace(/[\s\-()]/g, '').replace(/^\+/, '');
  if (/^9\d{8}$/.test(t)) { t = '51' + t; }
  return t;
}

async function sendMessage(telefono, mensaje) {
  const to = normalizarTelefono(telefono);

  if (DEMO_MODE || !WA_TOKEN || WA_TOKEN === 'EAAxxxxxxxxxx') {
    console.log('[WhatsApp Demo] Para: +' + to);
    console.log('[WhatsApp Demo] Mensaje: ' + mensaje);
    return { success: true, demo: true };
  }

  try {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'text',
      text: { preview_url: false, body: mensaje }
    };

    const response = await axios.post(WA_API_BASE, payload, {
      headers: {
        'Authorization': 'Bearer ' + WA_TOKEN,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const messageId = response.data && response.data.messages && response.data.messages[0] ? response.data.messages[0].id : null;
    console.log('[WhatsApp] Enviado a +' + to + ' - ID: ' + messageId);
    return { success: true, messageId: messageId };

  } catch (err) {
    const errorMsg = (err.response && err.response.data && err.response.data.error && err.response.data.error.message) || err.message;
    console.error('[WhatsApp] Error al enviar a +' + to + ': ' + errorMsg);
    return { success: false, error: errorMsg };
  }
}

async function replyMessage(telefono, mensaje) {
  return sendMessage(telefono, mensaje);
}

module.exports = { sendMessage: sendMessage, replyMessage: replyMessage };
