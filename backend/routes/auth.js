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
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const router   = express.Router();
const { db, knex }   = require('../db/database');
const { signToken, requireAuth } = require('../middleware/auth');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ============================================================
// GET /api/auth/status — ¿Hay algún usuario registrado?
// El frontend lo usa al cargar para saber si mostrar Setup o Login
// ============================================================
router.get('/status', async (req, res) => {
  try {
    const user = await db.prepare('SELECT id FROM users LIMIT 1').get();
    res.json({ hasUsers: !!user });
  } catch (err) {
    res.status(500).json({ error: 'Error al verificar estado' });
  }
});

// ============================================================
// POST /api/auth/setup — Primer uso o registro de usuario
// ============================================================
router.post('/setup', async (req, res) => {
  // Auto-registro deshabilitado: solo el super admin crea cuentas.
  return res.status(403).json({ error: 'El registro está deshabilitado. Pedile las credenciales al administrador.' });
  try {
    const { username, password, clinic_name, email } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son obligatorios.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const existingUser = await db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim().toLowerCase());
    if (existingUser) {
      return res.status(400).json({ error: 'Este nombre de usuario ya está en uso.' });
    }

    const existingTotal = await db.prepare('SELECT COUNT(*) as count FROM users').get();
    const isFirstUser = existingTotal.count === 0;
    const role = isFirstUser ? 'admin' : 'user';

    const hash = await bcrypt.hash(password, 12);
    
    // We will add an email column logic here or keep it simple for now as requested by user
    // The user also mentioned recovering password, so we need an email column if not present.
    // Let's check if the users table has an email column.
    
    const result = await db.prepare(
      'INSERT INTO users(username, password_hash, role, email) VALUES(?, ?, ?, ?)'
    ).run(username.trim().toLowerCase(), hash, role, email ? email.trim().toLowerCase() : null);

    // Si se envió nombre de clínica y es el primer usuario, guardarlo en settings
    if (isFirstUser && clinic_name && clinic_name.trim()) {
      await db.prepare(
        `INSERT INTO settings(key, value) VALUES('clinic_name', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).run(clinic_name.trim());
    }

    const newUserId = result.lastInsertRowid;
    // Crear clínica para el primer usuario
    let clinic_id = null;
    if (isFirstUser) {
      const clinicName = clinic_name ? clinic_name.trim() : username.trim();
      const [cid] = await knex('clinics').insert({ name: clinicName, owner_id: newUserId, created_at: new Date(), updated_at: new Date() }).returning('id');
      clinic_id = typeof cid === 'object' ? cid.id : cid;
      await knex('users').where('id', newUserId).update({ clinic_id, role: 'owner' });
    }

    const token = signToken({ id: newUserId, username: username.trim().toLowerCase(), role: isFirstUser ? 'owner' : role, clinic_id, doctor_name: null });

    console.log(`[Auth] ✅ Usuario creado: "${username}" (Rol: ${role})`);
    res.status(201).json({ success: true, token, username: username.trim().toLowerCase(), role: isFirstUser ? 'owner' : role, clinic_id });

  } catch (err) {
    console.error('[Auth] Error en setup/registro:', err.message);
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

    const user = await db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim().toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    if (user.active === false || user.active === 0) {
      return res.status(403).json({ error: 'Tu cuenta está desactivada. Contactá al administrador.' });
    }

    // Actualizar último acceso (sin esperar para no bloquear)
    db.prepare(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`).run(user.id).catch(() => {});

    const token = signToken({ id: user.id, username: user.username, role: user.role, clinic_id: user.clinic_id, doctor_name: user.doctor_name });

    console.log(`[Auth] ✅ Login: "${user.username}"`);
    res.json({ success: true, token, username: user.username, role: user.role, clinic_id: user.clinic_id, doctor_name: user.doctor_name });

  } catch (err) {
    console.error('[Auth] Error en login:', err.message);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// ============================================================
// POST /api/auth/join — Unirse a una clínica con código de invitación
// ============================================================
router.post('/join', async (req, res) => {
  // Auto-registro deshabilitado: solo el super admin crea cuentas.
  return res.status(403).json({ error: 'El registro está deshabilitado. Pedile las credenciales al administrador.' });
  try {
    const { username, password, doctor_name, invite_code, email } = req.body;
    if (!username || !password || !invite_code) {
      return res.status(400).json({ error: 'Usuario, contraseña y código de invitación son obligatorios.' });
    }
    const clinic = await knex('clinics').where('invite_code', invite_code.trim().toUpperCase()).first();
    if (!clinic) return res.status(400).json({ error: 'Código de invitación inválido o expirado.' });

    const existing = await db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim().toLowerCase());
    if (existing) return res.status(400).json({ error: 'Ese nombre de usuario ya está en uso.' });

    const hash = await bcrypt.hash(password, 12);
    // Respetar el rol definido al crear el código de invitación
    const assignedRole = ['doctor', 'receptionist'].includes(clinic.invite_role) ? clinic.invite_role : 'doctor';
    const result = await db.prepare(
      'INSERT INTO users(username, password_hash, role, email, clinic_id, doctor_name) VALUES(?, ?, ?, ?, ?, ?)'
    ).run(username.trim().toLowerCase(), hash, assignedRole, email || null, clinic.id, doctor_name ? doctor_name.trim() : null);

    const token = signToken({ id: result.lastInsertRowid, username: username.trim().toLowerCase(), role: assignedRole, clinic_id: clinic.id, doctor_name: doctor_name || null });
    res.status(201).json({ success: true, token, username: username.trim().toLowerCase(), role: assignedRole, clinic_id: clinic.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/auth/me — Verificar token (requiere auth)
// ============================================================
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await db.prepare('SELECT id, username, role, clinic_id, doctor_name, created_at, last_login FROM users WHERE id = ?').get(req.user.id);
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

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
    }

    const newHash = await bcrypt.hash(new_password, 12);
    await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);

    console.log(`[Auth] 🔑 Contraseña actualizada para: "${user.username}"`);
    res.json({ success: true, message: 'Contraseña actualizada correctamente.' });

  } catch (err) {
    console.error('[Auth] Error cambiando contraseña:', err.message);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

// ============================================================
// POST /api/auth/forgot-password — Recuperar contraseña
// ============================================================
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'El correo electrónico es obligatorio.' });
    }

    // Since users may have registered before without email, we should search by email,
    // but in SQLite we just added the column.
    // However, if we don't find it, we shouldn't reveal if it exists or not for security.
    const user = await db.prepare('SELECT id, username FROM users WHERE email = ?').get(email.trim().toLowerCase());
    
    if (user) {
      const resetToken = require('crypto').randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 3600000).toISOString(); // 1 hour

      await db.prepare('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?').run(resetToken, resetExpires, user.id);

      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/#reset-password/${resetToken}`;

      try {
        await transporter.sendMail({
          from: `"DentalFlow" <${process.env.SMTP_USER}>`,
          to: email,
          subject: 'Restablecer tu contraseña en DentalFlow',
          html: `
            <h2>Recuperación de contraseña</h2>
            <p>Hola ${user.username},</p>
            <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente enlace para crear una nueva:</p>
            <a href="${resetLink}" style="display:inline-block;padding:10px 20px;background:#0d6efd;color:#fff;text-decoration:none;border-radius:5px;">Restablecer Contraseña</a>
            <p>Si no solicitaste esto, puedes ignorar este correo.</p>
          `
        });
        console.log(`[Auth] ✅ Correo de recuperación enviado a ${email}`);
      } catch (mailErr) {
        console.error('[Auth] Error enviando correo de recuperación:', mailErr.message);
      }
    }

    res.json({ success: true, message: 'Si el correo existe en nuestro sistema, recibirás un enlace de recuperación pronto.' });

  } catch (err) {
    console.error('[Auth] Error en forgot-password:', err.message);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

// ============================================================
// POST /api/auth/reset-password — Restablecer contraseña
// ============================================================
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Faltan datos.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    }

    const user = await db.prepare('SELECT id, reset_expires FROM users WHERE reset_token = ?').get(token);
    if (!user) {
      return res.status(400).json({ error: 'El enlace es inválido.' });
    }

    if (new Date(user.reset_expires) < new Date()) {
      return res.status(400).json({ error: 'El enlace ha expirado. Solicitá uno nuevo.' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?').run(hash, user.id);

    console.log(`[Auth] ✅ Contraseña restablecida vía token para ID ${user.id}`);
    res.json({ success: true, message: 'Tu contraseña ha sido actualizada correctamente.' });
  } catch (err) {
    console.error('[Auth] Error en reset-password:', err.message);
    res.status(500).json({ error: 'Error al restablecer contraseña.' });
  }
});

