import { getAllStaff, createStaff, updateStaff, deleteStaff, getStaffAvailability, updateStaffAvailability } from '../../db/staff.js';
import { getBranches } from '../../db/branches.js';
import { getServices } from '../../db/services.js';
import { showModal, showToast } from '../../components.js';
import { escapeHtml } from '../../utils.js';
import { getEffectiveRole, getCurrentBranchId } from '../../auth.js';

export async function renderStaff(container) {
  container.innerHTML = '<h2>Staff Management</h2><div id="staff-content"><div class="loading-spinner"></div></div>';

  const content = document.getElementById('staff-content');

  try {
    const role = getEffectiveRole();
    const userBranchId = getCurrentBranchId();
    const branches = role === 'admin' || role === 'superadmin' ? await getBranches(true) : [];
    const targetBranches = role === 'admin' || role === 'superadmin' ? branches : (userBranchId ? [await (await import('../../db/branches.js')).getBranch(userBranchId)].filter(Boolean) : []);

    if (targetBranches.length === 0) {
      content.innerHTML = '<div class="empty-state"><h3>No branch assigned</h3></div>';
      return;
    }

    let html = '<div style="margin-bottom:var(--space-4)"><button class="btn btn-primary" id="add-staff-btn">+ Add Staff</button></div>';

    for (const branch of targetBranches) {
      const staff = await getAllStaff(branch.id);
      html += `<h3 style="margin:var(--space-4) 0 var(--space-2)">${escapeHtml(branch.name)}</h3>`;

      if (staff.length === 0) {
        html += '<p style="color:var(--c-stone-500);font-size:0.9rem">No staff at this branch</p>';
      } else {
        html += '<table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Active</th><th>Actions</th></tr></thead><tbody>';

        for (const s of staff) {
          html += `
            <tr>
              <td><strong>${escapeHtml(s.name || '')}</strong></td>
              <td>${escapeHtml(s.email || '')}</td>
              <td>${escapeHtml(s.phone || '')}</td>
              <td><span class="badge badge-confirmed">${escapeHtml(s.role || 'staff')}</span></td>
              <td>${s.isActive !== false ? '<span class="badge badge-confirmed">Active</span>' : '<span class="badge badge-cancelled">Inactive</span>'}</td>
              <td class="actions">
                <button class="btn btn-secondary btn-sm" data-edit="${s.id}">Edit</button>
                <button class="btn btn-ghost btn-sm" data-avail="${s.id}">Availability</button>
                <button class="btn btn-danger btn-sm" data-delete="${s.id}">Delete</button>
              </td>
            </tr>`;
        }

        html += '</tbody></table>';
      }
    }

    content.innerHTML = html;

    document.getElementById('add-staff-btn')?.addEventListener('click', () => showStaffForm(content, null, targetBranches));

    content.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.edit;
        const branch = targetBranches.find(b => (await getAllStaff(b.id)).some(s => s.id === id));
        const staff = branch ? (await getAllStaff(branch.id)).find(s => s.id === id) : null;
        if (staff) showStaffForm(content, staff, targetBranches);
      });
    });

    content.querySelectorAll('[data-avail]').forEach(btn => {
      btn.addEventListener('click', () => showStaffAvailForm(content, btn.dataset.avail));
    });

    content.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const confirmed = await showModal({
          title: 'Delete Staff',
          body: '<p>Are you sure you want to delete this staff member?</p>',
          confirmText: 'Delete',
          isDanger: true
        });
        if (confirmed) {
          try {
            await deleteStaff(btn.dataset.delete);
            showToast({ message: 'Staff deleted', type: 'success' });
            renderStaff(container);
          } catch (err) { showToast({ message: err.message, type: 'error' }); }
        }
      });
    });
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

