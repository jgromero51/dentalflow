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
      alergias   TEXT,
      tipo_sangre TEXT,
      enfermedades_previas TEXT,
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
      costo_estimado           REAL DEFAULT 0,
      monto_pagado             REAL DEFAULT 0,
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
  _db.run(`
    CREATE TABLE IF NOT EXISTS odontogram_marks (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id     INTEGER NOT NULL REFERENCES patients(id),
      diente_numero  INTEGER NOT NULL,
      diagnostico    TEXT NOT NULL,
      notas          TEXT,
      created_at     TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  // Tabla de configuración de la clínica
  _db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT,
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  // Migraciones seguras para añadir columnas a DB existente
  const migrations = [
    "ALTER TABLE patients ADD COLUMN alergias TEXT;",
    "ALTER TABLE patients ADD COLUMN tipo_sangre TEXT;",
    "ALTER TABLE patients ADD COLUMN enfermedades_previas TEXT;",
    "ALTER TABLE appointments ADD COLUMN costo_estimado REAL DEFAULT 0;",
    "ALTER TABLE appointments ADD COLUMN monto_pagado REAL DEFAULT 0;"
  ];
  for (const sql of migrations) {
    try { _db.run(sql); } catch (e) { /* Columna ya existe, ignorar */ }
  }

  // Insertar valores por defecto solo si la tabla está vacía
  const existingSettings = _db.exec('SELECT COUNT(*) as cnt FROM settings');
  const cnt = existingSettings[0]?.values?.[0]?.[0] || 0;
  if (cnt === 0) {
    const defaults = [
      ['clinic_name',         process.env.CLINIC_NAME    || 'Mi Clínica Odontológica'],
      ['clinic_phone',        process.env.CLINIC_PHONE   || ''],
      ['clinic_address',      ''],
      ['clinic_email',        ''],
      ['clinic_hours',        'Lun–Vie 9:00–18:00'],
      ['clinic_welcome_msg',  '¡Hola! Soy el asistente virtual de {clinic_name}. ¿En qué puedo ayudarte?'],
      ['reminder_24h_active', 'true'],
      ['reminder_4h_active',  'true'],
    ];
    for (const [key, value] of defaults) {
      _db.run('INSERT OR IGNORE INTO settings(key, value) VALUES(?, ?)', [key, value]);
    }
    console.log('[DB] ⚙️  Configuración inicial creada con valores por defecto');
  }

  // Tabla de usuarios (sistema de login)
  _db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      username     TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role         TEXT NOT NULL DEFAULT 'admin',
      created_at   TEXT DEFAULT (datetime('now','localtime')),
      last_login   TEXT
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

// ---- Helper: obtener settings como objeto plano ----
function getSettings() {
  if (!_db) return {};
  const rows = _db.exec('SELECT key, value FROM settings');
  if (!rows.length) return {};
  const result = {};
  const [columns, ...values] = [rows[0].columns, ...rows[0].values];
  for (const row of rows[0].values) {
    result[row[0]] = row[1];
  }
  return result;
}

module.exports = { db, initializeDatabase, toLocalISO, getSettings };
