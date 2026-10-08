import { getBranches, createBranch, updateBranch, deleteBranch } from '../../db/branches.js';
import { showModal, showToast } from '../../components.js';
import { escapeHtml } from '../../utils.js';

export async function renderBranches(container) {
  container.innerHTML = '<h2>Branches</h2><div id="branches-content"><div class="loading-spinner"></div></div>';

  const content = document.getElementById('branches-content');

  try {
    const branches = await getBranches(true);

    let html = '<div style="margin-bottom:var(--space-4)"><button class="btn btn-primary" id="add-branch-btn">+ Add Branch</button></div>';

    if (branches.length === 0) {
      html += '<div class="empty-state"><h3>No branches</h3></div>';
    } else {
      html += '<table class="data-table"><thead><tr><th>Name</th><th>Address</th><th>Phone</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead><tbody>';

      for (const b of branches) {
        html += `
          <tr>
            <td><strong>${escapeHtml(b.name)}</strong></td>
            <td>${escapeHtml(b.address || '')}</td>
            <td>${escapeHtml(b.phone || '')}</td>
            <td>${escapeHtml(b.email || '')}</td>
            <td>${b.isActive !== false ? '<span class="badge badge-confirmed">Active</span>' : '<span class="badge badge-cancelled">Inactive</span>'}</td>
            <td class="actions">
              <button class="btn btn-secondary btn-sm" data-edit="${b.id}">Edit</button>
              <button class="btn btn-danger btn-sm" data-delete="${b.id}">Delete</button>
            </td>
          </tr>`;
      }

      html += '</tbody></table>';
    }

    content.innerHTML = html;

    document.getElementById('add-branch-btn')?.addEventListener('click', () => showBranchForm(content));

    content.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const branch = branches.find(b => b.id === btn.dataset.edit);
        if (branch) showBranchForm(content, branch);
      });
    });

    content.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const branch = branches.find(b => b.id === btn.dataset.delete);
        if (!branch) return;
        const confirmed = await showModal({
          title: 'Delete Branch',
          body: `<p>Are you sure you want to delete <strong>${escapeHtml(branch.name)}</strong>? This action cannot be undone.</p><p style="color:var(--c-cancelled);margin-top:var(--space-2)">All associated data will be affected.</p>`,
          confirmText: 'Delete',
          isDanger: true
        });
        if (confirmed) {
          try {
            await deleteBranch(branch.id);
            showToast({ message: 'Branch deleted', type: 'success' });
            renderBranches(container);
          } catch (err) { showToast({ message: err.message, type: 'error' }); }
        }
      });
    });
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

async function showBranchForm(content, existing = null) {
  const isEdit = !!existing;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal modal-wide">
      <h3 class="modal-title">${isEdit ? 'Edit Branch' : 'Add Branch'}</h3>
      <form id="branch-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Name *</label>
            <input type="text" class="form-input" id="branch-name" value="${escapeHtml(existing?.name || '')}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input type="tel" class="form-input" id="branch-phone" value="${escapeHtml(existing?.phone || '')}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Address</label>
          <input type="text" class="form-input" id="branch-address" value="${escapeHtml(existing?.address || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-input" id="branch-email" value="${escapeHtml(existing?.email || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Timezone</label>
          <select class="form-select" id="branch-timezone">
            <option value="Asia/Kolkata" ${existing?.timezone === 'Asia/Kolkata' ? 'selected' : ''}>Asia/Kolkata (IST)</option>
            <option value="America/New_York" ${existing?.timezone === 'America/New_York' ? 'selected' : ''}>America/New_York (EST)</option>
            <option value="America/Chicago" ${existing?.timezone === 'America/Chicago' ? 'selected' : ''}>America/Chicago (CST)</option>
            <option value="America/Los_Angeles" ${existing?.timezone === 'America/Los_Angeles' ? 'selected' : ''}>America/Los_Angeles (PST)</option>
            <option value="Europe/London" ${existing?.timezone === 'Europe/London' ? 'selected' : ''}>Europe/London (GMT)</option>
            <option value="UTC" ${existing?.timezone === 'UTC' ? 'selected' : ''}>UTC</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-checkbox">
            <input type="checkbox" id="branch-active" ${existing?.isActive !== false ? 'checked' : ''}>
            Active
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="branch-form-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#branch-form-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#branch-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('branch-name').value.trim(),
      address: document.getElementById('branch-address').value.trim(),
      phone: document.getElementById('branch-phone').value.trim(),
      email: document.getElementById('branch-email').value.trim(),
      timezone: document.getElementById('branch-timezone').value,
      isActive: document.getElementById('branch-active').checked
    };

    if (!data.name) {
      showToast({ message: 'Branch name is required', type: 'error' });
      return;
    }

    try {
      if (isEdit) {
        await updateBranch(existing.id, data);
        showToast({ message: 'Branch updated', type: 'success' });
      } else {
        await createBranch(data);
        showToast({ message: 'Branch created', type: 'success' });
      }
      modal.remove();
      renderBranches(container);
    } catch (err) {
      showToast({ message: err.message, type: 'error' });
    }
  });
}
