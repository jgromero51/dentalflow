/**
 * DentalFlow — Notificaciones (campana en el nav)
 */

const NotifDropdown = {
  _open: false,
  _pollInterval: null,
  _unread: 0,

  init() {
    if (!Auth.isLoggedIn()) return;
    this._poll();
    // Refresca cada 30 segundos
    this._pollInterval = setInterval(() => this._poll(), 30000);
    // Cerrar al hacer click fuera
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#nav-notif-wrapper')) this.close();
    });
  },

  destroy() {
    if (this._pollInterval) { clearInterval(this._pollInterval); this._pollInterval = null; }
  },

  async _poll() {
    if (!Auth.isLoggedIn()) return;
    try {
      const res = await api.notifications.list();
      this._unread = res.unread || 0;
      this._updateBadge();
      if (this._open) this._renderList(res.data || []);
    } catch { /* silencioso */ }
  },

  _updateBadge() {
    const wrapper = document.getElementById('nav-notif-wrapper');
    const badge   = document.getElementById('notif-badge');
    if (!wrapper || !badge) return;
    // Mostrar solo cuando no está en auth views
    const isAuth = ['login','setup','forgot-password','reset-password','join'].some(r =>
      window.location.hash.includes(r)
    );
    wrapper.style.display = isAuth ? 'none' : '';
    if (this._unread > 0) {
      badge.style.display = '';
      badge.textContent   = this._unread > 9 ? '9+' : this._unread;
    } else {
      badge.style.display = 'none';
    }
  },

  toggle(e) {
    e.stopPropagation();
    this._open ? this.close() : this.open();
  },

  async open() {
    document.getElementById('notif-panel')?.classList.add('open');
    this._open = true;
    const res = await api.notifications.list().catch(() => ({ data: [], unread: 0 }));
    this._renderList(res.data || []);
  },

  close() {
    document.getElementById('notif-panel')?.classList.remove('open');
    this._open = false;
  },

  _renderList(items) {
    const el = document.getElementById('notif-list');
    if (!el) return;

    if (items.length === 0) {
      el.innerHTML = '<p style="text-align:center;padding:1.5rem;color:var(--text-muted);font-size:0.85rem;">Sin notificaciones nuevas</p>';
      return;
    }

    el.innerHTML = items.map(n => {
      const tiempo = this._timeAgo(n.created_at);
      const icono  = this._icono(n.mensaje, n.cita_estado);
      const snippet = n.mensaje.length > 55 ? n.mensaje.slice(0, 55) + '…' : n.mensaje;
      const link   = n.appointment_id
        ? `onclick="NotifDropdown.close(); Router.navigate('patient/${n.patient_id}')"`
        : `onclick="NotifDropdown.close(); Router.navigate('messages')"`;

      return `
        <div class="nav-dropdown-item" role="button" ${link}
             style="flex-direction:column;align-items:flex-start;gap:2px;cursor:pointer;">
          <div style="display:flex;align-items:center;gap:6px;width:100%;">
            <span style="font-size:1rem;">${icono}</span>
            <span style="font-weight:600;font-size:0.85rem;flex:1;">${n.paciente_nombre}</span>
            <span style="font-size:0.7rem;color:var(--text-muted);">${tiempo}</span>
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);padding-left:22px;">"${snippet}"</div>
          ${n.cita_estado === 'confirmada' ? `<div style="padding-left:22px;"><span class="badge badge-confirmada" style="font-size:0.65rem;">Cita confirmada ✅</span></div>` : ''}
          ${n.cita_estado === 'cancelada'  ? `<div style="padding-left:22px;"><span class="badge badge-cancelada"  style="font-size:0.65rem;">Cita cancelada ❌</span></div>`  : ''}
        </div>`;
    }).join('<div style="height:1px;background:var(--border);margin:0 12px;"></div>');
  },

  _icono(mensaje, citaEstado) {
    if (citaEstado === 'confirmada') return '✅';
    if (citaEstado === 'cancelada')  return '❌';
    const t = (mensaje || '').toLowerCase();
    if (/\bsi\b|confirm|asist/.test(t)) return '✅';
    if (/\bno\b|cancel|no puedo/.test(t)) return '❌';
    return '💬';
  },

  _timeAgo(isoStr) {
    if (!isoStr) return '';
    const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
    if (diff < 60)   return 'ahora';
    if (diff < 3600) return Math.floor(diff / 60) + ' min';
    if (diff < 86400) return Math.floor(diff / 3600) + ' h';
    return Math.floor(diff / 86400) + ' d';
  },

  async markAllRead() {
    try {
      await api.notifications.markRead();
      this._unread = 0;
      this._updateBadge();
      this._renderList([]);
    } catch { /* silencioso */ }
  },
};

window.NotifDropdown = NotifDropdown;
