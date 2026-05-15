/**
 * DentalFlow — Vista de Ajustes de Clínica
 * Permite al usuario personalizar el nombre, contacto y configuración
 * de su clínica sin tocar archivos de código.
 */

const SettingsView = {
  _settings: {},

  async render(container) {
    container.innerHTML = `
      <div class="fade-in" id="settings-view">
        <div class="settings-hero">
          <div class="settings-hero-icon">⚙️</div>
          <div>
            <h1 class="settings-hero-title">Ajustes de Clínica</h1>
            <p class="settings-hero-sub">Personaliza la información de tu consultorio</p>
          </div>
        </div>
        <div class="loading-spinner" style="margin: 40px auto;"></div>
      </div>`;

    try {
      const res = await api.settings.get();
      this._settings = res.data || {};
      this._renderForm(container);
    } catch (err) {
      container.querySelector('#settings-view').innerHTML += `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <div class="empty-title">Error de conexión</div>
          <div class="empty-desc">${err.message}</div>
        </div>`;
    }
  },

  _renderForm(container) {
    const s = this._settings;
    container.querySelector('#settings-view').innerHTML = `

      <!-- Hero -->
      <div class="settings-hero">
        <div class="settings-hero-icon">⚙️</div>
        <div>
          <h1 class="settings-hero-title">Ajustes de Clínica</h1>
          <p class="settings-hero-sub">Personaliza la información de tu consultorio</p>
        </div>
      </div>

      <!-- Sección: Identidad -->
      <div class="settings-section">
        <div class="settings-section-label">
          <span class="settings-section-icon">🏥</span>
          Identidad de la Clínica
        </div>
        <div class="settings-card">
          <div class="form-group">
            <label class="form-label" for="s-clinic-name">
              Nombre de la clínica <span class="required">*</span>
            </label>
            <input id="s-clinic-name" class="form-control" type="text"
              placeholder="Ej: Dr. García Odontología"
              value="${this._esc(s.clinic_name)}" maxlength="80" />
            <div class="form-hint">Aparece en todos los mensajes de WhatsApp automáticos.</div>
          </div>
          <div class="form-row form-row-2">
            <div class="form-group">
              <label class="form-label" for="s-clinic-phone">Teléfono de la clínica</label>
              <input id="s-clinic-phone" class="form-control" type="tel"
                placeholder="+5491198765432"
                value="${this._esc(s.clinic_phone)}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="s-clinic-email">E-mail</label>
              <input id="s-clinic-email" class="form-control" type="email"
                placeholder="clinica@ejemplo.com"
                value="${this._esc(s.clinic_email)}" />
            </div>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" for="s-clinic-address">Dirección</label>
            <input id="s-clinic-address" class="form-control" type="text"
              placeholder="Av. Corrientes 1234, CABA"
              value="${this._esc(s.clinic_address)}" maxlength="120" />
          </div>
        </div>
      </div>

      <!-- Sección: Horario -->
      <div class="settings-section">
        <div class="settings-section-label">
          <span class="settings-section-icon">🕐</span>
          Horario de Atención
        </div>
        <div class="settings-card">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" for="s-clinic-hours">Horario visible para pacientes</label>
            <input id="s-clinic-hours" class="form-control" type="text"
              placeholder="Lun–Vie 9:00–18:00, Sáb 9:00–13:00"
              value="${this._esc(s.clinic_hours)}" maxlength="100" />
            <div class="form-hint">Se mostrará en la bienvenida automática de WhatsApp.</div>
          </div>
        </div>
      </div>

      <!-- Sección: Recordatorios -->
      <div class="settings-section">
        <div class="settings-section-label">
          <span class="settings-section-icon">💬</span>
          Recordatorios Automáticos
        </div>
        <div class="settings-card">
          <div class="form-group">
            <label class="form-label" for="s-doctor-phone">Tu número de WhatsApp (para notificaciones)</label>
            <input id="s-doctor-phone" class="form-control" type="tel"
              placeholder="+5491198765432"
              value="${this._esc(s.doctor_phone)}" />
            <div class="form-hint">Cuando un paciente confirme o cancele su cita, recibirás un mensaje en este número.</div>
          </div>
          <div class="settings-toggle-row" id="toggle-24h" onclick="SettingsView._toggle('reminder_24h_active','toggle-24h')">
            <div class="settings-toggle-info">
              <div class="settings-toggle-title">Recordatorio 24 horas antes</div>
              <div class="settings-toggle-desc">Envía WhatsApp el día anterior a la cita</div>
            </div>
            <div class="settings-toggle ${s.reminder_24h_active === 'true' ? 'on' : ''}" id="toggle-24h-btn">
              <div class="settings-toggle-thumb"></div>
            </div>
          </div>
          <div class="settings-toggle-row" id="toggle-4h" onclick="SettingsView._toggle('reminder_4h_active','toggle-4h')">
            <div class="settings-toggle-info">
              <div class="settings-toggle-title">Recordatorio 4 horas antes</div>
              <div class="settings-toggle-desc">Envía un segundo recordatorio el mismo día</div>
            </div>
            <div class="settings-toggle ${s.reminder_4h_active === 'true' ? 'on' : ''}" id="toggle-4h-btn">
              <div class="settings-toggle-thumb"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sección: Mensaje de bienvenida -->
      <div class="settings-section">
        <div class="settings-section-label">
          <span class="settings-section-icon">👋</span>
          Mensaje de Bienvenida
        </div>
        <div class="settings-card">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" for="s-welcome-msg">
              Plantilla de bienvenida
            </label>
            <textarea id="s-welcome-msg" class="form-control" rows="3"
              placeholder="¡Hola! Soy el asistente de {clinic_name}..."
              maxlength="400">${this._esc(s.clinic_welcome_msg)}</textarea>
            <div class="form-hint">Podés usar <code style="color:var(--primary);">{clinic_name}</code> y <code style="color:var(--primary);">{clinic_hours}</code> como variables.</div>
          </div>
        </div>
      </div>

      <!-- Botón Guardar -->
      <button id="settings-save-btn" class="btn btn-primary btn-full" onclick="SettingsView._save()" style="margin-bottom:20px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
        </svg>
        Guardar Cambios
      </button>

      <!-- Sección: Cuenta y Seguridad -->
      <div class="settings-section">
        <div class="settings-section-label">
          <span class="settings-section-icon">🔐</span>
          Cuenta y Seguridad
        </div>
        <div class="settings-card">
          <div class="settings-toggle-row" style="cursor:default;" onclick="SettingsView._togglePassForm()">
            <div class="settings-toggle-info">
              <div class="settings-toggle-title">Cambiar contraseña</div>
              <div class="settings-toggle-desc">Actualiza tu contraseña de acceso</div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="#8b949e" stroke-width="2" style="width:16px;height:16px;flex-shrink:0;">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
          <div id="change-pass-form" style="display:none;padding-top:14px;border-top:1px solid var(--border);margin-top:4px;">
            <div class="form-group">
              <label class="form-label" for="s-curr-pass">Contraseña actual</label>
              <input id="s-curr-pass" class="form-control" type="password" placeholder="••••••••" />
            </div>
            <div class="form-group">
              <label class="form-label" for="s-new-pass">Nueva contraseña</label>
              <input id="s-new-pass" class="form-control" type="password" placeholder="Mínimo 6 caracteres" />
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" for="s-new-pass2">Confirmar nueva contraseña</label>
              <input id="s-new-pass2" class="form-control" type="password" placeholder="Repetí la contraseña" />
            </div>
            <div id="pass-error" class="auth-error" style="display:none;margin-top:10px;"></div>
            <button class="btn btn-ghost btn-full" onclick="SettingsView._changePass()" style="margin-top:14px;">
              Actualizar contraseña
            </button>
          </div>
        </div>
      </div>

      <!-- Cerrar sesión -->
      <button class="btn btn-danger btn-full" onclick="logout()" style="margin-bottom:40px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Cerrar Sesión
      </button>
    `;
  },

  _esc(val) {
    if (!val) return '';
    return String(val).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  _toggle(key, rowId) {
    const current = this._settings[key] === 'true';
    this._settings[key] = String(!current);
    const btn = document.getElementById(rowId + '-btn');
    if (btn) btn.classList.toggle('on', !current);
  },

  async _save() {
    const btn = document.getElementById('settings-save-btn');
    if (!btn) return;

    const get = id => document.getElementById(id)?.value?.trim() ?? '';

    const payload = {
      clinic_name:         get('s-clinic-name'),
      clinic_phone:        get('s-clinic-phone'),
      clinic_email:        get('s-clinic-email'),
      clinic_address:      get('s-clinic-address'),
      clinic_hours:        get('s-clinic-hours'),
      clinic_welcome_msg:  document.getElementById('s-welcome-msg')?.value?.trim() ?? '',
      reminder_24h_active: this._settings.reminder_24h_active ?? 'true',
      reminder_4h_active:  this._settings.reminder_4h_active  ?? 'true',
      doctor_phone:        get('s-doctor-phone'),
    };

    if (!payload.clinic_name) {
      Toast.error('El nombre de la clínica es obligatorio.');
      document.getElementById('s-clinic-name')?.focus();
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<div class="loading-spinner" style="width:18px;height:18px;border-width:2px;"></div> Guardando...`;

    try {
      await api.settings.save(payload);
      this._settings = { ...this._settings, ...payload };
      Toast.success('✅ Cambios guardados correctamente.');

      // Actualizar brand-name en header si cambia el nombre de la clínica
      const brandName = document.querySelector('.brand-name');
      if (brandName) brandName.textContent = payload.clinic_name || 'DentalFlow';

    } catch (err) {
      Toast.error('Error al guardar: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar Cambios`;
    }
  },

  _togglePassForm() {
    const form = document.getElementById('change-pass-form');
    if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
  },

  async _changePass() {
    const curr  = document.getElementById('s-curr-pass')?.value || '';
    const newP  = document.getElementById('s-new-pass')?.value  || '';
    const newP2 = document.getElementById('s-new-pass2')?.value || '';
    const err   = document.getElementById('pass-error');

    err.style.display = 'none';

    if (newP !== newP2) {
      err.textContent = 'Las contraseñas nuevas no coinciden.';
      err.style.display = 'block';
      return;
    }

    try {
      await api.auth.changePassword({ current_password: curr, new_password: newP });
      Toast.success('🔑 Contraseña actualizada correctamente.');
      this._togglePassForm();
      document.getElementById('s-curr-pass').value  = '';
      document.getElementById('s-new-pass').value   = '';
      document.getElementById('s-new-pass2').value  = '';
    } catch (e) {
      err.textContent   = e.message;
      err.style.display = 'block';
    }
  }
};

window.SettingsView = SettingsView;
