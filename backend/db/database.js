/**
 * DentalFlow — Modulo de Base de Datos (Knex.js)
 * Soporta SQLite (desarrollo) y PostgreSQL (produccion).
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
        return result.rows ? result.rows : result;
      },
      async get(...params) {
        const rows = await this.all(...params);
        return rows[0] || null;
      },
      async run(...params) {
        const result = await knex.raw(sql, params.flat());
        const isSQLite = knexConfig[environment].client === 'sqlite3';
        if (isSQLite) {
          if (sql.trim().toUpperCase().startsWith('INSERT')) {
            const lastId = await knex.raw('SELECT last_insert_rowid() as id');
            return { lastInsertRowid: lastId[0].id, changes: 1 };
          }
          return { changes: 1 };
        }
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

  knex
};

async function initializeDatabase() {
  console.log('[DB] Inicializando en modo: ' + environment);
  try {
    await knex.migrate.latest();
    console.log('[DB] Migraciones completadas');

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
      console.log('[DB] Usuario por defecto creado: Admin (admin1)');
    }
  } catch (err) {
    console.error('[DB] Error en migraciones o inicializacion:', err.message);
  }
}

function toLocalISO(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth()+1) + '-' + pad(date.getDate()) +
         'T' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
}

/**
 * Obtiene settings de la BD.
 * @param {number|null} userId - Si se provee, filtra por usuario. Si es null, devuelve todos.
 */
async function getSettings(userId = null) {
  let query = knex('settings').select('key', 'value');
  if (userId !== null) query = query.where('user_id', userId);
  const rows = await query;
  const result = {};
  rows.forEach(r => { result[r.key] = r.value; });
  return result;
}

/**
 * Devuelve la expresión SQL para formatear una fecha como 'YYYY-MM'
 * compatible con SQLite (desarrollo) y PostgreSQL (producción).
 */
function sqlYearMonth(column) {
  const isPg = (knexConfig[environment].client === 'pg');
  if (isPg) return `TO_CHAR(${column}::timestamp, 'YYYY-MM')`;
  return `strftime('%Y-%m', ${column})`;
}

/** Devuelve la expresión SQL para la fecha/hora actual según el motor */
function sqlNow() {
  const isPg = (knexConfig[environment].client === 'pg');
  return isPg ? `NOW()` : `datetime('now','localtime')`;
}

/**
 * Devuelve comparación "columna > ahora" compatible con ambos motores.
 * En PG castea el TEXT a TIMESTAMP para poder comparar con NOW().
 */
function sqlColGtNow(column, bufferHours = 0) {
  const isPg = (knexConfig[environment].client === 'pg');
  if (isPg) return bufferHours
    ? `CAST(${column} AS TIMESTAMP) > NOW() - INTERVAL '${bufferHours} hours'`
    : `CAST(${column} AS TIMESTAMP) > NOW()`;
  return bufferHours
    ? `${column} > datetime('now','localtime','-${bufferHours} hours')`
    : `${column} > datetime('now','localtime')`;
}

module.exports = { db, initializeDatabase, toLocalISO, getSettings, knex, sqlYearMonth, sqlNow, sqlColGtNow };
