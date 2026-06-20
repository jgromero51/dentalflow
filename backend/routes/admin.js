/**
 * DentalFlow — Ruta: Panel Maestro (Solo SUPER ADMIN)
 * Gestión global de clínicas, usuarios, suscripciones, WhatsApp y auditoría.
 */
const express = require('express');
const bcrypt  = require('bcryptjs');
const router  = express.Router();
const { db, knex } = require('../db/database');
const { requireAuth, requireSuperAdmin, signToken } = require('../middleware/auth');

// Precios mensuales estimados por plan (USD) — ajustá a tus precios reales.
const PLAN_PRICES = { starter: 15, pro: 30, clinica: 60, cortesia: 0 };

// Todas las rutas aquí requieren ser SUPER ADMIN
router.use(requireAuth, requireSuperAdmin);

// ---- Helpers ----

/** Convierte un valor de fecha (Date, ISO string, epoch ms número o string) a ms. */
function toTime(v) {
  if (v == null) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isNaN(n)) return n;        // epoch en string (SQLite)
  const t = Date.parse(s);                // ISO (Postgres)
  return Number.isNaN(t) ? null : t;
}

/** Estado efectivo de una suscripción (mismo criterio que el middleware). */
function subState(sub) {
  if (!sub) return 'sin';
  const now = Date.now();
  const cortesia = toTime(sub.cortesia_hasta);
  const trial = toTime(sub.trial_ends_at);
  if (cortesia && cortesia > now) return 'cortesia';
  if (sub.status === 'active') return 'active';
  if (trial && trial > now) return 'trial';
  return 'vencida';
}

/** Registra una acción del super admin. Nunca rompe la request si falla. */
async function logAudit(req, action, target_type, target_id, detail) {
  try {
    await knex('admin_audit').insert({
      admin_id: req.user.id,
      admin_username: req.user.username,
      action, target_type, target_id,
      detail: detail || null,
      created_at: new Date(),
    });
  } catch (err) {
    console.error('[Audit] No se pudo registrar:', err.message);
  }
}

/** Conteo de mensajes por clínica → Map(clinic_id → {total, enviados}). */
async function messageCountsByClinic() {
  const rows = await knex('message_log')
    .select('clinic_id')
    .count('* as total')
    .select(knex.raw('SUM(CASE WHEN enviado = 1 THEN 1 ELSE 0 END) as enviados'))
    .groupBy('clinic_id');
  const map = new Map();
  for (const r of rows) {
    map.set(r.clinic_id, {
      total: parseInt(r.total || 0, 10),
      enviados: parseInt(r.enviados || 0, 10),
    });
  }
  return map;
}

/** Set de user_ids que tienen WhatsApp configurado (token no vacío). */
async function whatsappConfiguredSet() {
  const ids = await knex('settings')
    .where('key', 'whatsapp_token')
    .whereNotNull('value')
    .andWhere('value', '!=', '')
    .pluck('user_id');
  return new Set(ids);
}

