/**
 * DentalFlow — Ruta: Webhook WhatsApp
 * 
 * Maneja mensajes entrantes de pacientes via WhatsApp Cloud API.
 * Clasifica la intención (confirmar/cancelar) con IA y actualiza el estado de la cita.
 */
const express = require('express');
const router  = express.Router();
const { db, getSettings, sqlNow } = require('../db/database');
const { processPatientResponse } = require('../services/ai');
const { sendMessage, getWhatsAppCredentials } = require('../services/whatsapp');

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
router.post('/', (req, res, next) => {
  // Verificar firma HMAC de Meta (X-Hub-Signature-256)
  const APP_SECRET = process.env.WHATSAPP_APP_SECRET;
  if (APP_SECRET) {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
      console.warn('[Webhook] ⚠️ Petición sin firma — rechazada');
      return res.sendStatus(403);
    }
    const crypto = require('crypto');
    const expected = 'sha256=' + crypto
      .createHmac('sha256', APP_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');
    if (signature !== expected) {
      console.warn('[Webhook] ⚠️ Firma inválida — posible petición falsificada');
      return res.sendStatus(403);
    }
  }
  next();
}, async (req, res) => {
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

      // Buscar al paciente por teléfono (varios formatos posibles)
      const telefonoFormateado = fromPhone.startsWith('+') ? fromPhone : `+${fromPhone}`;
      const sinPlus = fromPhone.replace(/^\+/, '');
      const patient = await db.prepare(
        `SELECT * FROM patients WHERE telefono = ? OR telefono = ? OR telefono = ? OR telefono LIKE ?`
      ).get(telefonoFormateado, sinPlus, fromPhone, `%${sinPlus.slice(-9)}`);

      if (!patient) {
        console.log(`[Webhook] Paciente no registrado: ${telefonoFormateado}`);
        const adminUser = await db.prepare(`SELECT id FROM users ORDER BY id ASC LIMIT 1`).get();
        if (adminUser) {
          const COOLDOWN_HORAS = 4;
          const corte = new Date(Date.now() - COOLDOWN_HORAS * 60 * 60 * 1000).toISOString();
          const yaEnviada = await db.prepare(`
            SELECT id FROM message_log
            WHERE tipo = 'bienvenida' AND mensaje LIKE ? AND created_at > ?
            LIMIT 1
          `).get(`%${sinPlus.slice(-9)}%`, corte);

          if (!yaEnviada) {
            const welcomeMsg = await buildWelcomeMessage(adminUser.id);
            const adminCreds = await getWhatsAppCredentials(adminUser.id);
            await sendMessage(telefonoFormateado, welcomeMsg, adminCreds);
            await db.prepare(`
              INSERT INTO message_log (user_id, tipo, mensaje, enviado)
              VALUES (?, 'bienvenida', ?, 1)
            `).run(adminUser.id, `[${telefonoFormateado}] ${welcomeMsg}`);
          } else {
            console.log(`[Webhook] Bienvenida ya enviada a ${telefonoFormateado} hace menos de ${COOLDOWN_HORAS}h — omitiendo`);
          }
        }
        continue;
      }

      // Determinar user_id: de la cita pendiente, o de la cita más reciente del paciente
      const appt = await db.prepare(`
        SELECT a.*, p.nombre as paciente_nombre
        FROM appointments a JOIN patients p ON p.id = a.patient_id
        WHERE a.patient_id = ?
          AND a.estado IN ('pendiente', 'confirmada')
          AND a.fecha_hora_inicio > ${sqlNow()}
        ORDER BY a.fecha_hora_inicio ASC LIMIT 1
      `).get(patient.id);

      let userId = appt?.user_id || null;
      if (!userId) {
        const lastAppt = await db.prepare(
          `SELECT user_id FROM appointments WHERE patient_id = ? ORDER BY created_at DESC LIMIT 1`
        ).get(patient.id);
        userId = lastAppt?.user_id || null;
      }
      // Fallback: asignar al primer usuario admin si no hay user_id
      if (!userId) {
        const adminUser = await db.prepare(`SELECT id FROM users ORDER BY id ASC LIMIT 1`).get();
        userId = adminUser?.id || 1;
      }

      // Guardar siempre el mensaje entrante
      await db.prepare(`
        INSERT INTO message_log (appointment_id, patient_id, user_id, tipo, mensaje, enviado)
        VALUES (?, ?, ?, 'respuesta_entrada', ?, 1)
      `).run(appt?.id || null, patient.id, userId, text);

      // Sin cita pendiente → responder con mensaje de bienvenida (máx 1 vez cada 4h)
      if (!appt) {
        const COOLDOWN_HORAS = 4;
        const corte = new Date(Date.now() - COOLDOWN_HORAS * 60 * 60 * 1000).toISOString();
        const enviada = await db.prepare(`
          SELECT id FROM message_log
          WHERE patient_id = ? AND tipo = 'bienvenida' AND created_at > ?
          LIMIT 1
        `).get(patient.id, corte);

        if (enviada) {
          console.log(`[Webhook] Bienvenida ya enviada hace menos de ${COOLDOWN_HORAS}h a ${patient.nombre} — omitiendo`);
          continue;
        }

        console.log(`[Webhook] Sin cita pendiente para ${patient.nombre} — enviando bienvenida`);
        const welcomeMsg = await buildWelcomeMessage(userId);
        const userCreds = await getWhatsAppCredentials(userId);
        await sendMessage(telefonoFormateado, welcomeMsg, userCreds);

        await db.prepare(`
          INSERT INTO message_log (patient_id, user_id, tipo, mensaje, enviado)
          VALUES (?, ?, 'bienvenida', ?, 1)
        `).run(patient.id, userId, welcomeMsg);
        continue;
      }

      // Credenciales del usuario dueño de la cita (multi-tenant)
      const userCreds = await getWhatsAppCredentials(userId);

      // Procesar respuesta con IA
      const { intencion, respuesta } = await processPatientResponse(text, appt);

      // Actualizar estado según intención
      if (intencion === 'confirmar') {
        await db.prepare("UPDATE appointments SET estado='confirmada', updated_at=${sqlNow()} WHERE id=?")
          .run(appt.id);
        console.log(`[Webhook] ✅ Cita #${appt.id} CONFIRMADA por ${patient.nombre}`);
        await notificarDoctor(appt, patient, 'confirmar');
      } else if (intencion === 'cancelar') {
        await db.prepare("UPDATE appointments SET estado='cancelada', updated_at=${sqlNow()} WHERE id=?")
          .run(appt.id);
        console.log(`[Webhook] ❌ Cita #${appt.id} CANCELADA por ${patient.nombre}`);
        await notificarDoctor(appt, patient, 'cancelar');
      } else {
        // Mensaje general: avisar que el doctor se contactará
        if (respuesta) {
          respuesta += '\n\nSi tenés alguna consulta adicional, el doctor se comunicará con vos en breve. 👨‍⚕️';
        }
      }

      // Enviar respuesta automática
      if (respuesta) {
        await sendMessage(telefonoFormateado, respuesta, userCreds);
        await db.prepare(`
          INSERT INTO message_log (appointment_id, patient_id, user_id, tipo, mensaje, enviado)
          VALUES (?, ?, ?, 'respuesta_salida', ?, 1)
        `).run(appt.id, patient.id, userId, respuesta);
      }
    }
  } catch (err) {
    console.error('[Webhook] Error procesando mensaje:', err.message);
  }
});

async function buildWelcomeMessage(userId) {
  try {
    const settings    = await getSettings(userId);
    const clinicName  = settings.clinic_name  || 'la clínica';
    const clinicHours = settings.clinic_hours || '';
    let msg = settings.clinic_welcome_msg || '';

    if (!msg) {
      msg = `Hola 👋 Gracias por escribirnos a *${clinicName}*.${clinicHours ? '\n🕐 Horario: ' + clinicHours : ''}\n\nSi tienes una cita programada, responde *SÍ* para confirmar o *NO* para cancelar. ¡Te atendemos pronto!`;
    } else {
      msg = msg
        .replace(/\{clinic_name\}/g, clinicName)
        .replace(/\{clinic_hours\}/g, clinicHours);
    }
    return msg;
  } catch (err) {
    return 'Hola 👋 Gracias por escribirnos. En breve te atenderemos.';
  }
}

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
