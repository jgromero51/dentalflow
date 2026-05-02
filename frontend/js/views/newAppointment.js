/**
 * DentalFlow — Vista: Nueva Cita (formulario modal)
 */
const NewAppointmentView = {
  selectedPatient: null,
  selectedDuration: 30,
  searchTimeout: null,

  getFormHTML() {
    const now = new Date();
    const pad = n => String(n).padStart(2,'0');
    const defaultDate = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    const nextHour = new Date(now.getTime() + 60*60*1000);
    const defaultTime = `${pad(nextHour.getHours())}:00`;

    return `
    <form id="new-appt-form" novalidate>
      <!-- Paciente (autocomplete) -->
      <div class="form-group">
        <label class="form-label">Paciente <span class="required">*</span></label>
        <div class="autocomplete-wrapper">
          <input type="text" id="patient-search" class="form-control"
            placeholder="Nombre o teléfono..." autocomplete="off" />
          <div class="autocomplete-list" id="patient-autocomplete"></div>
        </div>
        <div id="patient-selected-info" style="display:none;margin-top:8px;padding:10px 12px;background:var(--bg-elevated);border-radius:var(--radius-md);border:1px solid rgba(0,180,216,0.3);">
          <div style="font-size:13px;font-weight:600;color:var(--primary)" id="sel-patient-name"></div>
          <div style="font-size:12px;color:var(--text-secondary)" id="sel-patient-phone"></div>
        </div>
        <p class="form-hint">Buscá por nombre o teléfono. Si no existe, ingresá nombre y teléfono abajo.</p>
      </div>

      <!-- Nombre (solo si es paciente nuevo) -->
      <div id="new-patient-fields" style="display:none;">
        <div class="form-group">
          <label class="form-label">Nombre completo <span class="required">*</span></label>
          <input type="text" id="patient-nombre" class="form-control" placeholder="Ej: María García" />
        </div>
        <div class="form-group">
          <label class="form-label">WhatsApp <span class="required">*</span></label>
          <input type="tel" id="patient-telefono" class="form-control" placeholder="+5491112345678" />
          <p class="form-hint">Incluir código de país: +54 (Argentina), +52 (México)...</p>
        </div>
      </div>

      <!-- Fecha y Hora -->
      <div class="form-row form-row-2">
        <div class="form-group">
          <label class="form-label">Fecha <span class="required">*</span></label>
          <input type="date" id="appt-fecha" class="form-control" value="${defaultDate}" min="${defaultDate}" />
        </div>
        <div class="form-group">
          <label class="form-label">Hora <span class="required">*</span></label>
          <input type="time" id="appt-hora" class="form-control" value="${defaultTime}" step="900" />
        </div>
      </div>

      <!-- Duración -->
      <div class="form-group">
        <label class="form-label">Duración</label>
        <div class="duration-chips" id="duration-chips">
          ${[20,30,40,60,90,120].map(m=>`
            <div class="chip ${m===30?'selected':''}" data-duration="${m}">${m >= 60 ? m/60+'h' : m+'min'}</div>
          `).join('')}
        </div>
        <input type="hidden" id="appt-duracion" value="30" />
      </div>

      <!-- Descripción -->
      <div class="form-group">
        <label class="form-label">Tratamiento / Descripción</label>
        <input type="text" id="appt-descripcion" class="form-control"
          placeholder="Ej: Limpieza, Extracción, Control..." />
      </div>

      <!-- Alerta de conflicto -->
      <div class="conflict-alert" id="conflict-alert">
        <span class="conflict-icon">🚫</span>
        <div class="conflict-text">
          <div class="conflict-title">Conflicto de horario</div>
          <div id="conflict-message"></div>
        </div>
      </div>

      <!-- Submit -->
      <button type="submit" class="btn btn-primary btn-full" id="submit-appt-btn" style="margin-top:8px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Guardar Cita
      </button>
    </form>`;
  },

  init() {
    this.selectedPatient = null;
    this.selectedDuration = 30;
    this.bindEvents();
  },

  bindEvents() {
    // Autocomplete de pacientes
    const searchInput = document.getElementById('patient-search');
    const autocompleteList = document.getElementById('patient-autocomplete');

    searchInput?.addEventListener('input', (e) => {
      clearTimeout(this.searchTimeout);
      const q = e.target.value.trim();
      if (q.length < 2) { autocompleteList.classList.remove('show'); return; }

      this.searchTimeout = setTimeout(async () => {
        try {
          const res = await api.patients.list(q);
          const patients = res.data || [];
          autocompleteList.innerHTML = '';

          if (patients.length === 0) {
            autocompleteList.innerHTML = `
              <div class="autocomplete-item new-patient" id="ac-new">
                <div class="name">➕ Nuevo paciente: "${q}"</div>
                <div class="phone">Se creará automáticamente</div>
              </div>`;
            document.getElementById('ac-new')?.addEventListener('click', () => {
              this.selectNewPatient(q);
              autocompleteList.classList.remove('show');
            });
          } else {
            patients.forEach(p => {
              const item = document.createElement('div');
              item.className = 'autocomplete-item';
              item.innerHTML = `<div class="name">${p.nombre}</div><div class="phone">${p.telefono}</div>`;
              item.addEventListener('click', () => {
                this.selectPatient(p);
                autocompleteList.classList.remove('show');
                searchInput.value = p.nombre;
              });
              autocompleteList.appendChild(item);
            });
            // Opción de crear nuevo
            const newItem = document.createElement('div');
            newItem.className = 'autocomplete-item new-patient';
            newItem.innerHTML = `<div class="name">➕ Crear nuevo paciente</div>`;
            newItem.addEventListener('click', () => {
              this.selectNewPatient('');
              autocompleteList.classList.remove('show');
            });
            autocompleteList.appendChild(newItem);
          }
          autocompleteList.classList.add('show');
        } catch (err) { /* silencioso */ }
      }, 300);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.autocomplete-wrapper')) {
        autocompleteList?.classList.remove('show');
      }
    });

    // Duration chips
    document.querySelectorAll('#duration-chips .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#duration-chips .chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        this.selectedDuration = parseInt(chip.dataset.duration);
        document.getElementById('appt-duracion').value = this.selectedDuration;
        this.checkConflicts();
      });
    });

    // Verificar conflictos al cambiar fecha/hora
    document.getElementById('appt-fecha')?.addEventListener('change', () => this.checkConflicts());
    document.getElementById('appt-hora')?.addEventListener('change', () => this.checkConflicts());

    // Submit
    document.getElementById('new-appt-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitForm();
    });
  },

  selectPatient(patient) {
    this.selectedPatient = patient;
    document.getElementById('patient-selected-info').style.display = 'block';
    document.getElementById('sel-patient-name').textContent = patient.nombre;
    document.getElementById('sel-patient-phone').textContent = patient.telefono;
    document.getElementById('new-patient-fields').style.display = 'none';
  },

  selectNewPatient(initialName) {
    this.selectedPatient = null;
    document.getElementById('new-patient-fields').style.display = 'block';
    document.getElementById('patient-selected-info').style.display = 'none';
    if (initialName) {
      document.getElementById('patient-nombre').value = initialName;
      document.getElementById('patient-telefono').focus();
    } else {
      document.getElementById('patient-nombre').focus();
    }
  },

  async checkConflicts() {
    const fecha = document.getElementById('appt-fecha')?.value;
    const hora  = document.getElementById('appt-hora')?.value;
    const alert = document.getElementById('conflict-alert');
    if (!fecha || !hora || !alert) return;

    try {
      const fechaHora = `${fecha}T${hora}:00`;
      const res = await api.appointments.slots(fecha);
      const slots = res.data || [];
      const inicio = new Date(fechaHora);
      const fin    = new Date(inicio.getTime() + this.selectedDuration * 60000);
      let conflicto = null;

      for (const slot of slots) {
        const sInicio = new Date(slot.inicio);
        const sFin    = new Date(slot.fin);
        if (inicio < sFin && fin > sInicio) { conflicto = slot; break; }
      }

      if (conflicto) {
        alert.classList.add('show');
        document.getElementById('conflict-message').textContent =
          `${conflicto.paciente} tiene cita de ${conflicto.inicio.slice(11,16)} a ${conflicto.fin.slice(11,16)} hs`;
      } else {
        alert.classList.remove('show');
      }
    } catch (e) { /* silencioso */ }
  },

  async submitForm() {
    const btn   = document.getElementById('submit-appt-btn');
    const fecha = document.getElementById('appt-fecha').value;
    const hora  = document.getElementById('appt-hora').value;
    const desc  = document.getElementById('appt-descripcion').value.trim();
    const dur   = this.selectedDuration;

    if (!fecha || !hora) { Toast.error('Completá la fecha y hora'); return; }

    const payload = {
      fecha_hora_inicio: `${fecha}T${hora}:00`,
      duracion_minutos:  dur,
      descripcion:       desc || null,
    };

    if (this.selectedPatient) {
      payload.patient_id = this.selectedPatient.id;
    } else {
      const nombre   = document.getElementById('patient-nombre')?.value.trim();
      const telefono = document.getElementById('patient-telefono')?.value.trim();
      if (!nombre)   { Toast.error('El nombre del paciente es requerido'); return; }
      if (!telefono) { Toast.error('El teléfono WhatsApp es requerido'); return; }
      payload.nombre   = nombre;
      payload.telefono = telefono;
    }

    btn.disabled = true;
    btn.innerHTML = '<div class="loading-spinner" style="width:18px;height:18px;border-width:2px;margin:0 auto;"></div>';

    try {
      await api.appointments.create(payload);
      Toast.success('🎉 Cita creada. Recordatorios automáticos programados.');
      window.closeModal();
      window.Router.navigate('appointments');
    } catch (err) {
      if (err.status === 409) {
        Toast.error('⚠️ ' + (err.data?.message || 'Conflicto de horario'));
        document.getElementById('conflict-alert').classList.add('show');
        document.getElementById('conflict-message').textContent = err.data?.message || 'Horario ocupado';
      } else {
        Toast.error('Error al crear la cita: ' + err.message);
      }
      btn.disabled = false;
      btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Guardar Cita';
    }
  },

  open() {
    const modal = document.getElementById('modal');
    document.getElementById('modal-title').textContent = '📅 Nueva Cita';
    document.getElementById('modal-body').innerHTML = this.getFormHTML();
    window.openModal();
    this.init();
  },
};
window.NewAppointmentView = NewAppointmentView;
