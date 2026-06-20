/**
 * DentalFlow — Crear / actualizar el SUPER ADMIN (cuenta maestra global).
 *
 * Lee las credenciales del entorno y hace upsert de un usuario con rol
 * 'superadmin' (sin clínica). No hay nada hardcodeado.
 *
 * Uso:
 *   SUPERADMIN_USER=jose SUPERADMIN_PASSWORD=...  node backend/seed-superadmin.js
 *
 * En Render: definir SUPERADMIN_USER y SUPERADMIN_PASSWORD y correr este script
 * una vez (o como build/deploy step).
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { knex } = require('./db/database');

(async () => {
  try {
    await knex.migrate.latest();

    const username = (process.env.SUPERADMIN_USER || '').trim().toLowerCase();
    const password = process.env.SUPERADMIN_PASSWORD || '';

    if (!username || !password) {
      console.error('[seed] Falta SUPERADMIN_USER o SUPERADMIN_PASSWORD en el entorno.');
      process.exit(1);
    }
    if (password.length < 8) {
      console.error('[seed] La contraseña del super admin debe tener al menos 8 caracteres.');
      process.exit(1);
    }

    const hash = await bcrypt.hash(password, 12);
    const existing = await knex('users').where('username', username).first();

    if (existing) {
      await knex('users').where('id', existing.id).update({
        password_hash: hash,
        role: 'superadmin',
        clinic_id: null,
        active: true,
      });
      console.log(`[seed] ✅ Super admin actualizado: "${username}"`);
    } else {
      await knex('users').insert({
        username,
        password_hash: hash,
        role: 'superadmin',
        clinic_id: null,
        active: true,
      });
      console.log(`[seed] ✅ Super admin creado: "${username}"`);
    }

    await knex.destroy();
    process.exit(0);
  } catch (err) {
    console.error('[seed] Error:', err.message);
    process.exit(1);
  }
})();
