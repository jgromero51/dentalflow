/**
 * DentalFlow — Servicio de Inteligencia Artificial
 *
 * Usa OpenAI GPT-4o-mini para:
 * 1. Generar mensajes de recordatorio naturales y personalizados
 * 2. Clasificar la intención de respuestas de pacientes (confirmar/cancelar/otro)
 * 3. Generar respuestas automáticas cordiales
 *
 * Si no hay OPENAI_API_KEY, usa mensajes de plantilla como fallback.
 */

require('dotenv').config();
const { getSettings } = require('../db/database');

let openaiClient = null;

// Inicializar cliente OpenAI solo si hay API key
function getOpenAIClient() {
  if (!openaiClient && process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-...') {
    try {
      const OpenAI = require('openai');
      openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      console.log('[AI] ✅ OpenAI inicializado correctamente');
    } catch (err) {
      console.warn('[AI] ⚠️ No se pudo inicializar OpenAI:', err.message);
    }
  }
  return openaiClient;
}

/**
 * Transcribe audio con Whisper usando fetch nativo (Node 18+).
 * Evita el "Premature close" del agentkeepalive del SDK al subir multipart desde Render.
 */
async function transcribeAudio(buffer, ext) {
  const form = new FormData();
  form.append('file', new Blob([buffer]), `audio.${ext}`);
  form.append('model', 'whisper-1');
  form.append('language', 'es');

  const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });

  if (!resp.ok) {
    const detalle = await resp.text().catch(() => '');
    throw new Error(`Whisper ${resp.status}: ${detalle.slice(0, 200)}`);
  }
  const data = await resp.json();
  return (data.text || '').trim();
}

