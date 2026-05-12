/**
 * DentalFlow — Ruta: Administración (Solo para dueños/admins)
 * Permite gestionar usuarios, ver estadísticas y auditar datos.
 */
const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');
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

module.exports = router;
