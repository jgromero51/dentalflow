/**
 * DentalFlow — Ruta: Web Push
 * Entrega la clave pública VAPID y guarda/elimina suscripciones del dispositivo.
 */
const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');
const { getPublicKey, isEnabled } = require('../services/push');

// GET /api/push/public-key — clave pública VAPID para suscribir el navegador
router.get('/public-key', (req, res) => {
  res.json({ publicKey: getPublicKey(), enabled: isEnabled() });
});

// POST /api/push/subscribe — guarda la suscripción del dispositivo para este usuario
router.post('/subscribe', async (req, res) => {
  try {
    const sub = req.body || {};
    const endpoint = sub.endpoint;
    const p256dh   = sub.keys?.p256dh;
    const auth     = sub.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: 'Suscripción inválida' });
    }

    // Reasignar al usuario actual si el endpoint ya existía (mismo dispositivo, otra cuenta)
    await db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).run(endpoint);
    await db.prepare(`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES (?, ?, ?, ?)
    `).run(req.user.id, endpoint, p256dh, auth);

    res.json({ success: true });
  } catch (err) {
    console.error('[Push] Error al guardar suscripción:', err.message);
    res.status(500).json({ error: 'Error al guardar suscripción' });
  }
});

// POST /api/push/unsubscribe — elimina la suscripción del dispositivo
router.post('/unsubscribe', async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (endpoint) {
      await db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).run(endpoint);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar suscripción' });
  }
});

module.exports = router;
