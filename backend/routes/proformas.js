/**
 * DentalFlow — Rutas de Proformas
 */
const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');
const { sendMessage } = require('../services/whatsapp');

// GET /api/proformas?patient_id=X
router.get('/', async (req, res) => {
  try {
    const { patient_id } = req.query;
    let rows;
    if (patient_id) {
      rows = await db.prepare(
        `SELECT p.*, pa.nombre as paciente_nombre, pa.telefono as paciente_telefono
         FROM proformas p JOIN patients pa ON pa.id = p.patient_id
         WHERE p.patient_id = ? AND p.user_id = ? ORDER BY p.created_at DESC`
      ).all(patient_id, req.user.id);
    } else {
      rows = await db.prepare(
        `SELECT p.*, pa.nombre as paciente_nombre FROM proformas p
         JOIN patients pa ON pa.id = p.patient_id
         WHERE p.user_id = ? ORDER BY p.created_at DESC LIMIT 50`
      ).all(req.user.id);
    }
    rows = rows.map(r => ({ ...r, items: JSON.parse(r.items_json || '[]') }));
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/proformas
router.post('/', async (req, res) => {
  const { patient_id, items, notas } = req.body;
  if (!patient_id || !items?.length) return res.status(400).json({ error: 'Faltan datos' });
  try {
    const total = items.reduce((s, i) => s + (parseFloat(i.precio) || 0), 0);
    const result = await db.prepare(
      `INSERT INTO proformas (patient_id, user_id, items_json, notas, total) VALUES (?, ?, ?, ?, ?)`
    ).run(patient_id, req.user.id, JSON.stringify(items), notas || '', total);
    const row = await db.prepare(`SELECT * FROM proformas WHERE id = ?`).get(result.lastInsertRowid);
    res.json({ success: true, data: { ...row, items: JSON.parse(row.items_json) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/proformas/:id
router.put('/:id', async (req, res) => {
  const { items, notas, estado } = req.body;
  try {
    const total = (items || []).reduce((s, i) => s + (parseFloat(i.precio) || 0), 0);
    await db.prepare(
      `UPDATE proformas SET items_json=?, notas=?, total=?, estado=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`
    ).run(JSON.stringify(items || []), notas || '', total, estado || 'borrador', req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/proformas/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.prepare(`DELETE FROM proformas WHERE id=? AND user_id=?`).run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/proformas/:id/send-whatsapp — envía resumen por WhatsApp al paciente
router.post('/:id/send-whatsapp', async (req, res) => {
  try {
    const row = await db.prepare(
      `SELECT p.*, pa.nombre as paciente_nombre, pa.telefono as paciente_telefono
       FROM proformas p JOIN patients pa ON pa.id = p.patient_id
       WHERE p.id = ? AND p.user_id = ?`
    ).get(req.params.id, req.user.id);

    if (!row) return res.status(404).json({ error: 'Proforma no encontrada' });
    if (!row.paciente_telefono) return res.status(400).json({ error: 'El paciente no tiene teléfono registrado' });

    const items   = JSON.parse(row.items_json || '[]');
    const lineas  = items.map(i => `  • ${i.nombre}: S/ ${parseFloat(i.precio).toFixed(2)}`).join('\n');
    const fecha   = new Date(row.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });

    const mensaje = `🦷 *Presupuesto de Tratamiento*\n\n👤 ${row.paciente_nombre}\n📅 ${fecha}\n\n*Tratamientos:*\n${lineas}\n\n💰 *Total: S/ ${parseFloat(row.total).toFixed(2)}*${row.notas ? '\n\n📝 ' + row.notas : ''}\n\n_Ante cualquier consulta, no dude en contactarnos._`;

    const result = await sendMessage(row.paciente_telefono, mensaje);

    if (result.success) {
      await db.prepare(`UPDATE proformas SET estado='enviada', updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(row.id);
      res.json({ success: true, demo: result.demo || false });
    } else {
      res.status(500).json({ error: result.error || 'Error al enviar WhatsApp' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
