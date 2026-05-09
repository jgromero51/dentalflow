/**
 * DentalFlow — API Client
 * Modo dual:
 *   - WEB (servidor corriendo): usa fetch() → Node.js backend
 *   - APK / OFFLINE (window.localDB disponible): usa IndexedDB directamente
 */

const API_BASE = '/api';

// ---- Gestión de sesión ----
const Auth = {
  getToken()  { return localStorage.getItem('df_token'); },
  setToken(t) { localStorage.setItem('df_token', t); },
  clearToken(){ localStorage.removeItem('df_token'); localStorage.removeItem('df_user'); },
  getUser()   { try { return JSON.parse(localStorage.getItem('df_user') || 'null'); } catch { return null; } },
  setUser(u)  { localStorage.setItem('df_user', JSON.stringify(u)); },
  isLoggedIn(){ return !!this.getToken(); },
};
window.Auth = Auth;

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
    // Inyectar token JWT si existe
    const token = Auth.getToken();
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body) opts.body = JSON.stringify(body);
    const res  = await fetch(`${API_BASE}${path}`, opts);
    const data = await res.json().catch(() => ({}));
    // Si el servidor dice 401, cerrar sesión y forzar render del login
    if (res.status === 401) {
      Auth.clearToken();
      // Forzamos render explícito del login aunque el hash ya sea #login
      // (si el hash no cambia, hashchange no dispara y la vista no se actualiza)
      window.location.hash = 'login';
      if (window.Router) {
        window.Router.handleRoute();
      }
      throw Object.assign(new Error('Sesión expirada. Iniciá sesión para continuar.'), { status: 401 });
    }
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

  settings: {
    get:  ()     => remoteApi.request('GET',  '/settings'),
    save: (data) => remoteApi.request('POST', '/settings', data),
  },

  messages: {
    list: (p = {}) => remoteApi.request('GET', `/messages?${new URLSearchParams(p)}`),
  },

  odontogram: {
    get:    (patientId) => remoteApi.request('GET', `/odontogram/${patientId}`),
    create: (data)      => remoteApi.request('POST', '/odontogram', data),
    delete: (id)        => remoteApi.request('DELETE', `/odontogram/${id}`),
  },

  auth: {
    status:         ()     => remoteApi.request('GET',  '/auth/status'),
    login:          (data) => remoteApi.request('POST', '/auth/login', data),
    setup:          (data) => remoteApi.request('POST', '/auth/setup', data),
    me:             ()     => remoteApi.request('GET',  '/auth/me'),
    changePassword: (data) => remoteApi.request('POST', '/auth/change-password', data),
    logout() { Auth.clearToken(); },
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

  settings: {
    get:  () => Promise.resolve({ data: {} }),
    save: () => Promise.resolve({ success: true }),
  },

  messages: {
    list: () => Promise.resolve({ data: [], total: 0 }),
  },

  odontogram: {
    get:    () => Promise.resolve({ data: [] }),
    create: () => Promise.resolve({ data: {} }),
    delete: () => Promise.resolve({ success: true }),
  },

  health: () => Promise.resolve({ status: 'OK', app: 'DentalFlow', version: '1.0.0-apk', mode: 'local' }),

  // ---- Auth local (sin servidor) ----
  auth: {
    // Devuelve si ya existe al menos un usuario creado localmente
    status() {
      const users = JSON.parse(localStorage.getItem('df_local_users') || '[]');
      return Promise.resolve({ hasUsers: users.length > 0 });
    },

    // Crear primer usuario (setup)
    async setup({ username, password, clinic_name }) {
      const users = JSON.parse(localStorage.getItem('df_local_users') || '[]');
      if (users.find(u => u.username === username)) {
        throw Object.assign(new Error('Ese nombre de usuario ya existe.'), { status: 409 });
      }
      const newUser = { username: username.trim(), password, clinic_name: clinic_name || 'Mi Clínica', role: 'admin' };
      users.push(newUser);
      localStorage.setItem('df_local_users', JSON.stringify(users));
      // Guardar clinic_name
      localStorage.setItem('df_clinic_name', clinic_name || 'Mi Clínica');
      // Generar token simple
      const token = btoa(`${username}:${Date.now()}`);
      Auth.setToken(token);
      Auth.setUser({ username, role: 'admin' });
      return { token, username, role: 'admin' };
    },

    // Iniciar sesión
    async login({ username, password }) {
      const users = JSON.parse(localStorage.getItem('df_local_users') || '[]');
      const user = users.find(u => u.username === username && u.password === password);
      if (!user) {
        throw Object.assign(new Error('Usuario o contraseña incorrectos.'), { status: 401 });
      }
      const token = btoa(`${username}:${Date.now()}`);
      Auth.setToken(token);
      Auth.setUser({ username, role: user.role });
      return { token, username, role: user.role };
    },

    // Info del usuario actual
    me() {
      const user = Auth.getUser();
      if (!user) throw Object.assign(new Error('No autenticado'), { status: 401 });
      return Promise.resolve({ data: user });
    },

    // Cambiar contraseña
    async changePassword({ current_password, new_password }) {
      const user = Auth.getUser();
      if (!user) throw Object.assign(new Error('No autenticado'), { status: 401 });
      const users = JSON.parse(localStorage.getItem('df_local_users') || '[]');
      const idx = users.findIndex(u => u.username === user.username && u.password === current_password);
      if (idx === -1) throw Object.assign(new Error('Contraseña actual incorrecta.'), { status: 400 });
      users[idx].password = new_password;
      localStorage.setItem('df_local_users', JSON.stringify(users));
      return { message: 'Contraseña actualizada.' };
    },

    logout() { Auth.clearToken(); },
  },
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
