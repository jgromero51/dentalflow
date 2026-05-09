const PatientsView = {
  async render(container) {
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
          ${this.renderList(patients)}
        </div>`;

      // Búsqueda en tiempo real
      let timeout;
      document.getElementById('patient-search-global')?.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(async () => {
          const q = e.target.value.trim();
          const r = await api.patients.list(q);
          document.getElementById('patients-list').innerHTML = this.renderList(r.data || []);
        }, 350);
      });
    } catch (err) {
      view.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>${err.message}</p></div>`;
    }
  },

  renderList(patients) {
    if (!patients.length) return `
      <div class="empty-state">
        <div class="empty-icon">👤</div>
        <div class="empty-title">Sin pacientes</div>
        <div class="empty-desc">Los pacientes se crean automáticamente al crear una cita.</div>
      </div>`;

    return patients.map(p => {
      const initials = p.nombre.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
      return `
      <div class="patient-card" onclick="Router.navigate('patient/${p.id}')">
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
};

window.PatientsView = PatientsView;
