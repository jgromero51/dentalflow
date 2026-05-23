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
            { type: 'text', parameter_name: 'nombre',  text: nombre  },
            { type: 'text', parameter_name: 'clinica', text: clinica },
            { type: 'text', parameter_name: 'fecha',   text: fecha   },
            { type: 'text', parameter_name: 'hora',    text: hora    },
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

/**
 * Envía el template de confirmación de cita (4h antes)
 * Variables: {{1}}=nombre, {{2}}=clinica, {{3}}=hora
 */
async function sendConfirmTemplate(telefono, { nombre, clinica, hora }) {
  const to = normalizarTelefono(telefono);

  if (DEMO_MODE || !WA_TOKEN || WA_TOKEN === 'EAAxxxxxxxxxx') {
    console.log(`[WhatsApp Demo] Confirmación a +${to} | ${nombre} | ${clinica} | ${hora}`);
    return { success: true, demo: true };
  }

  try {
    const res = await axios.post(WA_API_BASE, {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: 'confirmacion_cita',
        language: { code: process.env.WA_TEMPLATE_LANG || 'es_PE' },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', text: nombre  },
            { type: 'text', text: clinica },
            { type: 'text', text: hora    },
          ]
        }]
      }
    }, { headers: headers(), timeout: 10000 });

    const messageId = res.data?.messages?.[0]?.id || null;
    console.log(`[WhatsApp] Confirmación enviada a +${to} - ID: ${messageId}`);
    return { success: true, messageId };
  } catch (err) {
    const fullError = err.response?.data || err.message;
    const errorMsg  = err.response?.data?.error?.message || err.message;
    console.error(`[WhatsApp] Error confirmación a +${to}:`, JSON.stringify(fullError));
    return { success: false, error: errorMsg };
  }
}

async function replyMessage(telefono, mensaje) {
  return sendMessage(telefono, mensaje);
}

/**
 * Sube un archivo a WhatsApp Media API y devuelve el media_id
 */
async function uploadMedia(buffer, filename, mimeType) {
  if (DEMO_MODE || !WA_TOKEN || WA_TOKEN === 'EAAxxxxxxxxxx') {
    return { success: true, mediaId: 'demo_media_id', demo: true };
  }
  try {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', buffer, { filename, contentType: mimeType });
    form.append('type', mimeType);
    form.append('messaging_product', 'whatsapp');

    const uploadUrl = `https://graph.facebook.com/v19.0/${WA_PHONE_ID}/media`;
    const res = await axios.post(uploadUrl, form, {
      headers: { 'Authorization': 'Bearer ' + WA_TOKEN, ...form.getHeaders() },
      timeout: 30000,
    });
    return { success: true, mediaId: res.data.id };
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error('[WhatsApp] Error upload media:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Envía un documento (PDF) ya subido a WhatsApp
 */
async function sendDocument(telefono, mediaId, filename, caption = '') {
  const to = normalizarTelefono(telefono);

  if (DEMO_MODE || !WA_TOKEN || WA_TOKEN === 'EAAxxxxxxxxxx') {
    console.log(`[WhatsApp Demo] Documento a +${to} | ${filename}`);
    return { success: true, demo: true };
  }

  try {
    const res = await axios.post(WA_API_BASE, {
      messaging_product: 'whatsapp',
      to,
      type: 'document',
      document: { id: mediaId, filename, caption },
    }, { headers: headers(), timeout: 15000 });

    const messageId = res.data?.messages?.[0]?.id || null;
    console.log(`[WhatsApp] Documento enviado a +${to} - ID: ${messageId}`);
    return { success: true, messageId };
  } catch (err) {
    const fullError = err.response?.data || err.message;
    const errorMsg  = err.response?.data?.error?.message || err.message;
    console.error(`[WhatsApp] Error documento a +${to}:`, JSON.stringify(fullError));
    return { success: false, error: errorMsg };
  }
}

/**
 * Envía el template de reactivación de paciente inactivo
 * Variables: {{nombre}}, {{clinica}}
 */
async function sendRecallTemplate(telefono, { nombre, clinica }) {
  const to = normalizarTelefono(telefono);

  if (DEMO_MODE || !WA_TOKEN || WA_TOKEN === 'EAAxxxxxxxxxx') {
    console.log(`[WhatsApp Demo] Recall a +${to} | ${nombre} | ${clinica}`);
    return { success: true, demo: true };
  }

  try {
    const res = await axios.post(WA_API_BASE, {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: 'reactivacion_paciente',
        language: { code: process.env.WA_TEMPLATE_LANG || 'es_PE' },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', parameter_name: 'nombre',  text: nombre  },
            { type: 'text', parameter_name: 'clinica', text: clinica },
          ]
        }]
      }
    }, { headers: headers(), timeout: 10000 });

    const messageId = res.data?.messages?.[0]?.id || null;
    console.log(`[WhatsApp] Recall enviado a +${to} - ID: ${messageId}`);
    return { success: true, messageId };
  } catch (err) {
    const fullError = err.response?.data || err.message;
    const errorMsg  = err.response?.data?.error?.message || err.message;
    console.error(`[WhatsApp] Error recall a +${to}:`, JSON.stringify(fullError));
    return { success: false, error: errorMsg };
  }
}

module.exports = { sendMessage, sendTemplate, sendConfirmTemplate, replyMessage, sendRecallTemplate, uploadMedia, sendDocument };
