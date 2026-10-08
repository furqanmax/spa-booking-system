import { getBranchHolidays, createHoliday, deleteHoliday } from '../../db/holidays.js';
import { getBranches } from '../../db/branches.js';
import { showModal, showToast } from '../../components.js';
import { escapeHtml, formatDate } from '../../utils.js';
import { getEffectiveRole, getCurrentBranchId } from '../../auth.js';

export async function renderHolidays(container) {
  container.innerHTML = '<h2>Holidays</h2><div id="holidays-content"><div class="loading-spinner"></div></div>';

  const content = document.getElementById('holidays-content');

  try {
    const role = getEffectiveRole();
    const userBranchId = getCurrentBranchId();
    let branchId = userBranchId;

    let branches = [];
    if (!branchId && (role === 'admin' || role === 'superadmin')) {
      branches = await getBranches(true);
      branchId = branches[0]?.id;
    } else if (userBranchId) {
      const branch = await (await import('../../db/branches.js')).getBranch(userBranchId);
      if (branch) branches = [branch];
    }

    if (!branchId) {
      content.innerHTML = '<div class="empty-state"><h3>No branch selected</h3></div>';
      return;
    }

    let html = '';
    if (branches.length > 1) {
      html += `<div class="form-group" style="max-width:300px"><select class="form-select" id="holiday-branch-select">
        ${branches.map(b => `<option value="${b.id}" ${b.id === branchId ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('')}
      </select></div>`;
    }

    html += '<div style="margin-bottom:var(--space-4)"><button class="btn btn-primary" id="add-holiday-btn">+ Add Holiday</button></div><div id="holiday-list"></div>';

    content.innerHTML = html;

    const branchSelect = document.getElementById('holiday-branch-select');
    if (branchSelect) {
      branchSelect.addEventListener('change', (e) => renderHolidayList(e.target.value));
    }

    document.getElementById('add-holiday-btn')?.addEventListener('click', () => {
      showHolidayForm(content, branchId);
    });

    await renderHolidayList(branchId);
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${escapeHtml(err.message)}</p></div>`;
  }

  async function renderHolidayList(bId) {
    const listEl = document.getElementById('holiday-list');
    listEl.innerHTML = '<div class="loading-spinner"></div>';

    try {
      const holidays = await getBranchHolidays(bId, true);

      if (holidays.length === 0) {
        listEl.innerHTML = '<div class="empty-state"><h3>No holidays scheduled</h3></div>';
        return;
      }

      let hHtml = '<table class="data-table"><thead><tr><th>Date</th><th>Name</th><th>Recurring</th><th>All Staff</th><th>Actions</th></tr></thead><tbody>';

      for (const h of holidays) {
        hHtml += `
          <tr>
            <td>${formatDate(h.date)}</td>
            <td><strong>${escapeHtml(h.name || '')}</strong></td>
            <td>${h.isRecurring ? '<span class="badge badge-confirmed">Recurring</span>' : '—'}</td>
            <td>${h.affectsAllStaff !== false ? '<span class="badge badge-confirmed">Yes</span>' : '<span class="badge badge-cancelled">No</span>'}</td>
            <td><button class="btn btn-danger btn-sm" data-delete="${h.id}">Remove</button></td>
          </tr>`;
      }

      hHtml += '</tbody></table>';
      listEl.innerHTML = hHtml;

      listEl.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const confirmed = await showModal({
            title: 'Remove Holiday',
            body: '<p>Are you sure you want to remove this holiday?</p>',
            confirmText: 'Remove',
            isDanger: true
          });
          if (confirmed) {
            try {
              await deleteHoliday(btn.dataset.delete, bId);
              showToast({ message: 'Holiday removed', type: 'success' });
              renderHolidayList(bId);
            } catch (err) { showToast({ message: err.message, type: 'error' }); }
          }
        });
      });
    } catch (err) {
      listEl.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
  }
}

function showHolidayForm(content, branchId) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <h3 class="modal-title">Add Holiday</h3>
      <form id="holiday-form">
        <div class="form-group">
          <label class="form-label">Date *</label>
          <input type="date" class="form-input" id="hol-date" required>
        </div>
        <div class="form-group">
          <label class="form-label">Holiday Name *</label>
          <input type="text" class="form-input" id="hol-name" placeholder="e.g. Christmas" required>
        </div>
        <div class="form-group">
          <label class="form-checkbox">
            <input type="checkbox" id="hol-recurring">
            Recurring yearly
          </label>
        </div>
        <div class="form-group">
          <label class="form-checkbox">
            <input type="checkbox" id="hol-all-staff" checked>
            Affects all staff
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="hol-form-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Add Holiday</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#hol-form-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#holiday-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      branchId,
      date: document.getElementById('hol-date').value,
      name: document.getElementById('hol-name').value.trim(),
      isRecurring: document.getElementById('hol-recurring').checked,
      affectsAllStaff: document.getElementById('hol-all-staff').checked
    };

    if (!data.date || !data.name) {
      showToast({ message: 'Date and name are required', type: 'error' });
      return;
    }

    try {
      await createHoliday(data);
      showToast({ message: 'Holiday added', type: 'success' });
      modal.remove();
      renderHolidayList(branchId);
    } catch (err) {
      showToast({ message: err.message, type: 'error' });
    }
  });
}
