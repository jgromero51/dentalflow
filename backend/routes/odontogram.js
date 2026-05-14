/**
 * DentalFlow — Ruta: Odontograma (multi-tenant)
 * Scopeado a req.user.id para que cada dentista vea solo sus datos.
 */
const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

// GET /api/odontogram/:patientId
router.get('/:patientId', async (req, res) => {
  try {
    const patient = await db.prepare(
      'SELECT id FROM patients WHERE id = ? AND user_id = ?'
    ).get(req.params.patientId, req.user.id);
    if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

    const marks = await db.prepare(`
      SELECT * FROM odontogram_marks
      WHERE patient_id = ? AND user_id = ?
      ORDER BY created_at ASC
    `).all(req.params.patientId, req.user.id);

    res.json({ data: marks });
  } catch (err) {
    console.error('[Odontogram] Error al obtener:', err.message);
    res.status(500).json({ error: 'Error al obtener odontograma' });
  }
});

// POST /api/odontogram
router.post('/', async (req, res) => {
  try {
    const { patient_id, diente_numero, diagnostico, notas } = req.body;
    const uid = req.user.id;

    if (!patient_id || !diente_numero || !diagnostico) {
      return res.status(400).json({ error: 'patient_id, diente_numero y diagnostico son requeridos' });
    }

    const patient = await db.prepare('SELECT id FROM patients WHERE id = ? AND user_id = ?').get(patient_id, uid);
    if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

    const result = await db.prepare(`
      INSERT INTO odontogram_marks (patient_id, user_id, diente_numero, diagnostico, notas)
      VALUES (?, ?, ?, ?, ?)
    `).run(patient_id, uid, diente_numero, diagnostico, notas || null);

    const newMark = await db.prepare('SELECT * FROM odontogram_marks WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ data: newMark, message: 'Marca guardada' });
  } catch (err) {
    console.error('[Odontogram] Error al guardar:', err.message);
    res.status(500).json({ error: 'Error al guardar marca en odontograma' });
  }
});

// DELETE /api/odontogram/:id
router.delete('/:id', async (req, res) => {
  try {
    const mark = await db.prepare('SELECT id FROM odontogram_marks WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!mark) return res.status(404).json({ error: 'Marca no encontrada' });
    await db.prepare('DELETE FROM odontogram_marks WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ message: 'Marca eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar marca' });
  }
});

module.exports = router;
