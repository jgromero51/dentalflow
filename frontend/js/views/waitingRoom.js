/**
 * DentalFlow — Vista: Sala de Espera
 *
 * Panel en tiempo real para el doctor:
 * - Cola de pacientes esperando
 * - Botón Modo Consulta
 * - Estado de llegada por cita
 */
const WaitingRoomView = {
  _timer: null,

  async render(container) {
    container.innerHTML = `
      <div class="fade-in" id="waiting-room-view">
        <div class="settings-hero" style="margin-bottom:16px;">
          <div class="settings-hero-icon">🩺</div>
          <div>
            <h1 class="settings-hero-title">Sala de Espera</h1>
            <p class="settings-hero-sub">Estado en tiempo real · se actualiza cada 30s</p>
          </div>
        </div>
        <div class="loading-spinner" style="margin:40px auto;"></div>
      </div>`;

    await this._load(container);
    this._timer = setInterval(() => this._load(container), 30000);
  },

  destroy() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  },

  async _load(container) {
    try {
      const today = new Date(Date.now() - 5*60*60*1000).toISOString().split('T')[0]; // fecha de Perú (UTC-5)
      const [resHoy, resConsulta] = await Promise.all([
        api.appointments.list({ fecha: today }),
        api.clinic.consultaStatus().catch(() => ({ data: [] })),
      ]);
      const citas    = (resHoy.data || []).sort((a,b) => a.fecha_hora_inicio.localeCompare(b.fecha_hora_inicio));
      const doctores = resConsulta.data || [];
      const myUser   = Auth.getUser();
      const meDoc    = doctores.find(d => d.username === myUser?.username);
      this._renderContent(container, citas, doctores, meDoc);
    } catch (err) {
      const v = container.querySelector('#waiting-room-view');
      if (v) v.innerHTML += `<div class="empty-state"><div class="empty-title">${err.message}</div></div>`;
    }
  },

  _renderContent(container, citas, doctores, meDoc) {
    const v = container.querySelector('#waiting-room-view');
    if (!v) return;

    const enEspera   = citas.filter(c => c.llegada_at && !['atendida','cancelada','no_asistio'].includes(c.estado));
    const proximas   = citas.filter(c => !c.llegada_at && !['atendida','cancelada','no_asistio'].includes(c.estado));
    const atendidas  = citas.filter(c => c.estado === 'atendida');

    const enConsulta = meDoc?.en_consulta || false;

    v.innerHTML = `
      <!-- Modo Consulta Toggle -->
      <div class="card" style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;margin-bottom:20px;border:2px solid ${enConsulta ? 'var(--warning)' : 'var(--border)'};">
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:28px;">${enConsulta ? '🔴' : '🟢'}</span>
          <div>
            <div style="font-size:15px;font-weight:700;color:${enConsulta ? 'var(--warning)' : 'var(--success)'};">
              ${enConsulta ? 'En consulta' : 'Disponible'}
            </div>
            <div style="font-size:12px;color:var(--text-muted);">
              ${enConsulta ? 'La secretaria ve que estás ocupado' : 'La secretaria puede asignarte pacientes'}
            </div>
          </div>
        </div>
        <button class="btn ${enConsulta ? 'btn-ghost' : 'btn-primary'}" style="min-width:100px;"
                onclick="WaitingRoomView.toggleConsulta()">
          ${enConsulta ? 'Liberar' : 'Entrar'}
        </button>
      </div>

      <!-- Resumen del día -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;">
        <div class="card" style="text-align:center;padding:14px;">
          <div style="font-size:24px;font-weight:800;color:var(--warning);">${enEspera.length}</div>
          <div style="font-size:11px;color:var(--text-muted);">Esperando</div>
        </div>
        <div class="card" style="text-align:center;padding:14px;">
          <div style="font-size:24px;font-weight:800;color:var(--primary);">${proximas.length}</div>
          <div style="font-size:11px;color:var(--text-muted);">Por llegar</div>
        </div>
        <div class="card" style="text-align:center;padding:14px;">
          <div style="font-size:24px;font-weight:800;color:var(--success);">${atendidas.length}</div>
          <div style="font-size:11px;color:var(--text-muted);">Atendidos</div>
        </div>
      </div>

      <!-- Cola: en espera -->
      ${enEspera.length > 0 ? `
      <div class="settings-section">
        <div class="settings-section-label">
          <span class="settings-section-icon">⏳</span> En sala de espera
          <span style="background:var(--warning);color:#000;border-radius:10px;padding:1px 8px;font-size:11px;font-weight:700;margin-left:8px;">${enEspera.length}</span>
        </div>
        ${enEspera.map((c,i) => this._citaCard(c, i+1, 'waiting')).join('')}
      </div>` : ''}

      <!-- Por llegar -->
      <div class="settings-section">
        <div class="settings-section-label">
          <span class="settings-section-icon">📅</span> Por llegar (${proximas.length})
        </div>
        ${proximas.length === 0
          ? `<div class="card" style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px;">Todos los pacientes han llegado o no hay más citas</div>`
          : proximas.map(c => this._citaCard(c, null, 'pending')).join('')}
      </div>

      <!-- Atendidos -->
      ${atendidas.length > 0 ? `
      <div class="settings-section">
        <div class="settings-section-label" style="opacity:.7;">
          <span class="settings-section-icon">✅</span> Atendidos hoy
        </div>
        ${atendidas.map(c => this._citaCard(c, null, 'done')).join('')}
      </div>` : ''}
    `;
  },

  _citaCard(cita, turno, mode) {
    const d = new Date(cita.fecha_hora_inicio);
    const hora = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    const initials = (cita.paciente_nombre || '?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();

    const llegadaHora = cita.llegada_at
      ? (() => { const ll = new Date(cita.llegada_at); return `${String(ll.getHours()).padStart(2,'0')}:${String(ll.getMinutes()).padStart(2,'0')}`; })()
      : null;

    const espera = cita.llegada_at
      ? Math.round((Date.now() - new Date(cita.llegada_at)) / 60000)
      : null;

    const borderColor = mode === 'waiting' ? 'var(--warning)' : mode === 'done' ? 'var(--success)' : 'var(--border)';

    return `
      <div class="card" style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;margin-bottom:8px;border-left:3px solid ${borderColor};">
        ${turno ? `<div style="width:28px;height:28px;border-radius:50%;background:var(--warning);color:#000;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;flex-shrink:0;">${turno}</div>` : `<div style="width:38px;height:38px;border-radius:50%;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;">${initials}</div>`}
        <div style="flex:1;min-width:0;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <span style="font-size:14px;font-weight:600;cursor:pointer;color:var(--primary);" onclick="Router.navigate('patient/${cita.patient_id}')">${cita.paciente_nombre}</span>
            <span style="font-size:12px;color:var(--text-muted);white-space:nowrap;">🕐 ${hora}</span>
          </div>
          ${cita.descripcion ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${cita.descripcion}</div>` : ''}
          ${cita.nota_recepcion ? `
          <div style="font-size:12px;color:var(--warning);margin-top:6px;padding:6px 10px;background:var(--warning)15;border-radius:6px;border-left:2px solid var(--warning);">
            <strong>Nota recepción:</strong> ${cita.nota_recepcion}
          </div>` : ''}
          ${llegadaHora ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Llegó ${llegadaHora} · esperando ${espera < 60 ? espera + ' min' : Math.floor(espera/60) + 'h ' + (espera%60) + 'min'}</div>` : ''}
          ${mode === 'waiting' ? `
          <div style="display:flex;gap:6px;margin-top:8px;">
            <button class="btn btn-primary btn-sm" onclick="WaitingRoomView.iniciarAtencion(${cita.id})">▶ Atender ahora</button>
            <button class="btn btn-ghost btn-sm" onclick="Router.navigate('patient/${cita.patient_id}')">Ver historia</button>
          </div>` : ''}
        </div>
      </div>`;
  },

  async toggleConsulta() {
    try {
      const res = await api.clinic.toggleConsulta();
      const container = document.getElementById('app-main');
      await this._load(container);
      Toast.info(res.en_consulta ? '🔴 Modo consulta activado' : '🟢 Disponible para recibir pacientes');
    } catch (err) { Toast.error(err.message); }
  },

  async iniciarAtencion(id) {
    try {
      // Activar modo consulta automáticamente al iniciar
      await api.clinic.toggleConsulta();
      Router.navigate('appointments');
    } catch (err) { /* silencioso, igual navegar */ }
  },
};

window.WaitingRoomView = WaitingRoomView;
