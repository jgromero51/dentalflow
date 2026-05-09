/**
 * DentalFlow — Vista de Registro de Mensajes (Log)
 * Muestra el historial de mensajes enviados y recibidos por WhatsApp.
 */
const MessagesView = {
  async render(container) {
    container.innerHTML = `
      <div class="fade-in" id="messages-view">
        <div class="settings-hero">
          <div class="settings-hero-icon">📩</div>
          <div>
            <h1 class="settings-hero-title">Registro de Mensajes</h1>
            <p class="settings-hero-sub">Historial de notificaciones y respuestas de pacientes</p>
          </div>
        </div>
        <div class="loading-spinner" style="margin: 40px auto;"></div>
      </div>
    `;

    try {
      const res = await api.messages.list({ limit: 100, page: 1 });
      const messages = res.data || [];
      this._renderList(container, messages);
    } catch (err) {
      container.querySelector('#messages-view').innerHTML += `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <div class="empty-title">Error al cargar</div>
          <div class="empty-desc">${err.message}</div>
        </div>`;
    }
  },

  _renderList(container, messages) {
    let html = `
      <div class="settings-hero">
        <div class="settings-hero-icon">📩</div>
        <div>
          <h1 class="settings-hero-title">Registro de Mensajes</h1>
          <p class="settings-hero-sub">Historial de notificaciones y respuestas de pacientes</p>
        </div>
      </div>
    `;

    if (messages.length === 0) {
      html += `
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <div class="empty-title">Bandeja Vacía</div>
          <div class="empty-desc">Aún no se han registrado mensajes.</div>
        </div>
      `;
    } else {
      html += `<div style="display:flex; flex-direction:column; gap:12px;">`;
      
      messages.forEach(msg => {
        const d = new Date(msg.created_at);
        const fecha = d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
        const hora  = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

        let icon = '💬';
        let typeLabel = 'Desconocido';
        if (msg.tipo.includes('recordatorio')) { icon = '⏰'; typeLabel = 'Recordatorio'; }
        else if (msg.tipo === 'respuesta_entrada') { icon = '📥'; typeLabel = 'Recibido'; }
        else if (msg.tipo === 'respuesta_salida') { icon = '📤'; typeLabel = 'Enviado (IA)'; }

        let statusClass = 'success';
        let statusText = 'Enviado';
        if (msg.enviado === 0) { statusClass = 'warning'; statusText = 'Pendiente'; }
        if (msg.enviado === 2) { statusClass = 'danger'; statusText = 'Error'; }
        
        // Incoming messages are considered "Success" in terms of logging.
        if (msg.tipo === 'respuesta_entrada') { statusText = 'Recibido'; statusClass = 'primary'; }

        html += `
          <div class="card" style="padding: 16px; display: flex; gap: 16px; align-items: flex-start;">
            <div style="font-size: 24px; padding-top: 4px;">${icon}</div>
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 8px;">
                <div style="font-weight: 600; color: var(--text-primary);">
                  ${msg.paciente_nombre || msg.paciente_telefono || 'Paciente Desconocido'}
                </div>
                <div style="font-size: 12px; color: var(--text-muted);">
                  ${fecha} ${hora} hs
                </div>
              </div>
              <div style="font-size: 14px; color: var(--text-secondary); background: var(--bg-surface); padding: 10px; border-radius: 8px; border: 1px solid var(--border); word-break: break-word;">
                ${msg.mensaje.replace(/\n/g, '<br/>')}
              </div>
              ${msg.error_detalle ? `<div style="margin-top: 8px; font-size: 12px; color: var(--danger);">⚠️ Error: ${msg.error_detalle}</div>` : ''}
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex-shrink: 0;">
              <span class="badge badge-${statusClass}" style="font-size: 11px;">${statusText}</span>
              <span style="font-size: 11px; color: var(--text-muted);">${typeLabel}</span>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    container.querySelector('#messages-view').innerHTML = html;
  }
};

window.MessagesView = MessagesView;
