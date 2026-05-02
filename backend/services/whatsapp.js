/**
 * DentalFlow — Servicio WhatsApp
 *
 * Envía mensajes via WhatsApp Cloud API (Meta).
 * Si DEMO_MODE=true o no hay credenciales, imprime en consola (modo simulado).
 */

require('dotenv').config();
const axios = require('axios');

const DEMO_MODE       = process.env.DEMO_MODE === 'true';
const WA_TOKEN        = process.env.WHATSAPP_TOKEN;
const WA_PHONE_ID     = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WA_API_VERSION  = 'v19.0';
const WA_API_BASE     = `https://graph.facebook.com/${WA_API_VERSION}/${WA_PHONE_ID}/messages`;

/**
 * Envía un mensaje de texto por WhatsApp.
 * @param {string} telefono - Número en formato internacional: +5491112345678
 * @param {string} mensaje  - Texto del mensaje
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendMessage(telefono, mensaje) {
  // Normalizar número: quitar el "+" para la API de Meta
  const to = telefono.replace(/^\+/, '');

  // ---- MODO DEMO: solo imprime en consola ----
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

  // ---- MODO REAL: WhatsApp Cloud API ----
  try {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: mensaje,
      },
    };

    const response = await axios.post(WA_API_BASE, payload, {
      headers: {
        'Authorization': `Bearer ${WA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    const messageId = response.data?.messages?.[0]?.id;
    console.log(`[WhatsApp] ✅ Mensaje enviado a +${to} — ID: ${messageId}`);
    return { success: true, messageId };

  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error(`[WhatsApp] ❌ Error al enviar a +${to}: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Envía un mensaje de plantilla aprobada por Meta (para iniciar conversaciones).
 * Útil cuando han pasado más de 24h desde el último mensaje del paciente.
 * @param {string} telefono
 * @param {string} templateName  - Nombre de la plantilla aprobada en Meta
 * @param {string[]} components  - Parámetros de la plantilla
 */
async function sendTemplate(telefono, templateName, components = []) {
  const to = telefono.replace(/^\+/, '');

  if (DEMO_MODE || !WA_TOKEN || WA_TOKEN === 'EAAxxxxxxxxxx') {
    console.log(`[WhatsApp Demo] Template "${templateName}" → +${to}`);
    return { success: true, demo: true };
  }

  try {
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'es_AR' },
        components,
      },
    };

    const response = await axios.post(WA_API_BASE, payload, {
      headers: { 'Authorization': `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    return { success: true, messageId: response.data?.messages?.[0]?.id };
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error(`[WhatsApp] Error en template: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

module.exports = { sendMessage, sendTemplate };
