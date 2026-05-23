/**
 * Script de migración: SQLite → PostgreSQL
 * Ejecutar UNA sola vez: node migrate_to_postgres.js
 */

const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');
const path = require('path');

const SQLITE_PATH = path.join(__dirname, 'backend', 'db', 'dentalflow.db');
const PG_URL = 'postgresql://dentalflow_db_12vo_user:lrAga6FmgtgsJrVQF8pjJUdEz3QmJ1oU@dpg-d88jl80jo6nc73cvgni0-a.oregon-postgres.render.com/dentalflow_db_12vo';

function sqliteAll(db, sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, [], (err, rows) => err ? reject(err) : resolve(rows));
  });
}

// Convierte timestamps de SQLite (número ms, ISO string, o null) a Date válido para PG
function toDate(val) {
  if (!val) return new Date();
  if (typeof val === 'number') return new Date(val);
  if (typeof val === 'string' && /^\d+$/.test(val)) return new Date(parseInt(val));
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

async function migrate() {
  const sqlite = new sqlite3.Database(SQLITE_PATH);
  const pg = new Client({ connectionString: PG_URL, ssl: { rejectUnauthorized: false } });

  await pg.connect();
  console.log('✅ Conectado a PostgreSQL');

  try {
    // 1. USUARIOS
    const users = await sqliteAll(sqlite, 'SELECT * FROM users');
    console.log(`\n👤 Migrando ${users.length} usuarios...`);
    for (const u of users) {
      await pg.query(`
        INSERT INTO users (id, username, password_hash, role, email, oauth_provider, oauth_id,
                           reset_token, reset_expires, clinic_id, doctor_name, created_at, updated_at, last_login)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT (id) DO UPDATE SET
          username=EXCLUDED.username, password_hash=EXCLUDED.password_hash,
          role=EXCLUDED.role, email=EXCLUDED.email, doctor_name=EXCLUDED.doctor_name,
          last_login=EXCLUDED.last_login
      `, [u.id, u.username, u.password_hash, u.role, u.email||null, u.oauth_provider||null,
          u.oauth_id||null, u.reset_token||null, u.reset_expires||null,
          u.clinic_id||null, u.doctor_name||null,
          toDate(u.created_at), toDate(u.updated_at), u.last_login ? toDate(u.last_login) : null]);
    }
    // Sincronizar secuencia de IDs
    await pg.query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`);

    // 2. CLÍNICAS
    let clinics = [];
    try { clinics = await sqliteAll(sqlite, 'SELECT * FROM clinics'); } catch(_) {}
    console.log(`🏥 Migrando ${clinics.length} clínicas...`);
    for (const c of clinics) {
      await pg.query(`
        INSERT INTO clinics (id, name, owner_id, invite_code, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (id) DO NOTHING
      `, [c.id, c.name, c.owner_id||null, c.invite_code||null, toDate(c.created_at), toDate(c.updated_at)]);
    }
    if (clinics.length) await pg.query(`SELECT setval('clinics_id_seq', (SELECT MAX(id) FROM clinics))`);

    // 3. PACIENTES
    const patients = await sqliteAll(sqlite, 'SELECT * FROM patients');
    console.log(`🦷 Migrando ${patients.length} pacientes...`);
    for (const p of patients) {
      await pg.query(`
        INSERT INTO patients (id, nombre, telefono, dni, notas, alergias, tipo_sangre,
                              enfermedades_previas, created_at, updated_at, user_id, clinic_id, recall_enviado_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (id) DO NOTHING
      `, [p.id, p.nombre, p.telefono, p.dni||null, p.notas||null, p.alergias||null,
          p.tipo_sangre||null, p.enfermedades_previas||null,
          toDate(p.created_at), toDate(p.updated_at),
          p.user_id||null, p.clinic_id||null, p.recall_enviado_at||null]);
    }
    if (patients.length) await pg.query(`SELECT setval('patients_id_seq', (SELECT MAX(id) FROM patients))`);

    // 4. CITAS
    const appts = await sqliteAll(sqlite, 'SELECT * FROM appointments');
    console.log(`📅 Migrando ${appts.length} citas...`);
    for (const a of appts) {
      await pg.query(`
        INSERT INTO appointments (id, patient_id, fecha_hora_inicio, duracion_minutos, descripcion,
                                  estado, recordatorio_24h_enviado, recordatorio_4h_enviado,
                                  costo_estimado, monto_pagado, created_at, updated_at,
                                  user_id, clinic_id, metodo_pago)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (id) DO NOTHING
      `, [a.id, a.patient_id, a.fecha_hora_inicio, a.duracion_minutos||30,
          a.descripcion||null, a.estado||'pendiente',
          a.recordatorio_24h_enviado||0, a.recordatorio_4h_enviado||0,
          a.costo_estimado||0, a.monto_pagado||0,
          toDate(a.created_at), toDate(a.updated_at),
          a.user_id||null, a.clinic_id||null, a.metodo_pago||null]);
    }
    if (appts.length) await pg.query(`SELECT setval('appointments_id_seq', (SELECT MAX(id) FROM appointments))`);

    // 5. SETTINGS
    const settings = await sqliteAll(sqlite, 'SELECT * FROM settings');
    console.log(`⚙️  Migrando ${settings.length} configuraciones...`);
    for (const s of settings) {
      await pg.query(`
        INSERT INTO settings (user_id, key, value, updated_at)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (user_id, key) DO UPDATE SET value=EXCLUDED.value
      `, [s.user_id||1, s.key, s.value||null, toDate(s.updated_at)]);
    }

    // 6. ODONTOGRAMA
    let marks = [];
    try { marks = await sqliteAll(sqlite, 'SELECT * FROM odontogram_marks'); } catch(_) {}
    console.log(`🦷 Migrando ${marks.length} marcas de odontograma...`);
    for (const m of marks) {
      await pg.query(`
        INSERT INTO odontogram_marks (id, patient_id, diente_numero, diagnostico, notas, created_at, user_id, clinic_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (id) DO NOTHING
      `, [m.id, m.patient_id, m.diente_numero, m.diagnostico, m.notas||null,
          toDate(m.created_at), m.user_id||null, m.clinic_id||null]);
    }
    if (marks.length) await pg.query(`SELECT setval('odontogram_marks_id_seq', (SELECT MAX(id) FROM odontogram_marks))`);

    // 7. CATÁLOGO
    let catalog = [];
    try { catalog = await sqliteAll(sqlite, 'SELECT * FROM treatment_catalog'); } catch(_) {}
    console.log(`📋 Migrando ${catalog.length} tratamientos del catálogo...`);
    for (const t of catalog) {
      await pg.query(`
        INSERT INTO treatment_catalog (id, user_id, nombre, categoria, precio, descripcion, created_at, updated_at, clinic_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (id) DO NOTHING
      `, [t.id, t.user_id, t.nombre, t.categoria||'General', t.precio||0,
          t.descripcion||null, toDate(t.created_at), toDate(t.updated_at), t.clinic_id||null]);
    }
    if (catalog.length) await pg.query(`SELECT setval('treatment_catalog_id_seq', (SELECT MAX(id) FROM treatment_catalog))`);

    // 8. PROFORMAS
    let proformas = [];
    try { proformas = await sqliteAll(sqlite, 'SELECT * FROM proformas'); } catch(_) {}
    console.log(`📄 Migrando ${proformas.length} proformas...`);
    for (const pf of proformas) {
      await pg.query(`
        INSERT INTO proformas (id, patient_id, user_id, estado, items_json, notas, total, created_at, updated_at, clinic_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (id) DO NOTHING
      `, [pf.id, pf.patient_id, pf.user_id, pf.estado||'borrador',
          pf.items_json, pf.notas||null, pf.total||0,
          toDate(pf.created_at), toDate(pf.updated_at), pf.clinic_id||null]);
    }
    if (proformas.length) await pg.query(`SELECT setval('proformas_id_seq', (SELECT MAX(id) FROM proformas))`);

    console.log('\n✅ Migración completada exitosamente.');
    console.log(`   ${users.length} usuarios | ${patients.length} pacientes | ${appts.length} citas`);

  } catch (err) {
    console.error('❌ Error durante migración:', err.message);
  } finally {
    sqlite.close();
    await pg.end();
  }
}

migrate();
