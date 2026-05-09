/**
 * DentalFlow — Ruta: Pacientes
 * 
 * CRUD completo de pacientes con búsqueda por nombre/teléfono.
 */

const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

// ============================================================
// GET /api/patients
// Listar pacientes (con búsqueda opcional)
// Query params: ?q=nombre_o_telefono
// ============================================================
router.get('/', (req, res) => {
  try {
    const { q } = req.query;

    let patients;
    if (q) {
      patients = await db.prepare(`
        SELECT p.*, COUNT(a.id) as total_citas
        FROM patients p
        LEFT JOIN appointments a ON a.patient_id = p.id
        WHERE p.nombre LIKE ? OR p.telefono LIKE ?
        GROUP BY p.id
        ORDER BY p.nombre ASC
      `).all(`%${q}%`, `%${q}%`);
    } else {
      patients = await db.prepare(`
        SELECT p.*, COUNT(a.id) as total_citas
        FROM patients p
        LEFT JOIN appointments a ON a.patient_id = p.id
        GROUP BY p.id
        ORDER BY p.nombre ASC
      `).all();
    }

    res.json({ data: patients, total: patients.length });
  } catch (err) {
    console.error('[Patients] Error al listar:', err.message);
    res.status(500).json({ error: 'Error al obtener pacientes' });
  }
});

// ============================================================
// GET /api/patients/:id
// Obtener paciente por ID con historial de citas
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    const patient = await db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);

    if (!patient) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    // Historial de citas del paciente
    const appointments = await db.prepare(`
      SELECT * FROM appointments
      WHERE patient_id = ?
      ORDER BY fecha_hora_inicio DESC
    `).all(req.params.id);

    res.json({ data: { ...patient, appointments } });
  } catch (err) {
    console.error('[Patients] Error al obtener paciente:', err.message);
    res.status(500).json({ error: 'Error al obtener paciente' });
  }
});

// ============================================================
// POST /api/patients
// Crear nuevo paciente
// Body: { nombre, telefono, dni?, notas? }
// ============================================================
router.post('/', async (req, res) => {
  try {
    const { nombre, telefono, dni, notas, alergias, tipo_sangre, enfermedades_previas } = req.body;

    // Validaciones básicas
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    if (!telefono || !telefono.trim()) {
      return res.status(400).json({ error: 'El teléfono es requerido' });
    }

    // Normalizar teléfono: asegurar que empiece con +
    const telefonoNorm = telefono.trim().startsWith('+')
      ? telefono.trim()
      : `+${telefono.trim()}`;

    // Verificar si ya existe ese teléfono
    const existing = await db.prepare('SELECT id FROM patients WHERE telefono = ?').get(telefonoNorm);
    if (existing) {
      return res.status(400).json({ error: 'Ya existe un paciente con ese teléfono.' });
    }

    const result = await db.prepare(`
      INSERT INTO patients (nombre, telefono, dni, notas, alergias, tipo_sangre, enfermedades_previas)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(nombre.trim(), telefonoNorm, dni || null, notas || null, alergias || null, tipo_sangre || null, enfermedades_previas || null);

    const newPatient = await db.prepare('SELECT * FROM patients WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ data: newPatient, message: 'Paciente creado exitosamente' });
  } catch (err) {
    console.error('[Patients] Error al crear:', err.message);
    res.status(500).json({ error: 'Error al crear paciente' });
  }
});

// ============================================================
// PUT /api/patients/:id
// Actualizar datos del paciente
// ============================================================
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, telefono, dni, notas, alergias, tipo_sangre, enfermedades_previas } = req.body;

  try {
    const patient = await db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
    if (!patient) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    let telefonoNorm = patient.telefono;
    if (telefono) {
      telefonoNorm = telefono.replace(/\D/g, '');
    }

    await db.prepare(`
      UPDATE patients
      SET nombre = ?, telefono = ?, dni = ?, notas = ?, alergias = ?, tipo_sangre = ?, enfermedades_previas = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      nombre ? nombre.trim() : patient.nombre,
      telefonoNorm,
      dni !== undefined ? dni : patient.dni,
      notas !== undefined ? notas : patient.notas,
      alergias !== undefined ? alergias : patient.alergias,
      tipo_sangre !== undefined ? tipo_sangre : patient.tipo_sangre,
      enfermedades_previas !== undefined ? enfermedades_previas : patient.enfermedades_previas,
      id
    );

    const updated = await db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
    res.json({ data: updated, message: 'Paciente actualizado' });
  } catch (err) {
    console.error('[Patients] Error al actualizar:', err.message);
    res.status(500).json({ error: 'Error al actualizar paciente' });
  }
});

// ============================================================
// DELETE /api/patients/:id
// Eliminar paciente (y sus citas por CASCADE)
// ============================================================
router.delete('/:id', async (req, res) => {
  try {
    const patient = await db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    await db.prepare('DELETE FROM patients WHERE id = ?').run(req.params.id);
    res.json({ message: `Paciente "${patient.nombre}" eliminado` });
  } catch (err) {
    console.error('[Patients] Error al eliminar:', err.message);
    res.status(500).json({ error: 'Error al eliminar paciente' });
  }
});

module.exports = router;