async function showStaffForm(content, existing = null, branches) {
  const isEdit = !!existing;
  const services = await getServices();
  const role = getEffectiveRole();

  let serviceCheckboxes = '';
  for (const svc of services) {
    const checked = existing?.serviceIds?.includes(svc.id);
    serviceCheckboxes += `
      <label class="form-checkbox" style="margin-right:var(--space-3)">
        <input type="checkbox" name="staff-services" value="${svc.id}" ${checked ? 'checked' : ''}>
        ${escapeHtml(svc.name)}
      </label>`;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal modal-wide">
      <h3 class="modal-title">${isEdit ? 'Edit Staff' : 'Add Staff'}</h3>
      <form id="staff-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Name *</label>
            <input type="text" class="form-input" id="st-name" value="${escapeHtml(existing?.name || '')}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-input" id="st-email" value="${escapeHtml(existing?.email || '')}" ${isEdit ? '' : 'required'}>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input type="tel" class="form-input" id="st-phone" value="${escapeHtml(existing?.phone || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Role</label>
            <select class="form-select" id="st-role">
              <option value="staff" ${existing?.role === 'staff' || !existing?.role ? 'selected' : ''}>Staff</option>
              <option value="manager" ${existing?.role === 'manager' ? 'selected' : ''}>Manager</option>
              <option value="reception" ${existing?.role === 'reception' ? 'selected' : ''}>Reception</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Branch</label>
          <select class="form-select" id="st-branch">
            ${branches.map(b => `<option value="${b.id}" ${existing?.branchId === b.id ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Services</label>
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">${serviceCheckboxes}</div>
        </div>
        <div class="form-group">
          <label class="form-checkbox">
            <input type="checkbox" id="st-active" ${existing?.isActive !== false ? 'checked' : ''}>
            Active
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="st-form-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#st-form-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#staff-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const serviceCheckboxes = modal.querySelectorAll('[name="staff-services"]:checked');
    const data = {
      name: document.getElementById('st-name').value.trim(),
      email: document.getElementById('st-email').value.trim(),
      phone: document.getElementById('st-phone').value.trim(),
      role: document.getElementById('st-role').value,
      branchId: document.getElementById('st-branch').value,
      serviceIds: Array.from(serviceCheckboxes).map(cb => cb.value),
      isActive: document.getElementById('st-active').checked
    };

    if (!data.name) {
      showToast({ message: 'Name is required', type: 'error' });
      return;
    }

    try {
      if (isEdit) {
        await updateStaff(existing.id, data);
        showToast({ message: 'Staff updated', type: 'success' });
      } else {
        if (!data.email) {
          showToast({ message: 'Email is required for new staff', type: 'error' });
          return;
        }
        await createStaff(data);
        showToast({ message: 'Staff created', type: 'success' });
      }
      modal.remove();
      renderStaff(container);
    } catch (err) {
      showToast({ message: err.message, type: 'error' });
    }
  });
}

async function showStaffAvailForm(content, staffId) {
  const staff = await (await import('../../db/staff.js')).getStaff(staffId);
  const currentAvail = await getStaffAvailability(staffId);

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal modal-wide">
      <h3 class="modal-title">Availability: ${escapeHtml(staff?.name || '')}</h3>
      <div id="avail-editor-container"></div>
      <div class="modal-actions" style="margin-top:var(--space-4)">
        <button type="button" class="btn btn-secondary" id="avail-form-cancel">Cancel</button>
        <button type="button" class="btn btn-primary" id="avail-form-save">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const { renderAvailabilityEditor } = await import('../../components.js');
  const editorContainer = modal.querySelector('#avail-editor-container');
  let availData = { ...currentAvail };

  renderAvailabilityEditor({
    container: editorContainer,
    value: availData,
    onChange: (data) => { availData = data; }
  });

  modal.querySelector('#avail-form-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#avail-form-save').addEventListener('click', async () => {
    try {
      for (const [day, data] of Object.entries(availData)) {
        await updateStaffAvailability(staffId, day, data);
      }
      showToast({ message: 'Availability updated', type: 'success' });
      modal.remove();
    } catch (err) {
      showToast({ message: err.message, type: 'error' });
    }
  });
}
