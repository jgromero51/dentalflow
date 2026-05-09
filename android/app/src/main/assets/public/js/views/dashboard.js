/**
 * DentalFlow — Vista de Dashboard (Inicio)
 * Muestra un resumen del día: citas pendientes, confirmadas, y próximos pacientes.
 */
const DashboardView = {
  async render(container) {
    container.innerHTML = `
      <div class="fade-in" id="dashboard-view">
        <div class="settings-hero">
          <div class="settings-hero-icon">📊</div>
          <div>
            <h1 class="settings-hero-title">Resumen del Día</h1>
            <p class="settings-hero-sub" id="dashboard-date">Cargando...</p>
          </div>
        </div>
        <div class="loading-spinner" style="margin: 40px auto;"></div>
      </div>
    `;

    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await api.appointments.list({ startDate: today, endDate: today });
      const citasHoy = res.data || [];
      
      const resUpcoming = await api.appointments.upcoming();
      const proximasCitas = resUpcoming.data || [];

      this._renderDashboard(container, citasHoy, proximasCitas);
    } catch (err) {
      container.querySelector('#dashboard-view').innerHTML += `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <div class="empty-title">Error al cargar</div>
          <div class="empty-desc">${err.message}</div>
        </div>`;
    }
  },

  _renderDashboard(container, citasHoy, proximasCitas) {
    const d = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = d.toLocaleDateString('es-AR', options);
    
    // Calcular estadísticas
    const totalHoy = citasHoy.length;
    const confirmadas = citasHoy.filter(c => c.estado === 'confirmada').length;
    const pendientes = citasHoy.filter(c => c.estado === 'pendiente').length;
    const canceladas = citasHoy.filter(c => c.estado === 'cancelada').length;

    // Próxima cita (la primera pendiente o confirmada a partir de ahora)
    const ahora = new Date();
    const proximaCita = proximasCitas.find(c => new Date(c.fecha_hora_inicio) > ahora && ['pendiente', 'confirmada'].includes(c.estado));

    // Calcular ingresos del día (pagos registrados hoy)
    const ingresosHoy = citasHoy.reduce((sum, cita) => sum + (cita.monto_pagado || 0), 0);

    let html = `
      <div class="settings-hero">
        <div class="settings-hero-icon">👋</div>
        <div>
          <h1 class="settings-hero-title">¡Hola!</h1>
          <p class="settings-hero-sub" style="text-transform: capitalize;">${dateStr}</p>
        </div>
      </div>

      <!-- Tarjetas de Estadísticas -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 24px;">
        
        <div class="card" style="text-align: center; padding: 20px;">
          <div style="font-size: 32px; font-weight: 800; color: var(--primary); margin-bottom: 4px;">${totalHoy}</div>
          <div style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">Citas Hoy</div>
        </div>

        <div class="card" style="text-align: center; padding: 20px;">
          <div style="font-size: 32px; font-weight: 800; color: var(--success); margin-bottom: 4px;">${confirmadas}</div>
          <div style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">Confirmadas</div>
        </div>

        <div class="card" style="text-align: center; padding: 20px;">
          <div style="font-size: 32px; font-weight: 800; color: var(--warning); margin-bottom: 4px;">${pendientes}</div>
          <div style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">Pendientes</div>
        </div>
        
        <div class="card" style="text-align: center; padding: 20px; border: 1px solid rgba(46, 160, 67, 0.3);">
          <div style="font-size: 24px; font-weight: 800; color: #2ea043; margin-bottom: 4px; display: flex; align-items: center; justify-content: center; height: 38px;">$${ingresosHoy.toFixed(2)}</div>
          <div style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">Ingresos Hoy</div>
        </div>

      </div>

      <!-- Próxima Cita -->
      <div class="settings-section">
        <div class="settings-section-label">
          <span class="settings-section-icon">⏰</span>
          Siguiente Paciente
        </div>
        ${this._renderProximaCita(proximaCita)}
      </div>

      <!-- Acciones Rápidas -->
      <div class="settings-section">
        <div class="settings-section-label">
          <span class="settings-section-icon">⚡</span>
          Acciones Rápidas
        </div>
        <div class="card" style="display: flex; gap: 12px; flex-wrap: wrap;">
          <button class="btn btn-primary" onclick="NewAppointmentView.open()" style="flex: 1; min-width: 140px; justify-content: center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px; height:16px; margin-right:6px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nueva Cita
          </button>
          <button class="btn btn-ghost" onclick="Router.navigate('appointments')" style="flex: 1; min-width: 140px; justify-content: center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px; margin-right:6px;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Ver Agenda
          </button>
        </div>
      </div>
    `;

    container.querySelector('#dashboard-view').innerHTML = html;
  },

  _renderProximaCita(cita) {
    if (!cita) {
      return `
        <div class="empty-state" style="padding: 30px;">
          <div class="empty-icon" style="font-size: 32px; margin-bottom: 12px;">🎉</div>
          <div class="empty-title">¡Todo libre!</div>
          <div class="empty-desc">No tienes próximas citas pendientes.</div>
        </div>
      `;
    }

    const d = new Date(cita.fecha_hora_inicio);
    const hora = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} hs`;
    const initials = cita.paciente_nombre.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
    const estadoClass = cita.estado === 'confirmada' ? 'success' : (cita.estado === 'pendiente' ? 'warning' : 'primary');

    return `
      <div class="card" style="display: flex; align-items: center; gap: 16px; padding: 20px; border-left: 4px solid var(--${estadoClass});">
        <div style="width: 50px; height: 50px; border-radius: 50%; background: var(--bg-elevated); display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--text-primary); font-size: 18px; flex-shrink: 0;">
          ${initials}
        </div>
        <div style="flex: 1;">
          <div style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">${cita.paciente_nombre}</div>
          <div style="font-size: 14px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
             📅 ${d.toLocaleDateString('es-AR')} a las ${hora}
          </div>
          ${cita.descripcion ? `<div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">${cita.descripcion}</div>` : ''}
        </div>
        <div>
          <span class="badge badge-${cita.estado}" style="font-size: 12px; padding: 4px 8px;">${cita.estado.toUpperCase()}</span>
        </div>
      </div>
    `;
  }
};

window.DashboardView = DashboardView;
