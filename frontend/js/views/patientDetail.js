const PatientDetailView = {
  currentTab: 'agenda',
  patient: null,
  odontogramData: [],
  mediaRecorder: null,
  audioChunks: [],

  async render(container, patientId) {
    if (!patientId) return Router.navigate('patients');
    
    container.innerHTML = '<div class="fade-in" id="patient-detail-view"><div style="text-align:center;padding:24px;"><div class="loading-spinner" style="margin:0 auto;"></div></div></div>';
    
    try {
      const res = await api.patients.get(patientId);
      this.patient = res.data;
      
      const resOdo = await api.odontogram.get(patientId);
      this.odontogramData = resOdo.data || [];

      this.updateView();
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Error al cargar paciente: ${err.message}</p>
        <button class="btn btn-primary" style="margin-top:16px;" onclick="Router.navigate('patients')">Volver</button>
      </div>`;
    }
  },

  updateView() {
    const view = document.getElementById('patient-detail-view');
    if (!view || !this.patient) return;

    const p = this.patient;
    const initials = p.nombre.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();

    let tabContent = '';
    if (this.currentTab === 'agenda') {
      tabContent = this.renderAgenda();
    } else if (this.currentTab === 'clinica') {
      tabContent = this.renderClinica();
    } else if (this.currentTab === 'finanzas') {
      tabContent = this.renderFinanzas();
      setTimeout(() => this.loadProformaHistory(), 0);
    }

    view.innerHTML = `
      <div class="patient-detail-header" style="padding-bottom: 0;">
        <button class="btn btn-icon" style="margin-bottom:12px;" onclick="Router.navigate('patients')">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style="display:flex; align-items:center; gap: 16px; justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:16px;">
            <div class="patient-avatar" style="width:64px;height:64px;font-size:24px;">${initials}</div>
            <div>
              <h2 style="margin:0; font-size:20px;">${p.nombre}</h2>
              <div style="color:var(--text-secondary); font-size:14px; margin-top:4px;">${p.telefono || 'Sin teléfono'}</div>
              ${p.email ? `<div style="color:var(--text-secondary); font-size:13px;">${p.email}</div>` : ''}
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="PatientDetailView.openEditModal()" style="flex-shrink:0;">
            ✏️ Editar
          </button>
        </div>
        
        <div class="tabs" style="display:flex; gap:16px; margin-top:24px; border-bottom:1px solid var(--border-color);">
          <button class="tab-btn ${this.currentTab === 'agenda' ? 'active' : ''}" onclick="PatientDetailView.switchTab('agenda')">Agenda</button>
          <button class="tab-btn ${this.currentTab === 'clinica' ? 'active' : ''}" onclick="PatientDetailView.switchTab('clinica')">Historia & Odontograma</button>
          <button class="tab-btn ${this.currentTab === 'finanzas' ? 'active' : ''}" onclick="PatientDetailView.switchTab('finanzas')">Finanzas</button>
        </div>
      </div>
      <div class="patient-detail-content" style="padding: 16px;">
        ${tabContent}
      </div>
    `;

    // Si estamos en clínica, renderizar odontograma y cargar tratamientos
    if (this.currentTab === 'clinica') {
      if (window.OdontogramComponent) {
        OdontogramComponent.render(document.getElementById('odontogram-container'), this.odontogramData, this.patient.id);
      }
      this.loadTreatments();
    }
  },

  switchTab(tab) {
    this.currentTab = tab;
    this.updateView();
  },

  renderAgenda() {
    const appts = this.patient.appointments || [];
    const estadoLabel = { pendiente: 'Pendiente', confirmada: 'Confirmada', cancelada: 'Cancelada', no_asistio: 'No asistió' };

    let html = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
        <button class="btn btn-primary btn-sm" onclick="NewAppointmentView.openForPatient(PatientDetailView.patient)">📅 Agendar Cita</button>
      </div>
    `;

    if (appts.length === 0) {
      html += '<div class="empty-state" style="padding:24px 0;"><div class="empty-desc">Sin citas registradas</div></div>';
    } else {
      html += appts.map(a => {
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
      }).join('');
    }
    return html;
  },

  renderClinica() {
    const p = this.patient;
    return `
      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="margin:0; font-size:16px;">Datos Médicos</h3>
          <button class="btn btn-sm" style="background: linear-gradient(45deg, #8a2be2, #4169e1); color:white; border:none;" onclick="PatientDetailView.getAISummary()">
            ✨ Resumen Clínico IA
          </button>
        </div>
        <div id="ai-summary-container" style="display:none; margin-bottom:16px; padding:12px; background:var(--bg-elevated); border-radius:8px; border-left:3px solid #8a2be2; font-size:14px; line-height:1.5;"></div>

        <div class="form-group" style="margin-bottom:12px;">
          <label>Alergias</label>
          <input type="text" id="pat-alergias" class="form-control" value="${p.alergias || ''}" placeholder="Ej. Penicilina, Látex..." onchange="PatientDetailView.saveMedicalData()">
        </div>
        <div class="form-group" style="margin-bottom:12px;">
          <label>Enfermedades Previas</label>
          <input type="text" id="pat-enf" class="form-control" value="${p.enfermedades_previas || ''}" placeholder="Ej. Hipertensión, Diabetes..." onchange="PatientDetailView.saveMedicalData()">
        </div>
        <div class="form-group">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <label style="margin:0;">Notas Clínicas Generales</label>
            <button class="btn btn-sm" id="btn-dictar" style="background:#f1f3f5; color:#333; border:1px solid #ddd;" onclick="PatientDetailView.toggleDictation()">
              🎙️ Dictar Evolución
            </button>
          </div>
          <div id="dictation-status" style="display:none; color:#da3633; font-size:12px; margin-bottom:8px; align-items:center; gap:4px;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#da3633;animation:pulse 1s infinite;"></span>
            Grabando... Haz clic en detener para procesar con IA.
          </div>
          <textarea id="pat-notas" class="form-control" rows="4" placeholder="Notas adicionales..." onchange="PatientDetailView.saveMedicalData()">${p.notas || ''}</textarea>
          <style>@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }</style>
        </div>
      </div>
      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="margin:0; font-size:16px;">Historial de Tratamientos</h3>
          <button class="btn btn-primary btn-sm" onclick="PatientDetailView.openAddTreatmentModal()">+ Agregar</button>
        </div>
        <div id="treatments-list"><div style="text-align:center;padding:12px;"><div class="loading-spinner" style="margin:0 auto;width:18px;height:18px;border-width:2px;"></div></div></div>
      </div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="margin:0; font-size:16px;">Odontograma</h3>
        </div>
        <div id="odontogram-container" style="overflow-x:auto;">
          <!-- SVG rendered here -->
        </div>
      </div>
    `;
  },

  async loadTreatments() {
    const el = document.getElementById('treatments-list');
    if (!el) return;
    try {
      const res  = await api.patients.getTreatments(this.patient.id);
      const rows = res.data || [];
      if (rows.length === 0) {
        el.innerHTML = `<div style="font-size:13px;color:var(--text-muted);text-align:center;padding:12px;">Sin tratamientos registrados.</div>`;
        return;
      }
      el.innerHTML = rows.map(t => {
        const fecha = new Date(t.fecha + 'T12:00:00').toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' });
        return `
          <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border-color);">
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:13px;color:var(--text-primary);">${t.nombre}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${fecha} · ${t.categoria || 'General'}</div>
              ${t.notas ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:3px;">${t.notas}</div>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
              ${t.precio > 0 ? `<span style="font-size:13px;font-weight:600;color:var(--text-primary);">S/ ${parseFloat(t.precio).toFixed(2)}</span>` : ''}
              <button onclick="PatientDetailView.deleteTreatment(${t.id})" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:16px;padding:0;line-height:1;" title="Eliminar">✕</button>
            </div>
          </div>`;
      }).join('');
    } catch (err) {
      el.innerHTML = `<div style="font-size:13px;color:var(--danger);">Error al cargar tratamientos.</div>`;
    }
  },

  async openAddTreatmentModal() {
    // Cargar catálogo para autocomplete
    let catalogItems = [];
    try {
      const res = await api.catalog.list();
      catalogItems = res.data || [];
    } catch (_) {}

    const today = new Date().toISOString().split('T')[0];
    const opts = catalogItems.map(c =>
      `<option value="${c.nombre}" data-precio="${c.precio}" data-categoria="${c.categoria}">`
    ).join('');

    document.getElementById('modal-title').textContent = '🦷 Agregar Tratamiento';
    document.getElementById('modal-body').innerHTML = `
      <datalist id="catalog-list">${opts}</datalist>
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div class="form-group" style="margin:0;">
          <label class="form-label">Tratamiento *</label>
          <input id="tr-nombre" type="text" class="form-control" list="catalog-list" placeholder="Ej: Extracción, Limpieza..."
            oninput="PatientDetailView._onTreatmentInput(this)" />
        </div>
        <div style="display:flex;gap:10px;">
          <div class="form-group" style="margin:0;flex:1;">
            <label class="form-label">Precio (S/)</label>
            <input id="tr-precio" type="number" class="form-control" min="0" step="0.01" placeholder="0.00" />
          </div>
          <div class="form-group" style="margin:0;flex:1;">
            <label class="form-label">Fecha *</label>
            <input id="tr-fecha" type="date" class="form-control" value="${today}" />
          </div>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label">Notas (opcional)</label>
          <input id="tr-notas" type="text" class="form-control" placeholder="Observaciones..." />
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px;">
          <button class="btn btn-ghost btn-sm" onclick="closeModal()">Cancelar</button>
          <button class="btn btn-primary btn-sm" onclick="PatientDetailView.saveTreatment()">💾 Guardar</button>
        </div>
      </div>
    `;
    openModal();
  },

  _onTreatmentInput(input) {
    const list = document.getElementById('catalog-list');
    const opt  = Array.from(list.options).find(o => o.value === input.value);
    if (opt) {
      document.getElementById('tr-precio').value = opt.dataset.precio || '';
    }
  },

  async saveTreatment() {
    const nombre = document.getElementById('tr-nombre').value.trim();
    const precio = parseFloat(document.getElementById('tr-precio').value) || 0;
    const fecha  = document.getElementById('tr-fecha').value;
    const notas  = document.getElementById('tr-notas').value.trim();

    if (!nombre) { Toast.warning('El nombre del tratamiento es requerido.'); return; }
    if (!fecha)  { Toast.warning('La fecha es requerida.'); return; }

    // Buscar categoría del catálogo si coincide
    const opt = document.querySelector(`#catalog-list option[value="${nombre}"]`);
    const categoria = opt?.dataset.categoria || 'General';

    try {
      await api.patients.addTreatment(this.patient.id, { nombre, precio, fecha, notas, categoria });
      closeModal();
      Toast.success('Tratamiento registrado.');
      this.loadTreatments();
    } catch (err) {
      Toast.error('Error: ' + err.message);
    }
  },

  async deleteTreatment(tid) {
    if (!confirm('¿Eliminar este tratamiento?')) return;
    try {
      await api.patients.deleteTreatment(this.patient.id, tid);
      Toast.success('Eliminado.');
      this.loadTreatments();
    } catch (err) {
      Toast.error('Error: ' + err.message);
    }
  },

  renderFinanzas() {
    const appts = this.patient.appointments || [];
    let totalCosto = 0;
    let totalPagado = 0;

    appts.forEach(a => {
      totalCosto += (a.costo_estimado || 0);
      totalPagado += (a.monto_pagado || 0);
    });

    const deuda = totalCosto - totalPagado;
    const metodoLabel = { efectivo: '💵 Efectivo', tarjeta: '💳 Tarjeta', transferencia: '🏦 Transferencia', yape: '📱 Yape', plin: '📱 Plin' };

    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <span style="font-size:14px;font-weight:600;color:var(--text-primary);">Proformas</span>
        <button class="btn btn-primary btn-sm" onclick="PatientDetailView.openProforma()">📄 Nueva Proforma</button>
      </div>
      <div id="proforma-history" style="margin-bottom:20px;"></div>
      <div style="display:flex; gap:12px; margin-bottom:24px; flex-wrap:wrap;">
        <div class="card" style="flex:1; min-width:90px; text-align:center; padding:12px 8px;">
          <div style="font-size:11px; color:var(--text-secondary); margin-bottom:4px;">Total Facturado</div>
          <div style="font-size:18px; font-weight:700; color:var(--text-primary);">S/ ${totalCosto.toFixed(2)}</div>
        </div>
        <div class="card" style="flex:1; min-width:90px; text-align:center; padding:12px 8px;">
          <div style="font-size:11px; color:var(--text-secondary); margin-bottom:4px;">Total Pagado</div>
          <div style="font-size:18px; font-weight:700; color:#2ea043;">S/ ${totalPagado.toFixed(2)}</div>
        </div>
        <div class="card" style="flex:1; min-width:90px; text-align:center; padding:12px 8px; ${deuda > 0 ? 'border:1px solid #da3633;' : ''}">
          <div style="font-size:11px; color:var(--text-secondary); margin-bottom:4px;">Saldo Pendiente</div>
          <div style="font-size:18px; font-weight:700; color:${deuda > 0 ? '#da3633' : '#2ea043'};">S/ ${deuda.toFixed(2)}</div>
        </div>
      </div>
      <h3 style="margin:0 0 12px 0; font-size:16px;">Historial de Pagos por Cita</h3>
    `;

    if (appts.length === 0) {
      html += '<div class="empty-state"><div class="empty-desc">Sin citas registradas</div></div>';
    } else {
      html += appts.map(a => {
        const d = new Date(a.fecha_hora_inicio);
        const fecha = d.toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' });
        const costo = a.costo_estimado || 0;
        const pagado = a.monto_pagado || 0;
        const saldo = costo - pagado;
        const pagoCompleto = costo > 0 && saldo <= 0;
        const sinCosto = costo === 0;

        return `
        <div class="card" style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:14px;">${fecha}</div>
              <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">${a.descripcion || 'Sin descripción'}</div>
              ${a.metodo_pago ? `<div style="font-size:11px;color:var(--text-muted);margin-top:3px;">${metodoLabel[a.metodo_pago] || a.metodo_pago}</div>` : ''}
            </div>
            <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">
              ${sinCosto
                ? `<div style="font-size:12px;color:var(--text-muted);">Sin costo</div>`
                : `<div style="font-size:14px;font-weight:600;">S/ ${costo.toFixed(2)}</div>
                   ${pagoCompleto
                     ? `<div style="font-size:11px;color:#2ea043;font-weight:600;">✅ Pagado</div>`
                     : `<div style="font-size:11px;color:#da3633;">Pendiente: S/ ${saldo.toFixed(2)}</div>`
                   }`
              }
              <button class="btn btn-sm" style="font-size:11px;padding:4px 10px;margin-top:2px;" onclick="PatientDetailView.openPaymentModal(${a.id})">
                ${sinCosto ? '💰 Agregar costo' : pagoCompleto ? '✏️ Editar' : '💳 Registrar pago'}
              </button>
            </div>
          </div>
        </div>`;
      }).join('');
    }

    return html;
  },

  openPaymentModal(apptId) {
    const appt = (this.patient.appointments || []).find(a => a.id === apptId);
    if (!appt) return;

    const costo = appt.costo_estimado || 0;
    const pagado = appt.monto_pagado || 0;
    const d = new Date(appt.fecha_hora_inicio);
    const fecha = d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
    const metodoOpts = [
      ['efectivo', '💵 Efectivo'],
      ['tarjeta', '💳 Tarjeta'],
      ['transferencia', '🏦 Transferencia'],
      ['yape', '📱 Yape'],
      ['plin', '📱 Plin'],
    ].map(([val, label]) =>
      `<option value="${val}" ${appt.metodo_pago === val ? 'selected' : ''}>${label}</option>`
    ).join('');

    document.getElementById('modal-title').textContent = '💳 Registrar Pago';
    document.getElementById('modal-body').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div style="font-size:13px;color:var(--text-secondary);padding:10px 12px;background:var(--bg-elevated);border-radius:8px;">
          <div style="font-weight:600;color:var(--text-primary);margin-bottom:2px;">${fecha}</div>
          ${appt.descripcion ? `<div>${appt.descripcion}</div>` : ''}
        </div>

        <div class="form-group" style="margin:0;">
          <label class="form-label">Costo total (S/)</label>
          <input id="pay-costo" type="number" class="form-control" min="0" step="0.01" value="${costo > 0 ? costo.toFixed(2) : ''}" placeholder="0.00" />
        </div>

        <div class="form-group" style="margin:0;">
          <label class="form-label">Monto pagado (S/)</label>
          <input id="pay-monto" type="number" class="form-control" min="0" step="0.01" value="${pagado > 0 ? pagado.toFixed(2) : ''}" placeholder="0.00" />
          <div class="form-hint">Total recibido hasta ahora. Puede ser parcial.</div>
        </div>

        <div class="form-group" style="margin:0;">
          <label class="form-label">Método de pago</label>
          <select id="pay-metodo" class="form-control">${metodoOpts}</select>
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px;">
          <button class="btn btn-ghost btn-sm" onclick="closeModal()">Cancelar</button>
          <button class="btn btn-primary btn-sm" onclick="PatientDetailView.savePayment(${apptId})">💾 Guardar</button>
        </div>
      </div>
    `;
    openModal();
  },

  async savePayment(apptId) {
    const costo  = parseFloat(document.getElementById('pay-costo').value) || 0;
    const monto  = parseFloat(document.getElementById('pay-monto').value) || 0;
    const metodo = document.getElementById('pay-metodo').value;

    if (monto > costo && costo > 0) {
      Toast.warning('El monto pagado no puede superar el costo total.');
      return;
    }

    try {
      await api.appointments.update(apptId, { costo_estimado: costo, monto_pagado: monto, metodo_pago: metodo });

      const appt = (this.patient.appointments || []).find(a => a.id === apptId);
      if (appt) {
        appt.costo_estimado = costo;
        appt.monto_pagado   = monto;
        appt.metodo_pago    = metodo;
      }

      closeModal();
      Toast.success('Pago registrado.');
      this.updateView();
      setTimeout(() => this.loadProformaHistory(), 0);
    } catch (err) {
      Toast.error('Error al guardar: ' + err.message);
    }
  },

  async saveMedicalData() {
    const alergias = document.getElementById('pat-alergias').value;
    const enf = document.getElementById('pat-enf').value;
    const notas = document.getElementById('pat-notas').value;

    try {
      await api.patients.update(this.patient.id, {
        alergias: alergias,
        enfermedades_previas: enf,
        notas: notas
      });
      Toast.success('Datos médicos guardados');
      // Actualizar modelo local
      this.patient.alergias = alergias;
      this.patient.enfermedades_previas = enf;
      this.patient.notas = notas;
    } catch(err) {
      Toast.error('Error al guardar datos: ' + err.message);
    }
  },

  async getAISummary() {
    const container = document.getElementById('ai-summary-container');
    if (!container) return;
    
    container.style.display = 'block';
    container.innerHTML = '<div style="display:flex;align-items:center;gap:8px;color:var(--text-secondary);"><div class="loading-spinner" style="width:14px;height:14px;border-width:2px;"></div> Analizando historial con IA...</div>';
    
    try {
      const res = await api.patients.getSummary(this.patient.id);
      // Formatear el texto usando saltos de línea y emojis
      const summaryHTML = res.data.replace(/\n/g, '<br>');
      container.innerHTML = `<strong>✨ Resumen de la IA:</strong><br><div style="margin-top:8px;color:var(--text-primary);">${summaryHTML}</div>`;
    } catch (err) {
      container.innerHTML = `<span style="color:#da3633;">⚠️ Error al generar resumen: ${err.message}</span>`;
    }
  },

  openProforma(proformaId = null, savedItems = null, savedNotas = '') {
    const p = this.patient;
    this._editingProformaId = proformaId || null;
    document.getElementById('modal-title').textContent = proformaId ? '✏️ Editar Proforma' : '📄 Nueva Proforma';
    document.getElementById('modal-body').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div style="font-size:14px;color:var(--text-secondary);">
          Paciente: <strong>${p.nombre}</strong>
        </div>

        <div id="proforma-items">
          <div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;margin-bottom:6px;">
            <span style="font-size:12px;color:var(--text-secondary);font-weight:600;">TRATAMIENTO</span>
            <span style="font-size:12px;color:var(--text-secondary);font-weight:600;">PRECIO (S/)</span>
            <span></span>
          </div>
        </div>

        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" onclick="PatientDetailView.addProformaItem()">+ Agregar ítem</button>
          <button id="proforma-voice-btn" class="btn btn-secondary btn-sm" onclick="PatientDetailView.dictarProforma()" style="display:flex;align-items:center;gap:6px;">
            🎙️ Dictar por voz
          </button>
          <button class="btn btn-secondary btn-sm" onclick="PatientDetailView.subirFotoProforma()" style="display:flex;align-items:center;gap:6px;">
            📷 Desde foto
          </button>
          <input type="file" id="proforma-img-input" accept="image/*" style="display:none;" onchange="PatientDetailView._procesarFotoProforma(this)">
          <span style="font-size:12px;color:var(--text-muted);">La IA lee tu lista de precios</span>
        </div>
        <div id="proforma-img-preview" style="display:none;margin-top:8px;"></div>

        <div>
          <label style="font-size:13px;color:var(--text-secondary);display:block;margin-bottom:4px;">Notas / condiciones (opcional)</label>
          <textarea id="proforma-notas" rows="2" style="width:100%;box-sizing:border-box;background:var(--surface);border:1px solid var(--border-color);border-radius:8px;padding:8px;color:var(--text-primary);font-size:13px;resize:vertical;" placeholder="Ej: Incluye anestesia, no incluye rayos X...">${savedNotas}</textarea>
        </div>

        <div id="proforma-total" style="text-align:right;font-size:15px;font-weight:700;color:var(--primary);"></div>

        <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:4px;">
          <button class="btn btn-secondary btn-sm" onclick="closeModal()">Cancelar</button>
          <button class="btn btn-secondary btn-sm" onclick="PatientDetailView.saveProforma()">💾 Guardar</button>
          <button class="btn btn-secondary btn-sm" onclick="PatientDetailView.printProforma()">🖨️ PDF</button>
          ${proformaId ? `<button class="btn btn-primary btn-sm" onclick="PatientDetailView.sendProformaWhatsApp(${proformaId})">📱 Enviar WhatsApp</button>` : ''}
        </div>
      </div>
    `;

    if (savedItems && savedItems.length > 0) {
      savedItems.forEach(it => this.addProformaItem(it.nombre, it.precio));
    } else {
      this.addProformaItem();
    }
    this._updateProformaTotal();
    openModal();
  },

  _getProformaItems() {
    const items = [];
    document.querySelectorAll('#proforma-items .proforma-row').forEach(row => {
      const inputs = row.querySelectorAll('input');
      const nombre = inputs[0]?.value.trim();
      const precio = parseFloat(inputs[1]?.value) || 0;
      if (nombre) items.push({ nombre, precio });
    });
    return items;
  },

  _updateProformaTotal() {
    const items = this._getProformaItems();
    const total = items.reduce((s, i) => s + i.precio, 0);
    const el = document.getElementById('proforma-total');
    if (el) el.textContent = `Total: S/ ${total.toFixed(2)}`;
  },

  async saveProforma() {
    const items = this._getProformaItems();
    const notas = document.getElementById('proforma-notas')?.value || '';
    if (items.length === 0) { Toast.warning('Agregá al menos un tratamiento.'); return; }

    try {
      if (this._editingProformaId) {
        await api.proformas.update(this._editingProformaId, { items, notas, estado: 'borrador' });
        Toast.success('Proforma actualizada.');
      } else {
        const res = await api.proformas.create({ patient_id: this.patient.id, items, notas });
        this._editingProformaId = res.data.id;
        // Actualizar modal para mostrar botón WhatsApp
        const btnRow = document.querySelector('#modal-body .btn-primary');
        if (btnRow && btnRow.parentElement) {
          const waBtn = document.createElement('button');
          waBtn.className = 'btn btn-primary btn-sm';
          waBtn.onclick = () => this.sendProformaWhatsApp(this._editingProformaId);
          waBtn.textContent = '📱 Enviar WhatsApp';
          btnRow.parentElement.appendChild(waBtn);
        }
        Toast.success('Proforma guardada.');
      }
      this.loadProformaHistory();
    } catch (err) {
      Toast.error('Error al guardar: ' + err.message);
    }
  },

  async sendProformaWhatsApp(id) {
    const proformaId = id || this._editingProformaId;
    if (!proformaId) { Toast.warning('Guardá la proforma primero.'); return; }
    try {
      const res = await api.proformas.sendWhatsApp(proformaId);
      if (res.demo) {
        Toast.warning('Modo demo: no se envió realmente.');
      } else {
        Toast.success('✅ Presupuesto enviado por WhatsApp al paciente.');
        this.loadProformaHistory();
      }
    } catch (err) {
      Toast.error('Error: ' + err.message);
    }
  },

  async loadProformaHistory() {
    const el = document.getElementById('proforma-history');
    if (!el) return;
    try {
      const res  = await api.proformas.list(this.patient.id);
      const rows = res.data || [];
      if (rows.length === 0) {
        el.innerHTML = `<div style="font-size:13px;color:var(--text-muted);text-align:center;padding:16px;">Sin proformas guardadas.</div>`;
        return;
      }
      el.innerHTML = rows.map(pf => {
        const fecha  = new Date((pf.created_at || '') + (pf.created_at && !pf.created_at.includes('Z') ? 'Z' : '')).toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' });
        const estado = pf.estado === 'enviada'
          ? `<span style="background:#238636;color:#fff;border-radius:4px;padding:2px 6px;font-size:11px;">Enviada</span>`
          : `<span style="background:var(--border);color:var(--text-muted);border-radius:4px;padding:2px 6px;font-size:11px;">Borrador</span>`;
        const itemsAttr = JSON.stringify(pf.items).replace(/"/g,'&quot;');
        const notasAttr = (pf.notas||'').replace(/'/g,"\\'");
        return `
          <div style="border:1px solid var(--border);border-radius:8px;margin-bottom:8px;background:var(--bg-primary);overflow:hidden;">
            <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;">
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:600;color:var(--text-primary);">Proforma #${pf.id} — S/ ${parseFloat(pf.total).toFixed(2)}</div>
                <div style="font-size:11px;color:var(--text-muted);">${fecha} · ${pf.items?.length || 0} ítem(s)</div>
              </div>
              ${estado}
              <button onclick="PatientDetailView.openProforma(${pf.id}, ${itemsAttr}, '${notasAttr}')"
                style="background:none;border:none;cursor:pointer;font-size:18px;padding:0 4px;" title="Editar">✏️</button>
              <button onclick="PatientDetailView._deleteProforma(${pf.id})"
                style="background:none;border:none;cursor:pointer;color:var(--danger);font-size:18px;padding:0 4px;" title="Eliminar">✕</button>
            </div>
            <div style="display:flex;gap:8px;padding:0 12px 10px;">
              <button class="btn btn-secondary btn-sm" style="flex:1;"
                onclick="PatientDetailView.printProformaById(${pf.id}, ${itemsAttr}, '${notasAttr}', ${parseFloat(pf.total)})">
                📄 Ver PDF
              </button>
              <button class="btn btn-primary btn-sm" style="flex:1;"
                onclick="PatientDetailView.sendProformaWhatsAppConfirm(${pf.id}, '${(pf.paciente_nombre||this.patient?.nombre||'').replace(/'/g,"\\'")}', ${parseFloat(pf.total)})">
                📱 Enviar WhatsApp
              </button>
            </div>
          </div>`;
      }).join('');
    } catch (err) {
      el.innerHTML = `<div style="font-size:13px;color:var(--danger);">Error al cargar proformas.</div>`;
    }
  },

  async _deleteProforma(id) {
    if (!confirm('¿Eliminar esta proforma?')) return;
    try {
      await api.proformas.remove(id);
      Toast.success('Eliminada.');
      this.loadProformaHistory();
    } catch (err) {
      Toast.error('Error: ' + err.message);
    }
  },

  async printProformaById(id, items, notas, total) {
    const p = this.patient;
    let clinica = {}, doctorNombre = '', ruc = '', direccion = '', telefono = '', email = '', validezDias = 15;
    try {
      const res = await api.settings.get();
      clinica = res.data || {};
      doctorNombre = clinica.doctor_name || '';
      ruc          = clinica.clinic_ruc  || '';
      direccion    = clinica.clinic_address || '';
      telefono     = clinica.clinic_phone   || '';
      email        = clinica.clinic_email   || '';
      validezDias  = parseInt(clinica.proforma_validez_dias) || 15;
    } catch (_) {}

    const clinicaNombre = clinica.clinic_name || 'Consultorio Dental';
    const fecha = new Date().toLocaleDateString('es-PE', { day:'2-digit', month:'long', year:'numeric' });
    const validezFecha = new Date(Date.now() + validezDias * 86400000)
      .toLocaleDateString('es-PE', { day:'2-digit', month:'long', year:'numeric' });

    const itemsHTML = items.map((it, i) => `
      <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td style="text-align:center;color:#6b7280;padding:9px 10px;">${i + 1}</td>
        <td style="padding:9px 12px;">${it.nombre || it.desc || ''}</td>
        <td style="padding:9px 12px;text-align:right;font-weight:500;">S/ ${parseFloat(it.precio).toFixed(2)}</td>
      </tr>`).join('');

    // Reutiliza el mismo HTML de printProforma()
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
    <title>Proforma #${id} — ${p.nombre}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: Arial, Helvetica, sans-serif; color:#1a1a1a; background:#fff; padding:32px 40px; font-size:13px; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:18px; padding-bottom:16px; border-bottom:3px solid #1a6fc4; }
      .clinic-name { font-size:22px; font-weight:800; color:#1a6fc4; }
      .clinic-sub  { font-size:11px; color:#555; margin-top:3px; line-height:1.6; }
      .badge-proforma { background:#1a6fc4; color:#fff; font-size:13px; font-weight:700; padding:5px 16px; border-radius:4px; display:inline-block; margin-bottom:6px; }
      .ruc-box { font-size:11px; color:#555; }
      .ruc-box strong { color:#1a1a1a; font-size:12px; }
      .doc-title { text-align:center; font-size:15px; font-weight:700; letter-spacing:2px; color:#1a6fc4; background:#eef4fc; padding:8px; margin-bottom:16px; border:1px solid #c2d9f0; }
      .patient-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 20px; background:#f7f9fc; border:1px solid #dde5f0; border-radius:6px; padding:12px 16px; margin-bottom:18px; }
      .patient-grid .label { font-size:10px; color:#888; text-transform:uppercase; font-weight:600; }
      .patient-grid .value { font-size:13px; color:#1a1a1a; font-weight:600; border-bottom:1px solid #d0d8e8; padding-bottom:2px; }
      table { width:100%; border-collapse:collapse; font-size:13px; }
      thead tr { background:#1a6fc4; color:#fff; }
      thead th { padding:9px 12px; font-weight:700; font-size:12px; }
      thead th:first-child { width:40px; text-align:center; }
      thead th:last-child  { text-align:right; width:110px; }
      .row-even { background:#fff; } .row-odd { background:#f4f7fd; }
      td { border-bottom:1px solid #e2e8f0; }
      .total-row td { background:#1a6fc4; color:#fff; font-weight:700; font-size:14px; padding:11px 12px; border:none; }
      .total-row td:last-child { text-align:right; }
      .notas { margin-top:14px; background:#fffbea; border-left:3px solid #f59e0b; padding:9px 14px; border-radius:0 6px 6px 0; font-size:12px; color:#555; }
      .validez { margin-top:12px; font-size:11px; color:#888; font-style:italic; text-align:center; }
      .firma-row { display:flex; justify-content:flex-end; margin-top:36px; }
      .firma-box { text-align:center; width:220px; }
      .firma-line { border-top:1.5px solid #1a1a1a; margin-bottom:6px; }
      .firma-name { font-weight:700; font-size:13px; }
      .firma-sub  { font-size:11px; color:#888; }
      .footer { margin-top:28px; font-size:10px; color:#aaa; text-align:center; border-top:1px solid #e5e7eb; padding-top:10px; }
      @media print { body { padding:16px 24px; } }
    </style></head><body>
    <div class="header">
      <div>
        <div class="clinic-name">🦷 ${clinicaNombre}</div>
        <div class="clinic-sub">${direccion ? direccion + '<br>' : ''}${telefono ? 'Tel: ' + telefono : ''}${telefono && email ? ' | ' : ''}${email ? 'E-mail: ' + email : ''}</div>
      </div>
      <div style="text-align:right;">
        <div class="badge-proforma">PROFORMA #${id}</div>
        ${ruc ? `<div class="ruc-box">RUC: <strong>${ruc}</strong></div>` : ''}
        <div class="ruc-box">Fecha: <strong>${fecha}</strong></div>
      </div>
    </div>
    <div class="doc-title">PROFORMA DE TRATAMIENTO</div>
    <div class="patient-grid">
      <div><div class="label">Nombre</div><div class="value">${p.nombre}</div></div>
      <div><div class="label">DNI</div><div class="value">${p.dni || ''}</div></div>
      <div><div class="label">Teléfono</div><div class="value">${p.telefono || ''}</div></div>
      <div><div class="label">Emisión</div><div class="value">${fecha}</div></div>
    </div>
    <table>
      <thead><tr><th style="text-align:center;">#</th><th>DESCRIPCIÓN</th><th style="text-align:right;">PRECIO</th></tr></thead>
      <tbody>${itemsHTML}<tr class="total-row"><td colspan="2">TOTAL</td><td>S/ ${parseFloat(total).toFixed(2)}</td></tr></tbody>
    </table>
    ${notas ? `<div class="notas"><strong>📝 Notas:</strong> ${notas}</div>` : ''}
    <div class="validez">⚠️ Válida hasta el <strong>${validezFecha}</strong> (${validezDias} días).</div>
    <div class="firma-row"><div class="firma-box"><div class="firma-line"></div><div class="firma-name">${doctorNombre || clinicaNombre}</div><div class="firma-sub">Cirujano Dentista</div></div></div>
    <div class="footer">Documento informativo · DentalFlow · ${clinicaNombre} · ${fecha}</div>
    </body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  },

  async sendProformaWhatsAppConfirm(id, nombre, total) {
    const ok = confirm(`¿Enviar la proforma por WhatsApp a ${nombre}?\n\nTotal: S/ ${parseFloat(total).toFixed(2)}\n\nEl paciente recibirá el detalle de los tratamientos en su WhatsApp.`);
    if (!ok) return;
    try {
      const res = await api.proformas.sendWhatsApp(id);
      if (res.demo) {
        Toast.warning('Modo demo: no se envió realmente.');
      } else {
        Toast.success('✅ Presupuesto enviado por WhatsApp.');
        this.loadProformaHistory();
      }
    } catch (err) {
      Toast.error('Error: ' + err.message);
    }
  },

  async dictarProforma() {
    const btn = document.getElementById('proforma-voice-btn');
    if (!btn) return;

    // Si ya está grabando, detener
    if (this._proformaRecorder && this._proformaRecorder.state === 'recording') {
      this._proformaRecorder.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      this._proformaRecorder = recorder;
      const chunks = [];

      btn.innerHTML = '⏹️ Detener grabación';
      btn.style.background = 'var(--danger)';
      btn.style.color = '#fff';

      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        btn.innerHTML = '⏳ Procesando...';
        btn.disabled = true;

        try {
          const blob   = new Blob(chunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            try {
              const res = await api.catalog.proformaVoice(base64, 'webm');
              const items = res.data || [];
              if (items.length === 0) {
                Toast.warning('No se detectaron tratamientos. Intentá de nuevo.');
              } else {
                // Limpiar items actuales y agregar los detectados
                document.getElementById('proforma-items').querySelectorAll('.proforma-row').forEach(r => r.remove());
                items.forEach(item => this.addProformaItem(item.nombre, item.precio));
                Toast.success(`✅ ${items.length} tratamiento(s) detectados.`);
              }
            } catch (err) {
              Toast.error('Error IA: ' + err.message);
            } finally {
              btn.innerHTML = '🎙️ Dictar por voz';
              btn.style.background = '';
              btn.style.color = '';
              btn.disabled = false;
            }
          };
          reader.readAsDataURL(blob);
        } catch (err) {
          Toast.error('Error al procesar audio.');
          btn.innerHTML = '🎙️ Dictar por voz';
          btn.style.background = '';
          btn.style.color = '';
          btn.disabled = false;
        }
      };

      recorder.start();
    } catch (err) {
      Toast.error('No se pudo acceder al micrófono: ' + err.message);
    }
  },

  addProformaItem(nombre = '', precio = '') {
    const container = document.getElementById('proforma-items');
    if (!container) return;
    const idx = container.querySelectorAll('.proforma-row').length;
    const row = document.createElement('div');
    row.className = 'proforma-row';
    row.style.cssText = 'display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;margin-bottom:6px;';
    row.innerHTML = `
      <input type="text" placeholder="Ej: Extracción molar" value="${nombre}" oninput="PatientDetailView._updateProformaTotal()" style="background:var(--surface);border:1px solid var(--border-color);border-radius:8px;padding:8px 10px;color:var(--text-primary);font-size:13px;width:100%;box-sizing:border-box;" />
      <input type="number" placeholder="0" min="0" step="0.01" value="${precio}" oninput="PatientDetailView._updateProformaTotal()" style="background:var(--surface);border:1px solid var(--border-color);border-radius:8px;padding:8px 10px;color:var(--text-primary);font-size:13px;width:90px;box-sizing:border-box;" />
      <button onclick="this.closest('.proforma-row').remove()" style="background:none;border:none;color:#da3633;font-size:18px;cursor:pointer;padding:0 4px;">✕</button>
    `;
    container.appendChild(row);
  },

  async printProforma() {
    const p = this.patient;
    const rows = document.querySelectorAll('#proforma-items .proforma-row');
    const notas = document.getElementById('proforma-notas')?.value || '';

    const items = [];
    let total = 0;
    rows.forEach(row => {
      const inputs = row.querySelectorAll('input');
      const desc   = inputs[0]?.value.trim();
      const precio = parseFloat(inputs[1]?.value) || 0;
      if (desc) { items.push({ desc, precio }); total += precio; }
    });
    if (items.length === 0) { Toast.warning('Agregá al menos un tratamiento'); return; }

    // Cargar datos de la clínica
    let clinica = {}, doctorNombre = '', ruc = '', direccion = '', telefono = '', email = '', validezDias = 15;
    try {
      const res = await api.settings.get();
      clinica = res.data || {};
      doctorNombre  = clinica.doctor_name || '';
      ruc           = clinica.clinic_ruc  || '';
      direccion     = clinica.clinic_address || '';
      telefono      = clinica.clinic_phone   || '';
      email         = clinica.clinic_email   || '';
      validezDias   = parseInt(clinica.proforma_validez_dias) || 15;
    } catch (_) {}

    const clinicaNombre = clinica.clinic_name || 'Consultorio Dental';
    const fecha = new Date().toLocaleDateString('es-PE', { day:'2-digit', month:'long', year:'numeric' });
    const validezFecha = new Date(Date.now() + validezDias * 86400000)
      .toLocaleDateString('es-PE', { day:'2-digit', month:'long', year:'numeric' });

    const itemsHTML = items.map((it, i) => `
      <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td style="text-align:center;color:#6b7280;padding:9px 10px;">${i + 1}</td>
        <td style="padding:9px 12px;">${it.desc}</td>
        <td style="padding:9px 12px;text-align:right;font-weight:500;">S/ ${it.precio.toFixed(2)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Proforma — ${p.nombre}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color:#1a1a1a; background:#fff; padding:32px 40px; font-size:13px; }

    /* HEADER */
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:18px; padding-bottom:16px; border-bottom:3px solid #1a6fc4; }
    .clinic-name { font-size:22px; font-weight:800; color:#1a6fc4; letter-spacing:-0.5px; }
    .clinic-sub  { font-size:11px; color:#555; margin-top:3px; line-height:1.6; }
    .badge-box   { text-align:right; }
    .badge-proforma { background:#1a6fc4; color:#fff; font-size:13px; font-weight:700; padding:5px 16px; border-radius:4px; display:inline-block; margin-bottom:6px; letter-spacing:1px; }
    .ruc-box { font-size:11px; color:#555; }
    .ruc-box strong { color:#1a1a1a; font-size:12px; }

    /* TITLE */
    .doc-title { text-align:center; font-size:15px; font-weight:700; letter-spacing:2px; color:#1a6fc4; background:#eef4fc; padding:8px; margin-bottom:16px; border:1px solid #c2d9f0; }

    /* PATIENT */
    .patient-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 20px; background:#f7f9fc; border:1px solid #dde5f0; border-radius:6px; padding:12px 16px; margin-bottom:18px; }
    .patient-grid .label { font-size:10px; color:#888; text-transform:uppercase; font-weight:600; }
    .patient-grid .value { font-size:13px; color:#1a1a1a; font-weight:600; border-bottom:1px solid #d0d8e8; padding-bottom:2px; min-height:20px; }

    /* TABLE */
    table { width:100%; border-collapse:collapse; font-size:13px; margin-bottom:0; }
    thead tr { background:#1a6fc4; color:#fff; }
    thead th { padding:9px 12px; font-weight:700; font-size:12px; letter-spacing:0.5px; }
    thead th:first-child { width:40px; text-align:center; }
    thead th:last-child  { text-align:right; width:110px; }
    .row-even { background:#fff; }
    .row-odd  { background:#f4f7fd; }
    td { border-bottom:1px solid #e2e8f0; }
    .total-row td { background:#1a6fc4; color:#fff; font-weight:700; font-size:14px; padding:11px 12px; border:none; }
    .total-row td:last-child { text-align:right; }

    /* NOTAS + FOOTER */
    .notas { margin-top:14px; background:#fffbea; border-left:3px solid #f59e0b; padding:9px 14px; border-radius:0 6px 6px 0; font-size:12px; color:#555; }
    .validez { margin-top:12px; font-size:11px; color:#888; font-style:italic; text-align:center; }
    .firma-row { display:flex; justify-content:flex-end; margin-top:36px; }
    .firma-box { text-align:center; width:220px; }
    .firma-line { border-top:1.5px solid #1a1a1a; margin-bottom:6px; }
    .firma-name { font-weight:700; font-size:13px; }
    .firma-sub  { font-size:11px; color:#888; }
    .footer { margin-top:28px; font-size:10px; color:#aaa; text-align:center; border-top:1px solid #e5e7eb; padding-top:10px; }
    @media print { body { padding:16px 24px; } }
  </style>
</head>
<body>

  <div class="header">
    <div>
      <div class="clinic-name">🦷 ${clinicaNombre}</div>
      <div class="clinic-sub">
        ${direccion ? direccion + '<br>' : ''}
        ${telefono ? 'Tel: ' + telefono : ''}${telefono && email ? ' &nbsp;|&nbsp; ' : ''}${email ? 'E-mail: ' + email : ''}
      </div>
    </div>
    <div class="badge-box">
      <div class="badge-proforma">PROFORMA</div>
      ${ruc ? `<div class="ruc-box">RUC: <strong>${ruc}</strong></div>` : ''}
      <div class="ruc-box">Fecha: <strong>${fecha}</strong></div>
    </div>
  </div>

  <div class="doc-title">PROFORMA DE TRATAMIENTO</div>

  <div class="patient-grid">
    <div>
      <div class="label">Nombre y apellido</div>
      <div class="value">${p.nombre}</div>
    </div>
    <div>
      <div class="label">DNI / Documento</div>
      <div class="value">${p.dni || ''}</div>
    </div>
    <div>
      <div class="label">Teléfono</div>
      <div class="value">${p.telefono || ''}</div>
    </div>
    <div>
      <div class="label">Fecha de emisión</div>
      <div class="value">${fecha}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="text-align:center;">#</th>
        <th>DESCRIPCIÓN DEL TRATAMIENTO</th>
        <th style="text-align:right;">PRECIO</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHTML}
      <tr class="total-row">
        <td colspan="2">TOTAL</td>
        <td>S/ ${total.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  ${notas ? `<div class="notas"><strong>📝 Notas:</strong> ${notas}</div>` : ''}

  <div class="validez">⚠️ Esta proforma es válida hasta el <strong>${validezFecha}</strong> (${validezDias} días desde la fecha de emisión).</div>

  <div class="firma-row">
    <div class="firma-box">
      <div class="firma-line"></div>
      <div class="firma-name">${doctorNombre || clinicaNombre}</div>
      <div class="firma-sub">Cirujano Dentista</div>
    </div>
  </div>

  <div class="footer">
    Este documento es una proforma informativa y no constituye un comprobante fiscal de pago.<br>
    Generado con DentalFlow · ${clinicaNombre} · ${fecha}
  </div>

</body>
</html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
    closeModal();
  },

  async toggleDictation() {
    const btn = document.getElementById('btn-dictar');
    const status = document.getElementById('dictation-status');
    
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      btn.innerHTML = '🎙️ Dictar Evolución';
      btn.style.background = '#f1f3f5';
      btn.style.color = '#333';
      status.style.display = 'none';
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstop = async () => {
        // Detener las pistas de audio para liberar el micrófono
        stream.getTracks().forEach(track => track.stop());

        const mimeType = this.mediaRecorder.mimeType;
        let ext = 'webm';
        if (mimeType.includes('mp4') || mimeType.includes('m4a')) ext = 'm4a';
        if (mimeType.includes('mpeg')) ext = 'mp3';
        if (mimeType.includes('ogg')) ext = 'ogg';

        const audioBlob = new Blob(this.audioChunks, { type: mimeType || 'audio/webm' });
        
        // Convert to Base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = reader.result.split(',')[1];
          
          btn.innerHTML = '<div class="loading-spinner" style="width:14px;height:14px;border-width:2px;border-top-color:#333;"></div> Procesando...';
          btn.disabled = true;

          try {
            const res = await api.patients.voiceDictation(base64data, ext);
            const textArea = document.getElementById('pat-notas');
            const currentNotes = textArea.value.trim();
            const dateStr = new Date().toLocaleDateString('es-AR');
            
            const newEntry = `[${dateStr}]\n${res.data}`;
            textArea.value = currentNotes ? `${currentNotes}\n\n${newEntry}` : newEntry;
            
            this.saveMedicalData();
            Toast.success('Evolución transcrita y guardada.');
          } catch(err) {
            Toast.error('Error en dictado: ' + err.message);
          } finally {
            btn.innerHTML = '🎙️ Dictar Evolución';
            btn.disabled = false;
          }
        };
      };

      this.mediaRecorder.start();
      btn.innerHTML = '⏹️ Detener';
      btn.style.background = '#ffe3e3';
      btn.style.color = '#da3633';
      status.style.display = 'flex';
    } catch(err) {
      Toast.error('No se pudo acceder al micrófono: ' + err.message);
    }
  },

  openEditModal() {
    const p = this.patient;
    const esc = v => (v || '').replace(/"/g, '&quot;').replace(/</g,'&lt;');

    const modal = document.createElement('div');
    modal.id = 'edit-patient-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML = `
      <div style="background:var(--bg-surface);border-radius:16px;padding:24px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h3 style="margin:0;font-size:18px;">Editar Paciente</h3>
          <button onclick="document.getElementById('edit-patient-modal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text-muted);">×</button>
        </div>
        <div class="form-group">
          <label class="form-label">Nombre completo *</label>
          <input id="ep-nombre" class="form-control" type="text" value="${esc(p.nombre)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Teléfono WhatsApp</label>
          <input id="ep-telefono" class="form-control" type="tel" placeholder="+51912345678" value="${esc(p.telefono)}" />
          <div class="form-hint">Incluí el código de país: +51 para Perú</div>
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input id="ep-email" class="form-control" type="email" value="${esc(p.email)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Fecha de nacimiento</label>
          <input id="ep-fecha" class="form-control" type="date" value="${esc(p.fecha_nacimiento)}" />
        </div>
        <div class="form-group">
          <label class="form-label">DNI / Documento</label>
          <input id="ep-dni" class="form-control" type="text" value="${esc(p.dni)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Dirección</label>
          <input id="ep-direccion" class="form-control" type="text" value="${esc(p.direccion)}" />
        </div>
        <div id="ep-error" style="display:none;color:var(--danger);font-size:13px;margin-bottom:12px;"></div>
        <div style="display:flex;gap:10px;margin-top:8px;">
          <button class="btn btn-ghost" style="flex:1;" onclick="document.getElementById('edit-patient-modal').remove()">Cancelar</button>
          <button id="ep-save-btn" class="btn btn-primary" style="flex:1;" onclick="PatientDetailView.saveEdit()">Guardar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  },

  subirFotoProforma() {
    document.getElementById('proforma-img-input')?.click();
  },

  async _procesarFotoProforma(input) {
    const file = input.files[0];
    if (!file) return;

    // Mostrar preview
    const preview = document.getElementById('proforma-img-preview');
    if (preview) {
      const url = URL.createObjectURL(file);
      preview.style.display = 'block';
      preview.innerHTML = `
        <div style="position:relative;display:inline-block;">
          <img src="${url}" style="max-width:100%;max-height:160px;border-radius:8px;border:1px solid var(--border-color);" />
          <div id="proforma-img-loading" style="display:none;position:absolute;inset:0;background:rgba(0,0,0,.5);border-radius:8px;display:flex;align-items:center;justify-content:center;">
            <div class="loading-spinner" style="width:24px;height:24px;border-color:rgba(255,255,255,.3);border-top-color:#fff;"></div>
          </div>
        </div>
        <div id="proforma-img-status" style="font-size:12px;color:var(--text-muted);margin-top:6px;">📷 Analizando imagen con IA...</div>
      `;
    }

    // Convertir a base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUrl  = reader.result;
      const base64   = dataUrl.split(',')[1];
      const mimeType = file.type || 'image/jpeg';

      const loadingEl = document.getElementById('proforma-img-loading');
      const statusEl  = document.getElementById('proforma-img-status');
      if (loadingEl) loadingEl.style.display = 'flex';

      try {
        const res   = await api.catalog.proformaImage(base64, mimeType);
        const items = res.data || [];

        if (items.length === 0) {
          if (statusEl) statusEl.innerHTML = `<span style="color:#da3633;">⚠️ No se detectaron tratamientos. Intentá con una foto más clara.</span>`;
          return;
        }

        // Limpiar items actuales y cargar los de la foto
        document.getElementById('proforma-items')?.querySelectorAll('.proforma-row').forEach(r => r.remove());
        items.forEach(item => this.addProformaItem(item.nombre, item.precio));
        this._updateProformaTotal();

        if (statusEl) statusEl.innerHTML = `<span style="color:#2ea043;">✅ ${items.length} tratamiento(s) detectados correctamente.</span>`;
        Toast.success(`✅ ${items.length} tratamientos cargados desde la foto.`);
      } catch (err) {
        if (statusEl) statusEl.innerHTML = `<span style="color:#da3633;">⚠️ Error: ${err.message}</span>`;
        Toast.error('Error al procesar la imagen: ' + err.message);
      } finally {
        if (loadingEl) loadingEl.style.display = 'none';
        input.value = '';
      }
    };
    reader.readAsDataURL(file);
  },

  async saveEdit() {
    const get = id => document.getElementById(id)?.value?.trim() || '';
    const nombre = get('ep-nombre');
    const errEl  = document.getElementById('ep-error');
    const btn    = document.getElementById('ep-save-btn');

    if (!nombre) {
      errEl.textContent = 'El nombre es obligatorio.';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Guardando...';
    errEl.style.display = 'none';

    try {
      const payload = {
        nombre,
        telefono:        get('ep-telefono'),
        email:           get('ep-email'),
        fecha_nacimiento: get('ep-fecha'),
        dni:             get('ep-dni'),
        direccion:       get('ep-direccion'),
      };

      const res = await api.patients.update(this.patient.id, payload);
      this.patient = { ...this.patient, ...payload };
      document.getElementById('edit-patient-modal')?.remove();
      Toast.success('Paciente actualizado.');
      this.updateView();
    } catch(err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Guardar';
    }
  }
};

window.PatientDetailView = PatientDetailView;
