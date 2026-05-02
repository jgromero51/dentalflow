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
const Router = {
  routes: {
    'appointments': renderAppointments,
    'patients':     renderPatients,
  },

  navigate(route) {
    window.location.hash = route;
  },

  async handleRoute() {
    const hash   = window.location.hash.replace('#', '') || 'appointments';
    const main   = document.getElementById('app-main');

    // Actualizar nav activo
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.route === hash);
    });

    // Ocultar FAB en vista de pacientes
    const fab = document.getElementById('fab-new-appointment');
    fab.style.display = hash === 'patients' ? 'none' : 'flex';

    const handler = this.routes[hash] || this.routes['appointments'];
    await handler(main);
  },
};

window.addEventListener('hashchange', () => Router.handleRoute());
window.Router = Router;

// ============================================================
// VISTAS
// ============================================================
async function renderAppointments(container) {
  await AppointmentsView.render(container);
}

async function renderPatients(container) {
  container.innerHTML = '<div class="fade-in" id="patients-view"></div>';
  const view = document.getElementById('patients-view');
  view.innerHTML = '<div style="text-align:center;padding:24px;"><div class="loading-spinner" style="margin:0 auto;"></div></div>';

  try {
    const res = await api.patients.list();
    const patients = res.data || [];

    view.innerHTML = `
      <div class="section-header" style="margin-bottom:12px;">
        <span class="section-title">Pacientes</span>
        <span class="section-count">${patients.length}</span>
      </div>
      <div class="form-group" style="margin-bottom:16px;">
        <input type="text" id="patient-search-global" class="form-control"
          placeholder="🔍 Buscar por nombre o teléfono..." />
      </div>
      <div id="patients-list">
        ${renderPatientList(patients)}
      </div>`;

    // Búsqueda en tiempo real
    let timeout;
    document.getElementById('patient-search-global')?.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        const q = e.target.value.trim();
        const r = await api.patients.list(q);
        document.getElementById('patients-list').innerHTML = renderPatientList(r.data || []);
      }, 350);
    });
  } catch (err) {
    view.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>${err.message}</p></div>`;
  }
}

function renderPatientList(patients) {
  if (!patients.length) return `
    <div class="empty-state">
      <div class="empty-icon">👤</div>
      <div class="empty-title">Sin pacientes</div>
      <div class="empty-desc">Los pacientes se crean automáticamente al crear una cita.</div>
    </div>`;

  return patients.map(p => {
    const initials = p.nombre.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
    return `
    <div class="patient-card" onclick="showPatientDetail(${p.id})">
      <div class="patient-avatar">${initials}</div>
      <div class="patient-info">
        <div class="patient-name">${p.nombre}</div>
        <div class="patient-phone">${p.telefono}</div>
        ${p.total_citas ? `<div class="patient-meta">${p.total_citas} cita${p.total_citas !== 1 ? 's' : ''}</div>` : ''}
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b949e" stroke-width="2">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>`;
  }).join('');
}

async function showPatientDetail(patientId) {
  try {
    const res = await api.patients.get(patientId);
    const p   = res.data;
    const appts = p.appointments || [];
    const estadoLabel = { pendiente: 'Pendiente', confirmada: 'Confirmada', cancelada: 'Cancelada', no_asistio: 'No asistió' };

    document.getElementById('modal-title').textContent = p.nombre;
    document.getElementById('modal-body').innerHTML = `
      <div class="info-list card" style="margin-bottom:16px;">
        <div class="info-row"><span class="info-key">📱 Teléfono</span><span class="info-val">${p.telefono}</span></div>
        ${p.dni ? `<div class="info-row"><span class="info-key">🪪 DNI</span><span class="info-val">${p.dni}</span></div>` : ''}
        <div class="info-row"><span class="info-key">📅 Registro</span><span class="info-val">${p.created_at?.split('T')[0] || '—'}</span></div>
      </div>
      <div class="section-header">
        <span class="section-title">Historial de Citas</span>
        <span class="section-count">${appts.length}</span>
      </div>
      ${appts.length === 0 ? '<div class="empty-state" style="padding:24px 0;"><div class="empty-desc">Sin citas registradas</div></div>' :
        appts.map(a => {
          const d = new Date(a.fecha_hora_inicio);
          const fecha = d.toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'numeric' });
          const hora  = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
          return `
          <div class="card" style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-weight:600;font-size:14px;">${fecha} — ${hora} hs</div>
                ${a.descripcion ? `<div style="font-size:13px;color:var(--text-secondary);margin-top:3px;">🦷 ${a.descripcion}</div>` : ''}
              </div>
              <span class="badge badge-${a.estado}">${estadoLabel[a.estado] || a.estado}</span>
            </div>
          </div>`;
        }).join('')}
      <div style="margin-top:16px;display:flex;gap:8px;">
        <a href="https://wa.me/${p.telefono.replace(/\D/g,'')}" target="_blank" class="btn btn-success btn-sm">
          💬 WhatsApp
        </a>
        <button class="btn btn-danger btn-sm" onclick="deletePatient(${p.id},'${p.nombre}')">
          🗑 Eliminar
        </button>
      </div>`;

    openModal();
  } catch (err) {
    Toast.error('Error al cargar paciente: ' + err.message);
  }
}

async function deletePatient(id, nombre) {
  if (!confirm(`¿Eliminar a "${nombre}" y todas sus citas?`)) return;
  try {
    await api.patients.delete(id);
    Toast.success('Paciente eliminado');
    closeModal();
    renderPatients(document.getElementById('app-main'));
  } catch (err) {
    Toast.error('Error: ' + err.message);
  }
}

window.showPatientDetail = showPatientDetail;
window.deletePatient     = deletePatient;

// ============================================================
// FAB — Nueva Cita
// ============================================================
document.getElementById('fab-new-appointment')?.addEventListener('click', () => {
  NewAppointmentView.open();
});

// ============================================================
// NAV BUTTONS
// ============================================================
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => Router.navigate(btn.dataset.route));
});

// ============================================================
// PWA — Service Worker
// ============================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[PWA] Service Worker registrado:', reg.scope))
      .catch(err => console.warn('[PWA] Error SW:', err));
  });
}

// ============================================================
// ARRANQUE
// ============================================================
async function init() {
  // Verificar conexión con el backend
  try {
    await api.health();
  } catch {
    Toast.warning('⚠️ Sin conexión al servidor. Verificá que el backend esté corriendo.');
  }

  // Esconder loading y renderizar vista inicial
  document.getElementById('loading-screen')?.remove();
  Router.handleRoute();
}

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
