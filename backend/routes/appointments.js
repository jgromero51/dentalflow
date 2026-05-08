/**
 * DentalFlow — Ruta: Appointments (Citas)
 * Anti-cruces, CRUD completo, filtros por fecha/estado.
 */
const express = require('express');
const router  = express.Router();
const { db, toLocalISO } = require('../db/database');

function calcularFin(inicioISO, duracionMinutos) {
  const inicio = new Date(inicioISO);
  return new Date(inicio.getTime() + duracionMinutos * 60 * 1000);
}

function formatHora(isoString) {
  try {
    const d = new Date(isoString);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } catch { return isoString; }
}

/** Verifica solapamiento. Retorna la cita conflictiva o null */
function verificarConflicto(fechaHoraInicio, duracionMinutos, excludeId = null) {
  const inicio = new Date(fechaHoraInicio);
  const fin    = calcularFin(fechaHoraInicio, duracionMinutos);
  const fecha  = fechaHoraInicio.split('T')[0];

  let query = `
    SELECT a.*, p.nombre as paciente_nombre
    FROM appointments a JOIN patients p ON p.id = a.patient_id
    WHERE date(a.fecha_hora_inicio) = ?
      AND a.estado NOT IN ('cancelada','no_asistio')
  `;
  const params = [fecha];
  if (excludeId) { query += ' AND a.id != ?'; params.push(excludeId); }

  for (const cita of db.prepare(query).all(...params)) {
    const cInicio = new Date(cita.fecha_hora_inicio);
    const cFin    = calcularFin(cita.fecha_hora_inicio, cita.duracion_minutos);
    if (inicio < cFin && fin > cInicio) return cita;
  }
  return null;
}

