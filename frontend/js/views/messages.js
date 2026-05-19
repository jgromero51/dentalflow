/**
 * DentalFlow — Vista de Mensajes / Chat WhatsApp
 * Bandeja de conversaciones con pacientes + hilo de chat + respuesta del doctor.
 */
const MessagesView = {
  _conversations: [],
  _activePatientId: null,
  _pollInterval: null,

  async render(container) {
    container.innerHTML = `
      <div class="fade-in" id="messages-view" style="height:calc(100vh - 120px);display:flex;flex-direction:column;">
        <div class="settings-hero" style="flex-shrink:0;display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div class="settings-hero-icon">💬</div>
            <div>
              <h1 class="settings-hero-title">Mensajes</h1>
              <p class="settings-hero-sub">Conversaciones con tus pacientes via WhatsApp</p>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="MessagesView.openNewMessageModal()" style="flex-shrink:0;">
            ✏️ Nuevo mensaje
          </button>
        </div>
        <div id="chat-shell" style="flex:1;display:flex;gap:0;border:1px solid var(--border);border-radius:12px;overflow:hidden;min-height:0;">
          <div id="conv-list" style="width:320px;flex-shrink:0;border-right:1px solid var(--border);overflow-y:auto;background:var(--bg-surface);">
            <div class="loading-spinner" style="margin:40px auto;"></div>
          </div>
          <div id="chat-panel" style="flex:1;display:flex;flex-direction:column;background:var(--bg-primary);">
            <div id="chat-empty" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text-muted);gap:12px;">
              <div style="font-size:48px;">💬</div>
              <div style="font-size:15px;">Seleccioná una conversación</div>
            </div>
          </div>
        </div>
      </div>`;

    await this._loadConversations();
    this._startPolling();
  },

  async _loadConversations() {
    try {
      const res = await api.messages.conversations();
      this._conversations = res.data || [];
      this._renderConvList();
    } catch (err) {
      document.getElementById('conv-list').innerHTML = `
        <div style="padding:20px;text-align:center;color:var(--danger);font-size:13px;">
          Error al cargar: ${err.message}
        </div>`;
    }
  },

  _renderConvList() {
    const el = document.getElementById('conv-list');
    if (!el) return;

    if (this._conversations.length === 0) {
      el.innerHTML = `
        <div style="padding:32px 16px;text-align:center;color:var(--text-muted);">
          <div style="font-size:32px;margin-bottom:8px;">📭</div>
          <div style="font-size:13px;">Ningún paciente ha respondido aún.</div>
        </div>`;
      return;
    }

    const items = this._conversations.map(c => {
      const isActive = c.patient_id === this._activePatientId;
      const unread   = c.no_leidos > 0;
      const d        = new Date(c.ultima_fecha);
      const hora     = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      const entrada  = c.ultimo_tipo === 'respuesta_entrada';

      return `
        <div class="conv-item ${isActive ? 'conv-active' : ''}"
             onclick="MessagesView._openConversation(${c.patient_id})"
             style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;border-bottom:1px solid var(--border);transition:background 0.15s;
                    background:${isActive ? 'var(--primary-alpha,rgba(99,102,241,.12))' : 'transparent'};">
          <div style="width:42px;height:42px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0;">
            ${(c.paciente_nombre || '?')[0].toUpperCase()}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:${unread ? '700' : '500'};color:var(--text-primary);font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;">
                ${c.paciente_nombre || c.paciente_telefono}
              </span>
              <span style="font-size:11px;color:${unread ? 'var(--primary)' : 'var(--text-muted)'};flex-shrink:0;">${hora}</span>
            </div>
            <div style="display:flex;align-items:center;gap:4px;margin-top:2px;">
              <span style="font-size:12px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">
                ${entrada ? '' : '↗ '}${(c.ultimo_mensaje || '').substring(0, 40)}${c.ultimo_mensaje?.length > 40 ? '…' : ''}
              </span>
              ${unread ? `<span style="background:var(--primary);color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${c.no_leidos}</span>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');

    el.innerHTML = items;
  },

  async _openConversation(patientId) {
    this._activePatientId = patientId;
    this._renderConvList();

    const panel = document.getElementById('chat-panel');
    if (!panel) return;

    panel.innerHTML = `<div class="loading-spinner" style="margin:40px auto;"></div>`;

    try {
      const res     = await api.messages.conversation(patientId);
      const msgs    = res.data || [];
      const patient = msgs[0] || {};

      panel.innerHTML = `
        <!-- Header -->
        <div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;background:var(--bg-surface);flex-shrink:0;">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;">
            ${(patient.paciente_nombre || '?')[0].toUpperCase()}
          </div>
          <div>
            <div style="font-weight:600;font-size:14px;color:var(--text-primary);">${patient.paciente_nombre || 'Paciente'}</div>
            <div style="font-size:12px;color:var(--text-muted);">${patient.paciente_telefono || ''}</div>
          </div>
        </div>

        <!-- Mensajes -->
        <div id="chat-messages" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px;"></div>

        <!-- Input -->
        <div style="padding:12px 16px;border-top:1px solid var(--border);background:var(--bg-surface);display:flex;gap:8px;align-items:flex-end;flex-shrink:0;">
          <textarea id="chat-input" placeholder="Escribí tu respuesta..." rows="1"
            style="flex:1;resize:none;border:1px solid var(--border);border-radius:20px;padding:10px 14px;font-size:14px;background:var(--bg-primary);color:var(--text-primary);outline:none;max-height:100px;overflow-y:auto;font-family:inherit;"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();MessagesView._sendReply();}"></textarea>
          <button onclick="MessagesView._sendReply()"
            style="width:40px;height:40px;border-radius:50%;background:var(--primary);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px;transform:rotate(90deg);">
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
            </svg>
          </button>
        </div>`;

      this._renderMessages(msgs);

      // Actualizar badge de no leídos en la lista
      const conv = this._conversations.find(c => c.patient_id === patientId);
      if (conv) { conv.no_leidos = 0; this._renderConvList(); }

    } catch (err) {
      panel.innerHTML = `<div style="padding:20px;color:var(--danger);">Error: ${err.message}</div>`;
    }
  },

  _renderMessages(msgs) {
    const el = document.getElementById('chat-messages');
    if (!el) return;

    if (msgs.length === 0) {
      el.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:13px;margin-top:40px;">Sin mensajes aún.</div>`;
      return;
    }

    el.innerHTML = msgs.map(m => {
      const esDoctor  = m.tipo === 'doctor_reply' || m.tipo === 'respuesta_salida';
      const d         = new Date(m.created_at);
      const hora      = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      const esAuto    = m.tipo.includes('recordatorio') || m.tipo === 'respuesta_salida';

      return `
        <div style="display:flex;flex-direction:column;align-items:${esDoctor ? 'flex-end' : 'flex-start'};gap:2px;">
          ${esAuto ? `<span style="font-size:10px;color:var(--text-muted);margin-bottom:2px;">${esDoctor ? '🤖 Automático' : ''}</span>` : ''}
          <div style="max-width:75%;padding:10px 14px;border-radius:${esDoctor ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};
                      background:${esDoctor ? 'var(--primary)' : 'var(--bg-surface)'};
                      color:${esDoctor ? '#fff' : 'var(--text-primary)'};
                      border:${esDoctor ? 'none' : '1px solid var(--border)'};
                      font-size:14px;line-height:1.4;word-break:break-word;">
            ${m.mensaje.replace(/\n/g, '<br>').replace(/\*(.*?)\*/g, '<strong>$1</strong>')}
          </div>
          <span style="font-size:10px;color:var(--text-muted);">${hora}</span>
        </div>`;
    }).join('');

    el.scrollTop = el.scrollHeight;
  },

  async _sendReply() {
    const input = document.getElementById('chat-input');
    if (!input) return;
    const mensaje = input.value.trim();
    if (!mensaje || !this._activePatientId) return;

    input.value = '';
    input.style.height = 'auto';

    try {
      await api.messages.reply(this._activePatientId, mensaje);
      // Recargar el hilo
      const res  = await api.messages.conversation(this._activePatientId);
      this._renderMessages(res.data || []);
      // Actualizar última conversación en la lista
      await this._loadConversations();
    } catch (err) {
      Toast.error('Error al enviar: ' + err.message);
      input.value = mensaje;
    }
  },

  _startPolling() {
    // Revisar mensajes nuevos cada 15 segundos
    this._pollInterval = setInterval(async () => {
      const prevConvs = this._conversations.length;
      await this._loadConversations();
      // Si hay conversación activa, refrescar el hilo silenciosamente
      if (this._activePatientId) {
        try {
          const res = await api.messages.conversation(this._activePatientId);
          this._renderMessages(res.data || []);
        } catch (_) {}
      }
    }, 15000);
  },

  async openNewMessageModal() {
    // Cargar lista de pacientes
    let patients = [];
    try {
      const res = await api.patients.list('');
      patients = res.data || [];
    } catch(e) {
      Toast.error('Error al cargar pacientes'); return;
    }

    const modal = document.createElement('div');
    modal.id = 'new-msg-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';

    const options = patients.map(p =>
      `<option value="${p.id}" data-phone="${p.telefono || ''}">${p.nombre} ${p.telefono ? '— ' + p.telefono : '(sin teléfono)'}</option>`
    ).join('');

    modal.innerHTML = `
      <div style="background:var(--bg-surface);border-radius:16px;padding:24px;width:100%;max-width:460px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h3 style="margin:0;font-size:18px;">Nuevo mensaje</h3>
          <button onclick="document.getElementById('new-msg-modal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text-muted);">×</button>
        </div>
        <div class="form-group">
          <label class="form-label">Paciente</label>
          <select id="nm-patient" class="form-control">
            <option value="">-- Seleccioná un paciente --</option>
            ${options}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Mensaje</label>
          <textarea id="nm-mensaje" class="form-control" rows="4" placeholder="Escribí el mensaje..."></textarea>
        </div>
        <div id="nm-error" style="display:none;color:var(--danger);font-size:13px;margin-bottom:12px;"></div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-ghost" style="flex:1;" onclick="document.getElementById('new-msg-modal').remove()">Cancelar</button>
          <button id="nm-send-btn" class="btn btn-primary" style="flex:1;" onclick="MessagesView._sendNewMessage()">
            Enviar por WhatsApp
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  },

  async _sendNewMessage() {
    const patientId = document.getElementById('nm-patient')?.value;
    const mensaje   = document.getElementById('nm-mensaje')?.value?.trim();
    const errEl     = document.getElementById('nm-error');
    const btn       = document.getElementById('nm-send-btn');

    if (!patientId) { errEl.textContent = 'Seleccioná un paciente.'; errEl.style.display = 'block'; return; }
    if (!mensaje)   { errEl.textContent = 'Escribí un mensaje.';     errEl.style.display = 'block'; return; }

    btn.disabled = true;
    btn.textContent = 'Enviando...';
    errEl.style.display = 'none';

    try {
      const res = await api.messages.reply(parseInt(patientId), mensaje);
      document.getElementById('new-msg-modal')?.remove();
      if (res.demo) {
        Toast.warning('Modo demo: mensaje no enviado realmente.');
      } else {
        Toast.success('✅ Mensaje enviado por WhatsApp.');
      }
      await this._loadConversations();
      this._openConversation(parseInt(patientId));
    } catch(err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Enviar por WhatsApp';
    }
  },

  destroy() {
    if (this._pollInterval) clearInterval(this._pollInterval);
    this._pollInterval    = null;
    this._activePatientId = null;
  }
};

window.MessagesView = MessagesView;
