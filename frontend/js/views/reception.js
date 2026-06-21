/**
 * DentalFlow — Vista de Recepción
 *
 * Panel optimizado para la secretaria/recepcionista:
 * - Buscador prominente de pacientes
 * - Agenda del día con marcado de llegada
 * - Accesos rápidos: nueva cita, nuevo paciente, nueva proforma
 */
const ReceptionView = {
  _refreshTimer: null,

  async render(container) {
    container.innerHTML = `
      <div class="fade-in" id="reception-view">
        <div class="settings-hero" style="margin-bottom:16px;">
          <div class="settings-hero-icon">🏥</div>
          <div>
            <h1 class="settings-hero-title">Recepción</h1>
            <p class="settings-hero-sub" id="reception-date">Cargando...</p>
          </div>
        </div>
        <div class="loading-spinner" style="margin:40px auto;"></div>
      </div>`;

    const d = new Date();
    const dateStr = d.toLocaleDateString('es-PE', { weekday:'long', day:'numeric', month:'long' });
    document.getElementById('reception-date').textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

    await this._load(container);
    // Auto-refresh cada 60s
    this._refreshTimer = setInterval(() => this._load(container), 60000);
  },

  destroy() {
    if (this._refreshTimer) { clearInterval(this._refreshTimer); this._refreshTimer = null; }
  },

  async _load(container) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [resHoy, resConsulta] = await Promise.all([
        api.appointments.list({ fecha: today }),
        api.clinic.consultaStatus().catch(() => ({ data: [] })),
      ]);
      const citas    = (resHoy.data || []).sort((a,b) => a.fecha_hora_inicio.localeCompare(b.fecha_hora_inicio));
      const doctores = resConsulta.data || [];
      this._renderContent(container, citas, doctores);
    } catch (err) {
      const v = container.querySelector('#reception-view');
      if (v) v.innerHTML += `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">${err.message}</div></div>`;
    }
  },

  _renderContent(container, citas, doctores) {
    const v = container.querySelector('#reception-view');
    if (!v) return;

    const docEnConsulta = doctores.find(d => d.en_consulta);

    // Clasificar citas
    const esperando  = citas.filter(c => c.llegada_at && !['atendida','cancelada','no_asistio'].includes(c.estado));
    const pendientes = citas.filter(c => !c.llegada_at && !['atendida','cancelada','no_asistio'].includes(c.estado));
    const atendidas  = citas.filter(c => c.estado === 'atendida');

    v.innerHTML = `
      <!-- Buscador -->
      <div style="margin-bottom:20px;">
        <div class="search-input-wrap" style="position:relative;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               style="position:absolute;left:14px;top:50%;transform:translateY(-50%);width:18px;height:18px;color:var(--text-muted);pointer-events:none;">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input id="rec-search" class="form-control" type="text" placeholder="Buscar paciente por nombre o teléfono..."
            style="padding-left:42px;font-size:16px;height:50px;"
            oninput="ReceptionView._onSearch(this.value)" />
        </div>
        <div id="rec-search-results" style="margin-top:8px;"></div>
      </div>

      <!-- Estado del doctor -->
      ${docEnConsulta ? `
      <div class="card" style="display:flex;align-items:center;gap:12px;padding:14px 16px;margin-bottom:16px;border-left:4px solid var(--warning);">
        <span style="font-size:20px;">🩺</span>
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--warning);">Doctor en consulta</div>
          <div style="font-size:12px;color:var(--text-muted);">${docEnConsulta.doctor_name || docEnConsulta.username} está atendiendo</div>
        </div>
      </div>` : ''}

      <!-- Acciones rápidas -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;">
        <button class="btn btn-primary" style="height:52px;justify-content:center;font-size:15px;" onclick="NewAppointmentView.open()">
          📅 Nueva Cita
        </button>
        <button class="btn btn-ghost" style="height:52px;justify-content:center;font-size:15px;border:1px solid var(--border);" onclick="NewPatientWizard.open()">
          👤 Nuevo Paciente
        </button>
      </div>

      <!-- Cola de espera -->
      <div class="settings-section">
        <div class="settings-section-label">
          <span class="settings-section-icon">⏳</span>
          En sala de espera
          ${esperando.length > 0 ? `<span style="background:var(--warning);color:#000;border-radius:10px;padding:1px 8px;font-size:11px;font-weight:700;margin-left:8px;">${esperando.length}</span>` : ''}
        </div>
        ${esperando.length === 0
          ? `<div class="card" style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">Sin pacientes esperando</div>`
          : esperando.map(c => this._citaCard(c, 'waiting')).join('')}
      </div>

      <!-- Citas del día pendientes de llegada -->
      <div class="settings-section">
        <div class="settings-section-label">
          <span class="settings-section-icon">📋</span>
          Agenda del día (${pendientes.length} pendiente${pendientes.length !== 1 ? 's' : ''})
        </div>
        ${pendientes.length === 0
          ? `<div class="card" style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">Sin citas pendientes</div>`
          : pendientes.map(c => this._citaCard(c, 'pending')).join('')}
      </div>

      <!-- Atendidos hoy -->
      ${atendidas.length > 0 ? `
      <div class="settings-section">
        <div class="settings-section-label" style="opacity:.7;">
          <span class="settings-section-icon">✅</span> Atendidos hoy (${atendidas.length})
        </div>
        ${atendidas.map(c => this._citaCard(c, 'done')).join('')}
      </div>` : ''}
    `;

    // Foco automático en el buscador
    setTimeout(() => document.getElementById('rec-search')?.focus(), 100);
  },

  _citaCard(cita, mode) {
    const d = new Date(cita.fecha_hora_inicio);
    const hora = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    const initials = (cita.paciente_nombre || '?').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();

    const llegadaHora = cita.llegada_at
      ? (() => { const ll = new Date(cita.llegada_at); return `${String(ll.getHours()).padStart(2,'0')}:${String(ll.getMinutes()).padStart(2,'0')}`; })()
      : null;

    const borderColor = mode === 'waiting' ? 'var(--warning)' : mode === 'done' ? 'var(--success)' : 'var(--border)';

    return `
      <div class="card" style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;margin-bottom:8px;border-left:3px solid ${borderColor};">
        <div style="width:40px;height:40px;border-radius:50%;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;">${initials}</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-size:14px;font-weight:600;color:var(--text-primary);cursor:pointer;" onclick="Router.navigate('patient/${cita.patient_id}')">${cita.paciente_nombre}</span>
            <span style="font-size:13px;font-weight:600;color:var(--primary);white-space:nowrap;">🕐 ${hora}</span>
          </div>
          ${cita.descripcion ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${cita.descripcion}</div>` : ''}
          ${cita.nota_recepcion ? `<div style="font-size:12px;color:var(--warning);margin-top:4px;padding:4px 8px;background:var(--warning)11;border-radius:4px;">📌 ${cita.nota_recepcion}</div>` : ''}
          ${llegadaHora ? `<div style="font-size:11px;color:var(--success);margin-top:4px;">Llegó a las ${llegadaHora}</div>` : ''}
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
            ${mode === 'pending' ? `
              <button class="btn btn-primary btn-sm" onclick="ReceptionView.marcarLlegada(${cita.id})">✅ Llegó</button>
              <button class="btn btn-ghost btn-sm" onclick="ReceptionView.agregarNota(${cita.id}, '${(cita.nota_recepcion||'').replace(/'/g,'&#39;')}')">📌 Nota</button>
              <button class="btn btn-ghost btn-sm" onclick="ReceptionView.nuevaProforma(${cita.patient_id}, '${(cita.paciente_nombre||'').replace(/'/g,'&#39;')}')">💰 Proforma</button>
            ` : mode === 'waiting' ? `
              <button class="btn btn-ghost btn-sm" style="border-color:var(--warning);" onclick="ReceptionView.agregarNota(${cita.id}, '${(cita.nota_recepcion||'').replace(/'/g,'&#39;')}')">📌 Nota para doctor</button>
              <button class="btn btn-ghost btn-sm" onclick="ReceptionView.marcarAtendida(${cita.id})">🏁 Marcar atendida</button>
            ` : `
              <span style="font-size:11px;color:var(--success);font-weight:600;">✓ Atendido</span>
            `}
          </div>
        </div>
      </div>`;
  },

  async _onSearch(q) {
    const el = document.getElementById('rec-search-results');
    if (!el) return;
    if (!q || q.length < 2) { el.innerHTML = ''; return; }
    try {
      const res = await api.patients.list(q);
      const patients = (res.data || []).slice(0, 6);
      if (patients.length === 0) {
        el.innerHTML = `<div class="card" style="padding:12px 16px;font-size:13px;color:var(--text-muted);">Sin resultados para "${q}"</div>`;
        return;
      }
      el.innerHTML = patients.map(p => `
        <div class="card" style="display:flex;align-items:center;gap:12px;padding:12px 16px;margin-bottom:6px;cursor:pointer;"
             onclick="Router.navigate('patient/${p.id}')">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--primary)22;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;color:var(--primary);">
            ${p.nombre.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:600;color:var(--text-primary);">${p.nombre}</div>
            <div style="font-size:12px;color:var(--text-muted);">${p.telefono || ''} · ${p.total_citas || 0} cita${p.total_citas !== 1 ? 's' : ''}</div>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;flex-shrink:0;color:var(--text-muted);"><path d="M9 18l6-6-6-6"/></svg>
        </div>`).join('');
    } catch (err) { /* silencioso */ }
  },

  async marcarLlegada(id) {
    try {
      await api.appointments.arrived(id);
      Toast.success('Paciente marcado como llegado ✅');
      const container = document.getElementById('app-main');
      await this._load(container);
    } catch (err) { Toast.error(err.message); }
  },

  async marcarAtendida(id) {
    try {
      await api.appointments.updateStatus(id, 'atendida');
      Toast.success('Cita marcada como atendida');
      const container = document.getElementById('app-main');
      await this._load(container);
    } catch (err) { Toast.error(err.message); }
  },

  agregarNota(id, notaActual) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML = `
      <div style="background:var(--bg-surface);border-radius:16px;padding:24px;width:100%;max-width:400px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="margin:0;font-size:16px;">📌 Nota para el doctor</h3>
          <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text-muted);">×</button>
        </div>
        <textarea id="nota-input" class="form-control" rows="3" placeholder="Ej: Paciente nervioso, preguntar sobre plan de pagos..." style="resize:none;">${notaActual}</textarea>
        <div style="display:flex;gap:8px;margin-top:14px;">
          <button class="btn btn-ghost" style="flex:1;" onclick="this.closest('[style*=fixed]').remove()">Cancelar</button>
          <button class="btn btn-primary" style="flex:1;" onclick="ReceptionView._guardarNota(${id}, document.getElementById('nota-input').value, this.closest('[style*=fixed]'))">Guardar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    setTimeout(() => document.getElementById('nota-input')?.focus(), 100);
  },

  async _guardarNota(id, nota, modal) {
    try {
      await api.appointments.notaRecepcion(id, nota);
      modal?.remove();
      Toast.success('Nota guardada');
      const container = document.getElementById('app-main');
      await this._load(container);
    } catch (err) { Toast.error(err.message); }
  },

  nuevaProforma(patientId, nombre) {
    Router.navigate(`patient/${patientId}`);
    // Pequeño delay para que cargue la vista y luego abrir tab finanzas
    setTimeout(() => PatientDetailView.switchTab('finanzas'), 600);
  },
};

window.ReceptionView = ReceptionView;
