/**
 * DentalFlow — Panel Maestro JS
 */

const API_BASE = '/api';

// Verificar sesión
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
    
    if (!res.ok) {
      throw new Error(data.error || 'Credenciales inválidas');
    }
    
    if (data.role !== 'admin') {
      throw new Error('No tienes permisos de administrador');
    }
    
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

// --- CARGAR DATOS ---
async function fetchApi(endpoint) {
  const token = localStorage.getItem('df_admin_token');
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('df_admin_token');
    showView('login-view');
    throw new Error('Sesión expirada o sin permisos');
  }
  return res.json();
}

async function loadData() {
  try {
    // Cargar estadísticas
    const statsRes = await fetchApi('/admin/system-stats');
    const stats = statsRes.data;
    
    const statsHtml = `
      <div class="stat-card">
        <div class="stat-title">Total Usuarios</div>
        <div class="stat-number">${stats.total_users}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Pacientes Globales</div>
        <div class="stat-number">${stats.total_patients}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Citas Registradas</div>
        <div class="stat-number">${stats.total_appointments}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Mensajes Enviados</div>
        <div class="stat-number">${stats.total_messages}</div>
      </div>
    `;
    document.getElementById('stats-container').innerHTML = statsHtml;
    
    // Cargar Usuarios
    const usersRes = await fetchApi('/admin/users');
    const users = usersRes.data;
    
    const tbody = document.getElementById('users-table-body');
    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8">No hay datos.</td></tr>';
    } else {
      tbody.innerHTML = users.map(u => `
        <tr>
          <td>#${u.id}</td>
          <td><strong>${u.username}</strong></td>
          <td><span class="badge ${u.role}">${u.role}</span></td>
          <td>${new Date(u.created_at).toLocaleDateString()}</td>
          <td>${u.last_login ? new Date(u.last_login).toLocaleString() : '-'}</td>
          <td>${u.stats?.patients_count || 0}</td>
          <td>${u.stats?.appointments_count || 0}</td>
          <td>
            <button class="btn-secondary" onclick="alert('Funciones avanzadas en la próxima actualización')">Administrar</button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Error cargando panel admin:', err);
  }
}
