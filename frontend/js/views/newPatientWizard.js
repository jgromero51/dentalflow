/**
 * DentalFlow — Wizard: Nuevo Paciente / Atención Directa
 * 4 pasos: Datos → Procedimiento → Tratamientos futuros → Próxima cita
 */
const NewPatientWizard = {
  step: 1,
  totalSteps: 4,
  patient: null,       // paciente creado en paso 1
  appointment: null,   // atención registrada en paso 2

  open() {
    this.step = 1;
    this.patient = null;
    this.appointment = null;
    document.getElementById('modal-title').textContent = '👤 Nuevo Paciente / Atención';
    document.getElementById('modal-body').innerHTML = this._wrapStep(this._step1HTML());
    window.openModal();
    this._bindStep1();
  },

  // ── Wrapper común con barra de progreso ──────────────────────
  _wrapStep(html) {
    const pct = Math.round(((this.step - 1) / this.totalSteps) * 100);
    return `
      <div style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:12px;color:var(--text-secondary);">Paso ${this.step} de ${this.totalSteps}</span>
          <span style="font-size:12px;color:var(--text-secondary);">${pct}%</span>
        </div>
        <div style="background:var(--border);border-radius:4px;height:4px;">
          <div style="background:var(--primary);width:${pct}%;height:4px;border-radius:4px;transition:width 0.3s;"></div>
        </div>
      </div>
      ${html}`;
  },

  // ── PASO 1: Datos del paciente ────────────────────────────────
  _step1HTML() {
    return `
      <h3 style="font-size:16px;margin-bottom:16px;color:var(--text-primary);">Datos del paciente</h3>

      <div class="form-group">
        <label class="form-label">Nombre completo <span class="required">*</span></label>
        <input id="wiz-nombre" class="form-control" type="text" placeholder="Ej: María García" autofocus />
      </div>
      <div class="form-group">
        <label class="form-label">WhatsApp <span class="required">*</span></label>
        <input id="wiz-telefono" class="form-control" type="tel" placeholder="+51987654321" />
        <p class="form-hint">Incluir código de país: +51 (Perú), +52 (México)...</p>
      </div>
      <div class="form-row form-row-2">
        <div class="form-group">
          <label class="form-label">DNI / Documento</label>
          <input id="wiz-dni" class="form-control" type="text" placeholder="12345678" />
        </div>
        <div class="form-group">
          <label class="form-label">Fecha de nacimiento</label>
          <input id="wiz-nacimiento" class="form-control" type="date" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Alergias conocidas</label>
        <input id="wiz-alergias" class="form-control" type="text" placeholder="Ej: Penicilina, Látex..." />
      </div>
      <div class="form-group" style="margin-bottom:24px;">
        <label class="form-label">Notas médicas generales</label>
        <textarea id="wiz-notas" class="form-control" rows="2" placeholder="Hipertensión, diabetes, medicamentos actuales..."></textarea>
      </div>

      <div id="wiz-error" class="auth-error" style="display:none;margin-bottom:12px;"></div>

      <button id="wiz-next-1" class="btn btn-primary btn-full">
        Siguiente — Registrar procedimiento →
      </button>`;
  },

  _bindStep1() {
    document.getElementById('wiz-next-1')?.addEventListener('click', () => this._submitStep1());
    document.getElementById('wiz-nombre')?.addEventListener('keydown', e => { if (e.key === 'Enter') this._submitStep1(); });
  },

  async _submitStep1() {
    const nombre    = document.getElementById('wiz-nombre')?.value.trim();
    const telefono  = document.getElementById('wiz-telefono')?.value.trim();
    const dni       = document.getElementById('wiz-dni')?.value.trim();
    const alergias  = document.getElementById('wiz-alergias')?.value.trim();
    const notas     = document.getElementById('wiz-notas')?.value.trim();
    const errBox    = document.getElementById('wiz-error');
    const btn       = document.getElementById('wiz-next-1');

    errBox.style.display = 'none';
    if (!nombre)   { errBox.textContent = 'El nombre es obligatorio.'; errBox.style.display='block'; return; }
    if (!telefono) { errBox.textContent = 'El WhatsApp es obligatorio.'; errBox.style.display='block'; return; }

    btn.disabled = true;
    btn.innerHTML = '<div class="loading-spinner" style="width:18px;height:18px;border-width:2px;margin:0 auto;"></div>';

    try {
      const res = await api.patients.create({ nombre, telefono, dni: dni||null, alergias: alergias||null, notas: notas||null });
      this.patient = res.data;
      this.step = 2;
      document.getElementById('modal-body').innerHTML = this._wrapStep(this._step2HTML());
      this._bindStep2();
    } catch (err) {
      // Si ya existe el paciente por teléfono, usarlo
      if (err.message && err.message.includes('ya existe')) {
        try {
          const search = await api.patients.list(telefono);
          if (search.data && search.data.length > 0) {
            this.patient = search.data[0];
            this.step = 2;
            document.getElementById('modal-body').innerHTML = this._wrapStep(this._step2HTML());
            this._bindStep2();
            return;
          }
        } catch(e) {}
      }
      errBox.textContent = err.message || 'Error al registrar paciente';
      errBox.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Siguiente — Registrar procedimiento →';
    }
  },

  // ── PASO 2: Procedimiento realizado hoy ──────────────────────
  _step2HTML() {
    const now  = new Date();
    const pad  = n => String(n).padStart(2,'0');
    const hoy  = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    const hora = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <div class="patient-avatar" style="width:40px;height:40px;font-size:15px;flex-shrink:0;">
          ${this.patient.nombre.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()}
        </div>
        <div>
          <div style="font-weight:600;font-size:15px;">${this.patient.nombre}</div>
          <div style="font-size:12px;color:var(--text-secondary);">${this.patient.telefono}</div>
        </div>
      </div>

      <h3 style="font-size:16px;margin-bottom:16px;">¿Qué se realizó hoy?</h3>

      <div class="form-group">
        <label class="form-label">Procedimiento realizado <span class="required">*</span></label>
        <input id="wiz-proc" class="form-control" type="text"
          placeholder="Ej: Extracción muela del juicio, Limpieza..." autofocus />
      </div>

      <div class="form-row form-row-2">
        <div class="form-group">
          <label class="form-label">Fecha</label>
          <input id="wiz-fecha" class="form-control" type="date" value="${hoy}" />
        </div>
        <div class="form-group">
          <label class="form-label">Hora</label>
          <input id="wiz-hora" class="form-control" type="time" value="${hora}" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Costo del procedimiento ($)</label>
        <input id="wiz-costo" class="form-control" type="number" placeholder="0.00" min="0" step="0.01" />
      </div>
      <div class="form-group" style="margin-bottom:6px;">
        <label class="form-label">¿Cuánto se cobró hoy? ($)</label>
        <input id="wiz-pagado" class="form-control" type="number" placeholder="0.00" min="0" step="0.01" />
      </div>
      <div id="wiz-saldo-info" style="font-size:12px;color:var(--warning);margin-bottom:16px;display:none;">
        ⚠️ Saldo pendiente: $<span id="wiz-saldo"></span>
      </div>

      <div class="form-group" style="margin-bottom:24px;">
        <label class="form-label">Observaciones clínicas</label>
        <textarea id="wiz-obs" class="form-control" rows="2"
          placeholder="Estado del paciente, hallazgos, recomendaciones post-procedimiento..."></textarea>
      </div>

      <div id="wiz-error-2" class="auth-error" style="display:none;margin-bottom:12px;"></div>

      <div style="display:flex;gap:10px;">
        <button id="wiz-back-2" class="btn btn-ghost" style="flex:1;">← Atrás</button>
        <button id="wiz-next-2" class="btn btn-primary" style="flex:2;">Siguiente →</button>
      </div>`;
  },

  _bindStep2() {
    document.getElementById('wiz-back-2')?.addEventListener('click', () => {
      this.step = 1; document.getElementById('modal-body').innerHTML = this._wrapStep(this._step1HTML()); this._bindStep1();
    });
    document.getElementById('wiz-next-2')?.addEventListener('click', () => this._submitStep2());

    // Mostrar saldo pendiente en tiempo real
    const calcSaldo = () => {
      const costo  = parseFloat(document.getElementById('wiz-costo')?.value) || 0;
      const pagado = parseFloat(document.getElementById('wiz-pagado')?.value) || 0;
      const saldo  = costo - pagado;
      const info   = document.getElementById('wiz-saldo-info');
      if (info) {
        if (saldo > 0) { info.style.display='block'; document.getElementById('wiz-saldo').textContent = saldo.toFixed(2); }
        else { info.style.display='none'; }
      }
    };
    document.getElementById('wiz-costo')?.addEventListener('input', calcSaldo);
    document.getElementById('wiz-pagado')?.addEventListener('input', calcSaldo);
  },

  async _submitStep2() {
    const proc   = document.getElementById('wiz-proc')?.value.trim();
    const fecha  = document.getElementById('wiz-fecha')?.value;
    const hora   = document.getElementById('wiz-hora')?.value;
    const costo  = parseFloat(document.getElementById('wiz-costo')?.value) || 0;
    const pagado = parseFloat(document.getElementById('wiz-pagado')?.value) || 0;
    const obs    = document.getElementById('wiz-obs')?.value.trim();
    const errBox = document.getElementById('wiz-error-2');
    const btn    = document.getElementById('wiz-next-2');

    errBox.style.display = 'none';
    if (!proc) { errBox.textContent = 'Describí el procedimiento realizado.'; errBox.style.display='block'; return; }

    btn.disabled = true;
    btn.innerHTML = '<div class="loading-spinner" style="width:18px;height:18px;border-width:2px;margin:0 auto;"></div>';

    try {
      const res = await api.appointments.create({
        patient_id:        this.patient.id,
        fecha_hora_inicio: `${fecha}T${hora}:00`,
        duracion_minutos:  30,
        descripcion:       proc + (obs ? '\n' + obs : ''),
        costo_estimado:    costo,
        monto_pagado:      pagado,
        estado:            'completada',
      });
      this.appointment = res.data;
      this.step = 3;
      document.getElementById('modal-body').innerHTML = this._wrapStep(this._step3HTML());
      this._bindStep3();
    } catch (err) {
      errBox.textContent = err.message || 'Error al registrar el procedimiento';
      errBox.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Siguiente →';
    }
  },

  // ── PASO 3: Tratamientos futuros (Proforma) ──────────────────
  _step3HTML() {
    return `
      <h3 style="font-size:16px;margin-bottom:6px;">¿Se detectaron más tratamientos?</h3>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">
        Si durante la consulta detectaste otros procedimientos que el paciente necesita, los podés agregar para la proforma.
      </p>

      <div id="wiz-treatments-list" style="margin-bottom:12px;"></div>

      <div style="display:flex;gap:8px;margin-bottom:20px;">
        <input id="wiz-treat-name" class="form-control" type="text"
          placeholder="Ej: Obturación media, Corona..." style="flex:1;" />
        <input id="wiz-treat-price" class="form-control" type="number"
          placeholder="$" min="0" style="width:80px;" />
        <button id="wiz-add-treat" class="btn btn-ghost" style="white-space:nowrap;">+ Agregar</button>
      </div>

      <div style="display:flex;gap:10px;">
        <button id="wiz-skip-3" class="btn btn-ghost" style="flex:1;">Omitir</button>
        <button id="wiz-next-3" class="btn btn-primary" style="flex:2;">Siguiente →</button>
      </div>`;
  },

  _bindStep3() {
    this._treatments = [];

    const renderList = () => {
      const list = document.getElementById('wiz-treatments-list');
      if (!list) return;
      if (this._treatments.length === 0) {
        list.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:8px 0;">Sin tratamientos agregados aún</div>';
        return;
      }
      const total = this._treatments.reduce((s,t) => s + t.price, 0);
      list.innerHTML = this._treatments.map((t, i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--bg-elevated);border-radius:8px;margin-bottom:6px;">
          <span style="font-size:14px;">${t.name}</span>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:14px;color:var(--primary);">$${t.price.toFixed(2)}</span>
            <button onclick="NewPatientWizard._removeTreatment(${i})" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px;">×</button>
          </div>
        </div>`).join('') +
        `<div style="text-align:right;font-size:13px;font-weight:600;color:var(--primary);padding:4px 12px;">
          Total proforma: $${total.toFixed(2)}
        </div>`;
    };
    renderList();

    document.getElementById('wiz-add-treat')?.addEventListener('click', () => {
      const name  = document.getElementById('wiz-treat-name')?.value.trim();
      const price = parseFloat(document.getElementById('wiz-treat-price')?.value) || 0;
      if (!name) return;
      this._treatments.push({ name, price });
      document.getElementById('wiz-treat-name').value  = '';
      document.getElementById('wiz-treat-price').value = '';
      document.getElementById('wiz-treat-name').focus();
      renderList();
    });
    document.getElementById('wiz-treat-name')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('wiz-add-treat')?.click();
    });

    document.getElementById('wiz-skip-3')?.addEventListener('click', () => this._goStep4());
    document.getElementById('wiz-next-3')?.addEventListener('click', () => this._goStep4());
  },

  _removeTreatment(i) {
    this._treatments.splice(i, 1);
    // Re-bind step 3
    document.getElementById('modal-body').innerHTML = this._wrapStep(this._step3HTML());
    this._bindStep3();
    // Restore list
    const renderList = () => {
      const list = document.getElementById('wiz-treatments-list');
      if (!list) return;
      if (this._treatments.length === 0) {
        list.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:8px 0;">Sin tratamientos agregados aún</div>';
        return;
      }
      const total = this._treatments.reduce((s,t) => s + t.price, 0);
      list.innerHTML = this._treatments.map((t, j) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--bg-elevated);border-radius:8px;margin-bottom:6px;">
          <span style="font-size:14px;">${t.name}</span>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:14px;color:var(--primary);">$${t.price.toFixed(2)}</span>
            <button onclick="NewPatientWizard._removeTreatment(${j})" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px;">×</button>
          </div>
        </div>`).join('') +
        `<div style="text-align:right;font-size:13px;font-weight:600;color:var(--primary);padding:4px 12px;">Total proforma: $${total.toFixed(2)}</div>`;
    };
    renderList();
  },

  _goStep4() {
    this.step = 4;
    document.getElementById('modal-body').innerHTML = this._wrapStep(this._step4HTML());
    this._bindStep4();
  },

  // ── PASO 4: Próxima cita (opcional) ──────────────────────────
  _step4HTML() {
    const tomorrow = new Date(Date.now() + 86400000);
    const pad = n => String(n).padStart(2,'0');
    const defDate = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth()+1)}-${pad(tomorrow.getDate())}`;

    const treatTotal = (this._treatments||[]).reduce((s,t) => s + t.price, 0);
    const treatSummary = this._treatments && this._treatments.length > 0
      ? `<div style="background:var(--bg-elevated);border-radius:8px;padding:10px 12px;margin-bottom:16px;font-size:13px;">
          <div style="color:var(--text-secondary);margin-bottom:4px;">Proforma generada:</div>
          ${this._treatments.map(t=>`<div style="display:flex;justify-content:space-between;"><span>${t.name}</span><span style="color:var(--primary);">$${t.price.toFixed(2)}</span></div>`).join('')}
          <div style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px;font-weight:600;display:flex;justify-content:space-between;">
            <span>Total</span><span style="color:var(--primary);">$${treatTotal.toFixed(2)}</span>
          </div>
        </div>` : '';

    return `
      <h3 style="font-size:16px;margin-bottom:6px;">¿Agendamos la próxima cita?</h3>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">Opcional — podés saltear esto y agendar después desde la agenda.</p>

      ${treatSummary}

      <div id="wiz-schedule-toggle" style="display:flex;align-items:center;gap:10px;margin-bottom:16px;cursor:pointer;" onclick="NewPatientWizard._toggleSchedule()">
        <div id="wiz-toggle-btn" class="settings-toggle" style="width:44px;height:24px;">
          <div class="settings-toggle-thumb"></div>
        </div>
        <span style="font-size:14px;">Sí, agendar cita ahora</span>
      </div>

      <div id="wiz-schedule-fields" style="display:none;">
        <div class="form-row form-row-2">
          <div class="form-group">
            <label class="form-label">Fecha</label>
            <input id="wiz-next-fecha" class="form-control" type="date" value="${defDate}" />
          </div>
          <div class="form-group">
            <label class="form-label">Hora</label>
            <input id="wiz-next-hora" class="form-control" type="time" value="09:00" />
          </div>
        </div>
        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label">Tratamiento a realizar</label>
          <input id="wiz-next-desc" class="form-control" type="text"
            placeholder="${this._treatments && this._treatments.length > 0 ? this._treatments[0].name : 'Ej: Obturación media...'}" />
        </div>
      </div>

      <div id="wiz-error-4" class="auth-error" style="display:none;margin-bottom:12px;"></div>

      <button id="wiz-finish" class="btn btn-primary btn-full" style="margin-top:8px;">
        ✅ Finalizar y guardar
      </button>`;
  },

  _bindStep4() {
    this._scheduleToggled = false;
    document.getElementById('wiz-finish')?.addEventListener('click', () => this._submitStep4());
  },

  _toggleSchedule() {
    this._scheduleToggled = !this._scheduleToggled;
    const fields = document.getElementById('wiz-schedule-fields');
    const btn    = document.getElementById('wiz-toggle-btn');
    if (fields) fields.style.display = this._scheduleToggled ? 'block' : 'none';
    if (btn)    btn.classList.toggle('on', this._scheduleToggled);
  },

  async _submitStep4() {
    const btn    = document.getElementById('wiz-finish');
    const errBox = document.getElementById('wiz-error-4');
    errBox.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = '<div class="loading-spinner" style="width:18px;height:18px;border-width:2px;margin:0 auto;"></div> Guardando...';

    try {
      // Agendar próxima cita si el toggle está activo
      if (this._scheduleToggled) {
        const fecha = document.getElementById('wiz-next-fecha')?.value;
        const hora  = document.getElementById('wiz-next-hora')?.value;
        const desc  = document.getElementById('wiz-next-desc')?.value.trim();
        if (fecha && hora) {
          await api.appointments.create({
            patient_id:        this.patient.id,
            fecha_hora_inicio: `${fecha}T${hora}:00`,
            duracion_minutos:  30,
            descripcion:       desc || null,
            costo_estimado:    0,
            monto_pagado:      0,
          });
        }
      }

      // Mostrar éxito
      document.getElementById('modal-body').innerHTML = `
        <div style="text-align:center;padding:32px 16px;">
          <div style="font-size:48px;margin-bottom:16px;">✅</div>
          <h3 style="font-size:18px;margin-bottom:8px;">${this.patient.nombre} registrado</h3>
          <p style="color:var(--text-secondary);font-size:14px;margin-bottom:24px;">
            El paciente y el procedimiento fueron guardados correctamente.
            ${this._scheduleToggled ? '<br>La próxima cita quedó agendada.' : ''}
            ${this._treatments && this._treatments.length > 0 ? '<br>La proforma está lista para enviar.' : ''}
          </p>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="Router.navigate('patient/${this.patient.id}'); closeModal();">
              Ver ficha del paciente
            </button>
            <button class="btn btn-ghost" onclick="closeModal();">Cerrar</button>
          </div>
        </div>`;
    } catch (err) {
      errBox.textContent = err.message || 'Error al finalizar';
      errBox.style.display = 'block';
      btn.disabled = false;
      btn.textContent = '✅ Finalizar y guardar';
    }
  },
};

window.NewPatientWizard = NewPatientWizard;
