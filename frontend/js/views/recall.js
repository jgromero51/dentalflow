/**
 * DentalFlow — Vista: Recall de Pacientes Inactivos
 */

const RecallView = {
  _dias_inactividad: 90,
  _dias_entre_recall: 30,
  _candidates: [],
  _loading: false,
  _sending: false,

  async render(container) {
    container.innerHTML = `
      <div class="view-header">
        <h1 class="view-title">Recall de Pacientes</h1>
        <p class="view-subtitle">Contacta pacientes inactivos para que regresen a su control</p>
      </div>

      <div class="card" style="margin-bottom:1rem;">
        <div class="card-body" style="display:flex;gap:1.5rem;align-items:flex-end;flex-wrap:wrap;">
          <div>
            <label class="form-label" style="font-size:0.8rem;">Sin cita desde hace (días)</label>
            <input id="recall-dias-inactividad" type="number" class="form-input" style="width:110px;"
                   value="${this._dias_inactividad}" min="30" max="365" />
          </div>
          <div>
            <label class="form-label" style="font-size:0.8rem;">Mínimo entre recall (días)</label>
            <input id="recall-dias-recall" type="number" class="form-input" style="width:110px;"
                   value="${this._dias_entre_recall}" min="7" max="180" />
          </div>
          <button class="btn btn-secondary" id="recall-refresh-btn">Buscar candidatos</button>
        </div>
      </div>

      <div id="recall-results"></div>
    `;

    container.querySelector('#recall-refresh-btn').addEventListener('click', () => this._load(container));
    await this._load(container);
  },

  async _load(container) {
    if (this._loading) return;
    this._loading = true;

    const diasInactividad = parseInt(container.querySelector('#recall-dias-inactividad').value) || 90;
    const diasEntreRecall  = parseInt(container.querySelector('#recall-dias-recall').value)        || 30;
    this._dias_inactividad = diasInactividad;
    this._dias_entre_recall = diasEntreRecall;

    const resultsEl = container.querySelector('#recall-results');
    resultsEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">Buscando...</p>';

    try {
      const res = await api.recall.candidates({ dias_inactividad: diasInactividad, dias_entre_recall: diasEntreRecall });
      this._candidates = res.data || [];
      this._renderResults(container, resultsEl);
    } catch (err) {
      resultsEl.innerHTML = `<p style="color:var(--danger);text-align:center;padding:2rem;">Error: ${err.message}</p>`;
    } finally {
      this._loading = false;
    }
  },

  _renderResults(container, resultsEl) {
    const candidates = this._candidates;

    if (candidates.length === 0) {
      resultsEl.innerHTML = `
        <div class="card">
          <div class="card-body" style="text-align:center;padding:3rem;color:var(--text-muted);">
            <div style="font-size:2.5rem;margin-bottom:0.75rem;">✅</div>
            <p style="font-weight:600;">No hay pacientes candidatos</p>
            <p style="font-size:0.85rem;">Todos tienen cita reciente o ya recibieron recall recientemente.</p>
          </div>
        </div>`;
      return;
    }

    const rows = candidates.map(p => {
      const ultimaCita = p.ultima_cita
        ? new Date(p.ultima_cita).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'Sin citas';
      const recallPrevio = p.recall_enviado_at
        ? new Date(p.recall_enviado_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—';

      return `
        <tr>
          <td>
            <a href="#patient/${p.id}" style="font-weight:600;color:var(--primary);">${p.nombre}</a>
          </td>
          <td style="color:var(--text-muted);font-size:0.85rem;">${p.telefono}</td>
          <td style="font-size:0.85rem;">${ultimaCita}</td>
          <td style="font-size:0.85rem;color:var(--text-muted);">${recallPrevio}</td>
          <td style="text-align:right;">
            <button class="btn btn-sm btn-secondary recall-send-one"
                    data-id="${p.id}" data-nombre="${p.nombre}">
              Enviar
            </button>
          </td>
        </tr>`;
    }).join('');

    resultsEl.innerHTML = `
      <div class="card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:600;">${candidates.length} paciente${candidates.length !== 1 ? 's' : ''} candidato${candidates.length !== 1 ? 's' : ''}</span>
          <button class="btn btn-primary" id="recall-send-all-btn">
            Enviar recall a todos
          </button>
        </div>
        <div style="overflow-x:auto;">
          <table class="data-table" style="margin:0;">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Teléfono</th>
                <th>Última cita</th>
                <th>Recall previo</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="recall-tbody">${rows}</tbody>
          </table>
        </div>
      </div>`;

    resultsEl.querySelector('#recall-send-all-btn').addEventListener('click', () => this._sendAll(container));

    resultsEl.querySelectorAll('.recall-send-one').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id     = btn.dataset.id;
        const nombre = btn.dataset.nombre;
        btn.disabled = true;
        btn.textContent = '...';
        try {
          const res = await api.recall.sendOne(id);
          if (res.success) {
            Toast.success(`Recall enviado a ${nombre}`);
            btn.textContent = 'Enviado';
            btn.classList.replace('btn-secondary', 'btn-success');
          } else {
            Toast.error(`Error al enviar a ${nombre}: ${res.error}`);
            btn.textContent = 'Error';
            btn.disabled = false;
          }
        } catch (err) {
          Toast.error(err.message);
          btn.textContent = 'Error';
          btn.disabled = false;
        }
      });
    });
  },

  async _sendAll(container) {
    if (this._sending) return;
    if (!confirm(`¿Enviar recall a los ${this._candidates.length} pacientes?`)) return;
    this._sending = true;

    const btn = container.querySelector('#recall-send-all-btn');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
      const res = await api.recall.sendAll({
        dias_inactividad: this._dias_inactividad,
        dias_entre_recall: this._dias_entre_recall,
      });
      Toast.success(res.message);
      await this._load(container);
    } catch (err) {
      Toast.error(err.message);
      btn.disabled = false;
      btn.textContent = orig;
    } finally {
      this._sending = false;
    }
  },
};

window.RecallView = RecallView;
