/**
 * DentalFlow — Ruta: Administración (Solo para dueños/admins)
 * Permite gestionar usuarios, ver estadísticas y auditar datos.
 */
const express = require('express');
const router  = express.Router();
const { db, knex } = require('../db/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Todas las rutas aquí requieren ser Admin
router.use(requireAuth, requireAdmin);

/**
 * GET /api/admin/users
 * Lista todos los usuarios del sistema con estadísticas básicas.
 */
router.get('/users', async (req, res) => {
  try {
    const users = await db.prepare(`
      SELECT id, username, role, created_at, last_login
      FROM users
      ORDER BY created_at DESC
    `).all();

    // Enriquecer con conteos (esto es lento pero útil para pocos usuarios)
    for (let user of users) {
      // Nota: Si el sistema es multi-inquilino real, aquí filtraríamos por tenant_id
      // Por ahora DentalFlow es un solo servidor por instalación, así que vemos todo.
      const stats = await db.prepare(`
        SELECT 
          (SELECT COUNT(*) FROM patients) as patients_count,
          (SELECT COUNT(*) FROM appointments) as appointments_count
        FROM users WHERE id = ?
      `).get(user.id);
      
      user.stats = stats;
    }

    res.json({ data: users });
  } catch (err) {
    console.error('[Admin] Error al listar usuarios:', err.message);
    res.status(500).json({ error: 'Error al obtener lista de usuarios' });
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
