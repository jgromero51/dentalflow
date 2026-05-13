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
    }

    view.innerHTML = `
      <div class="patient-detail-header" style="padding-bottom: 0;">
        <button class="btn btn-icon" style="margin-bottom:12px;" onclick="Router.navigate('patients')">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style="display:flex; align-items:center; gap: 16px;">
          <div class="patient-avatar" style="width:64px;height:64px;font-size:24px;">${initials}</div>
          <div>
            <h2 style="margin:0; font-size:20px;">${p.nombre}</h2>
            <div style="color:var(--text-secondary); font-size:14px; margin-top:4px;">${p.telefono}</div>
          </div>
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

    // Si estamos en clínica, renderizar el componente SVG del odontograma
    if (this.currentTab === 'clinica' && window.OdontogramComponent) {
      OdontogramComponent.render(document.getElementById('odontogram-container'), this.odontogramData, this.patient.id);
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
        <button class="btn btn-primary btn-sm" onclick="Router.navigate('new')">📅 Agendar Cita</button>
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

  renderFinanzas() {
    const appts = this.patient.appointments || [];
    let totalCosto = 0;
    let totalPagado = 0;

    appts.forEach(a => {
      totalCosto += (a.costo_estimado || 0);
      totalPagado += (a.monto_pagado || 0);
    });

    const deuda = totalCosto - totalPagado;

    let html = `
      <div style="display:flex; gap:16px; margin-bottom:24px;">
        <div class="card" style="flex:1; text-align:center;">
          <div style="font-size:12px; color:var(--text-secondary);">Total Facturado</div>
          <div style="font-size:20px; font-weight:600; color:var(--text-primary);">$${totalCosto.toFixed(2)}</div>
        </div>
        <div class="card" style="flex:1; text-align:center;">
          <div style="font-size:12px; color:var(--text-secondary);">Total Pagado</div>
          <div style="font-size:20px; font-weight:600; color:#2ea043;">$${totalPagado.toFixed(2)}</div>
        </div>
        <div class="card" style="flex:1; text-align:center; border: 1px solid ${deuda > 0 ? '#da3633' : 'transparent'};">
          <div style="font-size:12px; color:var(--text-secondary);">Saldo Pendiente</div>
          <div style="font-size:20px; font-weight:600; color:${deuda > 0 ? '#da3633' : 'var(--text-primary)'};">$${deuda.toFixed(2)}</div>
        </div>
      </div>
      <h3 style="margin:0 0 12px 0; font-size:16px;">Historial de Cargos por Cita</h3>
    `;

    if (appts.length === 0) {
      html += '<div class="empty-state"><div class="empty-desc">Sin citas para facturar</div></div>';
    } else {
      html += appts.map(a => {
        const d = new Date(a.fecha_hora_inicio);
        const fecha = d.toLocaleDateString('es-AR', { day:'2-digit', month:'short' });
        const costo = a.costo_estimado || 0;
        const pagado = a.monto_pagado || 0;
        const saldo = costo - pagado;
        return `
        <div class="card" style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:600;font-size:14px;">Cita ${fecha}</div>
            <div style="font-size:12px;color:var(--text-secondary);">${a.descripcion || 'Sin descripción'}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:14px; font-weight:600;">Costo: $${costo.toFixed(2)}</div>
            ${saldo > 0 ? `<div style="font-size:12px; color:#da3633;">Falta: $${saldo.toFixed(2)}</div>` : `<div style="font-size:12px; color:#2ea043;">Pagado</div>`}
          </div>
        </div>`;
      }).join('');
    }

    return html;
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
  }
};

window.PatientDetailView = PatientDetailView;
