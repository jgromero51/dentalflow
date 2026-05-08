/**
 * DentalFlow — Rutas de Autenticación
 *
 * POST /api/auth/setup   → Crear el primer usuario (solo si no existe ninguno)
 * POST /api/auth/login   → Iniciar sesión, devuelve JWT
 * GET  /api/auth/me      → Verificar token y devolver datos del usuario actual
 * POST /api/auth/change-password → Cambiar contraseña
 */

const express  = require('express');
const bcrypt   = require('bcryptjs');
const router   = express.Router();
const { db }         = require('../db/database');
const { signToken, requireAuth } = require('../middleware/auth');

// ============================================================
// GET /api/auth/status — ¿Hay algún usuario registrado?
// El frontend lo usa al cargar para saber si mostrar Setup o Login
// ============================================================
router.get('/status', (req, res) => {
  try {
    const user = db.prepare('SELECT id FROM users LIMIT 1').get();
    res.json({ hasUsers: !!user });
  } catch (err) {
    res.status(500).json({ error: 'Error al verificar estado' });
  }
});

// ============================================================
// POST /api/auth/setup — Primer uso: crear cuenta de administrador
// Solo funciona si NO existe ningún usuario todavía
// ============================================================
router.post('/setup', async (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM users LIMIT 1').get();
    if (existing) {
      return res.status(403).json({ error: 'Ya existe un usuario registrado. Usá el login normal.' });
    }

    const { username, password, clinic_name } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son obligatorios.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const hash = await bcrypt.hash(password, 12);
    const result = db.prepare(
      'INSERT INTO users(username, password_hash, role) VALUES(?, ?, ?)'
    ).run(username.trim().toLowerCase(), hash, 'admin');

    // Si se envió nombre de clínica, guardarlo en settings
    if (clinic_name && clinic_name.trim()) {
      db.prepare(
        `INSERT INTO settings(key, value, updated_at) VALUES('clinic_name', ?, datetime('now','localtime'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      ).run(clinic_name.trim());
    }

    const token = signToken({ id: result.lastInsertRowid, username: username.trim().toLowerCase(), role: 'admin' });

    console.log(`[Auth] ✅ Primer usuario creado: "${username}"`);
    res.status(201).json({ success: true, token, username: username.trim().toLowerCase() });

  } catch (err) {
    console.error('[Auth] Error en setup:', err.message);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// ============================================================
// POST /api/auth/login — Iniciar sesión
// ============================================================
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Completá usuario y contraseña.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim().toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    // Actualizar último acceso
    db.prepare(`UPDATE users SET last_login = datetime('now','localtime') WHERE id = ?`).run(user.id);

    const token = signToken({ id: user.id, username: user.username, role: user.role });

    console.log(`[Auth] ✅ Login: "${user.username}"`);
    res.json({ success: true, token, username: user.username, role: user.role });

  } catch (err) {
    console.error('[Auth] Error en login:', err.message);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// ============================================================
// GET /api/auth/me — Verificar token (requiere auth)
// ============================================================
router.get('/me', requireAuth, (req, res) => {
  try {
    const user = db.prepare('SELECT id, username, role, created_at, last_login FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

// ============================================================
// POST /api/auth/change-password — Cambiar contraseña
// ============================================================
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Ambas contraseñas son requeridas.' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
    }

    const newHash = await bcrypt.hash(new_password, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);

    console.log(`[Auth] 🔑 Contraseña actualizada para: "${user.username}"`);
    res.json({ success: true, message: 'Contraseña actualizada correctamente.' });

  } catch (err) {
    console.error('[Auth] Error cambiando contraseña:', err.message);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

module.exports = router;
