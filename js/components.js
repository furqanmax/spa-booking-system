import { escapeHtml } from './utils.js';

const toastContainer = document.getElementById('toast-container');
if (!toastContainer) {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'toast-container';
  document.body.appendChild(container);
}

export function showToast({ message, type = 'info', duration = 3000 }) {
  const container = document.getElementById('toast-container') || document.querySelector('.toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button style="margin-left:auto;background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--c-stone-400);padding:0;line-height:1">&times;</button>
  `;

  container.appendChild(toast);

  toast.querySelector('button').addEventListener('click', () => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  });

  setTimeout(() => {
    if (toast.isConnected) {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
}

export function showModal({ title, body, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, isDanger = false, wide = false }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = `modal ${wide ? 'modal-wide' : ''}`;

    modal.innerHTML = `
      <h3 class="modal-title">${escapeHtml(title)}</h3>
      <div class="modal-body">${body}</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-action="cancel">${escapeHtml(cancelText)}</button>
        <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" data-action="confirm">${escapeHtml(confirmText)}</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const close = (result) => {
      overlay.remove();
      resolve(result);
    };

    modal.querySelector('[data-action="cancel"]').addEventListener('click', () => close(false));
    modal.querySelector('[data-action="confirm"]').addEventListener('click', () => close(true));

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false);
    });

    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') {
        close(false);
        document.removeEventListener('keydown', handler);
      }
    });
  });
}

export function statusBadge(status) {
  const labels = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    completed: 'Completed',
    no_show: 'No Show'
  };
  return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
}

export function renderTimeSlotPicker({ container, slots, selectedTime, onSelect }) {
  container.innerHTML = '';

  if (!slots || slots.length === 0) {
    container.innerHTML = '<div class="empty-state"><h3>No available slots</h3><p>Please try a different date or service.</p></div>';
    return;
  }

  const groupLabels = {
    morning: 'Morning (Before 12 PM)',
    afternoon: 'Afternoon (12 PM — 5 PM)',
    evening: 'Evening (After 5 PM)'
  };

  const groups = { morning: [], afternoon: [], evening: [] };

  for (const slot of slots) {
    const hour = parseInt(slot.time);
    if (hour < 12) groups.morning.push(slot);
    else if (hour < 17) groups.afternoon.push(slot);
    else groups.evening.push(slot);
  }

  for (const [key, label] of Object.entries(groupLabels)) {
    if (groups[key].length === 0) continue;

    const groupEl = document.createElement('div');
    const groupLabel = document.createElement('div');
    groupLabel.className = 'time-slot-group-label';
    groupLabel.textContent = label;
    groupEl.appendChild(groupLabel);

    for (const slot of groups[key]) {
      const slotEl = document.createElement('div');
      slotEl.className = `time-slot${selectedTime === slot.time ? ' selected' : ''}`;
      slotEl.dataset.time = slot.time;

      slotEl.innerHTML = `
        <span>
          <strong>${slot.time}</strong>
          ${slot.staffName ? `<span class="time-slot-staff"> with ${escapeHtml(slot.staffName)}</span>` : ''}
        </span>
        ${slot.isOverbooking ? '<span class="time-slot-badge">Limited</span>' : ''}
      `;

      slotEl.addEventListener('click', () => {
        container.querySelectorAll('.time-slot').forEach(el => el.classList.remove('selected'));
        slotEl.classList.add('selected');
        if (onSelect) onSelect(slot);
      });

      groupEl.appendChild(slotEl);
    }

    container.appendChild(groupEl);
  }
}

