import { getUser, getStaff } from '../../auth.js';
import { getAppointmentsByCustomer, cancelAppointment } from '../../db/appointments.js';
import { getBranch } from '../../db/branches.js';
import { getService } from '../../db/services.js';
import { showModal, showToast, statusBadge } from '../../components.js';
import { formatDate, formatTime, formatCurrency, escapeHtml } from '../../utils.js';

export async function renderMyAppointments(container) {
  const user = getUser();
  if (!user) {
    container.innerHTML = '<div class="empty-state"><h3>Please sign in</h3></div>';
    return;
  }

  container.innerHTML = '<h2>My Appointments</h2><div id="appointments-list"><div class="loading-spinner"></div></div>';

  try {
    const { appointments, hasMore } = await getAppointmentsByCustomer(user.uid);

    const listEl = document.getElementById('appointments-list');

    if (appointments.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><h3>No appointments yet</h3><p><a href="/book.html" class="btn btn-primary" style="margin-top:var(--space-4)">Book an Appointment</a></p></div>';
      return;
    }

    let html = '<table class="data-table"><thead><tr><th>Date</th><th>Time</th><th>Service</th><th>Branch</th><th>Status</th><th>Actions</th></tr></thead><tbody>';

    for (const apt of appointments) {
      const [branch, service] = await Promise.all([
        getBranch(apt.branchId).catch(() => null),
        getService(apt.serviceId).catch(() => null)
      ]);

      const canCancel = apt.status === 'pending' || apt.status === 'confirmed';

      html += `
        <tr>
          <td>${formatDate(apt.date)}</td>
          <td>${formatTime(apt.startTime)}</td>
          <td>${escapeHtml(service?.name || apt.serviceId)}</td>
          <td>${escapeHtml(branch?.name || apt.branchId)}</td>
          <td>${statusBadge(apt.status)}</td>
          <td class="actions">
            ${canCancel ? `<button class="btn btn-danger btn-sm" data-cancel="${apt.id}">Cancel</button>` : ''}
            ${apt.status === 'pending' ? `<button class="btn btn-secondary btn-sm" data-reschedule="${apt.id}">Reschedule</button>` : ''}
          </td>
        </tr>`;
    }

    html += '</tbody></table>';

    if (hasMore) {
      html += '<div class="pagination"><button class="btn btn-ghost btn-sm" id="load-more">Load More</button></div>';
    }

    listEl.innerHTML = html;

    listEl.querySelectorAll('[data-cancel]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const confirmed = await showModal({
          title: 'Cancel Appointment',
          body: '<p>Are you sure you want to cancel this appointment?</p><div class="form-group"><label class="form-label">Reason (optional)</label><textarea class="form-textarea" id="cancel-reason" placeholder="Tell us why..."></textarea></div>',
          confirmText: 'Cancel Appointment',
          isDanger: true
        });

        if (confirmed) {
          const reason = document.getElementById('cancel-reason')?.value || '';
          await cancelAppointment(btn.dataset.cancel, reason, user.uid);
          showToast({ message: 'Appointment cancelled', type: 'success' });
          renderMyAppointments(container);
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h3>Error loading appointments</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}
