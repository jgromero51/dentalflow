/**
 * DentalFlow — Panel Maestro (Super Admin)
 */

const API_BASE = '/api';

const token = localStorage.getItem('df_admin_token');
if (token) { showView('dashboard-view'); loadAll(); }
else { showView('login-view'); }

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function fdate(d) { return d ? new Date(d).toLocaleDateString() : '-'; }
function fdatetime(d) { return d ? new Date(d).toLocaleString() : '-'; }

// --- LOGIN ---
document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('admin-user').value;
  const password = document.getElementById('admin-pass').value;
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = 'Verificando...';
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Credenciales inválidas');
    if (data.role !== 'superadmin') throw new Error('No tenés permisos de super administrador');
    localStorage.setItem('df_admin_token', data.token);
    errorEl.textContent = '';
    showView('dashboard-view'); loadAll();
  } catch (err) { errorEl.textContent = err.message; }
});

document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('df_admin_token'); showView('login-view');
});

// --- NAV ---
document.querySelectorAll('.nav-btn[data-section]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn[data-section]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const sec = btn.dataset.section;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(`section-${sec}`).classList.add('active');
    document.getElementById('page-title').textContent = btn.textContent.replace(/^[^\w]+/, '').trim();
    if (sec === 'audit') loadAudit();
  });
});

