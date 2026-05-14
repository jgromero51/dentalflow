/**
 * DentalFlow — Ruta: Pacientes (multi-tenant)
 *
 * Todas las queries filtran por req.user.id para que cada
 * usuario (dentista) vea unicamente sus propios pacientes.
 */

const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

// GET /api/patients
router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    const uid = req.user.id;
    let patients;
    if (q) {
      patients = await db.prepare(`
        SELECT p.*, COUNT(a.id) as total_citas
        FROM patients p
        LEFT JOIN appointments a ON a.patient_id = p.id
        WHERE (p.nombre LIKE ? OR p.telefono LIKE ?) AND p.user_id = ?
        GROUP BY p.id
        ORDER BY p.nombre ASC
      `).all(`%${q}%`, `%${q}%`, uid);
    } else {
      patients = await db.prepare(`
        SELECT p.*, COUNT(a.id) as total_citas
        FROM patients p
        LEFT JOIN appointments a ON a.patient_id = p.id
        WHERE p.user_id = ?
        GROUP BY p.id
        ORDER BY p.nombre ASC
      `).all(uid);
    }
    res.json({ data: patients, total: patients.length });
  } catch (err) {
    console.error('[Patients] Error al listar:', err.message);
    res.status(500).json({ error: 'Error al obtener pacientes' });
  }
});

// GET /api/patients/:id
router.get('/:id', async (req, res) => {
  try {
    const patient = await db.prepare(
      'SELECT * FROM patients WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);
    if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

    const appointments = await db.prepare(`
      SELECT * FROM appointments WHERE patient_id = ? ORDER BY fecha_hora_inicio DESC
    `).all(req.params.id);

    res.json({ data: { ...patient, appointments } });
  } catch (err) {
    console.error('[Patients] Error al obtener paciente:', err.message);
    res.status(500).json({ error: 'Error al obtener paciente' });
  }
});

// POST /api/patients
router.post('/', async (req, res) => {
  try {
    const { nombre, telefono, dni, notas, alergias, tipo_sangre, enfermedades_previas } = req.body;
    const uid = req.user.id;

    if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    if (!telefono || !telefono.trim()) return res.status(400).json({ error: 'El telefono es requerido' });

    const telefonoNorm = telefono.trim().startsWith('+') ? telefono.trim() : '+' + telefono.trim();

    const existing = await db.prepare(
      'SELECT id FROM patients WHERE telefono = ? AND user_id = ?'
    ).get(telefonoNorm, uid);
    if (existing) return res.status(400).json({ error: 'Ya existe un paciente con ese telefono.' });

    const result = await db.prepare(`
      INSERT INTO patients (nombre, telefono, dni, notas, alergias, tipo_sangre, enfermedades_previas, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(nombre.trim(), telefonoNorm, dni || null, notas || null, alergias || null, tipo_sangre || null, enfermedades_previas || null, uid);

    const newPatient = await db.prepare('SELECT * FROM patients WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ data: newPatient, message: 'Paciente creado exitosamente' });
  } catch (err) {
    console.error('[Patients] Error al crear:', err.message);
    res.status(500).json({ error: 'Error al crear paciente' });
  }
});

// PUT /api/patients/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, telefono, dni, notas, alergias, tipo_sangre, enfermedades_previas } = req.body;
  const uid = req.user.id;

  try {
    const patient = await db.prepare('SELECT * FROM patients WHERE id = ? AND user_id = ?').get(id, uid);
    if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

    let telefonoNorm = patient.telefono;
    if (telefono) telefonoNorm = telefono.replace(/\D/g, '');

    await db.prepare(`
      UPDATE patients
      SET nombre = ?, telefono = ?, dni = ?, notas = ?, alergias = ?,
          tipo_sangre = ?, enfermedades_previas = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      nombre ? nombre.trim() : patient.nombre,
      telefonoNorm,
      dni !== undefined ? dni : patient.dni,
      notas !== undefined ? notas : patient.notas,
      alergias !== undefined ? alergias : patient.alergias,
      tipo_sangre !== undefined ? tipo_sangre : patient.tipo_sangre,
      enfermedades_previas !== undefined ? enfermedades_previas : patient.enfermedades_previas,
      id, uid
    );

    const updated = await db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
    res.json({ data: updated, message: 'Paciente actualizado' });
  } catch (err) {
    console.error('[Patients] Error al actualizar:', err.message);
    res.status(500).json({ error: 'Error al actualizar paciente' });
  }
});

// GET /api/patients/:id/ai-summary
router.get('/:id/ai-summary', async (req, res) => {
  try {
    const { generatePatientSummary } = require('../services/ai');
    const patient = await db.prepare('SELECT * FROM patients WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

    const appointments = await db.prepare(
      'SELECT * FROM appointments WHERE patient_id = ? ORDER BY fecha_hora_inicio DESC LIMIT 10'
    ).all(req.params.id);

    const odontogramMarks = await db.prepare(
      'SELECT diente_numero, diagnostico, notas FROM odontogram_marks WHERE patient_id = ?'
    ).all(req.params.id);

    const odontogramText = odontogramMarks.map(m =>
      'Diente ' + m.diente_numero + ': ' + m.diagnostico + (m.notas ? ' (' + m.notas + ')' : '')
    ).join(' | ');

    const summary = await generatePatientSummary(patient, appointments, odontogramText);
    res.json({ data: summary });
  } catch (err) {
    console.error('[Patients] Error generando AI summary:', err.message);
    res.status(500).json({ error: 'Error al generar el resumen con IA' });
  }
});

// POST /api/patients/voice-dictation
router.post('/voice-dictation', async (req, res) => {
  try {
    const { transcribeAndFormatVoiceNote } = require('../services/ai');
    const { audioBase64, ext = 'webm' } = req.body;
    if (!audioBase64) return res.status(400).json({ error: 'Audio requerido' });
    const formattedText = await transcribeAndFormatVoiceNote(audioBase64, ext);
    res.json({ data: formattedText });
  } catch (err) {
    console.error('[Patients] Error en dictado por voz:', err.message);
    res.status(500).json({ error: err.message || 'Error al procesar dictado por voz' });
  }
});

// DELETE /api/patients/:id
router.delete('/:id', async (req, res) => {
  try {
    const patient = await db.prepare('SELECT * FROM patients WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

    await db.prepare('DELETE FROM patients WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ message: 'Paciente "' + patient.nombre + '" eliminado' });
  } catch (err) {
    console.error('[Patients] Error al eliminar:', err.message);
    res.status(500).json({ error: 'Error al eliminar paciente' });
  }
});

module.exports = router;
