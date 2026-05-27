/**
 * DentalFlow — Exportación de datos en CSV
 */
const express = require('express');
const router  = express.Router();
const { knex } = require('../db/database');

function escapeCSV(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCSV(headers, rows) {
  const head = headers.join(',');
  const body = rows.map(row => headers.map(h => escapeCSV(row[h])).join(',')).join('\n');
  return '﻿' + head + '\n' + body; // BOM para Excel
}

// GET /api/export/patients
router.get('/patients', async (req, res) => {
  try {
    const rows = await knex('patients')
      .where('user_id', req.user.id)
      .orderBy('nombre', 'asc')
      .select('nombre', 'telefono', 'dni', 'tipo_sangre', 'alergias', 'enfermedades_previas', 'notas', 'created_at');

    const headers = ['nombre', 'telefono', 'dni', 'tipo_sangre', 'alergias', 'enfermedades_previas', 'notas', 'created_at'];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="pacientes.csv"');
    res.send(toCSV(headers, rows));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/export/appointments
router.get('/appointments', async (req, res) => {
  try {
    const rows = await knex('appointments as a')
      .join('patients as p', 'p.id', 'a.patient_id')
      .where('a.user_id', req.user.id)
      .orderBy('a.fecha_hora_inicio', 'asc')
      .select(
        'p.nombre as paciente', 'p.telefono',
        'a.fecha_hora_inicio', 'a.duracion_minutos', 'a.estado',
        'a.descripcion', 'a.costo_estimado', 'a.monto_pagado',
        'a.recordatorio_24h_enviado', 'a.recordatorio_4h_enviado', 'a.created_at'
      );

    const headers = ['paciente', 'telefono', 'fecha_hora_inicio', 'duracion_minutos', 'estado', 'descripcion', 'costo_estimado', 'monto_pagado', 'recordatorio_24h_enviado', 'recordatorio_4h_enviado', 'created_at'];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="citas.csv"');
    res.send(toCSV(headers, rows));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/export/odontogram
router.get('/odontogram', async (req, res) => {
  try {
    const rows = await knex('odontogram_marks as o')
      .join('patients as p', 'p.id', 'o.patient_id')
      .where('o.user_id', req.user.id)
      .orderBy('p.nombre', 'asc')
      .select('p.nombre as paciente', 'o.diente_numero', 'o.diagnostico', 'o.notas', 'o.created_at');

    const headers = ['paciente', 'diente_numero', 'diagnostico', 'notas', 'created_at'];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="odontograma.csv"');
    res.send(toCSV(headers, rows));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
