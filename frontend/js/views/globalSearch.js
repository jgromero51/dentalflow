/**
 * DentalFlow — Búsqueda Global de Pacientes
 */
const GlobalSearch = {
  _open: false,
  _timer: null,

  open() {
    document.getElementById('search-overlay').style.display = 'flex';
    const inp = document.getElementById('search-input');
    inp.value = '';
    document.getElementById('search-results').innerHTML = '';
    setTimeout(() => inp.focus(), 60);
    this._open = true;
  },

  close() {
    document.getElementById('search-overlay').style.display = 'none';
    this._open = false;
  },

  onInput(q) {
    clearTimeout(this._timer);
    const results = document.getElementById('search-results');
    if (!q.trim()) { results.innerHTML = ''; return; }
    results.innerHTML = '<div class="search-hint">Buscando...</div>';
    this._timer = setTimeout(() => this._search(q.trim()), 280);
  },

  async _search(q) {
    try {
      const res = await api.patients.list(q);
      const list = (res.data || []).slice(0, 8);
      const results = document.getElementById('search-results');
      if (!list.length) {
        results.innerHTML = `<div class="search-hint">Sin resultados para "<strong>${q}</strong>"</div>`;
        return;
      }
      results.innerHTML = list.map(p => {
        const initials = p.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
        return `
          <button class="search-result-item" onclick="GlobalSearch._pick(${p.id})">
            <div class="search-result-avatar">${initials}</div>
            <div class="search-result-info">
              <div class="search-result-name">${p.nombre}</div>
              <div class="search-result-phone">${p.telefono || 'Sin teléfono'}</div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;flex-shrink:0;color:var(--text-muted);"><path d="M9 18l6-6-6-6"/></svg>
          </button>`;
      }).join('');
    } catch {
      document.getElementById('search-results').innerHTML = '<div class="search-hint">Error al buscar</div>';
    }
  },

  _pick(id) {
    this.close();
    Router.navigate('patient/' + id);
  }
};

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && GlobalSearch._open) GlobalSearch.close();
  // Ctrl+K o Cmd+K para abrir búsqueda
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    if (Auth.isLoggedIn()) GlobalSearch.open();
  }
});

window.GlobalSearch = GlobalSearch;