// ============================================================
// Helpers de formato de fecha
// ============================================================
function formatFecha(isoString) {
  const d = new Date(isoString);
  const dias   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const meses  = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${dias[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]}`;
}

function formatHora(isoString) {
  const d = new Date(isoString);
  const h = String(d.getHours()).padStart(2,'0');
  const m = String(d.getMinutes()).padStart(2,'0');
  return `${h}:${m} hs`;
}

// ============================================================
// FUNCIÓN 1: Generar mensaje de recordatorio
// ============================================================

/**
 * Genera un mensaje de recordatorio personalizado usando IA.
 * @param {Object} appointment - Objeto cita con paciente_nombre, fecha_hora_inicio, duracion_minutos, descripcion
 * @param {'24h'|'4h'} tipo - Tipo de recordatorio
 * @returns {Promise<string>} Mensaje listo para enviar por WhatsApp
 */
async function generateReminderMessage(appointment, tipo) {
  const settings   = await getSettings(appointment.user_id || null);
  const clinicName = settings.clinic_name || process.env.CLINIC_NAME || 'el consultorio odontológico';
  const nombre      = appointment.paciente_nombre;
  const fecha       = formatFecha(appointment.fecha_hora_inicio);
  const hora        = formatHora(appointment.fecha_hora_inicio);
  const duracion    = appointment.duracion_minutos;
  const tratamiento = appointment.descripcion || 'consulta odontológica';
  const tiempoTexto = tipo === '24h' ? 'mañana' : 'en 4 horas';

  const ai = getOpenAIClient();

  if (ai) {
    try {
      const prompt = `Eres el asistente virtual de ${clinicName}. 
Genera un mensaje de WhatsApp de recordatorio de cita para el paciente.

Datos:
- Nombre del paciente: ${nombre}
- Cita: ${tiempoTexto} (${fecha} a las ${hora})
- Duración aproximada: ${duracion} minutos
- Tratamiento/descripción: ${tratamiento}

Requisitos del mensaje:
- Máximo 3 párrafos cortos
- Tono: amigable, profesional y cálido
- Incluir fecha, hora y tipo de tratamiento
- Pedir confirmación al paciente (responder "SÍ" o "NO")
- Usar emojis con moderación (1-2 máximo)
- Idioma: español latinoamericano
- NO incluir saludos formales como "Estimado/a"
- NO mencionar el número de turno ni ID`;

      const response = await ai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.7,
      });

      const msg = response.choices[0].message.content.trim();
      console.log(`[AI] ✅ Mensaje ${tipo} generado para ${nombre}`);
      return msg;

    } catch (err) {
      console.warn(`[AI] ⚠️ Error con OpenAI, usando plantilla: ${err.message}`);
    }
  }

  // ---- Fallback: plantillas predefinidas ----
  return generateTemplateMessage(nombre, fecha, hora, tratamiento, tiempoTexto, clinicName);
}

function generateTemplateMessage(nombre, fecha, hora, tratamiento, tiempoTexto, clinicName) {
  const templates = {
    cerca: [
      `Hola ${nombre} 👋 Te recordamos que ${tiempoTexto} tenés turno en ${clinicName}.\n\n📅 ${fecha} a las ${hora}\n🦷 ${tratamiento}\n\nPor favor confirmá tu asistencia respondiendo *SÍ* o avisanos si no podés con *NO*. ¡Muchas gracias!`,
      `¡Hola ${nombre}! 😊 Te escribimos de ${clinicName} para recordarte tu turno:\n\n📆 ${fecha} — ${hora}\n💬 ${tratamiento}\n\n¿Confirmás? Respondé *SÍ* para confirmar o *NO* si necesitás cancelar.`,
    ]
  };
  const pool = templates.cerca;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ============================================================
// FUNCIÓN 2: Procesar respuesta del paciente
// ============================================================

/**
 * Analiza el texto de respuesta del paciente y determina su intención.
 * @param {string} texto - Mensaje recibido del paciente
 * @param {Object} appointment - Cita asociada
 * @returns {Promise<{intencion: 'confirmar'|'cancelar'|'otro', respuesta: string}>}
 */
async function processPatientResponse(texto, appointment) {
  const nombre = appointment.paciente_nombre;
  const fecha  = formatFecha(appointment.fecha_hora_inicio);
  const hora   = formatHora(appointment.fecha_hora_inicio);
  const ai     = getOpenAIClient();

  if (ai) {
    try {
      const prompt = `Eres el asistente de un consultorio odontológico.
Un paciente llamado "${nombre}" respondió un mensaje sobre su cita el ${fecha} a las ${hora}.

Mensaje del paciente: "${texto}"

Clasificá la intención del mensaje y generá una respuesta apropiada.

Respondé SOLO en formato JSON válido, sin markdown, sin explicaciones extra:
{
  "intencion": "confirmar" | "cancelar" | "otro",
  "respuesta": "mensaje de respuesta amigable en español (máx 2 oraciones)"
}

Reglas:
- "confirmar": si dice sí, ok, confirmo, ahí estaré, dale, perfecto, etc.
- "cancelar": si dice no, no puedo, cancelo, imposible, etc.
- "otro": preguntas, saludos, mensajes ambiguos
- La respuesta debe ser cálida y profesional`;

      const response = await ai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const parsed = JSON.parse(response.choices[0].message.content);
      console.log(`[AI] Respuesta clasificada: intención="${parsed.intencion}" para ${nombre}`);
      return parsed;

    } catch (err) {
      console.warn(`[AI] Error con OpenAI, usando clasificación simple: ${err.message}`);
    }
  }

  // ---- Fallback: clasificación por palabras clave ----
  return classifyByKeywords(texto.toLowerCase(), nombre, fecha, hora);
}

function classifyByKeywords(texto, nombre, fecha, hora) {
  const confirmar = ['sí','si','ok','dale','confirmo','confirmado','ahí estaré','ahi estare','perfecto','claro','por supuesto','voy'];
  const cancelar  = ['no','no puedo','cancelo','cancelar','no voy','imposible','no asisto'];

  if (confirmar.some(p => texto.includes(p))) {
    return {
      intencion: 'confirmar',
      respuesta: `¡Perfecto, ${nombre}! 😊 Tu turno del ${fecha} a las ${hora} está confirmado. ¡Te esperamos!`
    };
  }

  if (cancelar.some(p => texto.includes(p))) {
    return {
      intencion: 'cancelar',
      respuesta: `Entendemos, ${nombre}. Tu turno del ${fecha} quedó cancelado. Cuando quieras reagendar, escribinos y con gusto te buscamos un nuevo horario. 🦷`
    };
  }

  return {
    intencion: 'otro',
    respuesta: `Hola ${nombre}! Recibimos tu mensaje. Para confirmar o cancelar tu turno del ${fecha} a las ${hora}, respondé *SÍ* o *NO*. ¡Gracias!`
  };
}

// ============================================================
// FUNCIÓN 3: Resumen Clínico del Paciente
// ============================================================

/**
 * Genera un resumen clínico rápido basado en el historial del paciente.
 */
async function generatePatientSummary(patient, appointments, odontogramText) {
  const ai = getOpenAIClient();
  if (!ai) return "La Inteligencia Artificial no está configurada. Agrega tu API Key de OpenAI para usar esta función.";

  try {
    const citasInfo = appointments.map(a => 
      `- ${a.fecha_hora_inicio.split('T')[0]}: ${a.descripcion || 'Consulta'} (${a.estado})`
    ).join('\n');

    const prompt = `Eres un asistente clínico para un odontólogo.
Se te proporciona el historial reciente de un paciente. Tu tarea es escribir un resumen MUY BREVE (máximo 3-4 líneas) 
que el doctor pueda leer en 5 segundos antes de que el paciente entre al consultorio.

Paciente: ${patient.nombre}
Edad/Notas: ${patient.notas || 'Sin notas adicionales'}

Últimas citas:
${citasInfo || 'No tiene citas previas.'}

Estado del Odontograma (hallazgos):
${odontogramText || 'Sin hallazgos registrados.'}

Reglas del resumen:
- Mencionar por qué vino en sus últimas citas.
- Mencionar si tiene tendencia a cancelar o faltar.
- Mencionar hallazgos clave del odontograma si los hay.
- Tono clínico, profesional, muy directo.`;

    const response = await ai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.5,
    });

    return response.choices[0].message.content.trim();
  } catch (err) {
    console.error(`[AI] Error generando resumen para ${patient.nombre}:`, err.message);
    return "No se pudo generar el resumen en este momento debido a un error con el servicio de IA.";
  }
}

// ============================================================
// FUNCIÓN 4: Transcribir y Formatear Notas de Voz
// ============================================================

/**
 * Recibe un archivo de audio en Base64, lo transcribe con Whisper 
 * y le da formato médico estructurado con GPT-4o-mini.
 */
async function transcribeAndFormatVoiceNote(base64Audio, ext = 'webm') {
  const ai = getOpenAIClient();
  if (!ai) throw new Error("La IA no está configurada.");

  const buffer  = Buffer.from(base64Audio, 'base64');
  const safeExt = (ext || 'webm').replace(/[^a-z0-9]/gi, '') || 'webm';

  try {
    // 1. Transcribir audio
    const textoTranscripto = await transcribeAudio(buffer, safeExt);
    console.log('[AI] Audio transcripto:', textoTranscripto);

    if (!textoTranscripto || textoTranscripto.trim() === '') {
      return "No se pudo escuchar ningún dictado. Intenta hablar más cerca del micrófono.";
    }

    // 2. Formatear texto
    const prompt = `Eres un asistente de redacción médica para un odontólogo.
El odontólogo dictó la siguiente evolución clínica. 
Tu tarea es darle un formato profesional, conciso y estructurado (por ejemplo, separando por Motivo, Procedimiento, Medicación/Plan).
Corrige cualquier posible error de transcripción en términos odontológicos.
No agregues saludos ni introducciones, devuelve SOLO el texto final listo para pegar en la ficha del paciente.

Texto dictado: "${textoTranscripto}"`;

    const response = await ai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    return response.choices[0].message.content.trim();
  } catch (err) {
    console.error('[AI] Error en transcripción de voz:', err.message);
    throw new Error("Error en IA: " + err.message);
  }
}

// ============================================================
// FUNCIÓN 5: Generar items de proforma desde nota de voz
// ============================================================

/**
 * Transcribe un audio y devuelve items de proforma usando el catálogo de tratamientos.
 * @param {string} base64Audio
 * @param {string} ext
 * @param {Array<{nombre, categoria, precio}>} catalog
 * @returns {Promise<Array<{nombre, precio}>>}
 */
async function generateProformaFromVoice(base64Audio, ext, catalog) {
  const ai = getOpenAIClient();
  if (!ai) throw new Error('La IA no está configurada. Agregá tu API Key de OpenAI en Render.');

  const buffer  = Buffer.from(base64Audio, 'base64');
  const safeExt = (ext || 'webm').replace(/[^a-z0-9]/gi, '') || 'webm';

  const transcript = await transcribeAudio(buffer, safeExt);
  console.log('[AI] Proforma transcripta:', transcript);

  if (!transcript) throw new Error('No se pudo transcribir el audio.');

  const catalogText = catalog.length > 0
    ? catalog.map(t => `- ${t.nombre} (${t.categoria}): $${t.precio}`).join('\n')
    : 'Sin tratamientos en el catálogo.';

  const prompt = `Eres asistente de un consultorio dental. El doctor dictó los tratamientos para una proforma.

CATÁLOGO DE TRATAMIENTOS DE LA CLÍNICA:
${catalogText}

DICTADO DEL DOCTOR:
"${transcript}"

Tu tarea: identificar cada tratamiento mencionado en el dictado y asociarlo con el más similar del catálogo.
Si un tratamiento mencionado NO está en el catálogo, incluyelo igual con precio 0.

Respondé SOLO en JSON válido, sin markdown:
[
  {"nombre": "nombre exacto del catálogo o como lo dijo el doctor", "precio": numero},
  ...
]`;

  const response = await ai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 400,
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  let parsed;
  try {
    const content = response.choices[0].message.content;
    // La respuesta puede ser { items: [...] } o directamente [...]
    const obj = JSON.parse(content);
    parsed = Array.isArray(obj) ? obj : (obj.items || obj.tratamientos || Object.values(obj)[0] || []);
  } catch (e) {
    throw new Error('La IA devolvió un formato inesperado.');
  }

  return parsed;
}

// ============================================================
// FUNCIÓN 6: Generar items de proforma desde foto
// ============================================================

/**
 * Analiza una imagen (lista de precios manuscrita o impresa) y extrae
 * los tratamientos con sus precios.
 * @param {string} base64Image - Imagen en base64
 * @param {string} mimeType    - 'image/jpeg' | 'image/png' | 'image/webp'
 * @param {Array}  catalog     - Catálogo de tratamientos del doctor
 * @returns {Promise<Array<{nombre, precio}>>}
 */
async function generateProformaFromImage(base64Image, mimeType, catalog) {
  const ai = getOpenAIClient();
  if (!ai) throw new Error('La IA no está configurada. Agregá tu API Key de OpenAI en Render.');

  const catalogText = catalog.length > 0
    ? catalog.map(t => `- ${t.nombre} (${t.categoria}): S/ ${t.precio}`).join('\n')
    : 'Sin tratamientos en el catálogo.';

  const prompt = `Eres asistente de un consultorio odontológico. Se te envía una foto de una lista de tratamientos con precios (puede estar escrita a mano o impresa).

CATÁLOGO DE TRATAMIENTOS DE LA CLÍNICA (para comparar):
${catalogText}

Tu tarea:
1. Leer todos los tratamientos y precios que aparecen en la imagen.
2. Si un tratamiento de la imagen coincide con uno del catálogo, usar el nombre exacto del catálogo.
3. Si no coincide, usar el nombre como aparece en la imagen.
4. Extraer el precio numérico (solo el número, sin símbolo de moneda).

Respondé SOLO en JSON válido sin markdown:
[
  {"nombre": "nombre del tratamiento", "precio": 0},
  ...
]

Si no podés leer la imagen o no hay tratamientos visibles, devolvé: []`;

  const response = await ai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: 'high' } }
      ]
    }],
    max_tokens: 500,
    temperature: 0.1,
  });

  let parsed;
  try {
    const content = response.choices[0].message.content.trim()
      .replace(/```json/g, '').replace(/```/g, '').trim();
    const obj = JSON.parse(content);
    parsed = Array.isArray(obj) ? obj : (obj.items || obj.tratamientos || Object.values(obj)[0] || []);
  } catch (e) {
    throw new Error('La IA devolvió un formato inesperado.');
  }

  console.log(`[AI] Imagen procesada: ${parsed.length} tratamientos encontrados`);
  return parsed;
}

/**
 * Responde como asistente dental a cualquier mensaje libre del paciente.
 * NO puede recetar, diagnosticar ni dar indicaciones médicas.
 */
/**
 * Procesa mensaje libre del paciente.
 * Retorna { intencion, fecha_hora, respuesta }
 * intencion: 'agendar' | 'otro'
 * fecha_hora: 'YYYY-MM-DD HH:MM' si se detectó fecha completa, null si falta info
 */
async function chatWithPatient(texto, patientName, clinicName, apptInfo = null, historial = [], hoy = null) {
  const ai = getOpenAIClient();
  // Usar timezone de Peru (UTC-5) para calcular "hoy" y la hora actual correctamente
  const ahoraPeru = new Date(Date.now() - 5 * 60 * 60 * 1000);
  const fechaHoy = hoy || ahoraPeru.toISOString().slice(0, 10);
  const diaSemana = new Date(fechaHoy + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'long' });
  const horaPeru = ahoraPeru.toISOString().slice(11, 16); // HH:MM hora de Perú
  const horaActual = Number(horaPeru.slice(0, 2));
  const fueraDeHorario = horaActual >= 20 || horaActual < 7; // 8pm a 7am
  const contextoC = apptInfo
    ? `El paciente tiene una cita el ${formatFecha(apptInfo.fecha_hora_inicio)} a las ${formatHora(apptInfo.fecha_hora_inicio)}.`
    : 'El paciente no tiene cita programada actualmente.';

  if (ai) {
    try {
      const messages = [{
        role: 'system',
        content: `Sos el asistente de ${clinicName}, una clínica dental en Perú. Hoy es ${diaSemana} ${fechaHoy}, son las ${horaPeru} hora de Perú. El horario de atención es de 7:00 a 20:00 (7am a 8pm). ${contextoC}

Respondé SOLO en JSON válido con este formato exacto:
{"intencion":"agendar"|"otro","respuesta":"texto"}

Reglas:
- intencion="agendar" si el paciente quiere sacar turno/cita o preguntar disponibilidad de horarios.
- respuesta: máx 2 oraciones, cálida y natural como una recepcionista amable, sin saludar repetido, español latinoamericano.
- NUNCA recetes ni des diagnósticos. Ante dolor, mostrá empatía y decí que pueden atenderlo.
- NO menciones que sos un asistente virtual ni que no podés agendar.
${fueraDeHorario
  ? '- AHORA ESTÁS FUERA DEL HORARIO DE ATENCIÓN. Respondé con calidez, agradecé el mensaje y avisá amablemente que el horario de atención es de 7am a 8pm y que le responderán apenas se reinicie la atención.'
  : '- Estás dentro del horario de atención, respondé normalmente.'}`
      }];

      for (const h of historial) messages.push({ role: h.role, content: h.content });
      messages.push({ role: 'user', content: texto });

      const response = await ai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 200,
        temperature: 0.4,
        response_format: { type: 'json_object' },
      });

      const parsed = JSON.parse(response.choices[0].message.content);
      return {
        intencion: parsed.intencion || 'otro',
        respuesta: parsed.respuesta || ''
      };
    } catch (err) {
      console.warn('[AI] Error en chatWithPatient:', err.message);
    }
  }
  // Fallback sin IA: respetar el horario de atención (7am-8pm)
  const respuestaFallback = fueraDeHorario
    ? `¡Hola! Gracias por escribirnos a *${clinicName}*. 🦷 En este momento estamos fuera de horario. Nuestro horario de atención es de 7am a 8pm; te responderemos apenas reabramos.`
    : `Gracias por escribirnos a *${clinicName}*. En breve te atendemos. 🦷`;
  return { intencion: 'otro', respuesta: respuestaFallback };
}

module.exports = { generateReminderMessage, processPatientResponse, generatePatientSummary, transcribeAndFormatVoiceNote, generateProformaFromVoice, generateProformaFromImage, chatWithPatient };
