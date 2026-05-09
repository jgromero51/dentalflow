/**
 * DentalFlow — Ruta: Odontograma
 * Permite guardar y recuperar el estado de las piezas dentales por paciente.
 */
const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

// GET /api/odontogram/:patientId
// Obtiene todas las marcas del odontograma de un paciente
router.get('/:patientId', async (req, res) => {
  try {
    const marks = await db.prepare(`
      SELECT * FROM odontogram_marks
      WHERE patient_id = ?
      ORDER BY created_at ASC
    `).all(req.params.patientId);

    // Agrupar por diente para obtener el estado más reciente (o mantener el historial)
    // Para simplificar, el frontend puede necesitar solo el estado actual, pero enviamos todo el historial.
    res.json({ data: marks });
  } catch (err) {
    console.error('[Odontogram] Error al obtener:', err.message);
    res.status(500).json({ error: 'Error al obtener odontograma' });
  }
});

// POST /api/odontogram
// Crea una nueva marca para un diente
router.post('/', async (req, res) => {
  try {
    const { patient_id, diente_numero, diagnostico, notas } = req.body;

    if (!patient_id || !diente_numero || !diagnostico) {
      return res.status(400).json({ error: 'patient_id, diente_numero y diagnostico son requeridos' });
    }

    const result = await db.prepare(`
      INSERT INTO odontogram_marks (patient_id, diente_numero, diagnostico, notas)
      VALUES (?, ?, ?, ?)
    `).run(patient_id, diente_numero, diagnostico, notas || null);

    const newMark = await db.prepare('SELECT * FROM odontogram_marks WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ data: newMark, message: 'Marca guardada' });
  } catch (err) {
    console.error('[Odontogram] Error al guardar:', err.message);
    res.status(500).json({ error: 'Error al guardar marca en odontograma' });
  }
});

// DELETE /api/odontogram/:id
// Elimina una marca específica (si el doctor se equivocó)
router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM odontogram_marks WHERE id = ?').run(req.params.id);
    res.json({ message: 'Marca eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar marca' });
  }
});

module.exports = router;