// --- FETCH HELPER ---
async function apiRequest(method, endpoint, body) {
  const t = localStorage.getItem('df_admin_token');
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: { 'Authorization': `Bearer ${t}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && method === 'GET') {
      localStorage.removeItem('df_admin_token'); showView('login-view');
    }
    throw new Error(data.error || `Error ${res.status}`);
  }
  return data;
}

// --- LOAD ALL ---
function loadAll() { loadOverview(); loadUsers(); }

// --- OVERVIEW ---
async function loadOverview() {
  try {
    const { data: o } = await apiRequest('GET', '/admin/overview');
    document.getElementById('overview-cards').innerHTML = `
      <div class="stat-card"><div class="stat-title">Clínicas</div><div class="stat-number">${o.total_clinics}</div></div>
      <div class="stat-card"><div class="stat-title">Ingreso mensual (MRR)</div><div class="stat-number">$${o.mrr}</div></div>
      <div class="stat-card"><div class="stat-title">Pacientes (global)</div><div class="stat-number">${o.total_patients}</div></div>
      <div class="stat-card"><div class="stat-title">Citas (global)</div><div class="stat-number">${o.total_appointments}</div></div>`;

    const s = o.subscriptions;
    document.getElementById('subs-cards').innerHTML = `
      ${subCard('Pagando', s.active, 'active')}
      ${subCard('En prueba', s.trial, 'trial')}
      ${subCard('Cortesía', s.cortesia, 'cortesia')}
      ${subCard('Vencidas', s.vencida, 'vencida')}
      ${subCard('Sin suscripción', s.sin, 'sin')}`;

    const m = o.messages;
    document.getElementById('wa-cards').innerHTML = `
      ${subCard('WhatsApp conectado', o.whatsapp.configured, 'wa-ok')}
      ${subCard('WhatsApp pendiente', o.whatsapp.pending, 'wa-no')}
      ${plainCard('Mensajes totales', m.total)}
      ${plainCard('Enviados', m.enviados)}
      ${plainCard('Fallidos', m.fallidos)}`;
  } catch (err) { console.error('overview', err); }
}
function subCard(title, n, cls) {
  return `<div class="stat-card"><div class="stat-title">${title}</div><div class="stat-number"><span class="pill ${cls}" style="font-size:1rem;">${n ?? 0}</span></div></div>`;
}
function plainCard(title, n) {
  return `<div class="stat-card"><div class="stat-title">${title}</div><div class="stat-number">${n ?? 0}</div></div>`;
}
// Pill de WhatsApp: token propio, número global compartido, o ninguno.
function waPill(source, configured) {
  const src = source || (configured ? 'compartido' : 'no');
  if (src === 'propio')     return '<span class="pill wa-ok">Propio</span>';
  if (src === 'compartido') return '<span class="pill wa-ok">Compartido</span>';
  return '<span class="pill wa-no">No</span>';
}

// --- USERS / CLINICS ---
async function loadUsers() {
  try {
    const { data: users } = await apiRequest('GET', '/admin/users');
    const tbody = document.getElementById('users-table-body');
    if (!users.length) { tbody.innerHTML = '<tr><td colspan="10">No hay cuentas todavía.</td></tr>'; return; }

    tbody.innerHTML = users.map(u => {
      const isActive = u.active !== false && u.active !== 0;
      const isSuper = u.role === 'superadmin';
      const st = u.sub_state || 'sin';
      const msg = u.stats;
      return `
        <tr class="${isActive ? '' : 'row-inactive'}">
          <td>#${u.id}</td>
          <td><strong>${esc(u.username)}</strong>${isSuper ? ' <span class="pill active">maestro</span>' : ''}</td>
          <td>${esc(u.clinic_name || '—')}</td>
          <td>${isSuper ? '—' : `<span class="pill ${st}">${stLabel(st)}</span>`}</td>
          <td>${isSuper ? '—' : waPill(u.whatsapp_source, u.whatsapp_configured)}</td>
          <td>${msg.patients_count}</td>
          <td>${msg.appointments_count}</td>
          <td>${msg.messages_enviados}/${msg.messages_total}${msg.messages_fallidos ? ` <span style="color:#dc2626">(${msg.messages_fallidos}✗)</span>` : ''}</td>
          <td>${fdatetime(u.last_login)}</td>
          <td>${isSuper ? '' : `
            <div class="act-btns">
              <button class="btn-mini" onclick="openDetail(${u.id})">👁 Ver</button>
              <button class="btn-mini" onclick="openReset(${u.id}, '${esc(u.username)}')">🔑</button>
              <button class="btn-mini" onclick="impersonate(${u.id}, '${esc(u.username)}')">↪ Entrar</button>
              <button class="btn-mini ${isActive ? 'danger' : 'ok'}" onclick="toggleActive(${u.id}, ${!isActive})">${isActive ? '🚫' : '✅'}</button>
            </div>`}</td>
        </tr>`;
    }).join('');
  } catch (err) { console.error('users', err); }
}
function stLabel(st) {
  return { active:'Pagando', trial:'Prueba', cortesia:'Cortesía', vencida:'Vencida', sin:'Sin sub.' }[st] || st;
}

// --- AUDIT ---
async function loadAudit() {
  try {
    const { data: rows } = await apiRequest('GET', '/admin/audit');
    const tbody = document.getElementById('audit-table-body');
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="5">Sin acciones registradas.</td></tr>'; return; }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${fdatetime(r.created_at)}</td>
        <td>${esc(r.admin_username || '-')}</td>
        <td><strong>${esc(r.action)}</strong></td>
        <td>${esc(r.target_type || '')} ${r.target_id ? '#' + r.target_id : ''}</td>
        <td>${esc(r.detail || '')}</td>
      </tr>`).join('');
  } catch (err) { console.error('audit', err); }
}

// --- CREAR ---
const createModal = document.getElementById('create-modal');
document.getElementById('btn-new-user').addEventListener('click', () => {
  document.getElementById('create-form').reset();
  document.getElementById('create-msg').textContent = '';
  createModal.classList.add('open');
});
document.getElementById('btn-cancel-create').addEventListener('click', () => createModal.classList.remove('open'));
document.getElementById('create-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('create-msg'); msg.className = 'form-msg'; msg.textContent = 'Creando...';
  try {
    await apiRequest('POST', '/admin/users', {
      clinic_name: document.getElementById('nu-clinic').value,
      doctor_name: document.getElementById('nu-doctor').value,
      username: document.getElementById('nu-user').value,
      email: document.getElementById('nu-email').value,
      password: document.getElementById('nu-pass').value,
    });
    msg.className = 'form-msg ok'; msg.textContent = 'Cuenta creada.';
    setTimeout(() => { createModal.classList.remove('open'); loadAll(); }, 600);
  } catch (err) { msg.className = 'form-msg error'; msg.textContent = err.message; }
});

