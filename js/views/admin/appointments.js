import { getAppointmentsByBranch, cancelAppointment, updateAppointment, completeAppointment, noShowAppointment } from '../../db/appointments.js';
import { getBranches, getBranch } from '../../db/branches.js';
import { getService } from '../../db/services.js';
import { getStaff } from '../../db/staff.js';
import { getUser, getEffectiveRole, getCurrentBranchId } from '../../auth.js';
import { showModal, showToast, statusBadge } from '../../components.js';
import { formatDate, formatTime, formatCurrency, escapeHtml, todayString } from '../../utils.js';

export async function renderAdminAppointments(container) {
  container.innerHTML = '<h2>Appointments</h2><div id="appt-content"><div class="loading-spinner"></div></div>';

  const content = document.getElementById('appt-content');

  try {
    const role = getEffectiveRole();
    const userBranchId = getCurrentBranchId();
    let branchId = userBranchId;

    if (!branchId && (role === 'admin' || role === 'superadmin')) {
      const branches = await getBranches();
      branchId = branches[0]?.id;
    }

    if (!branchId) {
      content.innerHTML = '<div class="empty-state"><h3>No branch access</h3></div>';
      return;
    }

    let html = `
      <div class="filter-bar">
        <input type="date" class="form-input" id="appt-date-from" value="${todayString()}">
        <input type="date" class="form-input" id="appt-date-to" value="">
        <select class="form-select" id="appt-status-filter">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
          <option value="no_show">No Show</option>
        </select>
        <button class="btn btn-primary btn-sm" id="appt-refresh">Refresh</button>
      </div>
      <div id="appt-list"><div class="loading-spinner"></div></div>
    `;

    content.innerHTML = html;

    async function loadAppointments() {
      const listEl = document.getElementById('appt-list');
      listEl.innerHTML = '<div class="loading-spinner"></div>';

      const dateFrom = document.getElementById('appt-date-from')?.value || todayString();
      const dateTo = document.getElementById('appt-date-to')?.value || dateFrom;

      try {
        const { appointments, hasMore } = await getAppointmentsByBranch(branchId, dateFrom, dateTo);
        const statusFilter = document.getElementById('appt-status-filter')?.value;
        const filtered = statusFilter ? appointments.filter(a => a.status === statusFilter) : appointments;

        if (filtered.length === 0) {
          listEl.innerHTML = '<div class="empty-state"><h3>No appointments</h3></div>';
          return;
        }

        let tableHtml = '<table class="data-table"><thead><tr><th>Date</th><th>Time</th><th>Customer</th><th>Phone</th><th>Service</th><th>Staff</th><th>Status</th><th>Amount</th><th>Actions</th></tr></thead><tbody>';

        for (const apt of filtered) {
          const service = await getService(apt.serviceId).catch(() => null);
          const staff = apt.staffId ? await getStaff(apt.staffId).catch(() => null) : null;

          tableHtml += `
            <tr>
              <td>${formatDate(apt.date)}</td>
              <td>${formatTime(apt.startTime)}</td>
              <td><strong>${escapeHtml(apt.customerName || '')}</strong></td>
              <td>${escapeHtml(apt.customerPhone || '')}</td>
              <td>${escapeHtml(service?.name || apt.serviceId)}</td>
              <td>${escapeHtml(staff?.name || apt.staffId || '—')}</td>
              <td>${statusBadge(apt.status)}</td>
              <td>${formatCurrency(apt.price || 0, apt.currency || 'INR')}</td>
              <td class="actions">
                ${apt.status === 'pending' ? `<button class="btn btn-primary btn-sm" data-confirm="${apt.id}">Confirm</button>` : ''}
                ${(apt.status === 'pending' || apt.status === 'confirmed') ? `
                  <button class="btn btn-danger btn-sm" data-cancel="${apt.id}">Cancel</button>
                  <button class="btn btn-completed btn-sm" data-complete="${apt.id}">Complete</button>
                ` : ''}
                ${apt.status === 'confirmed' ? `<button class="btn btn-secondary btn-sm" data-noshow="${apt.id}">No Show</button>` : ''}
              </td>
            </tr>`;
        }

        tableHtml += '</tbody></table>';
        if (hasMore) tableHtml += '<div class="pagination"><button class="btn btn-ghost btn-sm" id="load-more">Load More</button></div>';

        listEl.innerHTML = tableHtml;

        listEl.querySelectorAll('[data-confirm]').forEach(btn => {
          btn.addEventListener('click', async () => {
            await updateAppointment(btn.dataset.confirm, { status: 'confirmed' });
            showToast({ message: 'Appointment confirmed', type: 'success' });
            loadAppointments();
          });
        });

        listEl.querySelectorAll('[data-cancel]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const reason = await showModal({
              title: 'Cancel Appointment',
              body: '<div class="form-group"><label class="form-label">Cancellation Reason</label><textarea class="form-textarea" id="cancel-reason-input" placeholder="Required reason..."></textarea></div>',
              confirmText: 'Cancel',
              isDanger: true
            });
            if (reason) {
              const reasonText = document.getElementById('cancel-reason-input')?.value || 'No reason provided';
              await cancelAppointment(btn.dataset.cancel, reasonText, getUser()?.uid);
              showToast({ message: 'Appointment cancelled', type: 'success' });
              loadAppointments();
            }
          });
        });

        listEl.querySelectorAll('[data-complete]').forEach(btn => {
          btn.addEventListener('click', async () => {
            await completeAppointment(btn.dataset.complete);
            showToast({ message: 'Appointment completed', type: 'success' });
            loadAppointments();
          });
        });

        listEl.querySelectorAll('[data-noshow]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const confirmed = await showModal({
              title: 'Mark No Show',
              body: '<p>Mark this appointment as no-show?</p>',
              confirmText: 'Mark No Show',
              isDanger: true
            });
            if (confirmed) {
              await noShowAppointment(btn.dataset.noshow);
              showToast({ message: 'Marked as no-show', type: 'success' });
              loadAppointments();
            }
          });
        });
      } catch (err) {
        listEl.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${escapeHtml(err.message)}</p></div>`;
      }
    }

    document.getElementById('appt-refresh').addEventListener('click', loadAppointments);
    await loadAppointments();
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}
