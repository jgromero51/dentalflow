/**
 * DentalFlow — App Router & Bootstrap
 * SPA hash-based router, modal manager, PWA registration.
 */

// ============================================================
// MODAL MANAGER
// ============================================================
function openModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

window.openModal  = openModal;
window.closeModal = closeModal;

document.getElementById('modal-close')?.addEventListener('click', closeModal);
document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// ============================================================
// ROUTER
// ============================================================
// Promesa que se resuelve cuando init() termina el chequeo de auth
let _resolveInit;
const _initReady = new Promise(res => { _resolveInit = res; });

const Router = {
  routes: {
    'dashboard':    renderDashboard,
    'appointments': renderAppointments,
    'patients':     renderPatients,
    'patient':      renderPatientDetail,
    'messages':     renderMessages,
    'settings':     renderSettings,
    'login':        renderLogin,
    'setup':        renderSetup,
    'forgot-password': renderForgotPassword,
    'reset-password': renderResetPassword,

  },

  navigate(route) {
    window.location.hash = route;
  },

  async handleRoute() {
    // Esperar a que init() haya evaluado la autenticación antes de renderizar
    await _initReady;

    const hash   = window.location.hash.replace('#', '') || 'dashboard';
    const main   = document.getElementById('app-main');

    // Actualizar nav activo
    document.querySelectorAll('.nav-btn').forEach(b => {
      const isRoute = b.dataset.route === hash;
      b.classList.toggle('active', isRoute);
    });

    // Parametrización de rutas (ej. patient/123 o reset-password/TOKEN)
    let routeKey = hash;
    let routeParams = null;
    if (hash.startsWith('patient/')) {
      routeKey = 'patient';
      routeParams = hash.split('/')[1];
    } else if (hash.startsWith('reset-password/')) {
      routeKey = 'reset-password';
      routeParams = hash.split('/')[1];
    }

    const isAuthView = routeKey === 'login' || routeKey === 'setup' || routeKey === 'forgot-password' || routeKey === 'reset-password';
    
    // Initialize Google Auth script on auth views
    if (isAuthView) {
      Auth.initGoogleAuth();
    }

    const fab = document.getElementById('fab-new-appointment');
    const nav = document.getElementById('header-nav');

    if (fab) fab.style.display = (isAuthView || routeKey === 'patients' || routeKey === 'patient' || routeKey === 'settings' || routeKey === 'messages') ? 'none' : 'flex';
    if (nav) nav.style.display = isAuthView ? 'none' : 'flex';

    // Cerrar dropdown de ajustes si estaba abierto
    if (window.NavDropdown) NavDropdown.close();

    const handler = this.routes[routeKey] || this.routes['dashboard'];
    try {
      await handler(main, routeParams);
    } catch (err) {
      console.error('Route error:', err);
      if (err.status === 401) {
        // El api.js ya maneja la redirección, pero por seguridad:
        if (window.location.hash !== '#login') {
           this.navigate('login');
        }
      }
    }
  },
};

window.addEventListener('hashchange', () => Router.handleRoute());
window.Router = Router;

// ============================================================
// VISTAS
// ============================================================
async function renderDashboard(container) {
  await DashboardView.render(container);
}

async function renderAppointments(container) {
  await AppointmentsView.render(container);
}

async function renderSettings(container) {
  await SettingsView.render(container);
}

async function renderMessages(container) {
  await MessagesView.render(container);
}

async function renderLogin(container) {
  LoginView.render(container);
}

async function renderSetup(container) {
  await SetupView.render(container);
}

async function renderForgotPassword(container) {
  ForgotPasswordView.render(container);
}

async function renderResetPassword(container, token) {
  ResetPasswordView.render(container, token);
}



async function renderPatients(container) {
  await PatientsView.render(container); // Cambiaremos la lógica antigua por una vista limpia
}

async function renderPatientDetail(container, patientId) {
  await PatientDetailView.render(container, patientId);
}
// El código antiguo de showPatientDetail se elimina ya que usaremos PatientDetailView

// ============================================================
// FAB — Nueva Cita
// ============================================================
document.getElementById('fab-new-appointment')?.addEventListener('click', () => {
  NewAppointmentView.open();
});

// ============================================================
// NAV BUTTONS (Citas y Pacientes)
// ============================================================
document.querySelectorAll('.nav-btn[data-route]').forEach(btn => {
  btn.addEventListener('click', () => Router.navigate(btn.dataset.route));
});

