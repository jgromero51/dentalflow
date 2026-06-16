/**
 * Índices para acelerar las consultas más frecuentes (búsqueda de pacientes
 * por teléfono, citas por fecha, hilos de mensajes, etc.). Compatible con
 * SQLite y PostgreSQL vía CREATE INDEX IF NOT EXISTS.
 */
const INDEXES = [
  ['idx_patients_telefono',     'patients(telefono)'],
  ['idx_patients_user',         'patients(user_id)'],
  ['idx_appointments_patient',  'appointments(patient_id)'],
  ['idx_appointments_user',     'appointments(user_id)'],
  ['idx_appointments_fecha',    'appointments(fecha_hora_inicio)'],
  ['idx_message_log_patient',   'message_log(patient_id)'],
  ['idx_message_log_user',      'message_log(user_id)'],
  ['idx_proformas_patient',     'proformas(patient_id)'],
  ['idx_odontogram_patient',    'odontogram_marks(patient_id)'],
];

exports.up = async function (knex) {
  for (const [name, target] of INDEXES) {
    try { await knex.raw(`CREATE INDEX IF NOT EXISTS ${name} ON ${target}`); }
    catch (e) { console.warn(`[migration] índice ${name} omitido: ${e.message}`); }
  }
};

exports.down = async function (knex) {
  for (const [name] of INDEXES) {
    try { await knex.raw(`DROP INDEX IF EXISTS ${name}`); } catch (_) {}
  }
};
