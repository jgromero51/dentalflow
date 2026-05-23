/**
 * DentalFlow — Servicio WhatsApp Cloud API (Meta)
 *
 * Soporta credenciales por usuario:
 *   - Si se pasan { token, phoneId } → usa esas credenciales (multi-tenant).
 *   - Si no → usa las variables de entorno globales (fallback / demo).
 */

require('dotenv').config();
const axios = require('axios');
const { getSettings } = require('../db/database');

const DEMO_MODE      = process.env.DEMO_MODE === 'true';
const WA_API_VERSION = 'v19.0';

// ── Helpers internos ─────────────────────────────────────────────────────────

function normalizarTelefono(telefono) {
  let t = telefono.replace(/[\s\-()]/g, '').replace(/^\+/, '');
  if (/^9\d{8}$/.test(t)) t = '51' + t;
  return t;
}

/**
 * Devuelve { token, phoneId } para usar en las llamadas a la API.
 * Prioridad: creds pasadas → settings del userId → env vars globales.
 */
async function resolveCredentials(creds = null, userId = null) {
  if (creds && creds.token && creds.phoneId) return creds;

  if (userId) {
    try {
      const settings = await getSettings(userId);
      const token   = settings.whatsapp_token;
      const phoneId = settings.whatsapp_phone_id;
      if (token && phoneId) return { token, phoneId };
    } catch (_) {}
  }

  return {
    token:   process.env.WHATSAPP_TOKEN,
    phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  };
}

function buildApiBase(phoneId) {
  return `https://graph.facebook.com/${WA_API_VERSION}/${phoneId}/messages`;
}

