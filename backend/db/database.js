/**
 * DentalFlow — Módulo de Base de Datos (Knex.js)
 * 
 * Soporta SQLite (desarrollo) y PostgreSQL (producción).
 */

const knexConfig = require('../../knexfile');
const bcrypt = require('bcryptjs');
const environment = process.env.NODE_ENV || 'development';
const knex = require('knex')(knexConfig[environment]);

// Wrapper para mantener compatibilidad parcial con la interfaz vieja (pero ahora ASYNC)
const db = {
  prepare(sql) {
    return {
      async all(...params) {
        const result = await knex.raw(sql, params.flat());
        // Knex raw devuelve cosas distintas según el driver
        if (environment === 'development') return result; // SQLite
        return result.rows; // Postgres
      },
      async get(...params) {
        const rows = await this.all(...params);
        return rows[0] || null;
      },
      async run(...params) {
        const result = await knex.raw(sql, params.flat());
        if (environment === 'development') {
          // Para SQLite, necesitamos el id insertado si fue un INSERT
          if (sql.trim().toUpperCase().startsWith('INSERT')) {
            const lastId = await knex.raw('SELECT last_insert_rowid() as id');
            return { lastInsertRowid: lastId[0].id, changes: 1 };
          }
          return { changes: 1 };
        }
        // Para Postgres
        return { 
          lastInsertRowid: result.rows?.[0]?.id || 0,
          changes: result.rowCount 
        };
      }
    };
  },
  
  async exec(sql) {
    return await knex.raw(sql);
  },

  // Acceso directo a knex para consultas más modernas
  knex
};

async function initializeDatabase() {
  console.log(`[DB] Inicializando en modo: ${environment}`);
  try {
    // Ejecutar migraciones pendientes
    await knex.migrate.latest();
    console.log('[DB] ✅ Migraciones completadas');

    // Crear usuario admin por defecto si no hay usuarios
    const usersCount = await knex('users').count('* as count').first();
    const count = parseInt(usersCount.count || 0, 10);
    
    if (count === 0) {
      console.log('[DB] No se detectaron usuarios. Creando usuario Admin por defecto...');
      const hash = await bcrypt.hash('admin1', 12);
      await knex('users').insert({
        username: 'admin',
        password_hash: hash,
        role: 'admin'
      });
      console.log('[DB] ✅ Usuario por defecto creado: Admin (admin1)');
    }
  } catch (err) {
    console.error('[DB] ❌ Error en migraciones o inicialización:', err.message);
  }
}

function toLocalISO(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}` +
         `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function getSettings() {
  const rows = await knex('settings').select('key', 'value');
  const result = {};
  rows.forEach(r => {
    result[r.key] = r.value;
  });
  return result;
}

module.exports = { db, initializeDatabase, toLocalISO, getSettings, knex };
