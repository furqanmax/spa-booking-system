import { getLandingConfig, updateLandingConfig } from '../../db/landingPage.js';
import { getServices, updateService } from '../../db/services.js';
import { getUser } from '../../auth.js';
import { showToast } from '../../components.js';
import { escapeHtml } from '../../utils.js';

export async function renderLandingEditor(container) {
  container.innerHTML = '<h2>Landing Page Editor</h2><div id="landing-editor-content"><div class="loading-spinner"></div></div>';

  const content = document.getElementById('landing-editor-content');

  try {
    const [config, services] = await Promise.all([
      getLandingConfig(true),
      getServices(true)
    ]);

    const heroTitle = config?.heroTitle || 'Find Your Inner Peace';
    const heroSubtitle = config?.heroSubtitle || 'Experience the art of relaxation.';
    const aboutText = config?.aboutText || '';
    const heroImage = config?.heroImageUrl || '';
    const isPublished = config?.isPublished || false;

    content.innerHTML = `
      <div class="tabs">
        <button class="tab active" data-tab="hero">Hero</button>
        <button class="tab" data-tab="services">Services</button>
        <button class="tab" data-tab="about">About</button>
        <button class="tab" data-tab="publish">Publish</button>
      </div>

      <div id="tab-hero" class="tab-content">
        <div class="form-group">
          <label class="form-label">Hero Title</label>
          <input type="text" class="form-input" id="lp-hero-title" value="${escapeHtml(heroTitle)}">
        </div>
        <div class="form-group">
          <label class="form-label">Hero Subtitle</label>
          <textarea class="form-textarea" id="lp-hero-subtitle">${escapeHtml(heroSubtitle)}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Hero Image URL</label>
          <input type="url" class="form-input" id="lp-hero-image" value="${escapeHtml(heroImage)}">
        </div>
        <button class="btn btn-primary" id="save-hero-btn">Save Hero Section</button>
      </div>

      <div id="tab-services" class="tab-content" style="display:none">
        <p style="margin-bottom:var(--space-4);color:var(--c-stone-600)">Toggle service visibility on the landing page.</p>
        <div id="lp-services-list"></div>
      </div>

      <div id="tab-about" class="tab-content" style="display:none">
        <div class="form-group">
          <label class="form-label">About Text</label>
          <textarea class="form-textarea" id="lp-about" style="min-height:200px">${escapeHtml(aboutText)}</textarea>
        </div>
        <button class="btn btn-primary" id="save-about-btn">Save About Section</button>
      </div>

      <div id="tab-publish" class="tab-content" style="display:none">
        <div style="padding:var(--space-6);text-align:center">
          <h3 style="margin-bottom:var(--space-4)">Publishing Status</h3>
          <p style="margin-bottom:var(--space-4)">Current: ${isPublished ? '<span class="badge badge-confirmed">Published</span>' : '<span class="badge badge-pending">Draft</span>'}</p>
          <button class="btn btn-gold btn-lg" id="lp-publish-btn">
            ${isPublished ? 'Unpublish' : 'Publish Landing Page'}
          </button>
        </div>
      </div>
    `;

    // Tab switching
    content.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        content.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        content.querySelectorAll('.tab-content').forEach(tc => tc.style.display = 'none');
        tab.classList.add('active');
        const tabId = document.getElementById(`tab-${tab.dataset.tab}`);
        if (tabId) tabId.style.display = 'block';
      });
    });

    // Hero save
    document.getElementById('save-hero-btn')?.addEventListener('click', async () => {
      try {
        await updateLandingConfig({
          heroTitle: document.getElementById('lp-hero-title').value.trim(),
          heroSubtitle: document.getElementById('lp-hero-subtitle').value.trim(),
          heroImageUrl: document.getElementById('lp-hero-image').value.trim(),
          updatedBy: getUser()?.uid
        });
        showToast({ message: 'Hero section updated', type: 'success' });
      } catch (err) { showToast({ message: err.message, type: 'error' }); }
    });

    // About save
    document.getElementById('save-about-btn')?.addEventListener('click', async () => {
      try {
        await updateLandingConfig({
          aboutText: document.getElementById('lp-about').value.trim(),
          updatedBy: getUser()?.uid
        });
        showToast({ message: 'About section updated', type: 'success' });
      } catch (err) { showToast({ message: err.message, type: 'error' }); }
    });

    // Services list
    const servicesList = document.getElementById('lp-services-list');
    for (const svc of services) {
      const item = document.createElement('div');
      item.className = 'service-select-item';
      item.innerHTML = `
        <div class="service-select-item-info">
          <h3>${escapeHtml(svc.name)}</h3>
        </div>
        <label class="form-checkbox">
          <input type="checkbox" class="lp-service-visibility" data-id="${svc.id}" ${svc.isVisibleOnLanding !== false ? 'checked' : ''}>
          Show on landing
        </label>
      `;
      servicesList.appendChild(item);

      item.querySelector('.lp-service-visibility')?.addEventListener('change', async (e) => {
        try {
          await updateService(svc.id, { isVisibleOnLanding: e.target.checked });
          showToast({ message: `${svc.name} visibility updated`, type: 'success' });
        } catch (err) { showToast({ message: err.message, type: 'error' }); }
      });
    }

    // Publish toggle
    document.getElementById('lp-publish-btn')?.addEventListener('click', async () => {
      try {
        const newPublished = !isPublished;
        await updateLandingConfig({
          isPublished: newPublished,
          updatedBy: getUser()?.uid
        });
        showToast({ message: newPublished ? 'Landing page published!' : 'Landing page unpublished', type: 'success' });
        renderLandingEditor(container);
      } catch (err) { showToast({ message: err.message, type: 'error' }); }
    });
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}
