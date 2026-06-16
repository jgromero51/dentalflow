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
          <div class="form-group">
            <label class="form-label" for="s-clinic-address">Dirección</label>
            <input id="s-clinic-address" class="form-control" type="text"
              placeholder="Av. Corrientes 1234, CABA"
              value="${this._esc(s.clinic_address)}" maxlength="120" />
          </div>
          <div class="form-row form-row-2">
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" for="s-clinic-ruc">RUC / NIT</label>
              <input id="s-clinic-ruc" class="form-control" type="text"
                placeholder="20612160695"
                value="${this._esc(s.clinic_ruc)}" maxlength="20" />
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" for="s-doctor-name">Nombre del doctor</label>
              <input id="s-doctor-name" class="form-control" type="text"
                placeholder="Dr. Juan García"
                value="${this._esc(s.doctor_name)}" maxlength="80" />
            </div>
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

      <!-- Sección: WhatsApp (Meta Cloud API) -->
      <div class="settings-section">
        <div class="settings-section-label">
          <span class="settings-section-icon">💬</span>
          WhatsApp Automático
        </div>
        <div class="settings-card">
          <div class="form-hint" style="margin-bottom:14px;padding:10px 12px;background:var(--bg-secondary);border-radius:8px;border-left:3px solid var(--primary);">
            Integrado con <strong>WhatsApp Cloud API (Meta)</strong>. Cada clínica puede tener su propio número de WhatsApp.
            <a href="https://developers.facebook.com/apps" target="_blank" style="color:var(--primary);font-size:11px;display:block;margin-top:4px;">→ Obtener credenciales en Meta for Developers</a>
          </div>
          <div class="form-row form-row-2">
            <div class="form-group">
              <label class="form-label" for="s-wa-phone-id">Phone Number ID</label>
              <input id="s-wa-phone-id" class="form-control" type="text"
                placeholder="Ej: 123456789012345"
                value="${this._esc(s.whatsapp_phone_id)}" />
              <div class="form-hint">Desde Meta for Developers → tu app → WhatsApp → API Setup</div>
            </div>
            <div class="form-group">
              <label class="form-label" for="s-wa-token">Access Token</label>
              <input id="s-wa-token" class="form-control" type="password"
                placeholder="EAAxxxxxxxxxx..."
                value="${this._esc(s.whatsapp_token)}" autocomplete="new-password" />
              <div class="form-hint">Token permanente desde Meta Business Suite</div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="s-doctor-phone">Tu número personal (para pruebas)</label>
            <div style="display:flex;gap:8px;align-items:center;">
              <input id="s-doctor-phone" class="form-control" type="tel"
                placeholder="+51987654321"
                value="${this._esc(s.doctor_phone)}" style="flex:1;" />
              <button type="button" class="btn btn-ghost" style="white-space:nowrap;flex-shrink:0;" onclick="SettingsView._testWhatsApp()">
                📱 Probar
              </button>
            </div>
            <div class="form-hint">Guardá primero, luego probá. Se enviará un mensaje de prueba usando la plantilla aprobada.</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="s-wa-proforma-tpl">Plantilla de proformas (Meta)</label>
            <input id="s-wa-proforma-tpl" class="form-control" type="text"
              placeholder="Ej: envio_proforma"
              value="${this._esc(s.proforma_template_name)}" />
            <div class="form-hint">Nombre EXACTO de tu plantilla aprobada en Meta (con PDF + variables nombre, clínica, total). Si lo dejás vacío, la proforma solo llega si el paciente escribió en las últimas 24h.</div>
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

      <!-- Sección: Catálogo de Tratamientos -->
      <div class="settings-section">
        <div class="settings-section-label">
          <span class="settings-section-icon">🦷</span>
          Catálogo de Tratamientos
        </div>
        <div class="settings-card">
          <p style="font-size:13px;color:var(--text-muted);margin:0 0 12px;">
            Cargá tus tratamientos con precios. La IA los usará para completar proformas por voz automáticamente.
          </p>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px;">
            <button class="btn btn-primary btn-sm" onclick="SettingsView.openAddTreatment()">+ Agregar tratamiento</button>
            <button class="btn btn-secondary btn-sm" onclick="SettingsView.importCatalogFromImage()" style="display:flex;align-items:center;gap:6px;">📷 Importar desde foto</button>
            <input type="file" id="catalog-img-input" accept="image/*" style="display:none;" onchange="SettingsView._processCatalogImage(this)">
          </div>
          <div id="catalog-section"></div>
        </div>
      </div>

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

      <!-- Sección: Equipo (solo owner) -->
      ${(Auth.getUser()?.role === 'owner') ? `
      <div class="settings-section">
        <div class="settings-section-label">
          <span class="settings-section-icon">👥</span>
          Equipo de la Clínica
        </div>
        <div class="settings-card" id="team-section">
          <div class="loading-spinner" style="margin:20px auto;"></div>
        </div>
      </div>` : ''}

      <!-- Sección: Exportar CSV -->
      <div class="settings-section">
        <div class="settings-section-label">
          <span class="settings-section-icon">📤</span>
          Exportar mis Datos (CSV)
        </div>
        <div class="settings-card">
          <p style="font-size:13px;color:var(--text-muted);margin:0 0 14px;">
            Descargá tus datos en formato CSV, compatible con Excel y cualquier sistema externo.
            Tus datos siempre te pertenecen.
          </p>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <button class="btn btn-ghost" onclick="SettingsView._exportCSV('patients')" style="border:1px solid var(--border);justify-content:flex-start;gap:10px;">
              <span style="font-size:16px;">👥</span>
              <span>Exportar Pacientes</span>
              <span style="margin-left:auto;font-size:11px;color:var(--text-muted);">pacientes.csv</span>
            </button>
            <button class="btn btn-ghost" onclick="SettingsView._exportCSV('appointments')" style="border:1px solid var(--border);justify-content:flex-start;gap:10px;">
              <span style="font-size:16px;">📅</span>
              <span>Exportar Citas</span>
              <span style="margin-left:auto;font-size:11px;color:var(--text-muted);">citas.csv</span>
            </button>
            <button class="btn btn-ghost" onclick="SettingsView._exportCSV('odontogram')" style="border:1px solid var(--border);justify-content:flex-start;gap:10px;">
              <span style="font-size:16px;">🦷</span>
              <span>Exportar Odontogramas</span>
              <span style="margin-left:auto;font-size:11px;color:var(--text-muted);">odontograma.csv</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Sección: Importar Pacientes CSV -->
      <div class="settings-section">
        <div class="settings-section-label">
          <span class="settings-section-icon">📥</span>
          Importar Pacientes desde CSV
        </div>
        <div class="settings-card">
          <p style="font-size:13px;color:var(--text-muted);margin:0 0 6px;">
            Subí un archivo CSV con tus pacientes. Se omiten duplicados (por teléfono).
          </p>
          <p style="font-size:12px;color:var(--text-muted);margin:0 0 14px;padding:8px 10px;background:var(--bg-secondary);border-radius:6px;border-left:3px solid var(--primary);">
            Columnas requeridas: <code style="color:var(--primary);">nombre</code>, <code style="color:var(--primary);">telefono</code><br>
            Columnas opcionales: <code style="color:var(--text-muted);">dni, tipo_sangre, alergias, enfermedades_previas, notas</code>
          </p>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <label class="btn btn-primary" style="cursor:pointer;gap:8px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Seleccionar CSV
              <input type="file" accept=".csv,text/csv" id="import-csv-input" style="display:none;" onchange="SettingsView._handleImportCSV(this)">
            </label>
            <span id="import-csv-status" style="font-size:13px;color:var(--text-muted);"></span>
          </div>
          <div id="import-csv-result" style="margin-top:12px;display:none;"></div>
        </div>
      </div>

      <!-- Sección: Backup -->
      <div class="settings-section">
        <div class="settings-section-label">
          <span class="settings-section-icon">💾</span>
          Copia de Seguridad
        </div>
        <div class="settings-card">
          <p style="font-size:13px;color:var(--text-muted);margin:0 0 14px;">
            Descargá todos tus datos (pacientes, citas, proformas) en formato JSON. Guardalo en un lugar seguro.
            El sistema también realiza backups automáticos cada 6 horas.
          </p>
          <button class="btn btn-ghost btn-full" onclick="SettingsView._downloadBackup()" style="border:1px dashed var(--border);">
            ⬇️ Descargar backup completo
          </button>
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
    this.renderCatalog();
    if (Auth.getUser()?.role === 'owner') this.renderTeam();
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
      clinic_name:          get('s-clinic-name'),
      clinic_phone:         get('s-clinic-phone'),
      clinic_email:         get('s-clinic-email'),
      clinic_address:       get('s-clinic-address'),
      clinic_ruc:           get('s-clinic-ruc'),
      doctor_name:          get('s-doctor-name'),
      clinic_hours:         get('s-clinic-hours'),
      clinic_welcome_msg:   document.getElementById('s-welcome-msg')?.value?.trim() ?? '',
      reminder_24h_active:  this._settings.reminder_24h_active ?? 'true',
      reminder_4h_active:   this._settings.reminder_4h_active  ?? 'true',
      doctor_phone:         get('s-doctor-phone'),
      whatsapp_phone_id:    get('s-wa-phone-id'),
      whatsapp_token:       get('s-wa-token'),
      proforma_template_name: get('s-wa-proforma-tpl'),
    };

    // No enviar token vacío (no borrar el guardado)
    if (!payload.whatsapp_token) delete payload.whatsapp_token;
    if (!payload.whatsapp_phone_id) delete payload.whatsapp_phone_id;

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

  async _testWhatsApp() {
    const telefono = document.getElementById('s-doctor-phone')?.value?.trim();
    if (!telefono) {
      Toast.error('Ingresá tu número de WhatsApp primero.');
      document.getElementById('s-doctor-phone')?.focus();
      return;
    }
    Toast.info('Enviando mensaje de prueba...');
    try {
      const res = await api.settings.testWhatsApp(telefono);
      if (res.demo) {
        Toast.warning('⚠️ Modo demo: el mensaje se imprimió en la consola del servidor (no hay credenciales de WhatsApp configuradas).');
      } else {
        Toast.success('✅ Mensaje enviado. Revisá tu WhatsApp en ' + telefono);
      }
    } catch (err) {
      Toast.error('Error: ' + err.message);
    }
  },

  // ============================================================
  // CATÁLOGO DE TRATAMIENTOS
  // ============================================================
  async renderCatalog() {
    const el = document.getElementById('catalog-section');
    if (!el) return;
    el.innerHTML = `<div class="loading-spinner" style="margin:24px auto;"></div>`;
    try {
      const res  = await api.catalog.list();
      const rows = res.data || [];
      if (rows.length === 0) {
        el.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:24px;font-size:13px;">Ningún tratamiento cargado aún.</div>`;
        return;
      }
      // Agrupar por categoría
      const groups = {};
      rows.forEach(r => {
        if (!groups[r.categoria]) groups[r.categoria] = [];
        groups[r.categoria].push(r);
      });
      el.innerHTML = Object.entries(groups).map(([cat, items]) => `
        <div style="margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px;letter-spacing:.05em;">${cat}</div>
          ${items.map(t => `
            <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;background:var(--bg-primary);">
              <span style="flex:1;font-size:14px;color:var(--text-primary);">${t.nombre}</span>
              <span style="font-size:14px;font-weight:600;color:var(--primary);min-width:70px;text-align:right;">S/ ${parseFloat(t.precio).toFixed(2)}</span>
              <button onclick="SettingsView.editTreatment(${t.id},'${t.nombre.replace(/'/g,"\\'")}','${t.categoria}',${t.precio})"
                style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:16px;padding:0 4px;">✏️</button>
              <button onclick="SettingsView.deleteTreatment(${t.id})"
                style="background:none;border:none;cursor:pointer;color:var(--danger);font-size:16px;padding:0 4px;">✕</button>
            </div>`).join('')}
        </div>`).join('');
    } catch (err) {
      el.innerHTML = `<div style="color:var(--danger);font-size:13px;">Error: ${err.message}</div>`;
    }
  },

  openAddTreatment(id, nombre, categoria, precio) {
    const isEdit = !!id;
    const modal  = document.createElement('div');
    modal.id     = 'cat-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML = `
      <div style="background:var(--bg-surface);border-radius:16px;padding:24px;width:100%;max-width:400px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h3 style="margin:0;font-size:16px;">${isEdit ? 'Editar' : 'Agregar'} tratamiento</h3>
          <button onclick="document.getElementById('cat-modal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text-muted);">×</button>
        </div>
        <div class="form-group">
          <label class="form-label">Nombre del tratamiento *</label>
          <input id="cat-nombre" class="form-control" value="${nombre || ''}" placeholder="Ej: Limpieza dental" />
        </div>
        <div class="form-group">
          <label class="form-label">Categoría</label>
          <input id="cat-cat" class="form-control" value="${categoria || 'General'}" placeholder="Ej: Preventivo, Estético..." />
        </div>
        <div class="form-group">
          <label class="form-label">Precio (S/) *</label>
          <input id="cat-precio" class="form-control" type="number" min="0" step="0.01" value="${precio || ''}" placeholder="0.00" />
        </div>
        <div style="display:flex;gap:10px;margin-top:8px;">
          <button class="btn btn-ghost" style="flex:1;" onclick="document.getElementById('cat-modal').remove()">Cancelar</button>
          <button class="btn btn-primary" style="flex:1;" onclick="SettingsView.saveTreatment(${id || 'null'})">Guardar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.getElementById('cat-nombre').focus();
  },

  editTreatment(id, nombre, categoria, precio) {
    this.openAddTreatment(id, nombre, categoria, precio);
  },

  async saveTreatment(id) {
    const nombre   = document.getElementById('cat-nombre')?.value.trim();
    const categoria = document.getElementById('cat-cat')?.value.trim() || 'General';
    const precio   = parseFloat(document.getElementById('cat-precio')?.value);
    if (!nombre || isNaN(precio)) { Toast.error('Completá nombre y precio.'); return; }
    try {
      if (id) {
        await api.catalog.update(id, { nombre, categoria, precio });
      } else {
        await api.catalog.create({ nombre, categoria, precio });
      }
      document.getElementById('cat-modal')?.remove();
      Toast.success('Tratamiento guardado.');
      this.renderCatalog();
    } catch (err) {
      Toast.error('Error: ' + err.message);
    }
  },

  importCatalogFromImage() {
    document.getElementById('catalog-img-input')?.click();
  },

  async _processCatalogImage(input) {
    const file = input.files[0];
    if (!file) return;

    const btn = document.querySelector('[onclick="SettingsView.importCatalogFromImage()"]');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Analizando...'; }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64   = reader.result.split(',')[1];
      const mimeType = file.type || 'image/jpeg';

      try {
        const res   = await api.catalog.proformaImage(base64, mimeType);
        const items = res.data || [];

        if (items.length === 0) {
          Toast.warning('No se detectaron tratamientos. Intentá con una foto más clara.');
          return;
        }

        // Modal de confirmación con los ítems detectados
        this._showImportConfirmModal(items);
      } catch (err) {
        Toast.error('Error al analizar la imagen: ' + err.message);
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '📷 Importar desde foto'; }
        input.value = '';
      }
    };
    reader.readAsDataURL(file);
  },

  _showImportConfirmModal(items) {
    const existing = document.getElementById('import-confirm-modal');
    if (existing) existing.remove();

    const rows = items.map((item, i) => `
      <div style="display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;margin-bottom:8px;">
        <input type="checkbox" id="imp-chk-${i}" checked style="width:16px;height:16px;cursor:pointer;" />
        <input type="text" id="imp-name-${i}" value="${(item.nombre || '').replace(/"/g,'&quot;')}"
          style="background:var(--surface);border:1px solid var(--border-color);border-radius:6px;padding:6px 8px;color:var(--text-primary);font-size:13px;width:100%;box-sizing:border-box;" />
        <div style="display:flex;align-items:center;gap:4px;">
          <span style="font-size:12px;color:var(--text-muted);">S/</span>
          <input type="number" id="imp-price-${i}" value="${parseFloat(item.precio)||0}" min="0" step="0.01"
            style="background:var(--surface);border:1px solid var(--border-color);border-radius:6px;padding:6px 8px;color:var(--text-primary);font-size:13px;width:76px;box-sizing:border-box;" />
        </div>
      </div>`).join('');

    const modal = document.createElement('div');
    modal.id = 'import-confirm-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML = `
      <div style="background:var(--bg-surface);border-radius:16px;padding:24px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <h3 style="margin:0;font-size:18px;">📋 Tratamientos detectados</h3>
          <button onclick="document.getElementById('import-confirm-modal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text-muted);">×</button>
        </div>
        <p style="font-size:13px;color:var(--text-muted);margin:0 0 16px;">Revisá y editá antes de guardar. Desmarcá los que no quieras importar.</p>
        <div style="margin-bottom:16px;">
          <div style="display:grid;grid-template-columns:auto 1fr auto;gap:8px;margin-bottom:8px;">
            <span></span>
            <span style="font-size:11px;color:var(--text-muted);font-weight:600;">TRATAMIENTO</span>
            <span style="font-size:11px;color:var(--text-muted);font-weight:600;">PRECIO</span>
          </div>
          ${rows}
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('import-confirm-modal').remove()">Cancelar</button>
          <button class="btn btn-primary btn-sm" onclick="SettingsView._saveImportedItems(${items.length})">💾 Guardar seleccionados</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  },

  async _saveImportedItems(count) {
    const toSave = [];
    for (let i = 0; i < count; i++) {
      const chk   = document.getElementById(`imp-chk-${i}`);
      const name  = document.getElementById(`imp-name-${i}`)?.value?.trim();
      const price = parseFloat(document.getElementById(`imp-price-${i}`)?.value) || 0;
      if (chk?.checked && name) toSave.push({ nombre: name, precio: price, categoria: 'General' });
    }
    if (toSave.length === 0) { Toast.warning('Seleccioná al menos un tratamiento.'); return; }

    try {
      await Promise.all(toSave.map(t => api.catalog.create(t)));
      document.getElementById('import-confirm-modal')?.remove();
      Toast.success(`✅ ${toSave.length} tratamiento(s) importados al catálogo.`);
      this.renderCatalog();
    } catch (err) {
      Toast.error('Error al guardar: ' + err.message);
    }
  },

  async deleteTreatment(id) {
    if (!confirm('¿Eliminar este tratamiento?')) return;
    try {
      await api.catalog.remove(id);
      Toast.success('Eliminado.');
      this.renderCatalog();
    } catch (err) {
      Toast.error('Error: ' + err.message);
    }
  },

  // ============================================================
  // EQUIPO DE LA CLÍNICA
  // ============================================================
  async renderTeam() {
    const el = document.getElementById('team-section');
    if (!el) return;
    try {
      const res     = await api.clinic.get();
      const clinic  = res.clinic;
      const doctors = res.doctors || [];
      const roleLabel = { owner: 'Propietario', doctor: 'Doctor', receptionist: 'Recepción' };

      el.innerHTML = `
        <p style="font-size:13px;color:var(--text-muted);margin:0 0 12px;">
          Gestiona los miembros que acceden a <strong>${clinic.name}</strong>. Comparte el código de invitación con nuevos doctores.
        </p>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" onclick="SettingsView.generateInvite('doctor')">+ Invitar Doctor</button>
          <button class="btn btn-ghost btn-sm" onclick="SettingsView.generateInvite('receptionist')">+ Invitar Secretaria</button>
        </div>
        <div id="invite-result" style="margin-bottom:12px;"></div>
        <div>
          ${doctors.map(d => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;background:var(--bg-primary);">
              <div style="width:36px;height:36px;border-radius:50%;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;">
                ${d.username[0].toUpperCase()}
              </div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:14px;font-weight:600;color:var(--text-primary);">${d.doctor_name || d.username}</div>
                <div style="font-size:12px;color:var(--text-muted);">${d.email || d.username} · <span style="color:var(--primary);">${roleLabel[d.role] || d.role}</span></div>
              </div>
              ${d.role !== 'owner' ? `
              <button onclick="SettingsView.changeRole(${d.id}, '${d.role}', '${(d.doctor_name || d.username).replace(/'/g,"\\'")}') "
                class="btn btn-ghost btn-sm" title="Cambiar rol" style="font-size:11px;padding:3px 8px;">
                ${d.role === 'receptionist' ? '→ Doctor' : '→ Secretaria'}
              </button>
              <button onclick="SettingsView.removeDoctor(${d.id}, '${(d.doctor_name || d.username).replace(/'/g,"\\'")}') "
                style="background:none;border:none;cursor:pointer;color:var(--danger);font-size:20px;padding:0 4px;" title="Quitar de la clínica">×</button>
              ` : ''}
            </div>`).join('')}
        </div>`;
    } catch (err) {
      const el2 = document.getElementById('team-section');
      if (el2) el2.innerHTML = `<div style="color:var(--danger);font-size:13px;">Error: ${err.message}</div>`;
    }
  },

  async generateInvite(rol_invitado = 'doctor') {
    try {
      const res  = await api.clinic.invite(rol_invitado);
      const code = res.invite_code;
      const label = rol_invitado === 'receptionist' ? '(Secretaria/Recepcionista)' : '(Doctor)';
      const el   = document.getElementById('invite-result');
      if (!el) return;
      const joinLink = `${window.location.origin}/#join/${code}`;
      el.innerHTML = `
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:14px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
            <div style="flex:1;">
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px;">Código de invitación</div>
              <div style="font-size:26px;font-weight:800;letter-spacing:4px;color:var(--primary);">${code}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Rol: <strong>${label}</strong> · Solo funciona una vez.</div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText('${joinLink}').then(()=>Toast.success('Link copiado ✅'))">Copiar link</button>
          </div>
          <div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-size:12px;color:var(--primary);word-break:break-all;">${joinLink}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">Compartí este link — el código se completa automáticamente.</div>
        </div>`;
    } catch (err) {
      Toast.error('Error: ' + err.message);
    }
  },

  async changeRole(id, rolActual, nombre) {
    const nuevoRol = rolActual === 'receptionist' ? 'doctor' : 'receptionist';
    const label = nuevoRol === 'receptionist' ? 'Secretaria/Recepcionista' : 'Doctor';
    if (!confirm(`¿Cambiar el rol de ${nombre} a ${label}?`)) return;
    try {
      await api.clinic.changeRole(id, nuevoRol);
      Toast.success(`Rol actualizado a ${label}.`);
      this.renderTeam();
    } catch (err) { Toast.error('Error: ' + err.message); }
  },

  async removeDoctor(id, nombre) {
    if (!confirm(`¿Quitar a ${nombre} de la clínica? Su cuenta no se eliminará.`)) return;
    try {
      await api.clinic.removeDoctor(id);
      Toast.success(`${nombre} fue removido de la clínica.`);
      this.renderTeam();
    } catch (err) {
      Toast.error('Error: ' + err.message);
    }
  },

  async _downloadBackup() {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
      const res = await fetch('/api/admin/backup', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) throw new Error('Sin permisos de administrador');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `dentalflow_backup_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      Toast.success('✅ Backup descargado correctamente.');
    } catch (err) {
      Toast.error('Error al descargar backup: ' + err.message);
    }
  },

  async _exportCSV(type) {
    try {
      Toast.info('Preparando exportación...');
      await api.export.downloadCSV(type);
      Toast.success('Archivo descargado.');
    } catch (err) {
      Toast.error('Error al exportar: ' + err.message);
    }
  },

  async _handleImportCSV(input) {
    const file = input.files[0];
    if (!file) return;

    const statusEl = document.getElementById('import-csv-status');
    const resultEl = document.getElementById('import-csv-result');
    if (statusEl) statusEl.textContent = 'Leyendo archivo...';

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) {
      if (statusEl) statusEl.textContent = 'El archivo está vacío o sin datos.';
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    const rows = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const obj  = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    }).filter(r => r.nombre || r.telefono);

    if (rows.length === 0) {
      if (statusEl) statusEl.textContent = 'No se encontraron filas válidas.';
      return;
    }

    if (statusEl) statusEl.textContent = `Importando ${rows.length} pacientes...`;

    try {
      const res = await api.patients.import(rows);
      if (statusEl) statusEl.textContent = '';
      if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.innerHTML = `
          <div style="padding:12px;border-radius:8px;background:var(--bg-secondary);border-left:3px solid var(--success);">
            <div style="font-size:14px;font-weight:600;color:var(--success);margin-bottom:4px;">Importación completada</div>
            <div style="font-size:13px;color:var(--text-secondary);">
              ✅ ${res.imported} importados &nbsp;·&nbsp; ⏭️ ${res.skipped} omitidos (duplicados o errores)
            </div>
            ${res.errors?.length ? `<div style="font-size:12px;color:var(--warning);margin-top:6px;">Errores: ${res.errors.map(e=>`Línea ${e.linea}: ${e.error}`).join(', ')}</div>` : ''}
          </div>`;
      }
      Toast.success(`✅ ${res.imported} pacientes importados.`);
    } catch (err) {
      if (statusEl) statusEl.textContent = '';
      Toast.error('Error al importar: ' + err.message);
    } finally {
      input.value = '';
    }
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
