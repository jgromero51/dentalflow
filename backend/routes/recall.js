/**
 * DentalFlow — Ruta: Recall de Pacientes Inactivos
 *
 * Identifica pacientes sin citas en N días y envía
 * el template de reactivación por WhatsApp.
 */

const express = require('express');
const router  = express.Router();
const { knex, db } = require('../db/database');
const { sendRecallTemplate } = require('../services/whatsapp');

const DIAS_INACTIVIDAD_DEFAULT = 90;
const DIAS_ENTRE_RECALL_DEFAULT = 30;

/**
 * Construye la query de pacientes candidatos a recall:
 * - Su última cita fue hace >= diasInactividad días
 * - No tienen citas futuras pendientes/confirmadas
 * - No recibieron recall en los últimos diasEntreRecall días (o nunca)
 */
function buildCandidatesQuery(userId, diasInactividad, diasEntreRecall) {
  const ahora = new Date();
  const corteInactividad = new Date(ahora - diasInactividad * 24 * 60 * 60 * 1000).toISOString();
  const corteRecall = new Date(ahora - diasEntreRecall * 24 * 60 * 60 * 1000).toISOString();

  return knex('patients as p')
    .select(
      'p.id', 'p.nombre', 'p.telefono', 'p.recall_enviado_at',
      knex.raw('MAX(a.fecha_hora_inicio) as ultima_cita')
    )
    .leftJoin('appointments as a', function() {
      this.on('a.patient_id', '=', 'p.id')
          .andOnNotIn('a.estado', ['cancelada']);
    })
    .where('p.user_id', userId)
    // Sin citas futuras pendientes/confirmadas (en WHERE, compatible SQLite/PG)
    .whereNotExists(function() {
      this.select(knex.raw('1')).from('appointments as fut')
        .whereRaw('fut.patient_id = p.id')
        .where('fut.fecha_hora_inicio', '>', ahora.toISOString())
        .whereIn('fut.estado', ['pendiente', 'confirmada']);
    })
    // No recibió recall recientemente (o nunca)
    .whereRaw('(p.recall_enviado_at IS NULL OR p.recall_enviado_at < ?)', [corteRecall])
    .groupBy('p.id')
    // Última cita hace más de N días (o sin citas). En HAVING va la expresión
    // agregada, no el alias (PostgreSQL no acepta alias en HAVING).
    .havingRaw('(MAX(a.fecha_hora_inicio) < ? OR MAX(a.fecha_hora_inicio) IS NULL)', [corteInactividad])
    .orderBy('ultima_cita', 'asc');
}

// GET /api/recall/candidates?dias_inactividad=90&dias_entre_recall=30
router.get('/candidates', async (req, res) => {
  try {
    const uid = req.user.id;
    const diasInactividad = parseInt(req.query.dias_inactividad) || DIAS_INACTIVIDAD_DEFAULT;
    const diasEntreRecall  = parseInt(req.query.dias_entre_recall)  || DIAS_ENTRE_RECALL_DEFAULT;

    const candidates = await buildCandidatesQuery(uid, diasInactividad, diasEntreRecall);

    res.json({
      data: candidates,
      total: candidates.length,
      config: { diasInactividad, diasEntreRecall }
    });
  } catch (err) {
    console.error('[Recall] Error candidatos:', err.message);
    res.status(500).json({ error: 'Error al obtener candidatos de recall' });
  }
});

// POST /api/recall/send — envía a todos los candidatos
router.post('/send', async (req, res) => {
  try {
    const uid = req.user.id;
    const diasInactividad = parseInt(req.body.dias_inactividad) || DIAS_INACTIVIDAD_DEFAULT;
    const diasEntreRecall  = parseInt(req.body.dias_entre_recall)  || DIAS_ENTRE_RECALL_DEFAULT;

    const clinicaSetting = await db.prepare(`SELECT value FROM settings WHERE user_id = ? AND key = 'clinic_name'`).get(uid);
    const clinica = clinicaSetting?.value || 'nuestra clínica';

    const candidates = await buildCandidatesQuery(uid, diasInactividad, diasEntreRecall);

    if (candidates.length === 0) {
      return res.json({ message: 'No hay pacientes candidatos para recall', enviados: 0, errores: 0 });
    }

    let enviados = 0;
    let errores  = 0;
    const ahora  = new Date().toISOString();

    for (const p of candidates) {
      const result = await sendRecallTemplate(p.telefono, { nombre: p.nombre, clinica });

      await db.prepare(`
        INSERT INTO message_log (patient_id, user_id, tipo, mensaje, enviado, error_detalle)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        p.id, uid,
        'recall',
        `[template:reactivacion_paciente] ${p.nombre} | ${clinica}`,
        result.success ? 1 : 2,
        result.error || null
      );

      if (result.success) {
        await knex('patients').where('id', p.id).update({ recall_enviado_at: ahora });
        enviados++;
      } else {
        errores++;
      }
    }

    res.json({ message: `Recall enviado: ${enviados} exitosos, ${errores} errores`, enviados, errores });
  } catch (err) {
    console.error('[Recall] Error send:', err.message);
    res.status(500).json({ error: 'Error al enviar recall' });
  }
});

// POST /api/recall/send/:id — envía a un paciente específico
router.post('/send/:id', async (req, res) => {
  try {
    const uid = req.user.id;
    const patient = await db.prepare('SELECT * FROM patients WHERE id = ? AND user_id = ?').get(req.params.id, uid);
    if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

    const clinicaSetting = await db.prepare(`SELECT value FROM settings WHERE user_id = ? AND key = 'clinic_name'`).get(uid);
    const clinica = clinicaSetting?.value || 'nuestra clínica';

    const result = await sendRecallTemplate(patient.telefono, { nombre: patient.nombre, clinica });

    await db.prepare(`
      INSERT INTO message_log (patient_id, user_id, tipo, mensaje, enviado, error_detalle)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      patient.id, uid,
      'recall',
      `[template:reactivacion_paciente] ${patient.nombre} | ${clinica}`,
      result.success ? 1 : 2,
      result.error || null
    );

    if (result.success) {
      await knex('patients').where('id', patient.id).update({ recall_enviado_at: new Date().toISOString() });
    }

    res.json({ success: result.success, error: result.error || null });
  } catch (err) {
    console.error('[Recall] Error send/:id:', err.message);
    res.status(500).json({ error: 'Error al enviar recall' });
  }
});

module.exports = router;