export function createDataTable({ container, columns, fetchPage, pageSize = 20 }) {
  let currentPage = 0;
  let lastDoc = null;
  let hasMore = true;
  let data = [];

  async function loadPage() {
    container.innerHTML = '<div class="loading-spinner"></div>';
    try {
      const result = await fetchPage(lastDoc, pageSize);
      data = result.appointments || result.data || [];
      lastDoc = result.lastDoc || null;
      hasMore = result.hasMore || false;
      render();
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><h3>Error loading data</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  function render() {
    if (data.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No records found</h3></div>';
      return;
    }

    let html = '<table class="data-table"><thead><tr>';
    for (const col of columns) {
      html += `<th>${escapeHtml(col.label)}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (const row of data) {
      html += '<tr>';
      for (const col of columns) {
        html += `<td>${col.render ? col.render(row) : escapeHtml(String(row[col.key] || ''))}</td>`;
      }
      html += '</tr>';
    }

    html += '</tbody></table>';

    if (hasMore) {
      html += '<div class="pagination"><button class="btn btn-ghost btn-sm" id="load-more-btn">Load More</button></div>';
    }

    container.innerHTML = html;

    const loadMoreBtn = container.querySelector('#load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', loadPage);
    }
  }

  return { load: loadPage, refresh: loadPage };
}

export function renderAvailabilityEditor({ container, value, onChange }) {
  container.innerHTML = '';
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const data = value || {};

  for (const day of days) {
    const row = document.createElement('div');
    row.className = 'avail-editor';
    row.style.marginBottom = 'var(--space-3)';

    const dayLabel = document.createElement('div');
    dayLabel.className = 'avail-editor-day';
    const cap = day.charAt(0).toUpperCase() + day.slice(1);

    const toggle = document.createElement('label');
    toggle.className = 'avail-toggle';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = data[day]?.isOpen !== false;
    toggle.appendChild(checkbox);
    toggle.appendChild(dayLabel);

    const slotsContainer = document.createElement('div');
    slotsContainer.className = 'avail-editor-slots';

    function renderSlots() {
      slotsContainer.innerHTML = '';
      const dayData = data[day];
      const slots = dayData?.slots || [{ start: '09:00', end: '17:00' }];

      if (!checkbox.checked) {
        slotsContainer.innerHTML = '<span style="color:var(--c-stone-400);font-size:0.875rem">Closed</span>';
        return;
      }

      for (let i = 0; i < slots.length; i++) {
        const slotEl = document.createElement('div');
        slotEl.className = 'avail-editor-slot';

        const startInput = document.createElement('input');
        startInput.type = 'time';
        startInput.value = slots[i].start;
        startInput.addEventListener('change', () => {
          slots[i].start = startInput.value;
          data[day] = { ...(data[day] || {}), slots: [...slots], isOpen: true };
          if (onChange) onChange(data);
        });

        const sep = document.createElement('span');
        sep.textContent = '—';

        const endInput = document.createElement('input');
        endInput.type = 'time';
        endInput.value = slots[i].end;
        endInput.addEventListener('change', () => {
          slots[i].end = endInput.value;
          data[day] = { ...(data[day] || {}), slots: [...slots], isOpen: true };
          if (onChange) onChange(data);
        });

        slotEl.appendChild(startInput);
        slotEl.appendChild(sep);
        slotEl.appendChild(endInput);

        if (slots.length > 1) {
          const removeBtn = document.createElement('button');
          removeBtn.innerHTML = '&times;';
          removeBtn.style.cssText = 'background:none;border:none;color:var(--c-cancelled);cursor:pointer;padding:0 2px;font-size:1rem';
          removeBtn.addEventListener('click', () => {
            slots.splice(i, 1);
            data[day] = { ...(data[day] || {}), slots: [...slots], isOpen: checkbox.checked };
            renderSlots();
            if (onChange) onChange(data);
          });
          slotEl.appendChild(removeBtn);
        }

        slotsContainer.appendChild(slotEl);
      }

      const addBtn = document.createElement('button');
      addBtn.className = 'avail-editor-add';
      addBtn.textContent = '+ Add slot';
      addBtn.addEventListener('click', () => {
        const lastSlot = slots[slots.length - 1];
        const newStart = lastSlot?.end || '17:00';
        slots.push({ start: newStart, end: '18:00' });
        data[day] = { ...(data[day] || {}), slots: [...slots], isOpen: checkbox.checked };
        renderSlots();
        if (onChange) onChange(data);
      });
      slotsContainer.appendChild(addBtn);
    }

    checkbox.addEventListener('change', () => {
      if (!checkbox.checked) {
        data[day] = { ...(data[day] || {}), isOpen: false, slots: data[day]?.slots || [{ start: '09:00', end: '17:00' }] };
      } else {
        data[day] = { ...(data[day] || {}), isOpen: true };
      }
      renderSlots();
      if (onChange) onChange(data);
    });

    row.appendChild(toggle);
    row.appendChild(slotsContainer);
    container.appendChild(row);
    renderSlots();
  }
}

export function renderDatePicker({ container, selectedDate, minDate, maxDate, onSelect, markedDates }) {
  container.innerHTML = '';

  let viewDate = selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date();
  viewDate.setDate(1);

  function render() {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const wrapper = document.createElement('div');
    wrapper.className = 'calendar-widget';

    const header = document.createElement('div');
    header.className = 'calendar-header';
    header.innerHTML = `
      <button class="calendar-nav-btn" data-action="prev">&larr;</button>
      <h4>${viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h4>
      <button class="calendar-nav-btn" data-action="next">&rarr;</button>
    `;
    wrapper.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'calendar-grid';

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (const name of dayNames) {
      const el = document.createElement('div');
      el.className = 'calendar-grid-header';
      el.textContent = name;
      grid.appendChild(el);
    }

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();

    let todayStr = new Date().toISOString().split('T')[0];
    if (minDate && new Date(minDate + 'T00:00:00') > new Date()) {
      todayStr = minDate;
    }
    const min = minDate ? new Date(minDate + 'T00:00:00') : null;
    const max = maxDate ? new Date(maxDate + 'T00:00:00') : null;

    for (let i = 0; i < startPad; i++) {
      const el = document.createElement('div');
      el.className = 'calendar-day other-month';
      grid.appendChild(el);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const dateObj = new Date(year, month, day);

      const el = document.createElement('div');
      el.className = 'calendar-day';
      if (dateStr === selectedDate) el.classList.add('selected');
      if (dateStr === todayStr) el.classList.add('today');
      if (markedDates?.has(dateStr)) el.classList.add('has-slots');

      if ((min && dateObj < min) || (max && dateObj > max)) {
        el.classList.add('disabled');
      } else {
        el.addEventListener('click', () => {
          container.querySelectorAll('.calendar-day.selected').forEach(e => e.classList.remove('selected'));
          el.classList.add('selected');
          if (onSelect) onSelect(dateStr);
        });
      }

      el.textContent = day;
      grid.appendChild(el);
    }

    wrapper.appendChild(grid);
    container.innerHTML = '';
    container.appendChild(wrapper);

    header.querySelector('[data-action="prev"]').addEventListener('click', () => {
      viewDate.setMonth(viewDate.getMonth() - 1);
      render();
    });

    header.querySelector('[data-action="next"]').addEventListener('click', () => {
      viewDate.setMonth(viewDate.getMonth() + 1);
      render();
    });
  }

  render();
}