// ============================================================
// POST /api/auth/google — Login / Registro con Google
// ============================================================
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Credencial requerida' });

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email.toLowerCase();
    const name = payload.name;
    const googleId = payload.sub;

    let user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      // Auto-registro deshabilitado: solo el super admin crea cuentas.
      return res.status(403).json({ error: 'No existe una cuenta con ese correo. Pedile las credenciales al administrador.' });
    }

    if (user.active === false || user.active === 0) {
      return res.status(403).json({ error: 'Tu cuenta está desactivada. Contactá al administrador.' });
    }

    // Actualizar oauth info si faltaba
    if (!user.oauth_provider) {
      await db.prepare('UPDATE users SET oauth_provider = ?, oauth_id = ? WHERE id = ?').run('google', googleId, user.id);
    }
    db.prepare(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`).run(user.id).catch(() => {});
    console.log(`[Auth] ✅ Login vía Google: "${user.username}"`);

    const token = signToken({ id: user.id, username: user.username, role: user.role, clinic_id: user.clinic_id, doctor_name: user.doctor_name });
    res.json({ success: true, token, username: user.username, role: user.role, clinic_id: user.clinic_id });
  } catch (err) {
    console.error('[Auth] Error en login de Google:', err.message);
    res.status(500).json({ error: 'Error de autenticación con Google.' });
  }
});

module.exports = router;
