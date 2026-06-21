/**
 * DentalFlow — Scheduler de Recordatorios
 *
 * Usa node-cron para revisar cada minuto si hay citas que
 * necesiten recordatorio de 24h o 4h y dispararlos automaticamente.
 */

require('dotenv').config();
const cron   = require('node-cron');
const { db } = require('../db/database');
const { sendTemplate, sendConfirmTemplate, getWhatsAppCredentials } = require('./whatsapp');

const VENTANA_TOLERANCIA = 2; // minutos
const PERU_OFFSET_MS = -5 * 60 * 60 * 1000; // UTC-5

function toPeruTime(date) {
  return new Date(date.getTime() + PERU_OFFSET_MS);
}

// Recordatorio 24h: se envía a las 12:00 PM hora Perú del día anterior a la cita
function debeEnviar24h(fechaHoraInicio) {
  const ahoraPeru = toPeruTime(new Date());
  const citaPeru  = toPeruTime(new Date(fechaHoraInicio));

  const manana = new Date(ahoraPeru);
  manana.setDate(manana.getDate() + 1);
  if (citaPeru.toISOString().slice(0, 10) !== manana.toISOString().slice(0, 10)) return false;

  const minActual = ahoraPeru.getHours() * 60 + ahoraPeru.getMinutes();
  return Math.abs(minActual - 12 * 60) <= VENTANA_TOLERANCIA;
}

// Horario permitido para recordatorios (hora Perú): 7:00 AM a 8:00 PM.
const ENVIO_MIN = 7 * 60;   // 7:00 AM
const ENVIO_MAX = 20 * 60;  // 8:00 PM

// Recordatorio 4h: 4h antes en hora Perú, pero acotado al horario permitido
// para no molestar de madrugada. Ej: cita 9 AM → 7 AM (2h antes); cita 10 AM → 7 AM.
function debeEnviar4h(fechaHoraInicio) {
  const ahoraPeru = toPeruTime(new Date());
  const citaPeru  = toPeruTime(new Date(fechaHoraInicio));

  // La cita debe ser hoy en hora Perú
  if (ahoraPeru.toISOString().slice(0, 10) !== citaPeru.toISOString().slice(0, 10)) return false;

  const minActual = ahoraPeru.getHours() * 60 + ahoraPeru.getMinutes();
  const minCita   = citaPeru.getHours() * 60 + citaPeru.getMinutes();

  // 4h antes, recortado a [7:00 AM, 8:00 PM]
  let minEnvio = minCita - 240;
  if (minEnvio < ENVIO_MIN) minEnvio = ENVIO_MIN;
  if (minEnvio > ENVIO_MAX) minEnvio = ENVIO_MAX;

  return Math.abs(minActual - minEnvio) <= VENTANA_TOLERANCIA;
}

