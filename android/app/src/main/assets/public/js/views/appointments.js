/**
 * DentalFlow — Vista: Listado de Citas
 */
const AppointmentsView = {
  currentTab: 'today',
  allAppointments: [],

  async render(container) {
    container.innerHTML = `
      <div class="fade-in">
        <!-- Stats -->
        <div class="stats-strip" id="stats-strip">
          <div class="stat-card"><div class="stat-value" id="stat-today">—</div><div class="stat-label">Hoy</div></div>
          <div class="stat-card"><div class="stat-value" id="stat-week">—</div><div class="stat-label">Esta semana</div></div>
          <div class="stat-card"><div class="stat-value" id="stat-pending">—</div><div class="stat-label">Pendientes</div></div>
        </div>

        <!-- Calendario mini -->
        <div id="mini-calendar-container"></div>

        <!-- Tabs -->
        <div class="tabs">
          <button class="tab-btn active" data-tab="today" id="tab-today">Hoy</button>
          <button class="tab-btn" data-tab="upcoming" id="tab-upcoming">Próximas</button>
          <button class="tab-btn" data-tab="all" id="tab-all">Todas</button>
        </div>

        <!-- Lista de citas -->
        <div id="appointments-list">
          <div class="loading-screen" style="min-height:30vh;">
            <div class="loading-spinner"></div>
          </div>
        </div>
      </div>`;

    this.bindTabs();
    await this.loadStats();
    await this.loadTab('today');
    CalendarComponent.render('mini-calendar-container', (fecha) => {
      this.loadByDate(fecha);
    });
  },

  bindTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.loadTab(btn.dataset.tab);
      });
    });
  },

  async loadStats() {
    try {
      const [todayRes, upcomingRes, pendingRes] = await Promise.all([
        api.appointments.today(),
        api.appointments.upcoming(),
        api.appointments.list({ estado: 'pendiente', limit: 200 }),
      ]);

      const today    = todayRes.data || [];
      const upcoming = upcomingRes.data || [];
      const pending  = pendingRes.data || [];

      // Citas esta semana
      const hoy   = new Date();
      const endW  = new Date(hoy); endW.setDate(hoy.getDate() + 7);
      const thisW = upcoming.filter(a => new Date(a.fecha_hora_inicio) <= endW).length;

      document.getElementById('stat-today').textContent   = today.length;
      document.getElementById('stat-week').textContent    = thisW;
      document.getElementById('stat-pending').textContent = pending.total || pending.length || 0;
    } catch (e) { /* silencioso */ }
  },

  async loadTab(tab) {
    this.currentTab = tab;
    const listEl = document.getElementById('appointments-list');
    listEl.innerHTML = '<div style="text-align:center;padding:24px;"><div class="loading-spinner" style="margin:0 auto;"></div></div>';

    try {
      let data = [];
      let title = '';
      if (tab === 'today') {
        const res = await api.appointments.today();
        data = res.data || []; title = 'Citas de hoy';
      } else if (tab === 'upcoming') {
        const res = await api.appointments.upcoming();
        data = res.data || []; title = 'Próximas citas';
      } else {
        const res = await api.appointments.list({ limit: 100 });
        data = res.data || []; title = 'Todas las citas';
      }
      this.allAppointments = data;
      this.renderList(listEl, data, title);
    } catch (err) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p class="empty-desc">Error al cargar citas: ${err.message}</p></div>`;
    }
  },

  async loadByDate(fecha) {
    const listEl = document.getElementById('appointments-list');
    listEl.innerHTML = '<div style="text-align:center;padding:24px;"><div class="loading-spinner" style="margin:0 auto;"></div></div>';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    try {
      const res = await api.appointments.list({ fecha, limit: 50 });
      const data = res.data || [];
      const d = new Date(fecha + 'T12:00:00');
      const dias = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
      const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      const title = `${dias[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]}`;
      this.renderList(listEl, data, title);
    } catch (err) {
      listEl.innerHTML = `<div class="empty-state"><p class="empty-desc">Error: ${err.message}</p></div>`;
    }
  },

  renderList(container, appointments, title) {
    if (appointments.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <div class="empty-title">Sin citas</div>
          <div class="empty-desc">${title === 'Citas de hoy' ? 'No hay citas para hoy.' : 'No se encontraron citas.'}<br>Tocá <strong>+</strong> para crear una.</div>
        </div>`;
      return;
    }

    const estadoLabel = { pendiente: 'Pendiente', confirmada: 'Confirmada', cancelada: 'Cancelada', no_asistio: 'No asistió' };

    container.innerHTML = `
      <div class="section-header">
        <span class="section-title">${title}</span>
        <span class="section-count">${appointments.length} cita${appointments.length !== 1 ? 's' : ''}</span>
      </div>
      ${appointments.map(a => {
        const d = new Date(a.fecha_hora_inicio);
        const hora = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        const dur  = a.duracion_minutos >= 60 ? `${a.duracion_minutos/60}h` : `${a.duracion_minutos}min`;
        return `
        <div class="appt-card estado-${a.estado}" id="appt-${a.id}" data-id="${a.id}">
          <div class="appt-row">
            <div class="appt-time-col">
              <div class="appt-time">${hora}</div>
              <div class="appt-duration">${dur}</div>
            </div>
            <div class="appt-info-col">
              <div class="appt-patient">${a.paciente_nombre}</div>
              ${a.descripcion ? `<div class="appt-treatment">🦷 ${a.descripcion}</div>` : ''}
              <div class="appt-phone">${a.paciente_telefono}</div>
            </div>
            <div>
              <span class="badge badge-${a.estado}">${estadoLabel[a.estado] || a.estado}</span>
            </div>
          </div>
          <div class="appt-actions">
            ${a.estado === 'pendiente' ? `
              <button class="btn btn-success btn-sm" onclick="AppointmentsView.updateStatus(${a.id},'confirmada')">✓ Confirmar</button>
              <button class="btn btn-danger  btn-sm" onclick="AppointmentsView.updateStatus(${a.id},'cancelada')">✕ Cancelar</button>
            ` : ''}
            ${a.estado !== 'no_asistio' && a.estado !== 'cancelada' ? `
              <button class="btn btn-ghost btn-sm" onclick="AppointmentsView.updateStatus(${a.id},'no_asistio')">No asistió</button>
            ` : ''}
            <button class="btn btn-ghost btn-sm btn-icon" onclick="AppointmentsView.whatsappPatient('${a.paciente_telefono}')" title="WhatsApp">
              <svg viewBox="0 0 24 24" fill="currentColor" style="color:#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </button>
            <button class="btn btn-ghost btn-sm btn-icon" onclick="AppointmentsView.deleteAppt(${a.id})" title="Eliminar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        </div>`;
      }).join('')}`;
  },

  async updateStatus(id, estado) {
    try {
      await api.appointments.updateStatus(id, estado);
      const labels = { confirmada: '✅ Confirmada', cancelada: '❌ Cancelada', no_asistio: '😔 No asistió' };
      Toast.success(`Cita marcada como: ${labels[estado] || estado}`);
      await this.loadTab(this.currentTab);
      await this.loadStats();
    } catch (err) {
      Toast.error('Error al actualizar: ' + err.message);
    }
  },

  async deleteAppt(id) {
    if (!confirm('¿Eliminar esta cita?')) return;
    try {
      await api.appointments.delete(id);
      Toast.success('Cita eliminada');
      await this.loadTab(this.currentTab);
      await this.loadStats();
    } catch (err) {
      Toast.error('Error al eliminar: ' + err.message);
    }
  },

  whatsappPatient(telefono) {
    const tel = telefono.replace(/\D/g, '');
    window.open(`https://wa.me/${tel}`, '_blank');
  },
};
window.AppointmentsView = AppointmentsView;
