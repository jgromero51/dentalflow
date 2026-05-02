/**
 * DentalFlow — API Client
 * Modo dual:
 *   - WEB (servidor corriendo): usa fetch() → Node.js backend
 *   - APK / OFFLINE (window.localDB disponible): usa IndexedDB directamente
 */

const API_BASE = '/api';

// Detecta si estamos en modo nativo (Capacitor APK) o sin servidor
const IS_NATIVE = typeof window !== 'undefined' &&
  (window.Capacitor !== undefined || window.__USE_LOCAL_DB === true);

// ---- Helper: normaliza errores del localDB al mismo formato que el backend ----
function wrapLocal(fn) {
  return async (...args) => {
    try {
      const result = await fn(...args);
      return result;
    } catch (err) {
      // Si el error tiene .data (ej: conflicto), lo propaga igual que el backend
      if (err.data) throw Object.assign(err, err.data);
      throw err;
    }
  };
}

// ---- API en modo servidor (fetch) ----
const remoteApi = {
  async request(method, path, body = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res  = await fetch(`${API_BASE}${path}`, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || data.message || 'Error'), { status: res.status, data });
    return data;
  },

  appointments: {
    list:         (p = {})        => remoteApi.request('GET', `/appointments?${new URLSearchParams(p)}`),
    today:        ()              => remoteApi.request('GET', '/appointments/today'),
    upcoming:     ()              => remoteApi.request('GET', '/appointments/upcoming'),
    get:          (id)            => remoteApi.request('GET', `/appointments/${id}`),
    slots:        (fecha)         => remoteApi.request('GET', `/appointments/slots/${fecha}`),
    create:       (data)          => remoteApi.request('POST', '/appointments', data),
    update:       (id, data)      => remoteApi.request('PUT', `/appointments/${id}`, data),
    delete:       (id)            => remoteApi.request('DELETE', `/appointments/${id}`),
    updateStatus: (id, estado)    => remoteApi.request('PUT', `/appointments/${id}`, { estado }),
  },

  patients: {
    list:   (q = '') => remoteApi.request('GET', `/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    get:    (id)     => remoteApi.request('GET', `/patients/${id}`),
    create: (data)   => remoteApi.request('POST', '/patients', data),
    update: (id, d)  => remoteApi.request('PUT', `/patients/${id}`, d),
    delete: (id)     => remoteApi.request('DELETE', `/patients/${id}`),
  },

  health: () => remoteApi.request('GET', '/health'),
};

// ---- API en modo local (IndexedDB) ----
const localApi = {
  async request() { throw new Error('localApi.request() no se usa directamente'); },

  appointments: {
    list:         (p = {})     => wrapLocal(window.localDB.appointments.list)(p),
    today:        ()           => wrapLocal(window.localDB.appointments.today)(),
    upcoming:     ()           => wrapLocal(window.localDB.appointments.upcoming)(),
    get:          (id)         => wrapLocal(window.localDB.appointments.get)(id),
    slots:        (fecha)      => wrapLocal(window.localDB.appointments.slots)(fecha),
    create:       (data)       => wrapLocal(window.localDB.appointments.create)(data),
    update:       (id, data)   => wrapLocal(window.localDB.appointments.update)(id, data),
    delete:       (id)         => wrapLocal(window.localDB.appointments.delete)(id),
    updateStatus: (id, estado) => wrapLocal(window.localDB.appointments.update)(id, { estado }),
  },

  patients: {
    list:   (q = '') => wrapLocal((q) => window.localDB.patients.list(q).then(data => ({ data, total: data.length })))(q),
    get:    (id)     => wrapLocal((id) => window.localDB.patients.get(id).then(data => ({ data })))(id),
    create: (data)   => wrapLocal((d)  => window.localDB.patients.create(d).then(data => ({ data, message: 'Paciente creado' })))(data),
    update: (id, d)  => wrapLocal((id, d) => window.localDB.patients.update(id, d).then(data => ({ data, message: 'Actualizado' })))(id, d),
    delete: (id)     => wrapLocal(window.localDB.patients.delete)(id),
  },

  health: () => Promise.resolve({ status: 'OK', app: 'DentalFlow', version: '1.0.0-apk', mode: 'local' }),
};

// ---- Selección automática de modo ----
const api = IS_NATIVE ? localApi : remoteApi;

// Si no es nativo pero no hay servidor, intenta detectarlo y cambiar a local
if (!IS_NATIVE) {
  const _origAppointmentsToday = api.appointments.today;
  let _serverOk = null;

  const _checkServer = async () => {
    if (_serverOk !== null) return _serverOk;
    try {
      const r = await fetch('/api/health', { signal: AbortSignal.timeout(2000) });
      _serverOk = r.ok;
    } catch {
      _serverOk = false;
    }
    if (!_serverOk && window.localDB) {
      console.warn('[API] Servidor no disponible → modo offline (IndexedDB)');
      // Redirige todas las llamadas al modo local
      Object.assign(api.appointments, localApi.appointments);
      Object.assign(api.patients,     localApi.patients);
      api.health = localApi.health;
    }
    return _serverOk;
  };

  // Verificar al cargar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _checkServer);
  } else {
    _checkServer();
  }
}

window.api = api;
