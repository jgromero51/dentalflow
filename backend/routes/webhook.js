/**
 * DentalFlow — Ruta: Webhook WhatsApp
 * 
 * Maneja mensajes entrantes de pacientes via WhatsApp Cloud API.
 * Clasifica la intención (confirmar/cancelar) con IA y actualiza el estado de la cita.
 */
const express = require('express');
const router  = express.Router();
const { db, getSettings, sqlNow, sqlColGtNow } = require('../db/database');
const { processPatientResponse, chatWithPatient } = require('../services/ai');
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
      .update(req.rawBody || Buffer.from(JSON.stringify(req.body)))
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

    // Estados de entrega que envía Meta (sent/delivered/read/failed).
    // Sirve para saber si un mensaje realmente llegó o falló (p.ej. fuera de la ventana de 24h).
    const statuses = value?.statuses;
    if (statuses && statuses.length) {
      for (const st of statuses) {
        if (st.status === 'failed') {
          const e = st.errors?.[0] || {};
          console.error(`[Webhook] ❌ Mensaje a +${st.recipient_id} NO ENTREGADO — ${e.title || ''} (code ${e.code}) ${e.error_data?.details || ''}`);
        } else {
          console.log(`[Webhook] 📬 Estado a +${st.recipient_id}: ${st.status}`);
        }
      }
      return;
    }

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

      // Dueño de la conversación: el usuario que le mandó el último mensaje a este teléfono.
      // El paciente responde a quien le escribió, así que la notificación debe ir a ese usuario.
      // (Resuelve el caso de teléfono duplicado entre usuarios distintos.)
      const lastOutbound = await db.prepare(`
        SELECT m.user_id
        FROM message_log m JOIN patients p ON p.id = m.patient_id
        WHERE (p.telefono = ? OR p.telefono = ? OR p.telefono = ? OR p.telefono LIKE ?)
          AND m.tipo != 'respuesta_entrada' AND m.user_id IS NOT NULL
        ORDER BY m.created_at DESC LIMIT 1
      `).get(telefonoFormateado, sinPlus, fromPhone, `%${sinPlus.slice(-9)}`);
      const ownerId = lastOutbound?.user_id || null;

      // Si el teléfono está duplicado entre usuarios, preferir el registro del dueño de la conversación
      const patient = await db.prepare(
        `SELECT * FROM patients WHERE telefono = ? OR telefono = ? OR telefono = ? OR telefono LIKE ?
         ORDER BY CASE WHEN user_id = ? THEN 0 ELSE 1 END, id ASC LIMIT 1`
      ).get(telefonoFormateado, sinPlus, fromPhone, `%${sinPlus.slice(-9)}`, ownerId);

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

      // Buscar la cita activa por TELÉFONO (no por un solo patient.id): así se encuentra
      // aunque el paciente esté duplicado o el teléfono guardado difiera en el código de país.
      const appt = await db.prepare(`
        SELECT a.*, p.nombre as paciente_nombre
        FROM appointments a JOIN patients p ON p.id = a.patient_id
        WHERE (p.telefono = ? OR p.telefono = ? OR p.telefono = ? OR p.telefono LIKE ?)
          AND a.estado IN ('pendiente', 'confirmada')
          AND ${sqlColGtNow('a.fecha_hora_inicio', 6)}
        ORDER BY a.fecha_hora_inicio ASC LIMIT 1
      `).get(telefonoFormateado, sinPlus, fromPhone, `%${sinPlus.slice(-9)}`);

      // Prioridad: dueño de la conversación → cita activa → última cita → primer admin
      let userId = ownerId || appt?.user_id || null;
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

      // Si hay cooldown de agendar activo (2h), no responder
      const corteAgendar = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const enCooldown = await db.prepare(`
        SELECT id FROM message_log
        WHERE patient_id = ? AND tipo = 'agendar_cooldown' AND created_at > ?
        LIMIT 1
      `).get(patient.id, corteAgendar);
      if (enCooldown) {
        console.log(`[Webhook] ⏸ Cooldown agendar activo para ${patient.nombre} — secretaria atiende`);
        continue;
      }

      // Guardar siempre el mensaje entrante
      await db.prepare(`
        INSERT INTO message_log (appointment_id, patient_id, user_id, tipo, mensaje, enviado)
        VALUES (?, ?, ?, 'respuesta_entrada', ?, 1)
      `).run(appt?.id || null, patient.id, userId, text);

      // Sin cita pendiente → responder con IA siempre
      if (!appt) {
        const settings = await getSettings(userId);
        const clinicName = settings.clinic_name || 'la clínica';
        const userCreds = await getWhatsAppCredentials(userId);
        const historial = await getHistorial(patient.id);
        const aiRes = await chatWithPatient(text, patient.nombre, clinicName, null, historial);

        let respuestaFinal = aiRes.respuesta;

        // Si quiere agendar → mensaje fijo + cooldown 2h (la secretaria lo atiende)
        if (aiRes.intencion === 'agendar') {
          const settings = await getSettings(userId);
          const clinicName = settings.clinic_name || 'la clínica';
          respuestaFinal = `¡Perfecto! En breve te enviamos los horarios disponibles. 📅`;
          await sendMessage(telefonoFormateado, respuestaFinal, userCreds);
          await db.prepare(`INSERT INTO message_log (patient_id, user_id, tipo, mensaje, enviado) VALUES (?, ?, 'agendar_cooldown', ?, 1)`).run(patient.id, userId, respuestaFinal);
          continue;
        }

        await sendMessage(telefonoFormateado, respuestaFinal, userCreds);
        await db.prepare(`INSERT INTO message_log (patient_id, user_id, tipo, mensaje, enviado) VALUES (?, ?, 'respuesta_salida', ?, 1)`).run(patient.id, userId, respuestaFinal);
        continue;
      }

      // Credenciales del usuario dueño de la cita (multi-tenant)
      const userCreds = await getWhatsAppCredentials(userId);

      // Procesar respuesta con IA
      const aiResult  = await processPatientResponse(text, appt);
      const intencion = aiResult.intencion;
      let respuesta   = aiResult.respuesta;

      // Actualizar estado según intención
      if (intencion === 'confirmar') {
        await db.prepare(`UPDATE appointments SET estado='confirmada', updated_at=${sqlNow()} WHERE id=?`)
          .run(appt.id);
        console.log(`[Webhook] ✅ Cita #${appt.id} CONFIRMADA por ${patient.nombre}`);
        await notificarDoctor(appt, patient, 'confirmar');
      } else if (intencion === 'cancelar') {
        await db.prepare(`UPDATE appointments SET estado='cancelada', updated_at=${sqlNow()} WHERE id=?`)
          .run(appt.id);
        console.log(`[Webhook] ❌ Cita #${appt.id} CANCELADA por ${patient.nombre}`);
        await notificarDoctor(appt, patient, 'cancelar');
      } else {
        // Mensaje general: responder con IA
        const settings = await getSettings(userId);
        const clinicName = settings.clinic_name || 'la clínica';
        const historial = await getHistorial(patient.id);
        const aiRes = await chatWithPatient(text, patient.paciente_nombre || patient.nombre, clinicName, appt, historial);
        if (aiRes.intencion === 'agendar') {
          respuesta = `¡Perfecto! En breve te enviamos los horarios disponibles. 📅`;
          await sendMessage(telefonoFormateado, respuesta, userCreds);
          await db.prepare(`INSERT INTO message_log (appointment_id, patient_id, user_id, tipo, mensaje, enviado) VALUES (?, ?, ?, 'agendar_cooldown', ?, 1)`).run(appt.id, patient.id, userId, respuesta);
          continue;
        }
        respuesta = aiRes.respuesta;
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

async function crearCitaDesdeChat(patient, userId, fechaHora, dbConn) {
  try {
    const duracion = 30;
    const inicio = new Date(fechaHora);
    const fin    = new Date(inicio.getTime() + duracion * 60000);

    // Verificar conflicto de horario con cualquier cita existente
    const conflicto = await dbConn.prepare(`
      SELECT p.nombre as paciente_nombre FROM appointments a
      JOIN patients p ON p.id = a.patient_id
      WHERE a.user_id = ? AND a.estado NOT IN ('cancelada','no_asistio')
        AND a.patient_id != ?
        AND datetime(a.fecha_hora_inicio) < datetime(?)
        AND datetime(a.fecha_hora_inicio, '+' || a.duracion_minutos || ' minutes') > datetime(?)
      LIMIT 1
    `).get(userId, patient.id, fin.toISOString(), inicio.toISOString());

    if (conflicto) {
      console.log(`[Webhook] ⚠️ Conflicto de horario para ${patient.nombre} @ ${fechaHora}`);
      return { ok: false, motivo: 'conflicto' };
    }

    // Cancelar citas previas de WhatsApp del mismo paciente (pendiente o confirmada)
    await dbConn.prepare(`
      UPDATE appointments SET estado='cancelada'
      WHERE patient_id = ? AND user_id = ? AND estado IN ('pendiente','confirmada') AND descripcion='Cita agendada por WhatsApp'
    `).run(patient.id, userId);

    await dbConn.prepare(`
      INSERT INTO appointments (patient_id, user_id, fecha_hora_inicio, duracion_minutos, descripcion, estado)
      VALUES (?, ?, ?, ?, 'Cita agendada por WhatsApp', 'pendiente')
    `).run(patient.id, userId, fechaHora, duracion);

    console.log(`[Webhook] 📅 Cita creada desde chat para ${patient.nombre} @ ${fechaHora}`);
    return { ok: true };
  } catch (err) {
    console.error('[Webhook] Error al crear cita desde chat:', err.message);
    return { ok: false, motivo: 'error' };
  }
}

async function getHistorial(patientId) {
  try {
    const rows = await db.prepare(`
      SELECT tipo, mensaje FROM message_log
      WHERE patient_id = ? AND tipo IN ('respuesta_entrada','respuesta_salida')
      ORDER BY created_at DESC LIMIT 10
    `).all(patientId);
    // Invertir para orden cronológico y mapear a roles
    return rows.reverse().map(r => ({
      role: r.tipo === 'respuesta_entrada' ? 'user' : 'assistant',
      content: r.mensaje
    }));
  } catch { return []; }
}

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

    const creds = await getWhatsAppCredentials(userId);
    await sendMessage(doctorPhone, mensaje, creds);
    console.log(`[Webhook] Notificación al doctor enviada (${accion}) → ${doctorPhone}`);
  } catch (err) {
    console.error('[Webhook] Error al notificar al doctor:', err.message);
  }
}

module.exports = router;
