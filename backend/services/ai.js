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
  const settings   = getSettings();
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

  const os = require('os');
  const path = require('path');
  const fs = require('fs');
  
  // Guardamos el buffer en un archivo temporal porque el SDK lo requiere
  const buffer = Buffer.from(base64Audio, 'base64');
  const tempPath = path.join(os.tmpdir(), `voice_note_${Date.now()}.${ext.replace(/[^a-z0-9]/gi, '')}`);
  fs.writeFileSync(tempPath, buffer);

  try {
    // 1. Transcribir audio
    const transcription = await ai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
      language: 'es'
    });

    const textoTranscripto = transcription.text;
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
  } finally {
    // Limpiar archivo temporal
    try { fs.unlinkSync(tempPath); } catch (e) {}
  }
}

module.exports = { generateReminderMessage, processPatientResponse, generatePatientSummary, transcribeAndFormatVoiceNote };
