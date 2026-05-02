-- ============================================================
-- DentalFlow — Schema de Base de Datos SQLite
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================
-- TABLA: pacientes
-- ============================================================
CREATE TABLE IF NOT EXISTS patients (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT    NOT NULL,
  telefono    TEXT    NOT NULL UNIQUE,  -- formato internacional: +5491112345678
  dni         TEXT,
  notas       TEXT,
  created_at  TEXT    DEFAULT (datetime('now', 'localtime')),
  updated_at  TEXT    DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_patients_telefono ON patients(telefono);
CREATE INDEX IF NOT EXISTS idx_patients_nombre   ON patients(nombre);

-- ============================================================
-- TABLA: appointments (citas)
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  fecha_hora_inicio         TEXT    NOT NULL,  -- ISO 8601: 2024-06-15T10:00:00
  duracion_minutos          INTEGER NOT NULL DEFAULT 30,
  descripcion               TEXT,
  -- Estados: pendiente | confirmada | cancelada | no_asistio
  estado                    TEXT    NOT NULL DEFAULT 'pendiente',
  -- Control de recordatorios
  recordatorio_24h_enviado  INTEGER NOT NULL DEFAULT 0,  -- 0=no, 1=sí
  recordatorio_4h_enviado   INTEGER NOT NULL DEFAULT 0,
  created_at                TEXT    DEFAULT (datetime('now', 'localtime')),
  updated_at                TEXT    DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_appointments_fecha    ON appointments(fecha_hora_inicio);
CREATE INDEX IF NOT EXISTS idx_appointments_patient  ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_estado   ON appointments(estado);

-- ============================================================
-- TABLA: message_log (historial de mensajes)
-- ============================================================
CREATE TABLE IF NOT EXISTS message_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id  INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  patient_id      INTEGER REFERENCES patients(id) ON DELETE SET NULL,
  tipo            TEXT NOT NULL,  -- recordatorio_24h | recordatorio_4h | respuesta_entrada | respuesta_salida
  mensaje         TEXT NOT NULL,
  enviado         INTEGER NOT NULL DEFAULT 0,  -- 0=pendiente, 1=enviado, 2=error
  error_detalle   TEXT,
  created_at      TEXT DEFAULT (datetime('now', 'localtime'))
);

-- ============================================================
-- DATOS DE EJEMPLO (opcionales, para desarrollo)
-- ============================================================
-- INSERT INTO patients (nombre, telefono) VALUES ('María García', '+5491122334455');
-- INSERT INTO patients (nombre, telefono) VALUES ('Carlos López', '+5491133445566');