// ============================================================
// GET /api/admin/overview — Resumen SaaS global
// ============================================================
router.get('/overview', async (req, res) => {
  try {
    const [clinics, users, patients, appointments, proformasHas] = await Promise.all([
      knex('clinics').count('* as n').first(),
      knex('users').where('role', '!=', 'superadmin').count('* as n').first(),
      knex('patients').count('* as n').first(),
      knex('appointments').count('* as n').first(),
      knex.schema.hasTable('proformas'),
    ]);

    // Mensajes globales
    const msgRow = await knex('message_log')
      .count('* as total')
      .select(knex.raw('SUM(CASE WHEN enviado = 1 THEN 1 ELSE 0 END) as enviados'))
      .first();
    const msgTotal = parseInt(msgRow?.total || 0, 10);
    const msgEnviados = parseInt(msgRow?.enviados || 0, 10);

    // Suscripciones → estados + MRR
    const subs = await knex('subscriptions as s')
      .join('users as u', 's.user_id', 'u.id')
      .where('u.role', '!=', 'superadmin')
      .select('s.plan', 's.status', 's.trial_ends_at', 's.cortesia_hasta');

    const states = { active: 0, trial: 0, cortesia: 0, vencida: 0, sin: 0 };
    let mrr = 0;
    for (const s of subs) {
      const st = subState(s);
      states[st] = (states[st] || 0) + 1;
      if (st === 'active') mrr += (PLAN_PRICES[s.plan] || 0);
    }

    // Cuántos owners tienen WhatsApp configurado
    const waSet = await whatsappConfiguredSet();
    const owners = await knex('users').where('role', '!=', 'superadmin').pluck('id');
    const waConfigured = owners.filter(id => waSet.has(id)).length;

    res.json({
      data: {
        total_clinics: parseInt(clinics.n || 0, 10),
        total_users: parseInt(users.n || 0, 10),
        total_patients: parseInt(patients.n || 0, 10),
        total_appointments: parseInt(appointments.n || 0, 10),
        messages: { total: msgTotal, enviados: msgEnviados, fallidos: msgTotal - msgEnviados },
        subscriptions: states,
        mrr,
        whatsapp: { configured: waConfigured, pending: owners.length - waConfigured },
      }
    });
  } catch (err) {
    console.error('[Admin] Error en overview:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/admin/users — Listado de cuentas/clínicas enriquecido
// ============================================================
router.get('/users', async (req, res) => {
  try {
    const users = await knex('users as u')
      .leftJoin('clinics as c', 'u.clinic_id', 'c.id')
      .leftJoin('subscriptions as s', 's.user_id', 'u.id')
      .select(
        'u.id', 'u.username', 'u.role', 'u.email', 'u.active',
        'u.clinic_id', 'u.doctor_name', 'u.created_at', 'u.last_login',
        'c.name as clinic_name',
        's.plan', 's.status as sub_status', 's.trial_ends_at', 's.cortesia_hasta'
      )
      .orderBy('u.created_at', 'desc');

    const [msgMap, waSet] = await Promise.all([messageCountsByClinic(), whatsappConfiguredSet()]);

    for (let user of users) {
      if (user.clinic_id) {
        const [pat, appt] = await Promise.all([
          knex('patients').where('clinic_id', user.clinic_id).count('* as n').first(),
          knex('appointments').where('clinic_id', user.clinic_id).count('* as n').first(),
        ]);
        const m = msgMap.get(user.clinic_id) || { total: 0, enviados: 0 };
        user.stats = {
          patients_count: parseInt(pat?.n || 0, 10),
          appointments_count: parseInt(appt?.n || 0, 10),
          messages_total: m.total,
          messages_enviados: m.enviados,
          messages_fallidos: m.total - m.enviados,
        };
      } else {
        user.stats = { patients_count: 0, appointments_count: 0, messages_total: 0, messages_enviados: 0, messages_fallidos: 0 };
      }
      user.sub_state = subState({ status: user.sub_status, trial_ends_at: user.trial_ends_at, cortesia_hasta: user.cortesia_hasta });
      user.whatsapp_configured = waSet.has(user.id);
    }

    res.json({ data: users });
  } catch (err) {
    console.error('[Admin] Error al listar usuarios:', err.message);
    res.status(500).json({ error: 'Error al obtener lista de usuarios' });
  }
});

// ============================================================
// GET /api/admin/users/:id/detail — Drill-down de una clínica
// ============================================================
router.get('/users/:id/detail', async (req, res) => {
  try {
    const user = await knex('users as u')
      .leftJoin('clinics as c', 'u.clinic_id', 'c.id')
      .leftJoin('subscriptions as s', 's.user_id', 'u.id')
      .where('u.id', req.params.id)
      .select('u.*', 'c.name as clinic_name', 's.plan', 's.status as sub_status', 's.trial_ends_at', 's.cortesia_hasta', 's.current_period_end')
      .first();
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    delete user.password_hash;
    delete user.reset_token;

    const cid = user.clinic_id;
    const [members, patients, appointments, msg, lastMsgs] = await Promise.all([
      knex('users').where('clinic_id', cid).select('id', 'username', 'role', 'doctor_name', 'last_login', 'active'),
      cid ? knex('patients').where('clinic_id', cid).count('* as n').first() : { n: 0 },
      cid ? knex('appointments').where('clinic_id', cid).count('* as n').first() : { n: 0 },
      cid ? knex('message_log').where('clinic_id', cid)
        .count('* as total')
        .select(knex.raw('SUM(CASE WHEN enviado = 1 THEN 1 ELSE 0 END) as enviados'))
        .first() : { total: 0, enviados: 0 },
      cid ? knex('message_log').where('clinic_id', cid).orderBy('created_at', 'desc').limit(15)
        .select('tipo', 'mensaje', 'enviado', 'error_detalle', 'created_at') : [],
    ]);

    const waSet = await whatsappConfiguredSet();
    const total = parseInt(msg?.total || 0, 10);
    const enviados = parseInt(msg?.enviados || 0, 10);

    res.json({
      data: {
        user,
        sub_state: subState({ status: user.sub_status, trial_ends_at: user.trial_ends_at, cortesia_hasta: user.cortesia_hasta }),
        whatsapp_configured: waSet.has(user.id),
        members,
        counts: {
          patients: parseInt(patients?.n || 0, 10),
          appointments: parseInt(appointments?.n || 0, 10),
          messages_total: total,
          messages_enviados: enviados,
          messages_fallidos: total - enviados,
        },
        recent_messages: lastMsgs,
      }
    });
  } catch (err) {
    console.error('[Admin] Error en detail:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POST /api/admin/users — Crear cuenta (owner de su propia clínica)
// ============================================================
router.post('/users', async (req, res) => {
  try {
    let { username, password, clinic_name, doctor_name, email } = req.body;
    username = (username || '').trim().toLowerCase();
    clinic_name = (clinic_name || '').trim();

    if (!username || !password || !clinic_name) {
      return res.status(400).json({ error: 'Usuario, contraseña y nombre de clínica son obligatorios.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const exists = await knex('users').where('username', username).first();
    if (exists) return res.status(400).json({ error: 'Ese nombre de usuario ya está en uso.' });

    if (email) {
      email = email.trim().toLowerCase();
      const emailExists = await knex('users').where('email', email).first();
      if (emailExists) return res.status(400).json({ error: 'Ese correo ya está registrado.' });
    }

    const hash = await bcrypt.hash(password, 12);

    const [uid] = await knex('users').insert({
      username,
      password_hash: hash,
      role: 'owner',
      email: email || null,
      doctor_name: doctor_name ? doctor_name.trim() : null,
      active: true,
    }).returning('id');
    const userId = typeof uid === 'object' ? uid.id : uid;

    const [cid] = await knex('clinics').insert({
      name: clinic_name,
      owner_id: userId,
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('id');
    const clinicId = typeof cid === 'object' ? cid.id : cid;

    await knex('users').where('id', userId).update({ clinic_id: clinicId });

    // Suscripción inicial: prueba de 14 días
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    await knex('subscriptions').insert({
      user_id: userId, plan: 'starter', status: 'trialing', trial_ends_at: trialEnd,
    }).onConflict('user_id').ignore();

    await logAudit(req, 'create_user', 'user', userId, `clínica "${clinic_name}", usuario "${username}"`);
    console.log(`[Admin] ✅ Cuenta creada: "${username}" (clínica "${clinic_name}")`);
    res.status(201).json({ success: true, id: userId, clinic_id: clinicId, username, clinic_name });
  } catch (err) {
    console.error('[Admin] Error al crear usuario:', err.message);
    res.status(500).json({ error: 'Error al crear la cuenta.' });
  }
});

// ============================================================
// POST /api/admin/users/:id/reset-password
// ============================================================
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }
    const user = await knex('users').where('id', req.params.id).first();
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    if (user.role === 'superadmin') {
      return res.status(403).json({ error: 'No se puede cambiar la contraseña del super admin desde aquí.' });
    }
    const hash = await bcrypt.hash(new_password, 12);
    await knex('users').where('id', user.id).update({ password_hash: hash, reset_token: null, reset_expires: null });
    await logAudit(req, 'reset_password', 'user', user.id, `usuario "${user.username}"`);
    console.log(`[Admin] 🔑 Contraseña restablecida para "${user.username}"`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PATCH /api/admin/users/:id/active — Activar/desactivar cuenta
// ============================================================
router.patch('/users/:id/active', async (req, res) => {
  try {
    const active = !!req.body.active;
    const user = await knex('users').where('id', req.params.id).first();
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    if (user.role === 'superadmin') {
      return res.status(403).json({ error: 'No se puede desactivar al super admin.' });
    }
    await knex('users').where('id', user.id).update({ active });
    await logAudit(req, active ? 'activate' : 'deactivate', 'user', user.id, `usuario "${user.username}"`);
    console.log(`[Admin] ${active ? '✅ Activada' : '🚫 Desactivada'} cuenta "${user.username}"`);
    res.json({ success: true, active });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POST /api/admin/users/:id/extend-trial — Extender prueba N días
// ============================================================
router.post('/users/:id/extend-trial', async (req, res) => {
  try {
    const days = Number(req.body.days) || 14;
    const user = await knex('users').where('id', req.params.id).first();
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const sub = await knex('subscriptions').where('user_id', user.id).first();
    const existing = toTime(sub?.trial_ends_at);
    const base = existing && existing > Date.now() ? new Date(existing) : new Date();
    base.setDate(base.getDate() + days);

    await knex('subscriptions')
      .insert({ user_id: user.id, plan: sub?.plan || 'starter', status: 'trialing', trial_ends_at: base })
      .onConflict('user_id').merge({ status: 'trialing', trial_ends_at: base });

    await logAudit(req, 'extend_trial', 'subscription', user.id, `+${days} días → ${base.toISOString().slice(0,10)}`);
    res.json({ success: true, trial_ends_at: base });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POST /api/admin/users/:id/grant-courtesy — Cortesía N meses
// ============================================================
router.post('/users/:id/grant-courtesy', async (req, res) => {
  try {
    const months = Number(req.body.months) || 3;
    const user = await knex('users').where('id', req.params.id).first();
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const hasta = new Date();
    hasta.setMonth(hasta.getMonth() + months);

    await knex('subscriptions')
      .insert({ user_id: user.id, plan: 'cortesia', status: 'active', cortesia_hasta: hasta, trial_ends_at: null })
      .onConflict('user_id').merge({ plan: 'cortesia', status: 'active', cortesia_hasta: hasta });

    await logAudit(req, 'grant_courtesy', 'subscription', user.id, `${months} meses → ${hasta.toISOString().slice(0,10)}`);
    res.json({ success: true, cortesia_hasta: hasta });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POST /api/admin/users/:id/set-status — Marcar activa/cancelada manualmente
// ============================================================
router.post('/users/:id/set-status', async (req, res) => {
  try {
    const status = req.body.status; // 'active' | 'cancelled'
    if (!['active', 'cancelled', 'past_due'].includes(status)) {
      return res.status(400).json({ error: 'Estado inválido.' });
    }
    const user = await knex('users').where('id', req.params.id).first();
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    await knex('subscriptions')
      .insert({ user_id: user.id, plan: 'starter', status })
      .onConflict('user_id').merge({ status });

    await logAudit(req, 'set_status', 'subscription', user.id, status);
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POST /api/admin/users/:id/impersonate — Entrar como esa clínica
// ============================================================
router.post('/users/:id/impersonate', async (req, res) => {
  try {
    const user = await knex('users').where('id', req.params.id).first();
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    if (user.role === 'superadmin') return res.status(400).json({ error: 'No tiene sentido impersonar al super admin.' });

    const token = signToken({
      id: user.id, username: user.username, role: user.role,
      clinic_id: user.clinic_id, doctor_name: user.doctor_name, impersonated_by: req.user.id,
    });
    await logAudit(req, 'impersonate', 'user', user.id, `entró como "${user.username}"`);
    res.json({ success: true, token, username: user.username, role: user.role, clinic_id: user.clinic_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DELETE /api/admin/users/:id — Eliminar clínica y TODOS sus datos
// ============================================================
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await knex('users').where('id', req.params.id).first();
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    if (user.role === 'superadmin') return res.status(403).json({ error: 'No se puede eliminar al super admin.' });

    const cid = user.clinic_id;
    const username = user.username;

    await knex.transaction(async trx => {
      if (cid) {
        await trx('patients').where('clinic_id', cid).del();
        await trx('appointments').where('clinic_id', cid).del();
        if (await trx.schema.hasTable('odontogram_marks')) await trx('odontogram_marks').where('clinic_id', cid).del();
        await trx('message_log').where('clinic_id', cid).del();
        if (await trx.schema.hasTable('proformas')) await trx('proformas').where('clinic_id', cid).del();
        if (await trx.schema.hasTable('treatment_catalog')) await trx('treatment_catalog').where('clinic_id', cid).del();
      }
      // Borrar datos y miembros de la clínica
      const memberIds = cid ? await trx('users').where('clinic_id', cid).pluck('id') : [user.id];
      await trx('subscriptions').whereIn('user_id', memberIds).del();
      await trx('settings').whereIn('user_id', memberIds).del();
      await trx('users').whereIn('id', memberIds).del();
      if (cid) await trx('clinics').where('id', cid).del();
    });

    await logAudit(req, 'delete_clinic', 'clinic', cid, `eliminó clínica de "${username}" y todos sus datos`);
    console.log(`[Admin] 🗑️ Clínica de "${username}" eliminada con todos sus datos`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Admin] Error al eliminar:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/admin/audit — Registro de acciones del super admin
// ============================================================
router.get('/audit', async (req, res) => {
  try {
    const rows = await knex('admin_audit').orderBy('created_at', 'desc').limit(200);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/admin/system-stats — (legacy) Resumen general simple
// ============================================================
router.get('/system-stats', async (req, res) => {
  try {
    const counts = await db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM patients) as total_patients,
        (SELECT COUNT(*) FROM appointments) as total_appointments,
        (SELECT COUNT(*) FROM message_log) as total_messages
    `).get();
    res.json({ data: counts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/admin/backup — Descarga JSON con todos los datos
// ============================================================
router.get('/backup', async (req, res) => {
  try {
    const [patients, appointments, users, settings, proformas] = await Promise.all([
      knex('patients').select('*'),
      knex('appointments').select('*'),
      knex('users').select('id', 'username', 'role', 'email', 'clinic_id', 'created_at', 'last_login'),
      knex('settings').select('user_id', 'key', 'value'),
      knex.schema.hasTable('proformas').then(has => has ? knex('proformas').select('*') : []),
    ]);

    const payload = {
      exported_at: new Date().toISOString(),
      version: '1.0',
      counts: { patients: patients.length, appointments: appointments.length, users: users.length },
      patients, appointments, users, proformas,
      settings: settings.filter(s => s.key !== 'whatsapp_token'),
    };

    const filename = `dentalflow_backup_${new Date().toISOString().slice(0,10)}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(payload);
    console.log(`[Admin] Backup descargado: ${patients.length} pacientes`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
