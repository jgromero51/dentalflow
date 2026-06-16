/**
 * DentalFlow — Rutas del Historial de Mensajes (multi-tenant)
 * GET /api/messages — solo muestra mensajes del usuario autenticado.
 */
const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

const { sendMessage, getWhatsAppCredentials } = require('../services/whatsapp');

// GET /api/messages/conversations — lista de conversaciones del doctor (un hilo por paciente)
router.get('/conversations', async (req, res) => {
  try {
    const uid = req.user.id;
    const rows = await db.prepare(`
      SELECT
        p.id as patient_id,
        p.nombre as paciente_nombre,
        p.telefono as paciente_telefono,
        m.mensaje as ultimo_mensaje,
        m.tipo as ultimo_tipo,
        m.created_at as ultima_fecha,
        COALESCE((
          SELECT COUNT(*) FROM message_log ml
          WHERE ml.patient_id = p.id AND ml.user_id = ? AND ml.tipo='respuesta_entrada' AND ml.leido=0
        ), 0) as no_leidos
      FROM message_log m
      JOIN patients p ON p.id = m.patient_id
      WHERE m.user_id = ?
        AND m.id = (
          SELECT id FROM message_log ml2
          WHERE ml2.patient_id = p.id AND ml2.user_id = ?
          ORDER BY ml2.created_at DESC
          LIMIT 1
        )
      ORDER BY m.created_at DESC
    `).all(uid, uid, uid);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Messages] Error al obtener conversaciones:', err.message);
    res.status(500).json({ error: 'Error al obtener conversaciones' });
  }
});

// GET /api/messages/conversation/:patientId — hilo completo con un paciente
router.get('/conversation/:patientId', async (req, res) => {
  try {
    const uid = req.user.id;
    const { patientId } = req.params;
    const rows = await db.prepare(`
      SELECT m.*, p.nombre as paciente_nombre, p.telefono as paciente_telefono
      FROM message_log m
      JOIN patients p ON p.id = m.patient_id
      WHERE m.user_id = ? AND m.patient_id = ?
      ORDER BY m.created_at ASC
    `).all(uid, patientId);

    // Marcar como leídos
    await db.prepare(`UPDATE message_log SET leido=1 WHERE user_id=? AND patient_id=? AND tipo='respuesta_entrada'`)
      .run(uid, patientId);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Messages] Error al obtener hilo:', err.message);
    res.status(500).json({ error: 'Error al obtener conversación' });
  }
});

// POST /api/messages/reply — el doctor responde a un paciente
router.post('/reply', async (req, res) => {
  try {
    const uid = req.user.id;
    const { patient_id, mensaje } = req.body;
    if (!patient_id || !mensaje) return res.status(400).json({ error: 'Faltan campos' });

    const patient = await db.prepare('SELECT * FROM patients WHERE id = ?').get(patient_id);
    if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

    const creds  = await getWhatsAppCredentials(uid);
    const result = await sendMessage(patient.telefono, mensaje, creds);

    await db.prepare(`
      INSERT INTO message_log (patient_id, user_id, tipo, mensaje, enviado, error_detalle)
      VALUES (?, ?, 'doctor_reply', ?, ?, ?)
    `).run(patient_id, uid, mensaje, result.success ? 1 : 2, result.error || null);

    res.json({ success: result.success, demo: result.demo || false });
  } catch (err) {
    console.error('[Messages] Error al responder:', err.message);
    res.status(500).json({ error: 'Error al enviar respuesta' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const uid = req.user.id;

    const rows = await db.prepare(`
      SELECT m.*, p.nombre as paciente_nombre, p.telefono as paciente_telefono
      FROM message_log m
      LEFT JOIN patients p ON p.id = m.patient_id
      WHERE m.user_id = ?
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `).all(uid, parseInt(limit), offset);

    const totalRes = await db.prepare('SELECT COUNT(*) as total FROM message_log WHERE user_id = ?').get(uid);
    res.json({ success: true, data: rows, total: totalRes.total });
  } catch (err) {
    console.error('[Messages] Error al obtener log:', err.message);
    res.status(500).json({ error: 'Error al obtener historial de mensajes' });
  }
});

module.exports = router;
