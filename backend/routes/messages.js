/**
 * DentalFlow — Rutas del Historial de Mensajes (Log)
 * GET /api/messages → Obtiene el registro de mensajes enviados/recibidos.
 */

const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const rows = await db.prepare(`
      SELECT m.*, p.nombre as paciente_nombre, p.telefono as paciente_telefono
      FROM message_log m
      LEFT JOIN patients p ON p.id = m.patient_id
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `).all(parseInt(limit), offset);

    const totalRes = await db.prepare('SELECT COUNT(*) as total FROM message_log').get();
    const total = totalRes.total;

    res.json({ success: true, data: rows, total: total });
  } catch (err) {
    console.error('[Messages] Error al obtener log:', err.message);
    res.status(500).json({ error: 'Error al obtener historial de mensajes' });
  }
});

module.exports = router;