// --- RESET ---
const resetModal = document.getElementById('reset-modal');
let resetUserId = null;
window.openReset = (id, username) => {
  resetUserId = id;
  document.getElementById('reset-sub').textContent = `Nueva contraseña para "${username}".`;
  document.getElementById('reset-form').reset();
  document.getElementById('reset-msg').textContent = '';
  resetModal.classList.add('open');
};
document.getElementById('btn-cancel-reset').addEventListener('click', () => resetModal.classList.remove('open'));
document.getElementById('reset-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('reset-msg'); msg.className = 'form-msg'; msg.textContent = 'Guardando...';
  try {
    await apiRequest('POST', `/admin/users/${resetUserId}/reset-password`, { new_password: document.getElementById('rp-pass').value });
    msg.className = 'form-msg ok'; msg.textContent = 'Contraseña actualizada.';
    setTimeout(() => resetModal.classList.remove('open'), 600);
  } catch (err) { msg.className = 'form-msg error'; msg.textContent = err.message; }
});

// --- ACTIVAR/DESACTIVAR ---
window.toggleActive = async (id, active) => {
  if (!confirm(active ? '¿Reactivar esta cuenta?' : '¿Desactivar esta cuenta? No podrá iniciar sesión.')) return;
  try { await apiRequest('PATCH', `/admin/users/${id}/active`, { active }); loadAll(); }
  catch (err) { alert(err.message); }
};

// --- IMPERSONAR ---
window.impersonate = async (id, username) => {
  if (!confirm(`¿Entrar como "${username}"? Se abrirá la app con su sesión en otra pestaña.`)) return;
  try {
    const r = await apiRequest('POST', `/admin/users/${id}/impersonate`);
    localStorage.setItem('df_token', r.token);
    localStorage.setItem('df_user', JSON.stringify({ username: r.username, role: r.role, clinic_id: r.clinic_id }));
    window.open('/', '_blank');
  } catch (err) { alert(err.message); }
};

