/**
 * DentalFlow — Panel Maestro (Super Admin)
 */

const API_BASE = '/api';

const token = localStorage.getItem('df_admin_token');
if (token) {
  showView('dashboard-view');
  loadData();
} else {
  showView('login-view');
}

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// --- LOGIN ---
document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('admin-user').value;
  const password = document.getElementById('admin-pass').value;
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = 'Verificando...';

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Credenciales inválidas');
    if (data.role !== 'superadmin') throw new Error('No tenés permisos de super administrador');

    localStorage.setItem('df_admin_token', data.token);
    errorEl.textContent = '';
    showView('dashboard-view');
    loadData();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

// --- LOGOUT ---
document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('df_admin_token');
  showView('login-view');
});

// --- FETCH HELPER ---
async function apiRequest(method, endpoint, body) {
  const t = localStorage.getItem('df_admin_token');
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${t}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && method === 'GET') {
      localStorage.removeItem('df_admin_token');
      showView('login-view');
    }
    throw new Error(data.error || `Error ${res.status}`);
  }
  return data;
}

// --- CARGAR DATOS ---
async function loadData() {
  try {
    const statsRes = await apiRequest('GET', '/admin/system-stats');
    const s = statsRes.data;
    document.getElementById('stats-container').innerHTML = `
      <div class="stat-card"><div class="stat-title">Total Cuentas</div><div class="stat-number">${s.total_users}</div></div>
      <div class="stat-card"><div class="stat-title">Pacientes Globales</div><div class="stat-number">${s.total_patients}</div></div>
      <div class="stat-card"><div class="stat-title">Citas Registradas</div><div class="stat-number">${s.total_appointments}</div></div>
      <div class="stat-card"><div class="stat-title">Mensajes Enviados</div><div class="stat-number">${s.total_messages}</div></div>`;

    const usersRes = await apiRequest('GET', '/admin/users');
    const users = usersRes.data;
    const tbody = document.getElementById('users-table-body');

    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="10">No hay cuentas todavía.</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(u => {
      const isActive = u.active !== false && u.active !== 0;
      const isSuper = u.role === 'superadmin';
      return `
        <tr class="${isActive ? '' : 'row-inactive'}">
          <td>#${u.id}</td>
          <td><strong>${esc(u.username)}</strong></td>
          <td>${esc(u.clinic_name || '—')}</td>
          <td>${esc(u.email || '—')}</td>
          <td><span class="badge ${u.role}">${u.role}</span></td>
          <td>${u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
          <td>${u.last_login ? new Date(u.last_login).toLocaleString() : '-'}</td>
          <td>${u.stats?.patients_count || 0}</td>
          <td>${u.stats?.appointments_count || 0}</td>
          <td>${isSuper ? '<span class="badge superadmin">maestro</span>' : `
            <div class="act-btns">
              <button class="btn-mini" onclick="openReset(${u.id}, '${esc(u.username)}')">🔑 Clave</button>
              <button class="btn-mini ${isActive ? 'danger' : 'ok'}" onclick="toggleActive(${u.id}, ${!isActive})">
                ${isActive ? '🚫 Desactivar' : '✅ Activar'}
              </button>
            </div>`}</td>
        </tr>`;
    }).join('');
  } catch (err) {
    console.error('Error cargando panel:', err);
  }
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// --- CREAR CUENTA ---
const createModal = document.getElementById('create-modal');
document.getElementById('btn-new-user').addEventListener('click', () => {
  document.getElementById('create-form').reset();
  document.getElementById('create-msg').textContent = '';
  createModal.classList.add('open');
});
document.getElementById('btn-cancel-create').addEventListener('click', () => createModal.classList.remove('open'));

document.getElementById('create-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('create-msg');
  msg.className = 'form-msg';
  msg.textContent = 'Creando...';
  try {
    await apiRequest('POST', '/admin/users', {
      clinic_name: document.getElementById('nu-clinic').value,
      doctor_name: document.getElementById('nu-doctor').value,
      username: document.getElementById('nu-user').value,
      email: document.getElementById('nu-email').value,
      password: document.getElementById('nu-pass').value,
    });
    msg.className = 'form-msg ok';
    msg.textContent = 'Cuenta creada.';
    setTimeout(() => { createModal.classList.remove('open'); loadData(); }, 600);
  } catch (err) {
    msg.className = 'form-msg error';
    msg.textContent = err.message;
  }
});

// --- RESET PASSWORD ---
const resetModal = document.getElementById('reset-modal');
let resetUserId = null;
window.openReset = (id, username) => {
  resetUserId = id;
  document.getElementById('reset-sub').textContent = `Definí una nueva contraseña para "${username}".`;
  document.getElementById('reset-form').reset();
  document.getElementById('reset-msg').textContent = '';
  resetModal.classList.add('open');
};
document.getElementById('btn-cancel-reset').addEventListener('click', () => resetModal.classList.remove('open'));

document.getElementById('reset-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('reset-msg');
  msg.className = 'form-msg';
  msg.textContent = 'Guardando...';
  try {
    await apiRequest('POST', `/admin/users/${resetUserId}/reset-password`, {
      new_password: document.getElementById('rp-pass').value,
    });
    msg.className = 'form-msg ok';
    msg.textContent = 'Contraseña actualizada.';
    setTimeout(() => resetModal.classList.remove('open'), 600);
  } catch (err) {
    msg.className = 'form-msg error';
    msg.textContent = err.message;
  }
});

// --- ACTIVAR / DESACTIVAR ---
window.toggleActive = async (id, active) => {
  if (!confirm(active ? '¿Reactivar esta cuenta?' : '¿Desactivar esta cuenta? El usuario no podrá iniciar sesión.')) return;
  try {
    await apiRequest('PATCH', `/admin/users/${id}/active`, { active });
    loadData();
  } catch (err) {
    alert(err.message);
  }
};
