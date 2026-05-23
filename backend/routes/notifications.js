/**
 * DentalFlow — Notificaciones
 * Mensajes entrantes de pacientes no leídos + confirmaciones/cancelaciones recientes.
 */
const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

// GET /api/notifications
router.get('/', async (req, res) => {
  try {
    const uid = req.user.id;

    // Últimas 30 notificaciones (leídas o no), badge solo cuenta no leídas
    const mensajes = await db.prepare(`
      SELECT
        m.id, m.tipo, m.mensaje, m.created_at, m.leido,
        p.id   as patient_id,
        p.nombre as paciente_nombre,
        a.id   as appointment_id,
        a.estado as cita_estado,
        a.fecha_hora_inicio
      FROM message_log m
      JOIN patients p ON p.id = m.patient_id
      LEFT JOIN appointments a ON a.id = m.appointment_id
      WHERE m.user_id = ?
        AND m.tipo = 'respuesta_entrada'
      ORDER BY m.created_at DESC
      LIMIT 30
    `).all(uid);

    const unread = mensajes.filter(m => !m.leido).length;

    res.json({ data: mensajes, unread });
  } catch (err) {
    console.error('[Notifications] Error:', err.message);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

// PUT /api/notifications/mark-read
router.put('/mark-read', async (req, res) => {
  try {
    const uid = req.user.id;
    await db.prepare(`
      UPDATE message_log SET leido = 1
      WHERE user_id = ? AND tipo = 'respuesta_entrada' AND leido = 0
    `).run(uid);
    res.json({ success: true });
  } catch (err) {
    console.error('[Notifications] Error mark-read:', err.message);
    res.status(500).json({ error: 'Error al marcar leídos' });
  }
});

module.exports = router;