function authHeaders(token) {
  return { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
}

function isDemo(token) {
  return DEMO_MODE || !token || token === 'EAAxxxxxxxxxx';
}

// ── Obtener credenciales de WhatsApp de un usuario (exportado) ────────────────

/**
 * Devuelve las credenciales de WhatsApp de un usuario desde sus settings.
 * Útil para el scheduler y el webhook.
 */
async function getWhatsAppCredentials(userId) {
  return resolveCredentials(null, userId);
}

// ── Funciones públicas ────────────────────────────────────────────────────────

/**
 * Envía mensaje de texto libre.
 * @param {string} telefono
 * @param {string} mensaje
 * @param {object|null} creds  { token, phoneId } — opcional, para multi-tenant
 */
async function sendMessage(telefono, mensaje, creds = null) {
  const { token, phoneId } = creds || await resolveCredentials(null, null);
  const to = normalizarTelefono(telefono);

  if (isDemo(token)) {
    console.log(`[WhatsApp Demo] Texto a +${to} | ${mensaje.substring(0, 60)}...`);
    return { success: true, demo: true };
  }

  try {
    const res = await axios.post(buildApiBase(phoneId), {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: mensaje },
    }, { headers: authHeaders(token), timeout: 10000 });

    const messageId = res.data?.messages?.[0]?.id || null;
    console.log(`[WhatsApp] Texto enviado a +${to} - ID: ${messageId}`);
    return { success: true, messageId };
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error(`[WhatsApp] Error texto a +${to}: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Template: recordatorio_cita (24h antes)
 * Variables: nombre, clinica, fecha, hora
 */
async function sendTemplate(telefono, { nombre, clinica, fecha, hora }, creds = null) {
  const { token, phoneId } = creds || await resolveCredentials(null, null);
  const to = normalizarTelefono(telefono);

  if (isDemo(token)) {
    console.log(`[WhatsApp Demo] Template recordatorio a +${to} | ${nombre}`);
    return { success: true, demo: true };
  }

  try {
    const res = await axios.post(buildApiBase(phoneId), {
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
          ],
        }],
      },
    }, { headers: authHeaders(token), timeout: 10000 });

    const messageId = res.data?.messages?.[0]?.id || null;
    console.log(`[WhatsApp] Template recordatorio enviado a +${to} - ID: ${messageId}`);
    return { success: true, messageId };
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error(`[WhatsApp] Error template a +${to}:`, JSON.stringify(err.response?.data || err.message));
    return { success: false, error: errorMsg };
  }
}

/**
 * Template: confirmacion_cita (4h antes)
 * Variables: nombre, clinica, hora
 */
async function sendConfirmTemplate(telefono, { nombre, clinica, hora }, creds = null) {
  const { token, phoneId } = creds || await resolveCredentials(null, null);
  const to = normalizarTelefono(telefono);

  if (isDemo(token)) {
    console.log(`[WhatsApp Demo] Template confirmación a +${to} | ${nombre}`);
    return { success: true, demo: true };
  }

  try {
    const res = await axios.post(buildApiBase(phoneId), {
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
          ],
        }],
      },
    }, { headers: authHeaders(token), timeout: 10000 });

    const messageId = res.data?.messages?.[0]?.id || null;
    console.log(`[WhatsApp] Confirmación enviada a +${to} - ID: ${messageId}`);
    return { success: true, messageId };
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error(`[WhatsApp] Error confirmación a +${to}:`, JSON.stringify(err.response?.data || err.message));
    return { success: false, error: errorMsg };
  }
}

/**
 * Template: reactivacion_paciente (recall)
 * Variables: nombre, clinica
 */
async function sendRecallTemplate(telefono, { nombre, clinica }, creds = null) {
  const { token, phoneId } = creds || await resolveCredentials(null, null);
  const to = normalizarTelefono(telefono);

  if (isDemo(token)) {
    console.log(`[WhatsApp Demo] Recall a +${to} | ${nombre}`);
    return { success: true, demo: true };
  }

  try {
    const res = await axios.post(buildApiBase(phoneId), {
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
          ],
        }],
      },
    }, { headers: authHeaders(token), timeout: 10000 });

    const messageId = res.data?.messages?.[0]?.id || null;
    console.log(`[WhatsApp] Recall enviado a +${to} - ID: ${messageId}`);
    return { success: true, messageId };
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error(`[WhatsApp] Error recall a +${to}:`, JSON.stringify(err.response?.data || err.message));
    return { success: false, error: errorMsg };
  }
}

/**
 * Sube un archivo a WhatsApp Media API → devuelve mediaId
 */
async function uploadMedia(buffer, filename, mimeType, creds = null) {
  const { token, phoneId } = creds || await resolveCredentials(null, null);

  if (isDemo(token)) {
    return { success: true, mediaId: 'demo_media_id', demo: true };
  }

  try {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', buffer, { filename, contentType: mimeType });
    form.append('type', mimeType);
    form.append('messaging_product', 'whatsapp');

    const uploadUrl = `https://graph.facebook.com/${WA_API_VERSION}/${phoneId}/media`;
    const res = await axios.post(uploadUrl, form, {
      headers: { Authorization: 'Bearer ' + token, ...form.getHeaders() },
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
 * Envía un documento (PDF) previamente subido a WhatsApp Media API
 */
async function sendDocument(telefono, mediaId, filename, caption = '', creds = null) {
  const { token, phoneId } = creds || await resolveCredentials(null, null);
  const to = normalizarTelefono(telefono);

  if (isDemo(token)) {
    console.log(`[WhatsApp Demo] Documento a +${to} | ${filename}`);
    return { success: true, demo: true };
  }

  try {
    const res = await axios.post(buildApiBase(phoneId), {
      messaging_product: 'whatsapp',
      to,
      type: 'document',
      document: { id: mediaId, filename, caption },
    }, { headers: authHeaders(token), timeout: 15000 });

    const messageId = res.data?.messages?.[0]?.id || null;
    console.log(`[WhatsApp] Documento enviado a +${to} - ID: ${messageId}`);
    return { success: true, messageId };
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error(`[WhatsApp] Error documento a +${to}:`, JSON.stringify(err.response?.data || err.message));
    return { success: false, error: errorMsg };
  }
}

async function replyMessage(telefono, mensaje, creds = null) {
  return sendMessage(telefono, mensaje, creds);
}

module.exports = {
  sendMessage,
  sendTemplate,
  sendConfirmTemplate,
  sendRecallTemplate,
  uploadMedia,
  sendDocument,
  replyMessage,
  getWhatsAppCredentials,
};
