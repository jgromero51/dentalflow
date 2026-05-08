/**
 * DentalFlow — Componente: Odontograma Interactivo (Simple)
 */
const OdontogramComponent = {
  container: null,
  patientId: null,
  marksData: [],

  dientesSuperiores: [18,17,16,15,14,13,12,11, 21,22,23,24,25,26,27,28],
  dientesInferiores: [48,47,46,45,44,43,42,41, 31,32,33,34,35,36,37,38],

  diagnosticos: [
    { id: 'Sano',       color: '#ffffff', label: 'Sano / Limpiar' },
    { id: 'Caries',     color: '#da3633', label: 'Caries' },
    { id: 'Resina',     color: '#2ea043', label: 'Resina / Amalgama' },
    { id: 'Extraccion', color: '#8b949e', label: 'Extracción / Ausente' },
    { id: 'Corona',     color: '#d29922', label: 'Corona / Implante' },
  ],

  render(container, initialData = [], patientId) {
    this.container = container;
    this.patientId = patientId;
    this.marksData = initialData;

    let html = `
      <style>
        .odontogram-arch { display: flex; justify-content: center; gap: 4px; margin-bottom: 24px; flex-wrap: wrap; }
        .tooth-wrapper { display: flex; flex-direction: column; align-items: center; width: 32px; cursor: pointer; }
        .tooth-number { font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; font-weight: 600; }
        .tooth-shape { 
          width: 28px; height: 32px; 
          border: 2px solid var(--border-color); 
          border-radius: 6px 6px 12px 12px; 
          background: #fff;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.1s;
        }
        .tooth-shape:hover { transform: scale(1.1); border-color: var(--primary); }
        .tooth-shape.Extraccion::after { content: '✕'; color: #000; font-weight: 800; font-size: 18px; }
        .tooth-wrapper.lower .tooth-shape { border-radius: 12px 12px 6px 6px; }
        .tooth-wrapper.lower .tooth-number { margin-top: 4px; margin-bottom: 0; order: 2; }
        
        .diag-menu {
          position: absolute; background: var(--bg-elevated); border: 1px solid var(--border-color);
          border-radius: var(--radius-md); padding: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          display: none; flex-direction: column; gap: 4px; z-index: 100;
        }
        .diag-btn {
          display: flex; align-items: center; gap: 8px; padding: 6px 12px;
          background: transparent; border: none; color: var(--text-primary);
          text-align: left; cursor: pointer; border-radius: var(--radius-sm);
        }
        .diag-btn:hover { background: var(--bg-primary); }
        .diag-color { width: 12px; height: 12px; border-radius: 50%; display: inline-block; border: 1px solid rgba(255,255,255,0.2); }
      </style>
      
      <div style="text-align:center; font-weight:600; margin-bottom:12px;">Maxilar Superior</div>
      <div class="odontogram-arch upper">
        ${this.dientesSuperiores.map(n => this.renderTooth(n, 'upper')).join('')}
      </div>
      
      <div class="odontogram-arch lower">
        ${this.dientesInferiores.map(n => this.renderTooth(n, 'lower')).join('')}
      </div>
      <div style="text-align:center; font-weight:600; margin-top:-12px; margin-bottom:12px;">Mandíbula Inferior</div>

      <!-- Menú flotante -->
      <div id="diag-menu" class="diag-menu"></div>
    `;

    this.container.innerHTML = html;
    this.bindEvents();
  },

  getLatestMark(toothNumber) {
    // Buscar la última marca registrada para este diente
    const marks = this.marksData.filter(m => m.diente_numero === toothNumber);
    return marks.length ? marks[marks.length - 1] : null;
  },

  renderTooth(number, position) {
    const mark = this.getLatestMark(number);
    let bg = '#ffffff';
    let extraClass = '';

    if (mark && mark.diagnostico !== 'Sano') {
      const diagConfig = this.diagnosticos.find(d => d.id === mark.diagnostico);
      if (diagConfig) bg = diagConfig.color;
      extraClass = mark.diagnostico;
    }

    return `
      <div class="tooth-wrapper ${position}" data-tooth="${number}">
        ${position === 'upper' ? `<div class="tooth-number">${number}</div>` : ''}
        <div class="tooth-shape ${extraClass}" id="tooth-${number}" style="background-color: ${bg};"></div>
        ${position === 'lower' ? `<div class="tooth-number">${number}</div>` : ''}
      </div>
    `;
  },

  bindEvents() {
    const menu = document.getElementById('diag-menu');
    let activeTooth = null;

    // Renderizar botones del menú
    menu.innerHTML = this.diagnosticos.map(d => `
      <button class="diag-btn" data-diag="${d.id}">
        <span class="diag-color" style="background:${d.color};"></span> ${d.label}
      </button>
    `).join('');

    // Abrir menú al hacer clic en un diente
    this.container.querySelectorAll('.tooth-wrapper').forEach(tw => {
      tw.addEventListener('click', (e) => {
        activeTooth = parseInt(tw.dataset.tooth);
        const rect = tw.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        
        menu.style.display = 'flex';
        // Posicionar menú cerca del diente
        let top = (rect.bottom - containerRect.top) + 8;
        let left = (rect.left - containerRect.left);
        
        menu.style.top = top + 'px';
        menu.style.left = left + 'px';
        
        e.stopPropagation();
      });
    });

    // Cerrar menú al hacer clic fuera
    document.addEventListener('click', () => {
      menu.style.display = 'none';
      activeTooth = null;
    });
    menu.addEventListener('click', e => e.stopPropagation());

    // Seleccionar diagnóstico
    menu.querySelectorAll('.diag-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!activeTooth) return;
        const diagId = btn.dataset.diag;
        menu.style.display = 'none';

        // Guardar en backend
        try {
          const res = await api.odontogram.create({
            patient_id: this.patientId,
            diente_numero: activeTooth,
            diagnostico: diagId
          });
          
          // Actualizar estado local
          this.marksData.push(res.data);
          
          // Actualizar UI
          const toothShape = document.getElementById('tooth-' + activeTooth);
          const diagConfig = this.diagnosticos.find(d => d.id === diagId);
          
          // Resetear clases y aplicar nuevas
          toothShape.className = 'tooth-shape ' + diagId;
          toothShape.style.backgroundColor = diagConfig.color;

          Toast.success(`Diente ${activeTooth} actualizado`);
        } catch (err) {
          Toast.error('Error al guardar: ' + err.message);
        }
      });
    });
  }
};

window.OdontogramComponent = OdontogramComponent;
