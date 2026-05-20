/**
 * DentalFlow — Catálogo de Tratamientos
 * CRUD para los tratamientos con precios del doctor.
 * POST /api/catalog/proforma-voice — genera items de proforma desde nota de voz.
 */
const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');
const { generateProformaFromVoice } = require('../services/ai');

// GET /api/catalog
router.get('/', async (req, res) => {
  try {
    const rows = await db.prepare(
      `SELECT * FROM treatment_catalog WHERE user_id = ? ORDER BY categoria, nombre`
    ).all(req.user.id);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/catalog
router.post('/', async (req, res) => {
  const { nombre, categoria, precio, descripcion } = req.body;
  if (!nombre || precio === undefined) return res.status(400).json({ error: 'Faltan campos' });
  try {
    const result = await db.prepare(
      `INSERT INTO treatment_catalog (user_id, nombre, categoria, precio, descripcion) VALUES (?, ?, ?, ?, ?)`
    ).run(req.user.id, nombre.trim(), categoria || 'General', parseFloat(precio), descripcion || '');
    const row = await db.prepare(`SELECT * FROM treatment_catalog WHERE id = ?`).get(result.lastInsertRowid);
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/catalog/:id
router.put('/:id', async (req, res) => {
  const { nombre, categoria, precio, descripcion } = req.body;
  try {
    await db.prepare(
      `UPDATE treatment_catalog SET nombre=?, categoria=?, precio=?, descripcion=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`
    ).run(nombre.trim(), categoria || 'General', parseFloat(precio), descripcion || '', req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/catalog/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.prepare(`DELETE FROM treatment_catalog WHERE id=? AND user_id=?`).run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/catalog/proforma-voice — audio base64 → items de proforma con precios del catálogo
router.post('/proforma-voice', async (req, res) => {
  const { audio, ext } = req.body;
  if (!audio) return res.status(400).json({ error: 'Falta el audio' });
  try {
    const catalog = await db.prepare(
      `SELECT nombre, categoria, precio FROM treatment_catalog WHERE user_id = ? ORDER BY nombre`
    ).all(req.user.id);
    const items = await generateProformaFromVoice(audio, ext || 'webm', catalog);
    res.json({ success: true, data: items });
  } catch (err) {
    console.error('[Catalog] Error voz→proforma:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
