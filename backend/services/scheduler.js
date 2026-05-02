/**
 * DentalFlow — Scheduler de Recordatorios
 *
 * Usa node-cron para revisar cada minuto si hay citas que
 * necesiten recordatorio de 24h o 4h y dispararlos automáticamente.
 *
 * Lógica:
 * - Cada minuto: buscar citas con estado 'pendiente' cuya diferencia
 *   con "ahora" sea <= ventana de tiempo Y el recordatorio no fue enviado.
 * - Generar mensaje con IA → enviar por WhatsApp → marcar como enviado.
 */

require('dotenv').config();
const cron   = require('node-cron');
const { db } = require('../db/database');
const { generateReminderMessage } = require('./ai');
const { sendMessage }             = require('./whatsapp');

// Ventana de tolerancia: disparar recordatorio si faltan X minutos ± 2 min
const VENTANA_TOLERANCIA = 2; // minutos

/**
 * Calcula si una cita está dentro de la ventana de recordatorio.
 * @param {string} fechaHoraInicio - ISO string de la cita
 * @param {number} minutosAntes    - 1440 (24h) o 240 (4h)
 * @returns {boolean}
 */
function estaDentroVentana(fechaHoraInicio, minutosAntes) {
  const ahora     = new Date();
  const inicioCita = new Date(fechaHoraInicio);
  const diffMinutos = (inicioCita - ahora) / (1000 * 60);

  return diffMinutos >= (minutosAntes - VENTANA_TOLERANCIA) &&
         diffMinutos <= (minutosAntes + VENTANA_TOLERANCIA);
}

/**
 * Job principal: revisar y enviar recordatorios pendientes.
 */
async function checkAndSendReminders() {
  try {
    // Obtener citas pendientes en las próximas 25 horas
    const citas = db.prepare(`
      SELECT a.*, p.nombre as paciente_nombre, p.telefono as paciente_telefono
      FROM appointments a
      JOIN patients p ON p.id = a.patient_id
      WHERE a.estado = 'pendiente'
        AND a.fecha_hora_inicio > datetime('now', 'localtime')
        AND a.fecha_hora_inicio < datetime('now', 'localtime', '+25 hours')
        AND (a.recordatorio_24h_enviado = 0 OR a.recordatorio_4h_enviado = 0)
    `).all();

    if (citas.length === 0) return;

    for (const cita of citas) {
      // ---- Recordatorio 24 horas ----
      if (!cita.recordatorio_24h_enviado && estaDentroVentana(cita.fecha_hora_inicio, 1440)) {
        await enviarRecordatorio(cita, '24h');
        db.prepare("UPDATE appointments SET recordatorio_24h_enviado=1, updated_at=datetime('now','localtime') WHERE id=?")
          .run(cita.id);
      }

      // ---- Recordatorio 4 horas ----
      if (!cita.recordatorio_4h_enviado && estaDentroVentana(cita.fecha_hora_inicio, 240)) {
        await enviarRecordatorio(cita, '4h');
        db.prepare("UPDATE appointments SET recordatorio_4h_enviado=1, updated_at=datetime('now','localtime') WHERE id=?")
          .run(cita.id);
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error en checkAndSendReminders:', err.message);
  }
}

/**
 * Genera y envía un recordatorio para una cita.
 */
async function enviarRecordatorio(cita, tipo) {
  console.log(`[Scheduler] Enviando recordatorio ${tipo} → ${cita.paciente_nombre} (${cita.fecha_hora_inicio})`);

  try {
    // 1. Generar mensaje con IA
    const mensaje = await generateReminderMessage(cita, tipo);

    // 2. Enviar por WhatsApp
    const result = await sendMessage(cita.paciente_telefono, mensaje);

    // 3. Registrar en message_log
    db.prepare(`
      INSERT INTO message_log (appointment_id, patient_id, tipo, mensaje, enviado, error_detalle)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      cita.id,
      cita.patient_id,
      `recordatorio_${tipo}`,
      mensaje,
      result.success ? 1 : 2,
      result.error || null
    );

    if (result.success) {
      console.log(`[Scheduler] ✅ Recordatorio ${tipo} enviado a ${cita.paciente_nombre}`);
    } else {
      console.error(`[Scheduler] ❌ Fallo al enviar recordatorio ${tipo}: ${result.error}`);
    }
  } catch (err) {
    console.error(`[Scheduler] Error al enviar recordatorio ${tipo} para cita #${cita.id}:`, err.message);
  }
}

/**
 * Inicia el scheduler de cron jobs.
 * Se llama desde server.js al arrancar la aplicación.
 */
function startScheduler() {
  // Ejecutar cada minuto
  cron.schedule('* * * * *', () => {
    checkAndSendReminders();
  });

  console.log('[Scheduler] ⏰ Scheduler de recordatorios iniciado (cada minuto)');

  // Ejecutar una vez al arrancar para no esperar el primer minuto
  setTimeout(() => checkAndSendReminders(), 5000);
}

module.exports = { startScheduler, checkAndSendReminders, enviarRecordatorio };