// ============================================================
// NAV DROPDOWN — Menú de Ajustes
// ============================================================
const NavDropdown = {
  _open: false,

  toggle(e) {
    e.stopPropagation();
    this._open ? this.close() : this.open();
  },

  open() {
    const wrapper = document.getElementById('nav-dropdown-settings');
    if (wrapper) wrapper.classList.add('open');
    this._open = true;
    // Resetear confirmación al abrir
    this._resetLogoutConfirm();
  },

  close() {
    const wrapper = document.getElementById('nav-dropdown-settings');
    if (wrapper) wrapper.classList.remove('open');
    this._open = false;
    this._resetLogoutConfirm();
  },

  goSettings() {
    this.close();
    Router.navigate('settings');
  },

  // Paso 1: mostrar mini confirmación
  showLogoutConfirm(e) {
    e.stopPropagation();
    const step1 = document.getElementById('btn-logout-step1');
    const box   = document.getElementById('logout-confirm-box');
    if (step1) step1.style.display = 'none';
    if (box)   box.style.display   = 'flex';
  },

  // Cancelar
  cancelLogout(e) {
    e.stopPropagation();
    this._resetLogoutConfirm();
  },

  // Paso 2: ejecutar logout real
  doLogout(e) {
    e.stopPropagation();
    this.close();
    Auth.clearToken();
    window.Router.navigate('login');
  },

  _resetLogoutConfirm() {
    const step1 = document.getElementById('btn-logout-step1');
    const box   = document.getElementById('logout-confirm-box');
    if (step1) step1.style.display = '';
    if (box)   box.style.display   = 'none';
  }
};

// Cerrar dropdown al hacer click fuera
document.addEventListener('click', (e) => {
  if (!e.target.closest('#nav-dropdown-settings')) {
    NavDropdown.close();
  }
});

window.NavDropdown = NavDropdown;

// ============================================================
// PWA — Service Worker & Instalación
// ============================================================
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevenir que Chrome muestre el mini-infobar
  e.preventDefault();
  // Guardar el evento para dispararlo más tarde
  deferredPrompt = e;
  // Mostrar el botón de instalación en la UI
  const installBtn = document.getElementById('btn-install-pwa');
  if (installBtn) {
    installBtn.style.display = 'flex';
    installBtn.onclick = async () => {
      // Ocultar nuestro botón
      installBtn.style.display = 'none';
      // Mostrar el prompt nativo
      deferredPrompt.prompt();
      // Esperar a que el usuario responda al prompt
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA] Instalación ${outcome}`);
      deferredPrompt = null;
    };
  }
});

window.addEventListener('appinstalled', () => {
  // Ocultar botón si ya se instaló
  const installBtn = document.getElementById('btn-install-pwa');
  if (installBtn) installBtn.style.display = 'none';
  deferredPrompt = null;
  console.log('[PWA] DentalFlow ha sido instalado');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[PWA] Service Worker registrado:', reg.scope))
      .catch(err => console.warn('[PWA] Error SW:', err));
  });
}

// ============================================================
// CLINIC NAME — carga y actualiza el header con el nombre de la clínica
// ============================================================
async function loadClinicName() {
  try {
    const res = await api.settings.get();
    const name = res?.data?.clinic_name;
    if (name) {
      const brand = document.querySelector('.brand-name');
      if (brand) brand.textContent = name;
      // Actualizar también el header del dropdown
      const dropLabel = document.getElementById('dropdown-clinic-name');
      if (dropLabel) dropLabel.textContent = name;
    }
  } catch (e) { /* silencioso */ }
}
window.loadClinicName = loadClinicName;

// ============================================================
// ARRANQUE
// ============================================================
async function init() {
  // 1. Verificar si hay usuarios en el sistema
  let hasUsers = false;
  try {
    const status = await api.auth.status();
    hasUsers = status.hasUsers;
  } catch (err) {
    console.error('Auth status check failed:', err);
    if (!err.status) {
      Toast.warning('⚠️ Sin conexión al servidor. Verificá que el backend esté corriendo.');
    }
  }

  // Esconder loading
  document.getElementById('loading-screen')?.remove();

  // 2. Determinar a qué ruta debemos ir
  // Si ya hay un token → confiar en él y entrar directamente
  // Si no hay token → mostrar login siempre (setup solo desde el link de login)
  // 2. Determinar la ruta inicial
  let targetRoute;
  if (Auth.isLoggedIn()) {
    const currentHash = window.location.hash.replace('#', '');
    targetRoute = (currentHash && currentHash !== 'login' && currentHash !== 'setup')
      ? currentHash
      : 'appointments'; // Por defecto citas si está logueado
  } else {
    // Siempre ir a Login por defecto si no está logueado, a menos que pida setup explícitamente
    targetRou