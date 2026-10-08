import { getServices, createService, updateService, deleteService, getServicePricing, updateServicePricing } from '../../db/services.js';
import { getBranches } from '../../db/branches.js';
import { showModal, showToast } from '../../components.js';
import { escapeHtml, formatCurrency } from '../../utils.js';

export async function renderServices(container) {
  container.innerHTML = '<h2>Services</h2><div id="services-content"><div class="loading-spinner"></div></div>';

  const content = document.getElementById('services-content');

  try {
    const [services, branches] = await Promise.all([getServices(true), getBranches(true)]);

    let html = '<div style="margin-bottom:var(--space-4)"><button class="btn btn-primary" id="add-service-btn">+ Add Service</button></div>';

    if (services.length === 0) {
      html += '<div class="empty-state"><h3>No services</h3></div>';
    } else {
      html += '<table class="data-table"><thead><tr><th>Name</th><th>Category</th><th>Duration</th><th>Active</th><th>Landing</th><th>Actions</th></tr></thead><tbody>';

      for (const s of services) {
        html += `
          <tr>
            <td><strong>${escapeHtml(s.name)}</strong></td>
            <td>${escapeHtml(s.category || '')}</td>
            <td>${s.durationMinutes || 0} min</td>
            <td>${s.isActive !== false ? '<span class="badge badge-confirmed">Active</span>' : '<span class="badge badge-cancelled">Inactive</span>'}</td>
            <td>${s.isVisibleOnLanding !== false ? '<span class="badge badge-confirmed">Visible</span>' : '<span class="badge badge-cancelled">Hidden</span>'}</td>
            <td class="actions">
              <button class="btn btn-secondary btn-sm" data-edit="${s.id}">Edit</button>
              <button class="btn btn-ghost btn-sm" data-price="${s.id}">Pricing</button>
              <button class="btn btn-danger btn-sm" data-delete="${s.id}">Delete</button>
            </td>
          </tr>`;
      }

      html += '</tbody></table>';
    }

    content.innerHTML = html;

    document.getElementById('add-service-btn')?.addEventListener('click', () => showServiceForm(content, null, branches));

    content.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const service = services.find(s => s.id === btn.dataset.edit);
        if (service) showServiceForm(content, service, branches);
      });
    });

    content.querySelectorAll('[data-price]').forEach(btn => {
      btn.addEventListener('click', () => showPricingForm(content, btn.dataset.price, branches, services));
    });

    content.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const service = services.find(s => s.id === btn.dataset.delete);
        if (!service) return;
        const confirmed = await showModal({
          title: 'Delete Service',
          body: `<p>Are you sure you want to delete <strong>${escapeHtml(service.name)}</strong>?</p>`,
          confirmText: 'Delete',
          isDanger: true
        });
        if (confirmed) {
          try {
            await deleteService(service.id);
            showToast({ message: 'Service deleted', type: 'success' });
            renderServices(container);
          } catch (err) { showToast({ message: err.message, type: 'error' }); }
        }
      });
    });
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

async function showServiceForm(content, existing = null, branches) {
  const isEdit = !!existing;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal modal-wide">
      <h3 class="modal-title">${isEdit ? 'Edit Service' : 'Add Service'}</h3>
      <form id="service-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Name *</label>
            <input type="text" class="form-input" id="srv-name" value="${escapeHtml(existing?.name || '')}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Category</label>
            <input type="text" class="form-input" id="srv-category" value="${escapeHtml(existing?.category || '')}" placeholder="e.g. Massage, Facial">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-textarea" id="srv-desc">${escapeHtml(existing?.description || '')}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Duration (minutes) *</label>
            <input type="number" class="form-input" id="srv-duration" value="${existing?.durationMinutes || 60}" min="15" step="15">
          </div>
          <div class="form-group">
            <label class="form-label">Image URL</label>
            <input type="url" class="form-input" id="srv-image" value="${escapeHtml(existing?.imageUrl || '')}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Sort Order</label>
          <input type="number" class="form-input" id="srv-sort" value="${existing?.sortOrder || 0}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-checkbox">
              <input type="checkbox" id="srv-active" ${existing?.isActive !== false ? 'checked' : ''}>
              Active
            </label>
          </div>
          <div class="form-group">
            <label class="form-checkbox">
              <input type="checkbox" id="srv-landing" ${existing?.isVisibleOnLanding !== false ? 'checked' : ''}>
              Show on Landing Page
            </label>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="srv-form-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#srv-form-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#service-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('srv-name').value.trim(),
      description: document.getElementById('srv-desc').value.trim(),
      category: document.getElementById('srv-category').value.trim(),
      durationMinutes: parseInt(document.getElementById('srv-duration').value) || 60,
      imageUrl: document.getElementById('srv-image').value.trim(),
      sortOrder: parseInt(document.getElementById('srv-sort').value) || 0,
      isActive: document.getElementById('srv-active').checked,
      isVisibleOnLanding: document.getElementById('srv-landing').checked
    };

    if (!data.name) {
      showToast({ message: 'Service name is required', type: 'error' });
      return;
    }

    try {
      if (isEdit) {
        await updateService(existing.id, data);
        showToast({ message: 'Service updated', type: 'success' });
      } else {
        await createService(data);
        showToast({ message: 'Service created', type: 'success' });
      }
      modal.remove();
      renderServices(container);
    } catch (err) {
      showToast({ message: err.message, type: 'error' });
    }
  });
}

async function showPricingForm(content, serviceId, branches, services) {
  const service = services.find(s => s.id === serviceId);

  let rows = '';
  for (const branch of branches) {
    const pricing = await getServicePricing(serviceId, branch.id);
    rows += `
      <div class="form-row" style="margin-bottom:var(--space-3)">
        <div style="display:flex;align-items:center;font-weight:500">${escapeHtml(branch.name)}</div>
        <div>
          <input type="number" class="form-input" data-price="${serviceId}_${branch.id}_price" value="${pricing?.price || ''}" placeholder="Price" step="0.01" style="width:120px;display:inline-block">
          <input type="number" class="form-input" data-price="${serviceId}_${branch.id}_discount" value="${pricing?.discountedPrice || ''}" placeholder="Disc." step="0.01" style="width:100px;display:inline-block;margin-left:var(--space-2)">
          <label class="form-checkbox" style="display:inline-flex;margin-left:var(--space-2)">
            <input type="checkbox" data-price="${serviceId}_${branch.id}_available" ${pricing?.isAvailableAtBranch !== false ? 'checked' : ''}>
            Available
          </label>
        </div>
      </div>`;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal modal-wide">
      <h3 class="modal-title">Pricing: ${escapeHtml(service?.name || '')}</h3>
      <form id="pricing-form">
        ${rows}
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="price-form-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#price-form-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#pricing-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      for (const branch of branches) {
        const price = parseFloat(document.querySelector(`[data-price="${serviceId}_${branch.id}_price"]`)?.value);
        const discount = parseFloat(document.querySelector(`[data-price="${serviceId}_${branch.id}_discount"]`)?.value);
        const available = document.querySelector(`[data-price="${serviceId}_${branch.id}_available"]`)?.checked;

        if (!isNaN(price)) {
          await updateServicePricing(serviceId, branch.id, {
            price,
            discountedPrice: isNaN(discount) ? null : discount,
            isAvailableAtBranch: available !== false,
            currency: 'INR'
          });
        }
      }
      showToast({ message: 'Pricing updated', type: 'success' });
      modal.remove();
    } catch (err) {
      showToast({ message: err.message, type: 'error' });
    }
  });
}
