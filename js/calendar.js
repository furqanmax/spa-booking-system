import { formatDate, formatTime, escapeHtml } from './utils.js';

const STATUS_CLASSES = {
  pending: 'appt-pending',
  confirmed: 'appt-confirmed',
  cancelled: 'appt-cancelled',
  completed: 'appt-completed',
  no_show: 'appt-no_show'
};

export function renderCalendar({ container, appointments, onSlotClick, onAppointmentClick, view = 'week', date, startHour = 8, endHour = 20 }) {
  container.innerHTML = '';

  if (view === 'week') {
    return renderWeekView({ container, appointments, onSlotClick, onAppointmentClick, date, startHour, endHour });
  } else {
    return renderMonthView({ container, appointments, onSlotClick, onAppointmentClick, date });
  }
}

function renderWeekView({ container, appointments, onSlotClick, onAppointmentClick, date, startHour, endHour }) {
  const currentDate = date || new Date();
  const weekStart = getWeekStart(currentDate);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const totalHours = endHour - startHour;
  const hourHeight = 48;

  const wrapper = document.createElement('div');
  wrapper.className = 'calendar-view';

  const header = document.createElement('div');
  header.className = 'calendar-view-header';
  header.innerHTML = `
    <h3>${formatDate(days[0].toISOString().split('T')[0])} — ${formatDate(days[6].toISOString().split('T')[0])}</h3>
    <div>
      <button class="btn btn-ghost btn-sm" data-nav="prev">&larr; Previous</button>
      <button class="btn btn-ghost btn-sm" data-nav="today">Today</button>
      <button class="btn btn-ghost btn-sm" data-nav="next">Next &rarr;</button>
    </div>
  `;
  wrapper.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'calendar-week-view';

  grid.innerHTML = '<div class="calendar-week-header-cell"></div>';
  for (const day of days) {
    const dayStr = day.toISOString().split('T')[0];
    const isToday = dayStr === new Date().toISOString().split('T')[0];
    grid.innerHTML += `<div class="calendar-week-header-cell" style="${isToday ? 'color:var(--c-sage-700);font-weight:700' : ''}">${day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>`;
  }

  for (let h = 0; h < totalHours; h++) {
    const hour = startHour + h;
    const timeLabel = `${hour.toString().padStart(2, '0')}:00`;

    const timeCell = document.createElement('div');
    timeCell.className = 'calendar-week-time';
    timeCell.textContent = timeLabel;

    grid.appendChild(timeCell);

    for (let d = 0; d < 7; d++) {
      const dayStr = days[d].toISOString().split('T')[0];
      const cell = document.createElement('div');
      cell.className = 'calendar-week-cell';
      cell.dataset.day = dayStr;
      cell.dataset.hour = hour;
      cell.dataset.time = `${hour.toString().padStart(2, '0')}:00`;
      cell.style.height = `${hourHeight}px`;

      if (onSlotClick) {
        cell.addEventListener('click', () => onSlotClick(dayStr, hour));
      }

      const dayAppts = appointments.filter(apt =>
        apt.date === dayStr &&
        apt.status !== 'cancelled' &&
        parseInt(apt.startTime) >= hour &&
        parseInt(apt.startTime) < hour + 1
      );

      for (const apt of dayAppts) {
        const startMin = parseInt(apt.startTime.split(':')[1]) || 0;
        const duration = timeToMin(apt.endTime) - timeToMin(apt.startTime);
        const heightRatio = duration / 60;
        const apptEl = document.createElement('div');
        apptEl.className = `calendar-week-appointment ${STATUS_CLASSES[apt.status] || 'appt-pending'}`;
        apptEl.style.top = `${(startMin / 60) * hourHeight}px`;
        apptEl.style.height = `${heightRatio * hourHeight - 2}px`;
        apptEl.textContent = `${apt.customerName} - ${apt.startTime}`;
        apptEl.title = `${apt.customerName}\n${apt.serviceId}\n${apt.startTime}-${apt.endTime}\n${apt.status}`;
        if (onAppointmentClick) {
          apptEl.addEventListener('click', (e) => {
            e.stopPropagation();
            onAppointmentClick(apt);
          });
        }
        cell.appendChild(apptEl);
      }

      grid.appendChild(cell);
    }
  }

  wrapper.appendChild(grid);
  container.appendChild(wrapper);

  header.querySelector('[data-nav="prev"]')?.addEventListener('click', () => {
    const newDate = new Date(weekStart);
    newDate.setDate(newDate.getDate() - 7);
    renderWeekView({ container, appointments, onSlotClick, onAppointmentClick, date: newDate, startHour, endHour });
  });

  header.querySelector('[data-nav="next"]')?.addEventListener('click', () => {
    const newDate = new Date(weekStart);
    newDate.setDate(newDate.getDate() + 7);
    renderWeekView({ container, appointments, onSlotClick, onAppointmentClick, date: newDate, startHour, endHour });
  });

  header.querySelector('[data-nav="today"]')?.addEventListener('click', () => {
    renderWeekView({ container, appointments, onSlotClick, onAppointmentClick, date: new Date(), startHour, endHour });
  });
}

