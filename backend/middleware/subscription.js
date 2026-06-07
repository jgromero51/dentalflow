const { knex } = require('../db/database');

/**
 * Bloquea la ruta si el usuario no tiene suscripción activa.
 * Orden de prioridad:
 *   1. cortesia_hasta > ahora  → pasa (acceso manual por admin)
 *   2. trial_ends_at  > ahora  → pasa (trial automático)
 *   3. status = 'active'       → pasa (suscripción paga)
 *   4. Cualquier otro caso     → 402
 *
 * Si no existe registro en subscriptions, crea uno con trial de 14 días.
 */
async function requireSubscription(req, res, next) {
  return next(); // acceso libre temporalmente
  try {
    const userId = req.user?.id;
    if (!userId) return next();

    let sub = await knex('subscriptions').where('user_id', userId).first();

    if (!sub) {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);
      await knex('subscriptions').insert({
        user_id: userId,
        plan: 'starter',
        status: 'trialing',
        trial_ends_at: trialEnd,
      });
      return next();
    }

    const now = new Date();
    if (sub.cortesia_hasta && new Date(sub.cortesia_hasta) > now) return next();
    if (sub.trial_ends_at  && new Date(sub.trial_ends_at)  > now) return next();
    if (sub.status === 'active') return next();

    return res.status(402).json({
      error: 'Tu suscripción ha vencido. Renovála para continuar usando DentalFlow.',
      code: 'SUBSCRIPTION_REQUIRED',
      plan: sub.plan,
      status: sub.status,
    });
  } catch (err) {
    console.error('[Subscription] Error al verificar suscripción:', err.message);
    next(); // en caso de error de BD, no bloquear al usuario
  }
}

module.exports = { requireSubscription };
