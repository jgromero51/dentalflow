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

  const appts = await db.prepare(query).all(...params);
  for (const cita of appts) {
    const cInicio = new Date(cita.fecha_hora_inicio);
    const cFin    = calcularFin(cita.fecha_hora_inicio, cita.duracion_minutos);
    if (inicio < cFin && fin > cInicio) return cita;
  }
  return null;
}

// GET /api/appointments — listar con filtros opcionales
router.get('/', async (req, res) => {
  try {
    const { fecha, estado, patient_id, page = 1, limit = 50 } = req.query;
    const params = [];
    let wc = 'WHERE 1=1';
    
    if (fecha)      { wc += ' AND a.fecha_hora_inicio LIKE ?'; params.push(`${fecha}%`); }
    if (estado)     { wc += ' AND a.estado = ?';             params.push(estado); }
    if (patient_id) { wc += ' AND a.patient_id = ?';          params.push(patient_id); }

    const data = await db.prepare(`
      SELECT a.*, p.nombre as paciente_nombre, p.telefono as paciente_telefono
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      ${wc}
      ORDER BY a.fecha_hora_inicio ASC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const totalRes = await db.prepare(`SELECT COUNT(*) as c FROM appointments a ${wc}`).get(...params);
    res.json({ data, total: totalRes.c, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/appointments/today
router.get('/today', async (req, res) => {
  try {
    const hoy = new Date().toISOString().split('T')[0];
    const data = await db.prepare(`
      SELECT a.*, p.nombre as paciente_nombre, p.telefono as paciente_telefono
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      WHERE a.fecha_hora_inicio LIKE ?
      ORDER BY a.fecha_hora_inicio ASC
    `).all(`${hoy}%`);
    res.json({ data, fecha: hoy, total: data.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/appointments/upcoming
router.get('/upcoming', async (req, res) => {
  try {
    const ahora    = toLocalISO();
    const en30dias = toLocalISO(new Date(Date.now() + 30*24*60*60*1000));
    const data = await db.prepare(`
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
router.get('/slots/:fecha', async (req, res) => {
  try {
    const { fecha } = req.params;
    const citas = await db.prepare(`
      SELECT a.fecha_hora_inicio, a.duracion_minutos, a.estado, p.nombre as paciente_nombre
      FROM appointments a JOIN patients p ON p.id = a.patient_id
      WHERE a.fecha_hora_inicio LIKE ? AND a.estado NOT IN ('cancelada','no_asistio')
      ORDER BY a.fecha_hora_inicio ASC
    `).all(`${fecha}%`);

    const slots = citas.map(c => ({
      inicio: c.fecha_hora_inicio,
      fin: calcularFin(c.fecha_hora_inicio, c.duracion_minutos).toISOString().slice(0,19),
      duracion: c.duracion_minutos,
      paciente: c.paciente_nombre,
      estado: c.estado,
    }));
    res.json({ data: slots, fecha: fecha });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/appointments/:id
router.get('/:id', async (req, res) => {
  try {
    const appt = await db.prepare(`
      SELECT a.*, p.nombre as paciente_nombre, p.telefono as paciente_telefono, p.dni as paciente_dni
      FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.id = ?
    `).get(req.params.id);
    if (!appt) return res.status(404).json({ error: 'Cita no encontrada' });

    const messages = await db.prepare('SELECT * FROM message_log WHERE appointment_id = ? ORDER BY created_at ASC').all(req.params.id);
    res.json({ data: { ...appt, messages } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/appointments — crear cita (con creación inline de paciente)
router.post('/', async (req, res) => {
  try {
    let { patient_id, nombre, telefono, fecha_hora_inicio, duracion_minutos, descripcion, costo_estimado, monto_pagado } = req.body;
    let p_id = null;

    if (!fecha_hora_inicio) return res.status(400).json({ error: 'La fecha y hora de inicio es requerida' });
    if (!duracion_minutos || duracion_minutos < 15) return res.status(400).json({ error: 'La duración mínima es 15 minutos' });
    if (isNaN(new Date(fecha_hora_inicio).getTime())) return res.status(400).json({ error: 'Formato de fecha inválido' });

    if (patient_id === 'new' && nombre && telefono) {
      const tel = telefono.replace(/\D/g, '');
      let patient = await db.prepare('SELECT * FROM patients WHERE telefono = ?').get(tel);
      if (!patient) {
        const r = await db.prepare('INSERT INTO patients (nombre, telefono) VALUES (?, ?)').run(nombre.trim(), tel);
        patient = await db.prepare('SELECT * FROM patients WHERE id = ?').get(r.lastInsertRowid);
      }
      p_id = patient.id;
    } else {
      if (!await db.prepare('SELECT id FROM patients WHERE id = ?').get(patient_id)) {
        return res.status(400).json({ error: 'El paciente no existe.' });
      }
      p_id = patient_id;
    }

    const conflicto = await verificarConflicto(fecha_hora_inicio, parseInt(duracion_minutos));
    if (conflicto) {
      const fin = calcularFin(conflicto.fecha_hora_inicio, conflicto.duracion_minutos);
      return res.status(409).json({
        error: 'Conflicto de horario',
        message: `Ya hay una cita con ${conflicto.paciente_nombre} de ${formatHora(conflicto.fecha_hora_inicio)} a ${formatHora(fin.toISOString())} que se solaparía.`,
        conflicto: { id: conflicto.id, paciente: conflicto.paciente_nombre, inicio: conflicto.fecha_hora_inicio }
      });
    }

    const result = await db.prepare(`
      INSERT INTO appointments (patient_id, fecha_hora_inicio, duracion_minutos, descripcion, estado, costo_estimado, monto_pagado)
      VALUES (?, ?, ?, ?, 'pendiente', ?, ?)
    `).run(p_id, fecha_hora_inicio, parseInt(duracion_minutos), descripcion || null, parseFloat(costo_estimado) || 0, parseFloat(monto_pagado) || 0);

    const newAppt = await db.prepare(`
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
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { estado, fecha_hora_inicio, duracion_minutos, descripcion, costo_estimado, monto_pagado } = req.body;

  try {
    const appt = await db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
    if (!appt) return res.status(404).json({ error: 'Cita no encontrada' });

    if (fecha_hora_inicio && fecha_hora_inicio !== appt.fecha_hora_inicio) {
       const conflicto = await verificarConflicto(fecha_hora_inicio, duracion_minutos || appt.duracion_minutos, parseInt(id));
       if (conflicto) return res.status(409).json({ error: 'Conflicto de horario', conflicto });
    }

    await db.prepare(`
      UPDATE appointments
      SET estado = ?, fecha_hora_inicio = ?, duracion_minutos = ?, descripcion = ?, 
          costo_estimado = ?, monto_pagado = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      estado || appt.estado,
      fecha_hora_inicio || appt.fecha_hora_inicio,
      duracion_minutos !== undefined ? duracion_minutos : appt.duracion_minutos,
      descripcion !== undefined ? descripcion : appt.descripcion,
      costo_estimado !== undefined ? costo_estimado : appt.costo_estimado,
      monto_pagado !== undefined ? monto_pagado : appt.monto_pagado,
      id
    );

    const updated = await db.prepare(`
      SELECT a.*, p.nombre as paciente_nombre, p.telefono as paciente_telefono
      FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.id = ?
    `).get(id);

    res.json({ data: updated, message: 'Cita actualizada' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/appointments/:id
router.delete('/:id', async (req, res) => {
  try {
    if (!await db.prepare('SELECT id FROM appointments WHERE id = ?').get(req.params.id)) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }
    await db.prepare('DELETE FROM appointments WHERE id = ?').run(req.params.id);
    res.json({ message: 'Cita eliminada' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
