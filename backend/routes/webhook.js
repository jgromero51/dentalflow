/**
 * DentalFlow — Ruta: Webhook WhatsApp
 * 
 * Maneja mensajes entrantes de pacientes via WhatsApp Cloud API.
 * Clasifica la intención (confirmar/cancelar) con IA y actualiza el estado de la cita.
 */
const express = require('express');
const router  = express.Router();
const { db, getSettings } = require('../db/database');
const { processPatientResponse } = require('../services/ai');
const { sendMessage }            = require('../services/whatsapp');

// GET /api/webhook — Verificación inicial de Meta
router.get('/', async (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[Webhook] ✅ Verificación exitosa de Meta');
    return res.status(200).send(challenge);
  }
  console.warn('[Webhook] ⚠️ Verificación fallida. Token incorrecto.');
  res.sendStatus(403);
});

// POST /api/webhook — Mensajes entrantes de WhatsApp
router.post('/', async (req, res) => {
  // Responder 200 inmediatamente (requerido por Meta en < 20s)
  res.sendStatus(200);

  try {
    const body = req.body;

    // Estructura del payload de WhatsApp Cloud API
    if (body.object !== 'whatsapp_business_account') return;

    const entry   = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value   = changes?.value;

    // Solo procesar mensajes de texto entrantes
    const messages = value?.messages;
    if (!messages || messages.length === 0) return;

    for (const msg of messages) {
      if (msg.type !== 'text') continue;

      const fromPhone = msg.from; // número del paciente (sin +)
      const text      = msg.text.body.trim();

      console.log(`[Webhook] 📩 Mensaje de +${fromPhone}: "${text}"`);

      // Buscar al paciente por teléfono
      const telefonoFormateado = fromPhone.startsWith('+') ? fromPhone : `+${fromPhone}`;
      const patient = await db.prepare('SELECT * FROM patients WHERE telefono = ?').get(telefonoFormateado);

      if (!patient) {
        console.log(`[Webhook] Paciente no registrado: ${telefonoFormateado}`);
        continue;
      }

      // Buscar la próxima cita pendiente del paciente
      const appt = await db.prepare(`
        SELECT a.*, p.nombre as paciente_nombre
        FROM appointments a JOIN patients p ON p.id = a.patient_id
        WHERE a.patient_id = ?
          AND a.estado = 'pendiente'
          AND a.fecha_hora_inicio > datetime('now','localtime')
        ORDER BY a.fecha_hora_inicio ASC LIMIT 1
      `).get(patient.id);

      if (!appt) {
        console.log(`[Webhook] No hay citas pendientes para ${patient.nombre}`);
        continue;
      }

      // Procesar respuesta con IA
      const { intencion, respuesta } = await processPatientResponse(text, appt);

      // Actualizar estado según intención
      if (intencion === 'confirmar') {
        await db.prepare("UPDATE appointments SET estado='confirmada', updated_at=datetime('now','localtime') WHERE id=?")
          .run(appt.id);
        console.log(`[Webhook] ✅ Cita #${appt.id} CONFIRMADA por ${patient.nombre}`);
        await notificarDoctor(appt, patient, 'confirmar');
      } else if (intencion === 'cancelar') {
        await db.prepare("UPDATE appointments SET estado='cancelada', updated_at=datetime('now','localtime') WHERE id=?")
          .run(appt.id);
        console.log(`[Webhook] ❌ Cita #${appt.id} CANCELADA por ${patient.nombre}`);
        await notificarDoctor(appt, patient, 'cancelar');
      }

      // Guardar log del mensaje entrante
      await db.prepare(`
        INSERT INTO message_log (appointment_id, patient_id, tipo, mensaje, enviado)
        VALUES (?, ?, 'respuesta_entrada', ?, 1)
      `).run(appt.id, patient.id, text);

      // Enviar respuesta automática
      if (respuesta) {
        await sendMessage(telefonoFormateado, respuesta);
        await db.prepare(`
          INSERT INTO message_log (appointment_id, patient_id, tipo, mensaje, enviado)
          VALUES (?, ?, 'respuesta_salida', ?, 1)
        `).run(appt.id, patient.id, respuesta);
      }
    }
  } catch (err) {
    console.error('[Webhook] Error procesando mensaje:', err.message);
  }
});

async function notificarDoctor(appt, patient, accion) {
  try {
    const userId = appt.user_id;
    if (!userId) return;

    const settings = await getSettings(userId);
    const doctorPhone = settings.doctor_phone;
    if (!doctorPhone) {
      console.log('[Webhook] Sin doctor_phone configurado — omitiendo notificación al doctor');
      return;
    }

    const d = new Date(appt.fecha_hora_inicio);
    const fecha = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    const hora  = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');

    let mensaje;
    if (accion === 'confirmar') {
      mensaje = `✅ *Cita confirmada*\n\n👤 ${patient.nombre}\n📅 ${fecha} a las ${hora} hs\n\nEl paciente confirmó su asistencia.`;
    } else {
      mensaje = `❌ *Cita cancelada*\n\n👤 ${patient.nombre}\n📅 ${fecha} a las ${hora} hs\n\nEl paciente indicó que NO va a asistir.`;
    }

    await sendMessage(doctorPhone, mensaje);
    console.log(`[Webhook] Notificación al doctor enviada (${accion}) → ${doctorPhone}`);
  } catch (err) {
    console.error('[Webhook] Error al notificar al doctor:', err.message);
  }
}

module.exports = router;
