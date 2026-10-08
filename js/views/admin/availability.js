import { getBranchConfig, updateBranchConfig, getBranchAvailability, updateBranchAvailability } from '../../db/branches.js';
import { getServices, getServiceAvailability, updateServiceAvailability } from '../../db/services.js';
import { renderAvailabilityEditor, showToast, showModal } from '../../components.js';
import { escapeHtml } from '../../utils.js';
import { getEffectiveRole, getCurrentBranchId } from '../../auth.js';
import { getBranches } from '../../db/branches.js';

export async function renderAvailability(container) {
  container.innerHTML = '<h2>Availability Settings</h2><div id="avail-content"><div class="loading-spinner"></div></div>';

  const content = document.getElementById('avail-content');

  try {
    const role = getEffectiveRole();
    const userBranchId = getCurrentBranchId();
    const branches = role === 'admin' || role === 'superadmin' ? await getBranches(true) : [];

    if (role === 'staff') {
      content.innerHTML = '<p>Please use the Staff Management section to edit your availability via the "Availability" button on your staff record.</p>';
      return;
    }

    let branchId = userBranchId;
    if (!branchId && branches.length > 0) {
      branchId = branches[0].id;
    }

    if (!branchId) {
      content.innerHTML = '<div class="empty-state"><h3>No branch selected</h3></div>';
      return;
    }

    if ((role === 'admin' || role === 'superadmin') && branches.length > 1) {
      let selectorHtml = '<div class="form-group" style="max-width:300px"><label class="form-label">Select Branch</label><select class="form-select" id="avail-branch-select">';
      for (const b of branches) {
        selectorHtml += `<option value="${b.id}" ${b.id === branchId ? 'selected' : ''}>${escapeHtml(b.name)}</option>`;
      }
      selectorHtml += '</select></div>';
      content.innerHTML = selectorHtml;

      document.getElementById('avail-branch-select').addEventListener('change', (e) => {
        renderBranchAvail(content, e.target.value);
      });

      await renderBranchAvail(content, branchId);
    } else {
      await renderBranchAvail(content, branchId);
    }
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

async function renderBranchAvail(container, branchId) {
  const [config, branchAvail, services] = await Promise.all([
    getBranchConfig(branchId, true),
    getBranchAvailability(branchId, true),
    getServices()
  ]);

  const mode = config?.availabilityMode || 'common';

  let html = `
    <div style="margin-bottom:var(--space-6)">
      <label class="form-label">Availability Mode</label>
      <select class="form-select" id="avail-mode" style="max-width:300px">
        <option value="common" ${mode === 'common' ? 'selected' : ''}>Common (Branch-wide)</option>
        <option value="per_service" ${mode === 'per_service' ? 'selected' : ''}>Per-Service</option>
      </select>
      <p style="font-size:0.8125rem;color:var(--c-stone-500);margin-top:var(--space-1)">
        Common: one schedule for all services. Per-Service: each service has its own schedule.
      </p>
    </div>

    <div id="avail-editor-area">
      <h3 style="margin-bottom:var(--space-4)">${mode === 'common' ? 'Branch Hours' : 'Select a service to edit'}</h3>
      <div id="avail-editor-target"></div>
    </div>
  `;

  container.innerHTML = html;

  document.getElementById('avail-mode').addEventListener('change', async (e) => {
    const newMode = e.target.value;
    await updateBranchConfig(branchId, { availabilityMode: newMode });
    showToast({ message: 'Availability mode updated', type: 'success' });
    renderBranchAvail(container, branchId);
  });

  const editorTarget = document.getElementById('avail-editor-target');

  if (mode === 'common') {
    let availData = { ...branchAvail };
    renderAvailabilityEditor({
      container: editorTarget,
      value: availData,
      onChange: (data) => { availData = data; }
    });

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = 'Save Availability';
    saveBtn.style.marginTop = 'var(--space-4)';
    saveBtn.addEventListener('click', async () => {
      try {
        for (const [day, data] of Object.entries(availData)) {
          await updateBranchAvailability(branchId, day, data);
        }
        showToast({ message: 'Availability saved', type: 'success' });
      } catch (err) {
        showToast({ message: err.message, type: 'error' });
      }
    });
    editorTarget.appendChild(saveBtn);
  } else {
    let serviceListHtml = '';
    for (const svc of services) {
      if (svc.isActive === false) continue;
      serviceListHtml += `<div class="service-select-item" data-service-id="${svc.id}" style="cursor:pointer">
        <div class="service-select-item-info">
          <h3>${escapeHtml(svc.name)}</h3>
        </div>
      </div>`;
    }
    editorTarget.innerHTML = serviceListHtml;

    editorTarget.querySelectorAll('[data-service-id]').forEach(el => {
      el.addEventListener('click', async () => {
        const svcId = el.dataset.serviceId;
        const svcAvail = await getServiceAvailability(svcId, true);
        const subContainer = document.createElement('div');
        el.replaceWith(subContainer);

        let svcAvailData = { ...svcAvail };
        renderAvailabilityEditor({
          container: subContainer,
          value: svcAvailData,
          onChange: (data) => { svcAvailData = data; }
        });

        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn btn-primary btn-sm';
        saveBtn.textContent = 'Save';
        saveBtn.style.marginTop = 'var(--space-3)';
        saveBtn.addEventListener('click', async () => {
          try {
            for (const [day, data] of Object.entries(svcAvailData)) {
              await updateServiceAvailability(svcId, day, data);
            }
            showToast({ message: 'Service availability saved', type: 'success' });
          } catch (err) {
            showToast({ message: err.message, type: 'error' });
          }
        });
        subContainer.appendChild(saveBtn);
      });
    });
  }
}
