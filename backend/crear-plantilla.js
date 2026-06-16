/**
 * DentalFlow — Crea la plantilla de proformas en Meta vía API.
 *
 * Uso (desde la carpeta backend/, p.ej. en la Shell de Render):
 *   node crear-plantilla.js <WABA_ID> <APP_ID> [nombre] [idioma]
 *
 * Ejemplo:
 *   node crear-plantilla.js 123456789012345 987654321098765 envio_proforma es_PE
 *
 * - <WABA_ID>  = WhatsApp Business Account ID (Meta → WhatsApp Manager → Configuración de la cuenta).
 * - <APP_ID>   = ID de tu app de Meta (Meta for Developers → tu app → Configuración → Básica).
 * - El token de WhatsApp se lee de tus Ajustes (settings) automáticamente.
 *   Debe tener permiso `whatsapp_business_management` (token de System User), no solo de envío.
 */
require('dotenv').config();
const axios = require('axios');
const PDFDocument = require('pdfkit');
const { knex } = require('./db/database');

const WA_API = 'https://graph.facebook.com/v19.0';

const WABA_ID = process.argv[2] || process.env.WABA_ID;
const APP_ID  = process.argv[3] || process.env.META_APP_ID;
const NOMBRE  = process.argv[4] || 'envio_proforma';
const IDIOMA  = process.argv[5] || process.env.WA_TEMPLATE_LANG || 'es_PE';

const BODY_TEXT = 'Hola {{1}} 👋 Te enviamos tu presupuesto de tratamiento de {{2}}. Total: S/ {{3}}. Ante cualquier consulta, quedamos atentos.';

function samplePdf() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(20).text('Presupuesto de tratamiento', { align: 'center' });
    doc.moveDown().fontSize(12).text('Documento de ejemplo para la aprobación de la plantilla.');
    doc.end();
  });
}

async function getToken() {
  if (process.env.WHATSAPP_TOKEN) return process.env.WHATSAPP_TOKEN;
  const owner = await knex('users').orderBy('id', 'asc').first();
  if (!owner) throw new Error('No hay usuarios en la base.');
  const row = await knex('settings').where({ user_id: owner.id, key: 'whatsapp_token' }).first();
  if (!row?.value) throw new Error('No hay whatsapp_token configurado en Ajustes.');
  return row.value;
}

// Subida reanudable: devuelve el header_handle que pide la plantilla.
async function uploadSample(token, buffer) {
  const start = await axios.post(
    `${WA_API}/${APP_ID}/uploads`,
    null,
    {
      params: { file_name: 'proforma.pdf', file_length: buffer.length, file_type: 'application/pdf' },
      headers: { Authorization: `OAuth ${token}` },
    }
  );
  const sessionId = start.data.id; // "upload:..."

  const finish = await axios.post(
    `${WA_API}/${sessionId}`,
    buffer,
    {
      headers: { Authorization: `OAuth ${token}`, file_offset: 0, 'Content-Type': 'application/pdf' },
      maxBodyLength: Infinity,
    }
  );
  return finish.data.h; // header_handle
}

async function createTemplate(token, headerHandle) {
  const res = await axios.post(
    `${WA_API}/${WABA_ID}/message_templates`,
    {
      name: NOMBRE,
      language: IDIOMA,
      category: 'UTILITY',
      components: [
        { type: 'HEADER', format: 'DOCUMENT', example: { header_handle: [headerHandle] } },
        { type: 'BODY', text: BODY_TEXT, example: { body_text: [['Juan Pérez', 'Clínica Dental', '150.00']] } },
      ],
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return res.data;
}

(async () => {
  try {
    if (!WABA_ID || !APP_ID) {
      console.error('Faltan argumentos. Uso: node crear-plantilla.js <WABA_ID> <APP_ID> [nombre] [idioma]');
      process.exit(1);
    }
    console.log(`[Plantilla] Creando '${NOMBRE}' (${IDIOMA}) en WABA ${WABA_ID}...`);
    const token = await getToken();
    const pdf = await samplePdf();
    console.log(`[Plantilla] PDF de ejemplo generado (${pdf.length} bytes). Subiendo a Meta...`);
    const handle = await uploadSample(token, pdf);
    console.log('[Plantilla] PDF subido. Creando plantilla...');
    const result = await createTemplate(token, handle);
    console.log('[Plantilla] ✅ Creada:', JSON.stringify(result));
    console.log(`\n👉 Ahora poné "${NOMBRE}" en Ajustes → Plantilla de proformas, y guardá.`);
    process.exit(0);
  } catch (err) {
    const data = err.response?.data;
    console.error('[Plantilla] ❌ Error:', JSON.stringify(data || err.message, null, 2));
    process.exit(1);
  }
})();
