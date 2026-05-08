/**
 * DentalFlow — Rutas de Configuración de Clínica
 * GET  /api/settings        → Obtener todos los ajustes
 * POST /api/settings        → Actualizar uno o varios ajustes
 */

const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

// ---- GET /api/settings ----
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    console.error('[Settings] Error al leer:', err.message);
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

// ---- POST /api/settings ----
// Body: { clinic_name: "...", clinic_phone: "...", ... }
router.post('/', (req, res) => {
  const allowed = [
    'clinic_name',
    'clinic_phone',
    'clinic_address',
    'clinic_email',
    'clinic_hours',
    'clinic_welcome_msg',
    'reminder_24h_active',
    'reminder_4h_active',
  ];

  try {
    const updates = [];
    for (const [key, value] of Object.entries(req.body)) {
      if (!allowed.includes(key)) continue;
      db.prepare(`
        INSERT INTO settings(key, value, updated_at)
        VALUES(?, ?, datetime('now','localtime'))
        ON CONFLICT(key) DO UPDATE SET
          value      = excluded.value,
          updated_at = excluded.updated_at
      `).run(key, String(value));
      updates.push(key);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No se recibieron campos válidos para actualizar' });
    }

    console.log(`[Settings] ✅ Actualizados: ${updates.join(', ')}`);
    res.json({ success: true, updated: updates });
  } catch (err) {
    console.error('[Settings] Error al guardar:', err.message);
    res.status(500).json({ error: 'Error al guardar configuración' });
  }
});

module.exports = router;
