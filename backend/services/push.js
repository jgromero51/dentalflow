/**
 * DentalFlow — Web Push (notificaciones al teléfono aunque la app esté cerrada)
 *
 * Requiere las env vars VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (y opcional VAPID_SUBJECT).
 * Si no están configuradas, el push queda deshabilitado silenciosamente (no rompe nada).
 */
const webpush = require('web-push');
const { db } = require('../db/database');

const PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT     = process.env.VAPID_SUBJECT || 'mailto:soporte@dentalflow.app';

let enabled = false;
if (PUBLIC_KEY && PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
    enabled = true;
  } catch (err) {
    console.warn('[Push] Claves VAPID inválidas — push deshabilitado:', err.message);
  }
} else {
  console.warn('[Push] Sin VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY — push deshabilitado.');
}

function isEnabled() { return enabled; }
function getPublicKey() { return PUBLIC_KEY || null; }

/**
 * Envía una notificación push a todos los dispositivos de un usuario.
 * Borra automáticamente las suscripciones muertas (410/404).
 */
async function sendPushToUser(userId, payload) {
  if (!enabled || !userId) return;
  try {
    const subs = await db.prepare(
      `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?`
    ).all(userId);
    if (!subs || subs.length === 0) return;

    const body = JSON.stringify(payload);
    await Promise.all(subs.map(async (s) => {
      const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      try {
        await webpush.sendNotification(subscription, body);
      } catch (err) {
        // 410 Gone / 404 → la suscripción ya no existe en el dispositivo, limpiarla
        if (err.statusCode === 410 || err.statusCode === 404) {
          await db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).run(s.endpoint);
        } else {
          console.warn(`[Push] Error enviando a user ${userId}:`, err.statusCode || err.message);
        }
      }
    }));
  } catch (err) {
    console.error('[Push] Error en sendPushToUser:', err.message);
  }
}

module.exports = { isEnabled, getPublicKey, sendPushToUser };
