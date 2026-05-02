/**
 * DentalFlow — Módulo de Base de Datos (sql.js)
 *
 * Usa sql.js (WebAssembly, sin compilación nativa) con persistencia
 * manual en disco. La DB se carga al arrancar y se guarda tras cada write.
 */

const path = require('path');
const fs   = require('fs');
require('dotenv').config();

const DB_PATH = path.resolve(__dirname, '..', process.env.DB_PATH || './db/dentalflow.db');
const dbDir   = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

let _db     = null;
let _SQL    = null;
let _dirty  = false;

// ---- Guardar DB en disco ----
function persist() {
  if (!_db || !_dirty) return;
  try {
    const data = _db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    _dirty = false;
  } catch (e) {
    console.error('[DB] Error al guardar:', e.message);
  }
}

// Auto-guardar cada 2 segundos si hay cambios
setInterval(persist, 2000);
process.on('exit', persist);
process.on('SIGINT', () => { persist(); process.exit(); });

// ---- Wrapper síncrono sobre sql.js ----
const db = {
  _getDB() {
    if (!_db) throw new Error('DB no inicializada. Llamá a initializeDatabase() primero.');
    return _db;
  },

  prepare(sql) {
    const database = this._getDB();
    return {
      // Ejecutar consulta que retorna múltiples filas
      all(...params) {
        const stmt = database.prepare(sql);
        const rows = [];
        stmt.bind(params.flat());
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      },
      // Ejecutar consulta que retorna una sola fila
      get(...params) {
        const stmt = database.prepare(sql);
        stmt.bind(params.flat());
        let row = null;
        if (stmt.step()) row = stmt.getAsObject();
        stmt.free();
        return row;
      },
      // Ejecutar INSERT/UPDATE/DELETE
      run(...params) {
        const stmt = database.prepare(sql);
        stmt.bind(params.flat());
        stmt.step();
        stmt.free();
        _dirty = true;
        const lastId = database.exec('SELECT last_insert_rowid() as id')[0];
        const changes = database.exec('SELECT changes() as c')[0];
        return {
          lastInsertRowid: lastId?.values?.[0]?.[0] || 0,
          changes: changes?.values?.[0]?.[0] || 0,
        };
      },
    };
  },

  exec(sql) {
    const result = this._getDB().exec(sql);
    _dirty = true;
    return result;
  },

  pragma(pragmaSql) {
    try {
      this._getDB().run(`PRAGMA ${pragmaSql}`);
    } catch (e) { /* ignorar errores de pragma */ }
  },
};

// ---- Inicializar ----
async function initializeDatabase() {
  const initSql = require('sql.js');
  _SQL = await initSql();

  // Cargar DB existente o crear nueva
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new _SQL.Database(fileBuffer);
    console.log(`[DB] Base de datos cargada desde: ${DB_PATH}`);
  } else {
    _db = new _SQL.Database();
    console.log(`[DB] Nueva base de datos creada en: ${DB_PATH}`);
  }

  // Crear tablas
  _db.run('PRAGMA foreign_keys = ON');
  _db.run(`
    CREATE TABLE IF NOT EXISTS patients (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre     TEXT NOT NULL,
      telefono   TEXT NOT NULL UNIQUE,
      dni        TEXT,
      notas      TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
  _db.run(`
    CREATE TABLE IF NOT EXISTS appointments (
      id                       INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id               INTEGER NOT NULL REFERENCES patients(id),
      fecha_hora_inicio        TEXT NOT NULL,
      duracion_minutos         INTEGER NOT NULL DEFAULT 30,
      descripcion              TEXT,
      estado                   TEXT NOT NULL DEFAULT 'pendiente',
      recordatorio_24h_enviado INTEGER NOT NULL DEFAULT 0,
      recordatorio_4h_enviado  INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
  _db.run(`
    CREATE TABLE IF NOT EXISTS message_log (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER,
      patient_id     INTEGER,
      tipo           TEXT NOT NULL,
      mensaje        TEXT NOT NULL,
      enviado        INTEGER NOT NULL DEFAULT 0,
      error_detalle  TEXT,
      created_at     TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  // Indices
  _db.run('CREATE INDEX IF NOT EXISTS idx_appts_fecha    ON appointments(fecha_hora_inicio)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_appts_estado   ON appointments(estado)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_appts_patient  ON appointments(patient_id)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_patients_tel   ON patients(telefono)');

  persist();
  console.log('[DB] ✅ Tablas inicializadas correctamente');
}

function toLocalISO(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}` +
         `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

module.exports = { db, initializeDatabase, toLocalISO };