// --- DETALLE / DRILL-DOWN ---
const detailModal = document.getElementById('detail-modal');
document.getElementById('btn-cancel-detail').addEventListener('click', () => detailModal.classList.remove('open'));
window.openDetail = async (id) => {
  detailModal.classList.add('open');
  document.getElementById('detail-content').innerHTML = 'Cargando...';
  try {
    const { data: d } = await apiRequest('GET', `/admin/users/${id}/detail`);
    const u = d.user, c = d.counts;
    document.getElementById('detail-content').innerHTML = `
      <h3>${esc(u.clinic_name || u.username)}</h3>
      <p class="sub">Usuario: <strong>${esc(u.username)}</strong> · ${esc(u.email || 'sin correo')} · alta ${fdate(u.created_at)}</p>
      <div>
        <span class="pill ${d.sub_state}">${stLabel(d.sub_state)}</span>
        <span class="pill ${d.whatsapp_configured ? 'wa-ok' : 'wa-no'}">WhatsApp ${d.whatsapp_source === 'propio' ? 'propio' : d.whatsapp_source === 'compartido' ? 'compartido' : 'pendiente'}</span>
        <span class="pill ${u.active === false || u.active === 0 ? 'vencida' : 'active'}">${u.active === false || u.active === 0 ? 'Desactivada' : 'Activa'}</span>
      </div>
      <div class="detail-grid">
        <div class="detail-box"><div class="n">${c.patients}</div><div class="t">Pacientes</div></div>
        <div class="detail-box"><div class="n">${c.appointments}</div><div class="t">Citas</div></div>
        <div class="detail-box"><div class="n">${c.messages_enviados}/${c.messages_total}</div><div class="t">Mensajes enviados</div></div>
        <div class="detail-box"><div class="n" style="color:${c.messages_fallidos ? '#dc2626' : '#0f172a'}">${c.messages_fallidos}</div><div class="t">Mensajes fallidos</div></div>
      </div>

      <div class="section-header"><h2 style="font-size:1rem;">Gestionar suscripción</h2></div>
      <div class="quick-actions">
        <button class="btn-mini" onclick="extendTrial(${u.id})">+14 días prueba</button>
        <button class="btn-mini ok" onclick="grantCourtesy(${u.id})">Cortesía 3 meses</button>
        <button class="btn-mini ok" onclick="setStatus(${u.id},'active')">Marcar pagando</button>
        <button class="btn-mini danger" onclick="setStatus(${u.id},'cancelled')">Cancelar</button>
      </div>

      <div class="section-header" style="margin-top:16px;"><h2 style="font-size:1rem;">Usuarios de la clínica</h2></div>
      ${d.members.map(m => `<div class="msg-row">${esc(m.username)} · <span class="meta">${esc(m.role)}${m.doctor_name ? ' · ' + esc(m.doctor_name) : ''} · últ. ${fdatetime(m.last_login)}</span></div>`).join('') || '<p class="sub">—</p>'}

      <div class="section-header" style="margin-top:16px;"><h2 style="font-size:1rem;">Últimos mensajes</h2></div>
      ${(d.recent_messages || []).map(m => `
        <div class="msg-row">
          ${m.enviado ? '✅' : '❌'} <strong>${esc(m.tipo)}</strong> — ${esc(String(m.mensaje).slice(0,90))}
          <div class="meta">${fdatetime(m.created_at)}${m.error_detalle ? ' · ⚠ ' + esc(m.error_detalle) : ''}</div>
        </div>`).join('') || '<p class="sub">Sin mensajes.</p>'}

      <div class="section-header" style="margin-top:16px;"><h2 style="font-size:1rem;color:#dc2626;">Zona peligrosa</h2></div>
      <button class="btn-mini danger" onclick="deleteClinic(${u.id}, '${esc(u.username)}')">🗑️ Eliminar clínica y todos sus datos</button>
    `;
  } catch (err) {
    document.getElementById('detail-content').innerHTML = `<p class="form-msg error">${esc(err.message)}</p>`;
  }
};

window.extendTrial = async (id) => {
  try { await apiRequest('POST', `/admin/users/${id}/extend-trial`, { days: 14 }); alert('Prueba extendida 14 días.'); openDetail(id); loadAll(); }
  catch (err) { alert(err.message); }
};
window.grantCourtesy = async (id) => {
  const months = parseInt(prompt('¿Cuántos meses de cortesía?', '3') || '0', 10);
  if (!months) return;
  try { await apiRequest('POST', `/admin/users/${id}/grant-courtesy`, { months }); alert(`Cortesía de ${months} meses otorgada.`); openDetail(id); loadAll(); }
  catch (err) { alert(err.message); }
};
window.setStatus = async (id, status) => {
  if (!confirm(status === 'active' ? '¿Marcar como pagando (activa)?' : '¿Cancelar la suscripción?')) return;
  try { await apiRequest('POST', `/admin/users/${id}/set-status`, { status }); openDetail(id); loadAll(); }
  catch (err) { alert(err.message); }
};
window.deleteClinic = async (id, username) => {
  if (!confirm(`⚠️ Vas a ELIMINAR la clínica de "${username}" con TODOS sus pacientes, citas y mensajes. Esto no se puede deshacer. ¿Continuar?`)) return;
  if (!confirm('Confirmá una vez más: esta acción es PERMANENTE.')) return;
  try {
    await apiRequest('DELETE', `/admin/users/${id}`);
    detailModal.classList.remove('open');
    alert('Clínica eliminada.'); loadAll();
  } catch (err) { alert(err.message); }
};
