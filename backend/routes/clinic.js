/**
 * DentalFlow — Rutas de Clínica
 * Gestión de clínica, doctores e invitaciones
 *
 * GET  /api/clinic          → Info de la clínica actual
 * PUT  /api/clinic          → Actualizar nombre de clínica
 * GET  /api/clinic/doctors  → Listar doctores de la clínica
 * POST /api/clinic/invite   → Generar código de invitación
 * POST /api/auth/join       → Unirse a clínica con código (en auth.js)
 * DELETE /api/clinic/doctors/:id → Eliminar doctor de la clínica
 */
const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { knex } = require('../db/database');

// GET /api/clinic
router.get('/', async (req, res) => {
  try {
    const clinic = await knex('clinics').where('id', req.user.clinic_id).first();
    if (!clinic) return res.status(404).json({ error: 'Clínica no encontrada' });
    const doctors = await knex('users')
      .where('clinic_id', req.user.clinic_id)
      .select('id', 'username', 'doctor_name', 'role', 'email', 'last_login');
    res.json({ clinic, doctors });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/clinic
router.put('/', async (req, res) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede modificar la clínica.' });
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });
    await knex('clinics').where('id', req.user.clinic_id).update({ name: name.trim(), updated_at: new Date() });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/clinic/doctors
router.get('/doctors', async (req, res) => {
  try {
    const doctors = await knex('users')
      .where('clinic_id', req.user.clinic_id)
      .select('id', 'username', 'doctor_name', 'role', 'email', 'last_login', 'created_at');
    res.json({ data: doctors });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/clinic/invite — genera código de invitación válido 48h
router.post('/invite', async (req, res) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede invitar doctores.' });
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    await knex('clinics').where('id', req.user.clinic_id).update({ invite_code: code });
    res.json({ invite_code: code });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/clinic/doctors/:id
router.delete('/doctors/:id', async (req, res) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ error: 'Solo el propietario puede eliminar doctores.' });
    const doctorId = parseInt(req.params.id);
    if (doctorId === req.user.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo.' });
    const doc = await knex('users').where({ id: doctorId, clinic_id: req.user.clinic_id }).first();
    if (!doc) return res.status(404).json({ error: 'Doctor no encontrado en esta clínica.' });
    // Desasociar sin eliminar su cuenta
    await knex('users').where('id', doctorId).update({ clinic_id: null });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
