/**
 * DentalFlow — Rutas del Historial de Mensajes (multi-tenant)
 * GET /api/messages — solo muestra mensajes del usuario autenticado.
 */
const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

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
