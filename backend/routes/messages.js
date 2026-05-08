/**
 * DentalFlow — Rutas del Historial de Mensajes (Log)
 * GET /api/messages → Obtiene el registro de mensajes enviados/recibidos.
 */

const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const page  = parseInt(req.query.page)  || 1;
    const offset = (page - 1) * limit;

    const rows = db.prepare(`
      SELECT m.*, p.nombre as paciente_nombre, p.telefono as paciente_telefono
      FROM message_log m
      LEFT JOIN patients p ON p.id = m.patient_id
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const totalRes = db.prepare('SELECT COUNT(*) as total FROM message_log').get();

    res.json({ success: true, data: rows, total: totalRes.total });
  } catch (err) {
    console.error('[Messages] Error al obtener log:', err.message);
    res.status(500).json({ error: 'Error al obtener historial de mensajes' });
  }
});

module.exports = router;