// GET /api/appointments — listar con filtros opcionales
router.get('/', (req, res) => {
  try {
    const { fecha, estado, patient_id, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = [], params = [];
    if (fecha)      { where.push("date(a.fecha_hora_inicio) = ?"); params.push(fecha); }
    if (estado)     { where.push("a.estado = ?"); params.push(estado); }
    if (patient_id) { where.push("a.patient_id = ?"); params.push(patient_id); }
    const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const data = db.prepare(`
      SELECT a.*, p.nombre as paciente_nombre, p.telefono as paciente_telefono
      FROM appointments a JOIN patients p ON p.id = a.patient_id
      ${wc} ORDER BY a.fecha_hora_inicio ASC LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    const total = db.prepare(`SELECT COUNT(*) as c FROM appointments a ${wc}`).get(...params).c;
    res.json({ data, total, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/appointments/today
router.get('/today', (req, res) => {
  try {
    const hoy = new Date().toISOString().split('T')[0];
    const data = db.prepare(`
      SELECT a.*, p.nombre as paciente_nombre, p.telefono as paciente_telefono
      FROM appointments a JOIN patients p ON p.id = a.patient_id
      WHERE date(a.fecha_hora_inicio) = ? ORDER BY a.fecha_hora_inicio ASC
    `).all(hoy);
    res.json({ data, fecha: hoy, total: data.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/appointments/upcoming
router.get('/upcoming', (req, res) => {
  try {
    const ahora    = toLocalISO();
    const en30dias = toLocalISO(new Date(Date.now() + 30*24*60*60*1000));
    const data = db.prepare(`
      SELECT a.*, p.nombre as paciente_nombre, p.telefono as paciente_telefono
      FROM appointments a JOIN patients p ON p.id = a.patient_id
      WHERE a.fecha_hora_inicio >= ? AND a.fecha_hora_inicio <= ?
        AND a.estado NOT IN ('cancelada','no_asistio')
      ORDER BY a.fecha_hora_inicio ASC LIMIT 30
    `).all(ahora, en30dias);
    res.json({ data, total: data.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/appointments/slots/:fecha
router.get('/slots/:fecha', (req, res) => {
  try {
    const citas = db.prepare(`
      SELECT a.fecha_hora_inicio, a.duracion_minutos, a.estado, p.nombre as paciente_nombre
      FROM appointments a JOIN patients p ON p.id = a.patient_id
      WHERE date(a.fecha_hora_inicio) = ? AND a.estado NOT IN ('cancelada','no_asistio')
      ORDER BY a.fecha_hora_inicio ASC
    `).all(req.params.fecha);

    const slots = citas.map(c => ({
      inicio: c.fecha_hora_inicio,
      fin: calcularFin(c.fecha_hora_inicio, c.duracion_minutos).toISOString().slice(0,19),
      duracion: c.duracion_minutos,
      paciente: c.paciente_nombre,
      estado: c.estado,
    }));
    res.json({ data: slots, fecha: req.params.fecha });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/appointments/:id
router.get('/:id', (req, res) => {
  try {
    const appt = db.prepare(`
      SELECT a.*, p.nombre as paciente_nombre, p.telefono as paciente_telefono, p.dni as paciente_dni
      FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.id = ?
    `).get(req.params.id);
    if (!appt) return res.status(404).json({ error: 'Cita no encontrada' });

    const messages = db.prepare('SELECT * FROM message_log WHERE appointment_id = ? ORDER BY created_at ASC').all(req.params.id);
    res.json({ data: { ...appt, messages } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/appointments — crear cita (con creación inline de paciente)
router.post('/', (req, res) => {
  try {
    let { patient_id, nombre, telefono, fecha_hora_inicio, duracion_minutos, descripcion, costo_estimado, monto_pagado } = req.body;

    if (!fecha_hora_inicio) return res.status(400).json({ error: 'La fecha y hora de inicio es requerida' });
    if (!duracion_minutos || duracion_minutos < 15) return res.status(400).json({ error: 'La duración mínima es 15 minutos' });
    if (isNaN(new Date(fecha_hora_inicio).getTime())) return res.status(400).json({ error: 'Formato de fecha inválido' });

    // Obtener o crear paciente
    if (!patient_id) {
      if (!nombre || !telefono) return res.status(400).json({ error: 'Proporciona patient_id o nombre+teléfono' });
      const tel = telefono.trim().startsWith('+') ? telefono.trim() : `+${telefono.trim()}`;
      let patient = db.prepare('SELECT * FROM patients WHERE telefono = ?').get(tel);
      if (!patient) {
        const r = db.prepare('INSERT INTO patients (nombre, telefono) VALUES (?, ?)').run(nombre.trim(), tel);
        patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(r.lastInsertRowid);
      }
      patient_id = patient.id;
    } else {
      if (!db.prepare('SELECT id FROM patients WHERE id = ?').get(patient_id)) {
        return res.status(404).json({ error: 'Paciente no encontrado' });
      }
    }

    // Anti-cruces
    const conflicto = verificarConflicto(fecha_hora_inicio, parseInt(duracion_minutos));
    if (conflicto) {
      const fin = calcularFin(conflicto.fecha_hora_inicio, conflicto.duracion_minutos);
      return res.status(409).json({
        error: 'Conflicto de horario',
        message: `Ya hay una cita con ${conflicto.paciente_nombre} de ${formatHora(conflicto.fecha_hora_inicio)} a ${formatHora(fin.toISOString())} que se solaparía.`,
        conflicto: { id: conflicto.id, paciente: conflicto.paciente_nombre, inicio: conflicto.fecha_hora_inicio }
      });
    }

    const result = db.prepare(`
      INSERT INTO appointments (patient_id, fecha_hora_inicio, duracion_minutos, descripcion, estado, costo_estimado, monto_pagado)
      VALUES (?, ?, ?, ?, 'pendiente', ?, ?)
    `).run(patient_id, fecha_hora_inicio, parseInt(duracion_minutos), descripcion || null, parseFloat(costo_estimado) || 0, parseFloat(monto_pagado) || 0);

    const newAppt = db.prepare(`
      SELECT a.*, p.nombre as paciente_nombre, p.telefono as paciente_telefono
      FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.id = ?
    `).get(result.lastInsertRowid);

    console.log(`[Appointments] ✅ Nueva cita: ID=${newAppt.id} ${newAppt.paciente_nombre} @ ${newAppt.fecha_hora_inicio}`);
    res.status(201).json({ data: newAppt, message: 'Cita creada. Recordatorios automáticos programados.' });
  } catch (err) {
    console.error('[Appointments] Error al crear:', err.message);
    res.status(500).json({ error: 'Error al crear cita: ' + err.message });
  }
});

// PUT /api/appointments/:id
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { fecha_hora_inicio, duracion_minutos, descripcion, estado, costo_estimado, monto_pagado } = req.body;

    const appt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
    if (!appt) return res.status(404).json({ error: 'Cita no encontrada' });

    const newInicio   = fecha_hora_inicio || appt.fecha_hora_inicio;
    const newDuracion = duracion_minutos  || appt.duracion_minutos;

    if (fecha_hora_inicio || duracion_minutos) {
      const conflicto = verificarConflicto(newInicio, parseInt(newDuracion), parseInt(id));
      if (conflicto) {
        return res.status(409).json({ error: 'Conflicto de horario', conflicto });
      }
    }

    const estadosValidos = ['pendiente','confirmada','cancelada','no_asistio'];
    if (estado && !estadosValidos.includes(estado)) {
      return res.status(400).json({ error: `Estado inválido. Use: ${estadosValidos.join(', ')}` });
    }

    db.prepare(`
      UPDATE appointments SET fecha_hora_inicio=?, duracion_minutos=?, descripcion=?, estado=?, costo_estimado=?, monto_pagado=?,
        updated_at=datetime('now','localtime') WHERE id=?
    `).run(newInicio, parseInt(newDuracion), descripcion??appt.descripcion, estado||appt.estado, costo_estimado !== undefined ? parseFloat(costo_estimado) : appt.costo_estimado, monto_pagado !== undefined ? parseFloat(monto_pagado) : appt.monto_pagado, id);

    const updated = db.prepare(`
      SELECT a.*, p.nombre as paciente_nombre, p.telefono as paciente_telefono
      FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.id = ?
    `).get(id);

    res.json({ data: updated, message: 'Cita actualizada' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/appointments/:id
router.delete('/:id', (req, res) => {
  try {
    if (!db.prepare('SELECT id FROM appointments WHERE id = ?').get(req.params.id)) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }
    db.prepare('DELETE FROM appointments WHERE id = ?').run(req.params.id);
    res.json({ message: 'Cita eliminada' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
