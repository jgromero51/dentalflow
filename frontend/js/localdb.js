/**
 * DentalFlow — Local Database (IndexedDB)
 * Reemplaza el backend Node.js para la app Android (APK).
 * Todos los datos se guardan en el dispositivo, sin servidor.
 */

const _IDB = (() => {
  const DB_NAME = 'dentalflow_db';
  const DB_VERSION = 1;
  let _db = null;

  function now() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} `
         + `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  }

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('patients')) {
          const ps = db.createObjectStore('patients', { keyPath: 'id', autoIncrement: true });
          ps.createIndex('telefono', 'telefono', { unique: true });
          ps.createIndex('nombre',   'nombre',   { unique: false });
        }
        if (!db.objectStoreNames.contains('appointments')) {
          const as = db.createObjectStore('appointments', { keyPath: 'id', autoIncrement: true });
          as.createIndex('patient_id',       'patient_id',       { unique: false });
          as.createIndex('fecha_hora_inicio','fecha_hora_inicio', { unique: false });
          as.createIndex('estado',           'estado',           { unique: false });
        }
        if (!db.objectStoreNames.contains('message_log')) {
          const ml = db.createObjectStore('message_log', { keyPath: 'id', autoIncrement: true });
          ml.createIndex('appointment_id', 'appointment_id', { unique: false });
        }
        if (!db.objectStoreNames.contains('auth')) {
          const auth = db.createObjectStore('auth', { keyPath: 'username' });
        }
      };
      req.onsuccess  = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror    = (e) => reject(e.target.error);
    });
  }

  function getAll(store) {
    return new Promise((resolve, reject) => {
      const req = _db.transaction(store,'readonly').objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }
  function getOne(store, id) {
    return new Promise((resolve, reject) => {
      const req = _db.transaction(store,'readonly').objectStore(store).get(Number(id));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => reject(req.error);
    });
  }
  function getByIndex(store, index, value) {
    return new Promise((resolve, reject) => {
      const req = _db.transaction(store,'readonly').objectStore(store).index(index).getAll(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }
  function add(store, obj) {
    obj.created_at = obj.created_at || now();
    obj.updated_at = obj.updated_at || now();
    return new Promise((resolve, reject) => {
      const req = _db.transaction(store,'readwrite').objectStore(store).add(obj);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }
  function put(store, obj) {
    obj.updated_at = now();
    return new Promise((resolve, reject) => {
      const req = _db.transaction(store,'readwrite').objectStore(store).put(obj);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }
  function del(store, id) {
    return new Promise((resolve, reject) => {
      const req = _db.transaction(store,'readwrite').objectStore(store).delete(Number(id));
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  return { open, getAll, getOne, getByIndex, add, put, del, now };
})();

// ================================================================
// PATIENTS
// ================================================================
const localPatients = {
  async list(q = '') {
    await _IDB.open();
    let patients = await _IDB.getAll('patients');
    if (q && q.trim()) {
      const t = q.trim().toLowerCase();
      patients = patients.filter(p =>
        p.nombre.toLowerCase().includes(t) || p.telefono.includes(t)
      );
    }
    patients.sort((a, b) => a.nombre.localeCompare(b.nombre));

    const allAppts = await _IDB.getAll('appointments');
    return patients.slice(0, 100).map(p => {
      const pAppts = allAppts.filter(a => a.patient_id === p.id);
      return {
        ...p,
        total_citas: pAppts.length,
        ultima_cita: pAppts.length
          ? pAppts.sort((a,b) => b.fecha_hora_inicio.localeCompare(a.fecha_hora_inicio))[0].fecha_hora_inicio
          : null,
      };
    });
  },

  async get(id) {
    await _IDB.open();
    const patient = await _IDB.getOne('patients', id);
    if (!patient) { const e = new Error('Paciente no encontrado'); e.status = 404; throw e; }
    const allAppts = await _IDB.getAll('appointments');
    const appointments = allAppts
      .filter(a => a.patient_id === Number(id))
      .sort((a, b) => b.fecha_hora_inicio.localeCompare(a.fecha_hora_inicio))
      .slice(0, 20);
    return { ...patient, appointments };
  },

  async create({ nombre, telefono, dni, notas }) {
    await _IDB.open();
    const tel = telefono.trim().startsWith('+') ? telefono.trim() : `+${telefono.trim()}`;
    const all = await _IDB.getAll('patients');
    const dup = all.find(p => p.telefono === tel);
    if (dup) { const e = new Error('Ya existe un paciente con ese número'); e.status = 409; e.existingId = dup.id; throw e; }
    const id = await _IDB.add('patients', { nombre: nombre.trim(), telefono: tel, dni: dni || null, notas: notas || null });
    return _IDB.getOne('patients', id);
  },

  async update(id, { nombre, telefono, dni, notas }) {
    await _IDB.open();
    const patient = await _IDB.getOne('patients', id);
    if (!patient) { const e = new Error('Paciente no encontrado'); e.status = 404; throw e; }
    const tel = telefono
      ? (telefono.trim().startsWith('+') ? telefono.trim() : `+${telefono.trim()}`)
      : patient.telefono;
    const updated = {
      ...patient,
      nombre:   nombre?.trim()              || patient.nombre,
      telefono: tel,
      dni:      dni   !== undefined ? dni   : patient.dni,
      notas:    notas !== undefined ? notas : patient.notas,
    };
    await _IDB.put('patients', updated);
    return _IDB.getOne('patients', Number(id));
  },

  async delete(id) {
    await _IDB.open();
    const patient = await _IDB.getOne('patients', id);
    if (!patient) { const e = new Error('Paciente no encontrado'); e.status = 404; throw e; }
    // cascade: delete appointments
    const appts = await _IDB.getAll('appointments');
    for (const a of appts.filter(a => a.patient_id === Number(id))) {
      await _IDB.del('appointments', a.id);
    }
    await _IDB.del('patients', Number(id));
    return { message: `Paciente "${patient.nombre}" eliminado` };
  },
};

// ================================================================
// APPOINTMENTS
// ================================================================
function _calcFin(inicioISO, mins) {
  return new Date(new Date(inicioISO).getTime() + mins * 60000);
}
function _fmtHora(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
async function _conflicto(fechaHoraInicio, duracionMinutos, excludeId = null) {
  const inicio = new Date(fechaHoraInicio);
  const fin    = _calcFin(fechaHoraInicio, duracionMinutos);
  const fecha  = fechaHoraInicio.split('T')[0];
  const all    = await _IDB.getAll('appointments');
  const patients = await _IDB.getAll('patients');

  for (const c of all) {
    if (excludeId && c.id === Number(excludeId)) continue;
    if (['cancelada','no_asistio'].includes(c.estado)) continue;
    if (!c.fecha_hora_inicio.startsWith(fecha)) continue;
    const cInicio = new Date(c.fecha_hora_inicio);
    const cFin    = _calcFin(c.fecha_hora_inicio, c.duracion_minutos);
    if (inicio < cFin && fin > cInicio) {
      const p = patients.find(p => p.id === c.patient_id);
      return { ...c, paciente_nombre: p?.nombre || '?' };
    }
  }
  return null;
}

async function _apptWithPatient(appt) {
  if (!appt) return null;
  const p = await _IDB.getOne('patients', appt.patient_id);
  return { ...appt, paciente_nombre: p?.nombre || '?', paciente_telefono: p?.telefono || '', paciente_dni: p?.dni || '' };
}

const localAppointments = {
  async list({ fecha, estado, patient_id, page = 1, limit = 50 } = {}) {
    await _IDB.open();
    let all = await _IDB.getAll('appointments');
    if (fecha)      all = all.filter(a => a.fecha_hora_inicio.startsWith(fecha));
    if (estado)     all = all.filter(a => a.estado === estado);
    if (patient_id) all = all.filter(a => a.patient_id === Number(patient_id));
    all.sort((a, b) => a.fecha_hora_inicio.localeCompare(b.fecha_hora_inicio));
    const total = all.length;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const page_data = all.slice(offset, offset + parseInt(limit));
    const data = await Promise.all(page_data.map(_apptWithPatient));
    return { data, total, page: parseInt(page) };
  },

  async today() {
    await _IDB.open();
    const hoy = new Date().toISOString().split('T')[0];
    let all = await _IDB.getAll('appointments');
    all = all.filter(a => a.fecha_hora_inicio.startsWith(hoy));
    all.sort((a, b) => a.fecha_hora_inicio.localeCompare(b.fecha_hora_inicio));
    const data = await Promise.all(all.map(_apptWithPatient));
    return { data, fecha: hoy, total: data.length };
  },

  async upcoming() {
    await _IDB.open();
    const ahora    = new Date().toISOString().slice(0,19);
    const en30dias = new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0,19);
    let all = await _IDB.getAll('appointments');
    all = all.filter(a =>
      a.fecha_hora_inicio >= ahora &&
      a.fecha_hora_inicio <= en30dias &&
      !['cancelada','no_asistio'].includes(a.estado)
    );
    all.sort((a, b) => a.fecha_hora_inicio.localeCompare(b.fecha_hora_inicio));
    const data = await Promise.all(all.slice(0, 30).map(_apptWithPatient));
    return { data, total: data.length };
  },

  async slots(fecha) {
    await _IDB.open();
    let all = await _IDB.getAll('appointments');
    all = all.filter(a => a.fecha_hora_inicio.startsWith(fecha) && !['cancelada','no_asistio'].includes(a.estado));
    all.sort((a, b) => a.fecha_hora_inicio.localeCompare(b.fecha_hora_inicio));
    const patients = await _IDB.getAll('patients');
    const slots = all.map(c => {
      const p = patients.find(p => p.id === c.patient_id);
      return {
        inicio:   c.fecha_hora_inicio,
        fin:      _calcFin(c.fecha_hora_inicio, c.duracion_minutos).toISOString().slice(0,19),
        duracion: c.duracion_minutos,
        paciente: p?.nombre || '?',
        estado:   c.estado,
      };
    });
    return { data: slots, fecha };
  },

  async get(id) {
    await _IDB.open();
    const appt = await _IDB.getOne('appointments', id);
    if (!appt) { const e = new Error('Cita no encontrada'); e.status = 404; throw e; }
    const full = await _apptWithPatient(appt);
    const messages = await _IDB.getByIndex('message_log', 'appointment_id', Number(id));
    messages.sort((a,b) => a.created_at.localeCompare(b.created_at));
    return { data: { ...full, messages } };
  },

  async create({ patient_id, nombre, telefono, fecha_hora_inicio, duracion_minutos, descripcion }) {
    await _IDB.open();
    if (!fecha_hora_inicio)                throw Object.assign(new Error('Fecha y hora requerida'), { status: 400 });
    if (!duracion_minutos || duracion_minutos < 15) throw Object.assign(new Error('Duración mínima 15 min'), { status: 400 });
    if (isNaN(new Date(fecha_hora_inicio).getTime())) throw Object.assign(new Error('Fecha inválida'), { status: 400 });

    if (!patient_id || patient_id === 'new') {
      if (!nombre || !telefono) throw Object.assign(new Error('Proporciona patient_id o nombre+teléfono'), { status: 400 });
      const tel = telefono.trim().startsWith('+') ? telefono.trim() : `+${telefono.trim()}`;
      const all = await _IDB.getAll('patients');
      let pat = all.find(p => p.telefono === tel);
      if (!pat) {
        const newId = await _IDB.add('patients', { nombre: nombre.trim(), telefono: tel });
        pat = await _IDB.getOne('patients', newId);
      }
      patient_id = pat.id;
    } else {
      const pat = await _IDB.getOne('patients', patient_id);
      if (!pat) throw Object.assign(new Error('Paciente no encontrado'), { status: 404 });
    }

    const conflicto = await _conflicto(fecha_hora_inicio, parseInt(duracion_minutos));
    if (conflicto) {
      const fin = _calcFin(conflicto.fecha_hora_inicio, conflicto.duracion_minutos);
      const e = new Error('Conflicto de horario');
      e.status = 409;
      e.data = {
        error: 'Conflicto de horario',
        message: `Ya hay una cita con ${conflicto.paciente_nombre} de ${_fmtHora(conflicto.fecha_hora_inicio)} a ${_fmtHora(fin.toISOString())}.`,
        conflicto: { id: conflicto.id, paciente: conflicto.paciente_nombre, inicio: conflicto.fecha_hora_inicio },
      };
      throw e;
    }

    const newId = await _IDB.add('appointments', {
      patient_id:     Number(patient_id),
      fecha_hora_inicio,
      duracion_minutos: parseInt(duracion_minutos),
      descripcion:    descripcion || null,
      estado:         'pendiente',
      recordatorio_24h_enviado: 0,
      recordatorio_4h_enviado:  0,
    });
    const newAppt = await _apptWithPatient(await _IDB.getOne('appointments', newId));
    return { data: newAppt, message: 'Cita creada exitosamente.' };
  },

  async update(id, { fecha_hora_inicio, duracion_minutos, descripcion, estado }) {
    await _IDB.open();
    const appt = await _IDB.getOne('appointments', id);
    if (!appt) { const e = new Error('Cita no encontrada'); e.status = 404; throw e; }

    const newInicio   = fecha_hora_inicio || appt.fecha_hora_inicio;
    const newDuracion = duracion_minutos  || appt.duracion_minutos;

    if (fecha_hora_inicio || duracion_minutos) {
      const c = await _conflicto(newInicio, parseInt(newDuracion), parseInt(id));
      if (c) { const e = new Error('Conflicto de horario'); e.status = 409; e.data = { conflicto: c }; throw e; }
    }

    const validos = ['pendiente','confirmada','cancelada','no_asistio'];
    if (estado && !validos.includes(estado)) throw Object.assign(new Error('Estado inválido'), { status: 400 });

    const updated = {
      ...appt,
      fecha_hora_inicio: newInicio,
      duracion_minutos:  parseInt(newDuracion),
      descripcion:       descripcion !== undefined ? descripcion : appt.descripcion,
      estado:            estado || appt.estado,
    };
    await _IDB.put('appointments', updated);
    const full = await _apptWithPatient(await _IDB.getOne('appointments', Number(id)));
    return { data: full, message: 'Cita actualizada' };
  },

  async delete(id) {
    await _IDB.open();
    const appt = await _IDB.getOne('appointments', id);
    if (!appt) { const e = new Error('Cita no encontrada'); e.status = 404; throw e; }
    await _IDB.del('appointments', Number(id));
    return { message: 'Cita eliminada' };
  },
};

// ================================================================
// AUTH (Local users)
// ================================================================
const localAuthStore = {
  async list() {
    await _IDB.open();
    return _IDB.getAll('auth');
  },
  async get(username) {
    await _IDB.open();
    return new Promise((resolve, reject) => {
      const req = _IDB.open().then(db => {
        const r = db.transaction('auth','readonly').objectStore('auth').get(username);
        r.onsuccess = () => resolve(r.result || null);
        r.onerror   = () => reject(r.error);
      });
    });
  },
  async save(user) {
    await _IDB.open();
    return _IDB.put('auth', user);
  }
};

window.localDB = {
  patients:     localPatients,
  appointments: localAppointments,
  auth:         localAuthStore,
  open:         _IDB.open,
};
