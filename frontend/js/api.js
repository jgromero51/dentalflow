/**
 * DentalFlow — API Client
 * Modo dual:
 *   - WEB (servidor corriendo): usa fetch() → Node.js backend
 *   - APK / OFFLINE (window.localDB disponible): usa IndexedDB directamente
 */

const REMOTE_URL = 'https://dentalflow-mqgh.onrender.com';
const API_BASE   = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.protocol === 'capacitor:')) 
  ? `${REMOTE_URL}/api` 
  : '/api';

// ---- Gestión de sesión ----
const Auth = {
  getToken()  { return localStorage.getItem('df_token'); },
  setToken(t) { localStorage.setItem('df_token', t); },
  clearToken(){ localStorage.removeItem('df_token'); localStorage.removeItem('df_user'); },
  getUser()   { try { return JSON.parse(localStorage.getItem('df_user') || 'null'); } catch { return null; } },
  setUser(u)  { localStorage.setItem('df_user', JSON.stringify(u)); },
  isLoggedIn(){ return !!this.getToken(); },
  socialLogin(provider) {
    if (provider === 'google') {
      if (typeof google === 'undefined' || !google.accounts) {
        if (window.Toast) Toast.error('Google Sign-In no está cargado. Verificá tu conexión o recarga la página.');
        return;
      }
      google.accounts.id.prompt();
    } else {
      if (window.Toast) {
        Toast.info(`Para iniciar sesión con ${provider}, necesitás configurar las claves OAuth (Client ID). Contactá al administrador.`);
      } else {
        alert(`Para iniciar sesión con ${provider}, necesitás configurar las claves OAuth (Client ID). Contactá al administrador.`);
      }
    }
  },
  initGoogleAuth() {
    // Load Google Identity Services script
    if (document.getElementById('gsi-script')) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.id = 'gsi-script';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      // Intenta obtener el Client ID del backend, o usa una variable por defecto si se expone en la API
      // Como no tenemos el endpoint config publico, usaremos un client ID por defecto o lo pediremos al usuario.
      // Aquí se debe poner el Client ID real de Google Cloud Console.
      google.accounts.id.initialize({
        client_id: window.GOOGLE_CLIENT_ID || 'TU_CLIENT_ID_AQUI.apps.googleusercontent.com',
        callback: async (response) => {
          try {
            const res = await remoteApi.request('POST', '/auth/google', { credential: response.credential });
            Auth.setToken(res.token);
            Auth.setUser({ username: res.username, role: res.role });
            window.Router.navigate('appointments');
            if (window.Toast) Toast.success(`¡Bienvenido/a, ${res.username}!`);
          } catch (err) {
            if (window.Toast) Toast.error(err.message || 'Error al iniciar sesión con Google.');
          }
        }
      });
    };
    document.head.appendChild(script);
  }
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
    getSummary: (id) => remoteApi.request('GET', `/patients/${id}/ai-summary`),
    voiceDictation: (audioBase64, ext) => remoteApi.request('POST', '/patients/voice-dictation', { audioBase64, ext }),
  },

  settings: {
    get:  ()          => remoteApi.request('GET',  '/settings'),
    save: (data)      => remoteApi.request('POST', '/settings', data),
    testWhatsApp: (t) => remoteApi.request('POST', '/settings/test-whatsapp', { telefono: t }),
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
    forgotPassword: (data) => remoteApi.request('POST', '/auth/forgot-password', data),
    resetPassword:  (data) => remoteApi.request('POST', '/auth/reset-password', data),
    me:             ()     => remoteApi.request('GET',  '/auth/me'),
    changePassword: (data) => remoteApi.request('POST', '/auth/change-password', data),
    logout() { Auth.clearToken(); },
  },

  admin: {
    users: () => remoteApi.request('GET', '/admin/users'),
    stats: () => remoteApi.request('GET', '/admin/system-stats'),
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
    getSummary: (id) => Promise.resolve({ data: "El resumen con IA requiere conexión al servidor principal." }),
    voiceDictation: () => Promise.resolve({ data: "El dictado por voz requiere conexión al servidor principal." }),
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
    async status() {
      // Migración rápida de localStorage a IndexedDB si es necesario
      const legacy = JSON.parse(localStorage.getItem('df_local_users') || '[]');
      if (legacy.length > 0 && window.localDB) {
        for (const u of legacy) {
          await window.localDB.auth.save(u);
        }
        localStorage.removeItem('df_local_users'); // Limpiar tras migrar
      }

      if (!window.localDB) return { hasUsers: legacy.length > 0 };
      const users = await window.localDB.auth.list();
      return { hasUsers: users.length > 0 };
    },

    // Crear primer usuario (setup)
    async setup({ username, password, clinic_name }) {
      if (!window.localDB) throw new Error('Base de datos local no disponible');
      
      const existing = await window.localDB.auth.get(username);
      if (existing) {
        throw Object.assign(new Error('Ese nombre de usuario ya existe.'), { status: 409 });
      }

      const newUser = { 
        username: username.trim(), 
        password, 
        clinic_name: clinic_name || 'Mi Clínica', 
        role: 'admin',
        created_at: new Date().toISOString()
      };
      
      await window.localDB.auth.save(newUser);
      
      // Guardar clinic_name en localStorage para acceso rápido UI
      localStorage.setItem('df_clinic_name', clinic_name || 'Mi Clínica');
      
      // Generar token simple
      const token = btoa(`${username}:${Date.now()}`);
      Auth.setToken(token);
      Auth.setUser({ username, role: 'admin' });
      return { token, username, role: 'admin' };
    },

    // Iniciar sesión
    async login({ username, password }) {
      if (!window.localDB) throw new Error('Base de datos local no disponible');
      
      const user = await window.localDB.auth.get(username);
      if (!user || user.password !== password) {
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
      
      const dbUser = await window.localDB.auth.get(user.username);
      if (!dbUser || dbUser.password !== current_password) {
        throw Object.assign(new Error('Contraseña actual incorrecta.'), { status: 400 });
      }
      
      dbUser.password = new_password;
      await window.localDB.auth.save(dbUser);
      return { message: 'Contraseña actualizada.' };
    },

    logout() { Auth.clearToken(); },
  },

  admin: {
    users: () => Promise.resolve({ data: [] }),
    stats: () => Promise.resolve({ data: { total_users: 1, total_patients: 0, total_appointments: 0, total_messages: 0 } }),
  },
};

// ---- Selección automática de modo ----
// Por defecto intentamos usar el modo remoto (servidor)
let api = remoteApi;

// Si es nativo o web, verificamos si el servidor responde
const _checkServer = async () => {
  let serverOk = false;
  try {
    const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    serverOk = r.ok;
  } catch (err) {
    serverOk = false;
  }

  if (!serverOk && window.localDB) {
    console.warn('[API] Servidor no disponible o modo offline → usando LocalDB');
    // Redirigir métodos de la instancia actual de 'api' a localApi
    Object.assign(api.appointments, localApi.appointments);
    Object.assign(api.patients,     localApi.patients);
    Object.assign(api.auth,         localApi.auth);
    Object.assign(api.odontogram,   localApi.odontogram);
    api.messages = localApi.messages;
    api.settings = localApi.settings;
    api.health   = localApi.health;
    api.admin    = localApi.admin;
  } else {
    console.log('[API] Conectado al servidor profesional:', API_BASE);
  }
};

// Ejecutar verificación al cargar
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _checkServer);
  } else {
    _checkServer();
  }
}

window.api = api;
