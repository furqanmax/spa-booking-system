import { getAppointmentsByBranch } from '../../db/appointments.js';
import { getBranches, getBranch } from '../../db/branches.js';
import { getStaff } from '../../db/staff.js';
import { getService } from '../../db/services.js';
import { renderCalendar as renderCalendarEngine } from '../../calendar.js';
import { showModal, showToast } from '../../components.js';
import { formatDate, formatTime, formatCurrency, escapeHtml } from '../../utils.js';
import { getEffectiveRole, getCurrentBranchId } from '../../auth.js';

export async function renderCalendar(container) {
  container.innerHTML = '<h2>Calendar</h2><div id="calendar-content"><div class="loading-spinner"></div></div>';

  const content = document.getElementById('calendar-content');

  try {
    const role = getEffectiveRole();
    const userBranchId = getCurrentBranchId();
    let branchId = userBranchId;

    let branchSelector = '';
    if (!branchId && (role === 'admin' || role === 'superadmin')) {
      const branches = await getBranches();
      branchId = branches[0]?.id;
      if (branches.length > 1) {
        branchSelector = `
          <div class="form-group" style="max-width:300px">
            <select class="form-select" id="cal-branch-select">
              ${branches.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}
            </select>
          </div>`;
      }
    }

    if (!branchId) {
      content.innerHTML = '<div class="empty-state"><h3>No branch access</h3></div>';
      return;
    }

    content.innerHTML = `
      <div class="filter-bar">
        ${branchSelector}
        <select class="form-select" id="cal-view-select">
          <option value="week">Week View</option>
          <option value="month">Month View</option>
        </select>
      </div>
      <div id="calendar-container"></div>
    `;

    const calendarContainer = document.getElementById('calendar-container');
    let currentDate = new Date();

    async function loadCalendar() {
      const startDate = new Date(currentDate);
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date(currentDate);
      endDate.setDate(endDate.getDate() + 14);
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      const view = document.getElementById('cal-view-select')?.value || 'week';

      try {
        const { appointments } = await getAppointmentsByBranch(branchId, startStr, endStr);

        const fullAppts = await Promise.all(appointments.map(async (apt) => {
          const [service, staff] = await Promise.all([
            getService(apt.serviceId).catch(() => null),
            apt.staffId ? getStaff(apt.staffId).catch(() => null) : null
          ]);
          return { ...apt, serviceName: service?.name || apt.serviceId, staffName: staff?.name || '' };
        }));

        renderCalendarEngine({
          container: calendarContainer,
          appointments: fullAppts,
          date: currentDate,
          view,
          onSlotClick: (date, hour) => {
            showToast({ message: `Quick-create not yet implemented for ${date} at ${hour}:00`, type: 'info' });
          },
          onAppointmentClick: async (apt) => {
            const service = await getService(apt.serviceId).catch(() => null);
            const staff = apt.staffId ? await getStaff(apt.staffId).catch(() => null) : null;

            showModal({
              title: 'Appointment Details',
              body: `
                <p><strong>Customer:</strong> ${escapeHtml(apt.customerName || '')}</p>
                <p><strong>Service:</strong> ${escapeHtml(service?.name || apt.serviceId)}</p>
                <p><strong>Staff:</strong> ${escapeHtml(staff?.name || apt.staffId || '—')}</p>
                <p><strong>Date:</strong> ${formatDate(apt.date)}</p>
                <p><strong>Time:</strong> ${formatTime(apt.startTime)} — ${formatTime(apt.endTime)}</p>
                <p><strong>Status:</strong> ${apt.status}</p>
                <p><strong>Amount:</strong> ${formatCurrency(apt.price || 0, apt.currency || 'INR')}</p>
                ${apt.notes ? `<p><strong>Notes:</strong> ${escapeHtml(apt.notes)}</p>` : ''}
              `,
              confirmText: 'Close',
              wide: true
            });
          }
        });
      } catch (err) {
        calendarContainer.innerHTML = `<div class="empty-state"><h3>Error loading calendar</h3><p>${escapeHtml(err.message)}</p></div>`;
      }
    }

    document.getElementById('cal-view-select')?.addEventListener('change', loadCalendar);

    const branchSelect = document.getElementById('cal-branch-select');
    if (branchSelect) {
      branchSelect.addEventListener('change', (e) => {
        branchId = e.target.value;
        loadCalendar();
      });
    }

    await loadCalendar();
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}