async function checkAndSendReminders() {
  const { knex } = require('../db/database');
  try {
    // Usar prefijo de fecha (YYYY-MM-DD) para comparación robusta sin depender de timezone
    // Buscamos citas en las próximas 26h y últimas 1h (ventana amplia para cubrir diferencias UTC/local)
    const hace1h  = new Date(Date.now() - 1  * 60 * 60 * 1000).toISOString().slice(0, 16);
    const en30h   = new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString().slice(0, 16);

    // Incluir user_id del appointment para propagarlo al message_log
    const citas = await knex('appointments as a')
      .join('patients as p', 'a.patient_id', 'p.id')
      .select('a.*', 'p.nombre as paciente_nombre', 'p.telefono as paciente_telefono', 'a.user_id')
      .where('a.estado', 'pendiente')
      .andWhere('a.fecha_hora_inicio', '>', hace1h)
      .andWhere('a.fecha_hora_inicio', '<', en30h)
      .andWhere(function() {
        this.where('a.recordatorio_24h_enviado', 0).orWhere('a.recordatorio_4h_enviado', 0);
      });

    if (citas.length === 0) return;

    for (const cita of citas) {
      if (!cita.recordatorio_24h_enviado && debeEnviar24h(cita.fecha_hora_inicio)) {
        // Marcar ANTES de enviar para evitar duplicados si el servicio reinicia
        await knex('appointments').where('id', cita.id).update({
          recordatorio_24h_enviado: 1,
          updated_at: knex.fn.now()
        });
        await enviarRecordatorio(cita, '24h');
      }

      if (!cita.recordatorio_4h_enviado && debeEnviar4h(cita.fecha_hora_inicio)) {
        await knex('appointments').where('id', cita.id).update({
          recordatorio_4h_enviado: 1,
          updated_at: knex.fn.now()
        });
        await enviarRecordatorio(cita, '4h');
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error en checkAndSendReminders:', err.message);
  }
}

async function enviarRecordatorio(cita, tipo) {
  console.log('[Scheduler] Enviando recordatorio ' + tipo + ' -> ' + cita.paciente_nombre + ' (' + cita.fecha_hora_inicio + ')');

  try {
    const d    = new Date(cita.fecha_hora_inicio);
    const fecha = d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
    const hora  = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

    const { db: dbInst } = require('../db/database');
    const clinicaSetting = await dbInst.prepare(`SELECT value FROM settings WHERE user_id = ? AND key = 'clinic_name'`).get(cita.user_id);
    const clinica = clinicaSetting?.value || 'nuestra clínica';

    // 24h → recordatorio_cita (recuerda la cita de mañana)
    // 4h  → confirmacion_cita (confirma la cita de hoy)
    // Usar credenciales de WhatsApp del usuario dueño de la cita (multi-tenant)
    const creds = await getWhatsAppCredentials(cita.user_id);

    let result;
    let templateUsado;
    if (tipo === '24h') {
      result = await sendTemplate(cita.paciente_telefono, { nombre: cita.paciente_nombre, clinica, fecha, hora }, creds);
      templateUsado = 'recordatorio_cita';
    } else {
      result = await sendConfirmTemplate(cita.paciente_telefono, { nombre: cita.paciente_nombre, clinica, hora }, creds);
      templateUsado = 'confirmacion_cita';
    }

    await db.prepare(`
      INSERT INTO message_log (appointment_id, patient_id, user_id, tipo, mensaje, enviado, error_detalle)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      cita.id,
      cita.patient_id,
      cita.user_id || null,
      'recordatorio_' + tipo,
      `[template:${templateUsado}] ${cita.paciente_nombre} | ${clinica} | ${fecha} ${hora}`,
      result.success ? 1 : 2,
      result.error || null
    );

    if (result.success) {
      console.log('[Scheduler] Recordatorio ' + tipo + ' (' + templateUsado + ') enviado a ' + cita.paciente_nombre);
    } else {
      console.error('[Scheduler] Fallo recordatorio ' + tipo + ': ' + result.error);
    }
  } catch (err) {
    console.error('[Scheduler] Error al enviar recordatorio ' + tipo + ' para cita #' + cita.id + ':', err.message);
  }
}

// ============================================================
// BACKUP AUTOMÁTICO — exporta datos críticos a JSON cada 6 horas
// ============================================================
async function runBackup() {
  const fs   = require('fs');
  const path = require('path');

  try {
    const { knex } = require('../db/database');
    const backupDir = path.join(__dirname, '../../backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const [patients, appointments, users, settings, proformas] = await Promise.all([
      knex('patients').select('*'),
      knex('appointments').select('*'),
      knex('users').select('id', 'username', 'role', 'email', 'clinic_id', 'created_at', 'last_login'),
      knex('settings').select('*'),
      knex.schema.hasTable('proformas').then(has => has ? knex('proformas').select('*') : []),
    ]);

    const payload = {
      exported_at: new Date().toISOString(),
      counts: { patients: patients.length, appointments: appointments.length, users: users.length },
      patients,
      appointments,
      users,
      settings,
      proformas,
    };

    const filename = `backup_${new Date().toISOString().slice(0,10)}.json`;
    const filepath = path.join(backupDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(payload, null, 2));

    // Conservar solo los últimos 10 backups
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .sort();
    if (files.length > 10) {
      files.slice(0, files.length - 10).forEach(f => {
        try { fs.unlinkSync(path.join(backupDir, f)); } catch (_) {}
      });
    }

    console.log(`[Backup] ✅ Backup guardado: ${filename} (${patients.length} pacientes, ${appointments.length} citas)`);
  } catch (err) {
    console.error('[Backup] ❌ Error en backup:', err.message);
  }
}

function startScheduler() {
  cron.schedule('* * * * *', () => {
    checkAndSendReminders();
  });

  // Backup automático cada 6 horas
  cron.schedule('0 */6 * * *', () => {
    runBackup();
  });

  console.log('[Scheduler] Scheduler de recordatorios iniciado (cada minuto)');
  console.log('[Scheduler] Backup automático configurado (cada 6 horas)');
  setTimeout(() => checkAndSendReminders(), 5000);
  setTimeout(() => runBackup(), 15000); // primer backup 15s después de arrancar
}

module.exports = { startScheduler, checkAndSendReminders, enviarRecordatorio };
