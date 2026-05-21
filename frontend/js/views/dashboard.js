const DashboardView = {
  _container: null,
  _currentMes: null,

  async render(container) {
    this._container = container;
    const _initNow = new Date();
    this._currentMes = `${_initNow.getFullYear()}-${String(_initNow.getMonth()+1).padStart(2,'0')}`;
    container.innerHTML = `
      <div class="fade-in" id="dashboard-view">
        <div class="settings-hero">
          <div class="settings-hero-icon">📊</div>
          <div>
            <h1 class="settings-hero-title">Resumen</h1>
            <p class="settings-hero-sub" id="dashboard-date">Cargando...</p>
          </div>
        </div>
        <div class="loading-spinner" style="margin: 40px auto;"></div>
      </div>
    `;

    try {
      const today = new Date().toISOString().split('T')[0];
      const [resHoy, resStats, resUpcoming] = await Promise.all([
        api.appointments.list({ startDate: today, endDate: today }),
        api.appointments.stats(this._currentMes),
        api.appointments.upcoming(),
      ]);
      this._render(container, resHoy.data || [], resStats, resUpcoming.data || []);
    } catch (err) {
      container.querySelector('#dashboard-view').innerHTML += `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <div class="empty-title">Error al cargar</div>
          <div class="empty-desc">${err.message}</div>
        </div>`;
    }
  },

  _fmt(n) {
    return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
  },

  _render(container, citasHoy, stats, proximasCitas) {
    const d = new Date();
    const dateStr = d.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const totalHoy    = citasHoy.length;
    const confirmadas = citasHoy.filter(c => c.estado === 'confirmada').length;
    const pendientes  = citasHoy.filter(c => c.estado === 'pendiente').length;
    const ingresosHoy = citasHoy.reduce((s, c) => s + (c.monto_pagado || 0), 0);

    const proximaCita = proximasCitas.find(c =>
      new Date(c.fecha_hora_inicio) > new Date() && ['pendiente','confirmada'].includes(c.estado)
    );


    container.querySelector('#dashboard-view').innerHTML = `
      <!-- Cabecera -->
      <div class="settings-hero">
        <div class="settings-hero-icon">👋</div>
        <div>
          <h1 class="settings-hero-title">¡Hola!</h1>
          <p class="settings-hero-sub" style="text-transform:capitalize;">${dateStr}</p>
        </div>
      </div>

      <!-- Tabs -->
      <div style="display:flex; gap:8px; margin-bottom:20px;">
        <button class="btn btn-primary dash-tab active" data-tab="hoy" style="flex:1; justify-content:center;">Hoy</button>
        <button class="btn btn-ghost dash-tab" data-tab="mes" style="flex:1; justify-content:center;">Finanzas</button>
        <button class="btn btn-ghost dash-tab" data-tab="deudores" style="flex:1; justify-content:center;">Deudas ${stats.deudores?.length > 0 ? `<span style="background:var(--danger);color:#fff;border-radius:10px;padding:1px 6px;font-size:11px;margin-left:4px;">${stats.deudores.length}</span>` : ''}</button>
      </div>

      <!-- Tab: HOY -->
      <div id="tab-hoy">
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:12px; margin-bottom:20px;">
          ${this._statCard(totalHoy,    'Citas Hoy',    'var(--primary)')}
          ${this._statCard(confirmadas, 'Confirmadas',  'var(--success)')}
          ${this._statCard(pendientes,  'Pendientes',   'var(--warning)')}
          ${this._statCardMoney(ingresosHoy, 'Cobrado Hoy', '#2ea043')}
        </div>

        <div class="settings-section">
          <div class="settings-section-label">
            <span class="settings-section-icon">⏰</span> Siguiente Paciente
          </div>
          ${this._renderProximaCita(proximaCita)}
        </div>

        <div class="settings-section">
          <div class="settings-section-label">
            <span class="settings-section-icon">⚡</span> Acciones Rápidas
          </div>
          <div class="card" style="display:flex; gap:12px; flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="NewAppointmentView.open()" style="flex:1; min-width:140px; justify-content:center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px;margin-right:6px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nueva Cita
            </button>
            <button class="btn btn-ghost" onclick="Router.navigate('appointments')" style="flex:1; min-width:140px; justify-content:center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;margin-right:6px;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Ver Agenda
            </button>
          </div>
        </div>
      </div>

      <!-- Tab: MES -->
      <div id="tab-mes" style="display:none;"></div>

      <!-- Tab: DEUDORES -->
      <div id="tab-deudores" style="display:none;">
        ${this._renderDeudores(stats.deudores || [], stats.totalDeuda)}
      </div>
    `;

    this._renderMesTab(container, stats);

    // Tabs logic
    container.querySelectorAll('.dash-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.dash-tab').forEach(b => {
          b.classList.remove('active', 'btn-primary');
          b.classList.add('btn-ghost');
        });
        btn.classList.add('active', 'btn-primary');
        btn.classList.remove('btn-ghost');
        ['hoy','mes','deudores'].forEach(t => {
          const el = container.querySelector('#tab-' + t);
          if (el) el.style.display = (t === btn.dataset.tab) ? '' : 'none';
        });
      });
    });
  },

  _statCard(valor, label, color) {
    return `
      <div class="card" style="text-align:center; padding:18px;">
        <div style="font-size:30px; font-weight:800; color:${color}; margin-bottom:4px;">${valor}</div>
        <div style="font-size:12px; color:var(--text-secondary); font-weight:500;">${label}</div>
      </div>`;
  },

  _statCardMoney(valor, label, color) {
    return `
      <div class="card" style="text-align:center; padding:18px; border:1px solid ${color}22;">
        <div style="font-size:20px; font-weight:800; color:${color}; margin-bottom:4px;">$${this._fmt(valor)}</div>
        <div style="font-size:12px; color:var(--text-secondary); font-weight:500;">${label}</div>
      </div>`;
  },

  _renderDeudores(deudores, totalDeuda) {
    if (!deudores.length) {
      return `
        <div class="empty-state" style="padding:40px;">
          <div class="empty-icon" style="font-size:36px; margin-bottom:12px;">✅</div>
          <div class="empty-title">Sin deudas pendientes</div>
          <div class="empty-desc">Todos los pacientes están al día.</div>
        </div>`;
    }

    const rows = deudores.map(d => {
      const fecha = new Date(d.fecha_hora_inicio).toLocaleDateString('es-ES', { day:'2-digit', month:'short' });
      return `
        <div style="display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid var(--border);">
          <div style="flex:1;">
            <div style="font-size:14px; font-weight:600; color:var(--text-primary);">${d.paciente_nombre}</div>
            <div style="font-size:12px; color:var(--text-muted);">${fecha} · ${d.paciente_telefono}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:15px; font-weight:700; color:var(--danger);">$${this._fmt(d.deuda)}</div>
            <div style="font-size:11px; color:var(--text-muted);">de $${this._fmt(d.costo_estimado)}</div>
          </div>
          <button class="btn btn-ghost btn-sm btn-icon" onclick="Router.navigate('patient/${d.paciente_id}')" title="Ver paciente">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>`;
    }).join('');

    return `
      <div class="card" style="padding:0 16px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 0; border-bottom:1px solid var(--border);">
          <span style="font-weight:700; color:var(--text-primary);">Total adeudado</span>
          <span style="font-size:18px; font-weight:800; color:var(--danger);">$${this._fmt(totalDeuda)}</span>
        </div>
        ${rows}
      </div>`;
  },

  _renderProximaCita(cita) {
    if (!cita) {
      return `
        <div class="empty-state" style="padding:30px;">
          <div class="empty-icon" style="font-size:32px; margin-bottom:12px;">🎉</div>
          <div class="empty-title">¡Todo libre!</div>
          <div class="empty-desc">No tienes próximas citas pendientes.</div>
        </div>`;
    }
    const d = new Date(cita.fecha_hora_inicio);
    const hora = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} hs`;
    const initials = cita.paciente_nombre.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
    const estadoColor = cita.estado === 'confirmada' ? 'success' : 'warning';
    return `
      <div class="card" style="display:flex; align-items:center; gap:16px; padding:20px; border-left:4px solid var(--${estadoColor});">
        <div style="width:50px; height:50px; border-radius:50%; background:var(--bg-elevated); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:18px; flex-shrink:0;">
          ${initials}
        </div>
        <div style="flex:1;">
          <div style="font-size:16px; font-weight:600; color:var(--text-primary); margin-bottom:4px;">${cita.paciente_nombre}</div>
          <div style="font-size:14px; color:var(--text-secondary);">📅 ${d.toLocaleDateString('es-ES')} a las ${hora}</div>
          ${cita.descripcion ? `<div style="font-size:13px; color:var(--text-muted); margin-top:4px;">${cita.descripcion}</div>` : ''}
        </div>
        <span class="badge badge-${cita.estado}">${cita.estado.toUpperCase()}</span>
      </div>`;
  },

  _renderMesTab(container, stats) {
    const el = container.querySelector('#tab-mes');
    if (!el) return;
    el.innerHTML = this._getMesTabHTML(stats);
  },

  _getMesTabHTML(stats) {
    const [year, month] = this._currentMes.split('-').map(Number);
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const nomMes = meses[month - 1];
    const now = new Date();
    const nowMes = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const isCurrentMonth = this._currentMes === nowMes;

    const varMes = stats.ingresosMesAnterior > 0
      ? Math.round(((stats.ingresosMes - stats.ingresosMesAnterior) / stats.ingresosMesAnterior) * 100)
      : null;
    const varColor = varMes !== null && varMes >= 0 ? 'var(--success)' : 'var(--danger)';
    const varIcon  = varMes !== null && varMes >= 0 ? '↑' : '↓';

    return `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
        <button class="btn btn-ghost btn-sm" onclick="DashboardView._navMes(-1)" style="padding:6px 16px; font-size:18px;">◀</button>
        <span style="font-weight:700; font-size:16px; color:var(--text-primary);">${nomMes} ${year}</span>
        <button class="btn btn-ghost btn-sm" onclick="DashboardView._navMes(1)" style="padding:6px 16px; font-size:18px; ${isCurrentMonth ? 'opacity:0.3; pointer-events:none;' : ''}">▶</button>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:12px; margin-bottom:20px;">
        ${this._statCardMoney(stats.ingresosMes, 'Ingresos ' + nomMes, '#2ea043')}
        ${this._statCard(stats.citasMes, 'Citas ' + nomMes, 'var(--primary)')}
        ${this._statCardMoney(stats.totalDeuda, 'Total Adeudado', 'var(--danger)')}
        ${this._statCard((stats.tasaNoAsistencia || 0) + '%', 'No Asistencia', 'var(--warning)')}
      </div>

      ${varMes !== null ? `
      <div class="card" style="display:flex; align-items:center; gap:12px; padding:16px; margin-bottom:16px;">
        <span style="font-size:28px; font-weight:800; color:${varColor};">${varIcon} ${Math.abs(varMes)}%</span>
        <div>
          <div style="font-size:14px; font-weight:600; color:var(--text-primary);">vs. mes anterior</div>
          <div style="font-size:12px; color:var(--text-secondary);">Mes anterior: $${this._fmt(stats.ingresosMesAnterior)}</div>
        </div>
      </div>` : ''}

      ${this._renderChart(stats.historial || [])}

      <div class="settings-section">
        <div class="settings-section-label">
          <span class="settings-section-icon">📈</span> Resumen ${nomMes}
        </div>
        <div class="card" style="padding:16px;">
          <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border);">
            <span style="color:var(--text-secondary);">Ingresos cobrados</span>
            <span style="font-weight:700; color:var(--success);">$${this._fmt(stats.ingresosMes)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border);">
            <span style="color:var(--text-secondary);">Pendiente de cobro</span>
            <span style="font-weight:700; color:var(--danger);">$${this._fmt(stats.totalDeuda)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:10px 0;">
            <span style="color:var(--text-secondary);">Total facturado</span>
            <span style="font-weight:700; color:var(--text-primary);">$${this._fmt((stats.ingresosMes || 0) + (stats.totalDeuda || 0))}</span>
          </div>
        </div>
      </div>
    `;
  },

  async _navMes(delta) {
    const [y, m] = this._currentMes.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const newMes = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const now = new Date();
    const nowMes = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    if (newMes > nowMes) return;
    this._currentMes = newMes;

    const el = this._container?.querySelector('#tab-mes');
    if (el) el.innerHTML = '<div class="loading-spinner" style="margin:40px auto;"></div>';

    try {
      const stats = await api.appointments.stats(this._currentMes);
      this._renderMesTab(this._container, stats);
    } catch (err) {
      if (el) el.innerHTML = `<div class="empty-state"><div class="empty-title">Error</div><div class="empty-desc">${err.message}</div></div>`;
    }
  },

  _renderChart(historial) {
    if (!historial || historial.length === 0) return '';
    const max = Math.max(...historial.map(h => h.total), 1);
    const barW = 32, gap = 12, chartH = 80;
    const totalW = historial.length * (barW + gap) - gap;
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

    const bars = historial.map((h, i) => {
      const barH = Math.max(Math.round((h.total / max) * chartH), h.total > 0 ? 4 : 0);
      const x = i * (barW + gap);
      const y = chartH - barH;
      const [, mon] = h.mes.split('-');
      const label = meses[parseInt(mon) - 1];
      const isSel = h.mes === this._currentMes;
      const color = isSel ? 'var(--primary)' : '#6b7280';
      return `<g>
        <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="3" fill="${color}" opacity="${isSel ? '1' : '0.45'}"/>
        <text x="${x + barW/2}" y="${chartH + 14}" text-anchor="middle" font-size="10" fill="var(--text-muted)">${label}</text>
        ${barH > 12 ? `<text x="${x + barW/2}" y="${y - 4}" text-anchor="middle" font-size="9" fill="var(--text-secondary)">$${this._fmtShort(h.total)}</text>` : ''}
      </g>`;
    }).join('');

    return `
      <div class="card" style="padding:16px 16px 8px; margin-bottom:16px; overflow-x:auto;">
        <div style="font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:12px;">Ingresos últimos 6 meses</div>
        <svg viewBox="-4 -20 ${totalW + 8} ${chartH + 36}" style="width:100%; overflow:visible; min-width:240px;">
          ${bars}
        </svg>
      </div>`;
  },

  _fmtShort(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000)    return (n / 1000).toFixed(1) + 'k';
    return Math.round(n);
  },
};

window.DashboardView = DashboardView;