function renderMonthView({ container, appointments, onSlotClick, onAppointmentClick, date }) {
  const currentDate = date || new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();

  const wrapper = document.createElement('div');
  wrapper.className = 'calendar-view';

  const header = document.createElement('div');
  header.className = 'calendar-view-header';
  header.innerHTML = `
    <h3>${currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
    <div>
      <button class="btn btn-ghost btn-sm" data-nav="prev">&larr; Previous</button>
      <button class="btn btn-ghost btn-sm" data-nav="today">Today</button>
      <button class="btn btn-ghost btn-sm" data-nav="next">Next &rarr;</button>
    </div>
  `;
  wrapper.appendChild(header);

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);border:1px solid var(--c-stone-200);border-radius:var(--radius-md);overflow:hidden';

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (const name of dayNames) {
    const el = document.createElement('div');
    el.style.cssText = 'padding:var(--space-2);text-align:center;font-size:0.75rem;font-weight:600;text-transform:uppercase;color:var(--c-stone-600);background:var(--c-stone-50);border-bottom:1px solid var(--c-stone-200)';
    el.textContent = name;
    grid.appendChild(el);
  }

  const apptMap = {};
  for (const apt of appointments) {
    if (!apptMap[apt.date]) apptMap[apt.date] = [];
    apptMap[apt.date].push(apt);
  }

  for (let i = 0; i < startPad; i++) {
    const el = document.createElement('div');
    el.style.cssText = 'padding:var(--space-2);min-height:80px;background:var(--c-stone-50);border-bottom:1px solid var(--c-stone-100)';
    grid.appendChild(el);
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = dateStr === todayStr;
    const dayAppts = apptMap[dateStr] || [];

    const el = document.createElement('div');
    el.style.cssText = `padding:var(--space-2);min-height:80px;border-bottom:1px solid var(--c-stone-100);cursor:pointer;transition:background var(--duration-fast) var(--ease-out);${isToday ? 'font-weight:700;color:var(--c-sage-700)' : ''}`;
    el.innerHTML = `<div style="font-size:0.875rem;margin-bottom:var(--space-1)">${day}</div>`;

    if (dayAppts.length > 0) {
      const countEl = document.createElement('div');
      countEl.style.cssText = 'display:flex;gap:2px;flex-wrap:wrap';
      const counts = {};
      for (const apt of dayAppts) {
        if (apt.status !== 'cancelled') {
          counts[apt.status] = (counts[apt.status] || 0) + 1;
        }
      }
      for (const [status, count] of Object.entries(counts)) {
        const badge = document.createElement('span');
        badge.style.cssText = `display:inline-block;padding:1px 4px;border-radius:4px;font-size:0.65rem;background:${status === 'confirmed' ? '#D1FAE5' : status === 'pending' ? '#FEF3C7' : '#E0E7FF'};color:${status === 'confirmed' ? '#065F46' : status === 'pending' ? '#92400E' : '#3730A3'}`;
        badge.textContent = `${count} ${status}`;
        countEl.appendChild(badge);
      }
      el.appendChild(countEl);
    }

    if (onSlotClick) {
      el.addEventListener('click', () => onSlotClick(dateStr, 0));
    }

    grid.appendChild(el);
  }

  wrapper.appendChild(grid);
  container.appendChild(wrapper);

  header.querySelector('[data-nav="prev"]')?.addEventListener('click', () => {
    const newDate = new Date(year, month - 1, 1);
    renderMonthView({ container, appointments, onSlotClick, onAppointmentClick, date: newDate });
  });

  header.querySelector('[data-nav="next"]')?.addEventListener('click', () => {
    const newDate = new Date(year, month + 1, 1);
    renderMonthView({ container, appointments, onSlotClick, onAppointmentClick, date: newDate });
  });

  header.querySelector('[data-nav="today"]')?.addEventListener('click', () => {
    renderMonthView({ container, appointments, onSlotClick, onAppointmentClick, date: new Date() });
  });
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function timeToMin(t) {
  const [h, m] = (t || '00:00').split(':').map(Number);
  return h * 60 + (m || 0);
}
