/**
 * DentalFlow — Mini Calendar Component
 */
const CalendarComponent = {
  currentDate: new Date(),
  selectedDate: null,
  occupiedDates: new Set(),
  onDateSelect: null,

  render(containerId, onSelect) {
    this.onDateSelect = onSelect;
    this.selectedDate = this.selectedDate || new Date();
    this.renderCalendar(containerId);
  },

  async loadOccupied(year, month) {
    try {
      const start = `${year}-${String(month).padStart(2,'0')}-01`;
      const end   = `${year}-${String(month).padStart(2,'0')}-31`;
      const res   = await api.appointments.list({ page: 1, limit: 200 });
      this.occupiedDates = new Set(
        (res.data || [])
          .filter(a => !['cancelada','no_asistio'].includes(a.estado))
          .map(a => a.fecha_hora_inicio.split('T')[0])
      );
    } catch (e) { /* silencioso */ }
  },

  renderCalendar(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const d    = this.currentDate;
    const year = d.getFullYear(), month = d.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const dias  = ['Do','Lu','Ma','Mi','Ju','Vi','Sá'];

    let cells = '';
    const offset = firstDay;
    for (let i = 0; i < offset; i++) cells += '<div class="cal-cell empty"></div>';
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const isToday    = today.getDate()===day && today.getMonth()===month && today.getFullYear()===year;
      const isSelected = this.selectedDate && this.selectedDate.toISOString().startsWith(dateStr);
      const hasAppts   = this.occupiedDates.has(dateStr);
      const isPast     = new Date(dateStr) < new Date(today.toISOString().split('T')[0]);
      let cls = 'cal-cell';
      if (isToday)    cls += ' today';
      if (isSelected) cls += ' selected';
      if (hasAppts)   cls += ' has-appts';
      if (isPast)     cls += ' past';
      cells += `<div class="${cls}" data-date="${dateStr}">${day}</div>`;
    }

    container.innerHTML = `
      <div class="cal-wrapper">
        <div class="cal-header">
          <button class="cal-nav" id="cal-prev">‹</button>
          <span class="cal-title">${meses[month]} ${year}</span>
          <button class="cal-nav" id="cal-next">›</button>
        </div>
        <div class="cal-grid">
          ${dias.map(d=>`<div class="cal-day-name">${d}</div>`).join('')}
          ${cells}
        </div>
      </div>
    `;

    // Estilos inline para el calendario (autocontenido)
    if (!document.getElementById('cal-styles')) {
      const style = document.createElement('style');
      style.id = 'cal-styles';
      style.textContent = `
        .cal-wrapper{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;margin-bottom:16px;}
        .cal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
        .cal-title{font-size:14px;font-weight:600;color:var(--text-primary);}
        .cal-nav{width:28px;height:28px;border-radius:50%;background:var(--bg-elevated);color:var(--text-secondary);font-size:16px;display:flex;align-items:center;justify-content:center;transition:all .2s;cursor:pointer;}
        .cal-nav:hover{background:var(--bg-hover);color:var(--text-primary);}
        .cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;}
        .cal-day-name{text-align:center;font-size:11px;color:var(--text-muted);font-weight:500;padding:4px 0;}
        .cal-cell{text-align:center;padding:7px 2px;font-size:13px;border-radius:6px;cursor:pointer;color:var(--text-secondary);transition:all .15s;position:relative;}
        .cal-cell:not(.empty):hover{background:var(--bg-hover);color:var(--text-primary);}
        .cal-cell.today{color:var(--primary);font-weight:700;}
        .cal-cell.selected{background:var(--primary)!important;color:#fff!important;font-weight:700;}
        .cal-cell.past{opacity:.4;}
        .cal-cell.has-appts::after{content:'';position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%;background:var(--warning);}
        .cal-cell.selected.has-appts::after{background:#fff;}
        .cal-cell.empty{pointer-events:none;}
      `;
      document.head.appendChild(style);
    }

    // Event listeners
    container.querySelector('#cal-prev').addEventListener('click', () => {
      this.currentDate = new Date(year, month - 1, 1);
      this.renderCalendar(containerId);
      this.loadOccupied(this.currentDate.getFullYear(), this.currentDate.getMonth()+1)
        .then(() => this.renderCalendar(containerId));
    });
    container.querySelector('#cal-next').addEventListener('click', () => {
      this.currentDate = new Date(year, month + 1, 1);
      this.renderCalendar(containerId);
      this.loadOccupied(this.currentDate.getFullYear(), this.currentDate.getMonth()+1)
        .then(() => this.renderCalendar(containerId));
    });
    container.querySelectorAll('.cal-cell:not(.empty)').forEach(cell => {
      cell.addEventListener('click', () => {
        const date = cell.dataset.date;
        this.selectedDate = new Date(date + 'T12:00:00');
        this.renderCalendar(containerId);
        if (this.onDateSelect) this.onDateSelect(date);
      });
    });

    this.loadOccupied(year, month+1).then(() => this.renderCalendar(containerId));
  }
};
window.CalendarComponent = CalendarComponent;
