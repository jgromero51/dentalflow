/**
 * DentalFlow — Rutas de Configuracion de Clinica (multi-tenant)
 * GET  /api/settings  — ajustes del usuario autenticado
 * POST /api/settings  — actualizar ajustes del usuario
 */
const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');
const { sendMessage } = require('../services/whatsapp');

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const rows = await db.prepare('SELECT key, value FROM settings WHERE user_id = ?').all(req.user.id);
    const settings = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json({ success: true, data: settings });
  } catch (err) {
    console.error('[Settings] Error al leer:', err.message);
    res.status(500).json({ error: 'Error al obtener configuracion' });
  }
});

// POST /api/settings
router.post('/', async (req, res) => {
  const allowed = [
    'clinic_name', 'clinic_phone', 'clinic_address', 'clinic_email',
    'clinic_hours', 'clinic_welcome_msg', 'reminder_24h_active', 'reminder_4h_active',
    'doctor_phone',
  ];
  const uid = req.user.id;
  try {
    const updates = [];
    for (const [key, value] of Object.entries(req.body)) {
      if (!allowed.includes(key)) continue;
      await db.prepare(`
        INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?)
        ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `).run(uid, key, String(value));
      updates.push(key);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No se recibieron campos validos para actualizar' });
    }
    console.log('[Settings] Actualizados para user ' + uid + ': ' + updates.join(', '));
    res.json({ success: true, updated: updates });
  } catch (err) {
    console.error('[Settings] Error al guardar:', err.message);
    res.status(500).json({ error: 'Error al guardar configuracion' });
  }
});

// POST /api/settings/test-whatsapp
router.post('/test-whatsapp', async (req, res) => {
  const { telefono } = req.body;
  if (!telefono) return res.status(400).json({ error: 'Falta el número de teléfono' });

  const mensaje = `✅ *Prueba de WhatsApp — DentalFlow*\n\nSi ves este mensaje, la integración con WhatsApp está funcionando correctamente. 🦷`;

  const result = await sendMessage(telefono, mensaje);
  if (result.success) {
    res.json({ success: true, demo: result.demo || false });
  } else {
    res.status(500).json({ success: false, error: result.error });
  }
});

module.exports = router;
