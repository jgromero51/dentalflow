/**
 * DentalFlow — Ruta: Administración (Solo para dueños/admins)
 * Permite gestionar usuarios, ver estadísticas y auditar datos.
 */
const express = require('express');
const bcrypt  = require('bcryptjs');
const router  = express.Router();
const { db, knex } = require('../db/database');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');

// Todas las rutas aquí requieren ser SUPER ADMIN (cuenta maestra global)
router.use(requireAuth, requireSuperAdmin);

/**
 * GET /api/admin/users
 * Lista todas las cuentas con su clínica y conteos reales por clínica.
 */
router.get('/users', async (req, res) => {
  try {
    const users = await knex('users as u')
      .leftJoin('clinics as c', 'u.clinic_id', 'c.id')
      .select(
        'u.id', 'u.username', 'u.role', 'u.email', 'u.active',
        'u.clinic_id', 'u.doctor_name', 'u.created_at', 'u.last_login',
        'c.name as clinic_name'
      )
      .orderBy('u.created_at', 'desc');

    // Conteos por clínica (no globales)
    for (let user of users) {
      if (user.clinic_id) {
        const [pat, appt] = await Promise.all([
          knex('patients').where('clinic_id', user.clinic_id).count('* as n').first(),
          knex('appointments').where('clinic_id', user.clinic_id).count('* as n').first(),
        ]);
        user.stats = {
          patients_count: parseInt(pat?.n || 0, 10),
          appointments_count: parseInt(appt?.n || 0, 10),
        };
      } else {
        user.stats = { patients_count: 0, appointments_count: 0 };
      }
    }

    res.json({ data: users });
  } catch (err) {
    console.error('[Admin] Error al listar usuarios:', err.message);
    res.status(500).json({ error: 'Error al obtener lista de usuarios' });
  }
});

/**
 * POST /api/admin/users
 * Crea una cuenta nueva = dueño (owner) de su propia clínica.
 * Body: { username, password, clinic_name, doctor_name?, email? }
 */
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

    // 1. Crear el usuario
    const [uid] = await knex('users').insert({
      username,
      password_hash: hash,
      role: 'owner',
      email: email || null,
      doctor_name: doctor_name ? doctor_name.trim() : null,
      active: true,
    }).returning('id');
    const userId = typeof uid === 'object' ? uid.id : uid;

    // 2. Crear su clínica y asignársela
    const [cid] = await knex('clinics').insert({
      name: clinic_name,
      owner_id: userId,
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('id');
    const clinicId = typeof cid === 'object' ? cid.id : cid;

    await knex('users').where('id', userId).update({ clinic_id: clinicId });

    console.log(`[Admin] ✅ Cuenta creada: "${username}" (clínica "${clinic_name}")`);
    res.status(201).json({ success: true, id: userId, clinic_id: clinicId, username, clinic_name });
  } catch (err) {
    console.error('[Admin] Error al crear usuario:', err.message);
    res.status(500).json({ error: 'Error al crear la cuenta.' });
  }
});

/**
 * POST /api/admin/users/:id/reset-password
 * El super admin define una nueva contraseña para una cuenta.
 * Body: { new_password }
 */
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
    console.log(`[Admin] 🔑 Contraseña restablecida para "${user.username}"`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/admin/users/:id/active
 * Activa o desactiva una cuenta. Body: { active: boolean }
 */
router.patch('/users/:id/active', async (req, res) => {
  try {
    const active = !!req.body.active;
    const user = await knex('users').where('id', req.params.id).first();
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    if (user.role === 'superadmin') {
      return res.status(403).json({ error: 'No se puede desactivar al super admin.' });
    }
    await knex('users').where('id', user.id).update({ active });
    console.log(`[Admin] ${active ? '✅ Activada' : '🚫 Desactivada'} cuenta "${user.username}"`);
    res.json({ success: true, active });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/system-stats
 * Resumen general del servidor.
 */
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

/**
 * GET /api/admin/backup
 * Descarga un JSON con todos los datos del sistema.
 */
router.get('/backup', async (req, res) => {
  try {
    const { knex } = require('../db/database');
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
      patients,
      appointments,
      users,
      proformas,
      // No exportamos tokens de WhatsApp por seguridad
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

/**
 * POST /api/admin/grant-access
 * Otorga acceso gratuito (cortesía) a un usuario por N meses.
 * Requiere header: x-admin-secret = ADMIN_SECRET env var.
 * Body: { userId, months }
 */
router.post('/grant-access', async (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }

  const { userId, months = 3 } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId requerido.' });

  const cortesiaHasta = new Date();
  cortesiaHasta.setMonth(cortesiaHasta.getMonth() + Number(months));

  await knex('subscriptions')
    .insert({
      user_id: userId,
      plan: 'cortesia',
      status: 'active',
      cortesia_hasta: cortesiaHasta,
      trial_ends_at: null,
    })
    .onConflict('user_id')
    .merge({
      plan: 'cortesia',
      status: 'active',
      cortesia_hasta: cortesiaHasta,
    });

  console.log(`[Admin] Acceso cortesía otorgado → user ${userId} hasta ${cortesiaHasta.toISOString().slice(0,10)}`);
  res.json({ ok: true, userId, cortesia_hasta: cortesiaHasta });
});

module.exports = router;
