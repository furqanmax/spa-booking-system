import { getActiveBranches } from '../db/branches.js';
import { getVisibleServices, getServicePricing } from '../db/services.js';
import { getLandingConfig } from '../db/landingPage.js';
import { formatCurrency, escapeHtml } from '../utils.js';

document.getElementById('footer-year').textContent = new Date().getFullYear();

async function initLanding() {
  try {
    const [config, services, branches] = await Promise.all([
      getLandingConfig(),
      getVisibleServices(),
      getActiveBranches()
    ]);

    if (config) {
      const heroTitle = document.getElementById('hero-title');
      const heroSubtitle = document.getElementById('hero-subtitle');
      if (config.heroTitle) heroTitle.textContent = config.heroTitle;
      if (config.heroSubtitle) heroSubtitle.textContent = config.heroSubtitle;

      if (config.aboutText) {
        document.getElementById('about-text').innerHTML = config.aboutText;
      }
    }

    const servicesGrid = document.getElementById('services-grid');
    if (services.length > 0) {
      servicesGrid.innerHTML = '';
      const sorted = [...services].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      for (const service of sorted) {
        let priceDisplay = '';
        if (branches.length > 0) {
          const pricing = await getServicePricing(service.id, branches[0].id);
          if (pricing) {
            const price = pricing.discountedPrice || pricing.price;
            priceDisplay = formatCurrency(price, pricing.currency || 'INR');
          }
        }

        const card = document.createElement('div');
        card.className = 'service-card';
        card.innerHTML = `
          ${service.imageUrl ? `<img class="service-card-image" src="${escapeHtml(service.imageUrl)}" alt="${escapeHtml(service.name)}" loading="lazy">` : ''}
          <div class="service-card-body">
            <h3>${escapeHtml(service.name)}</h3>
            ${service.description ? `<p>${escapeHtml(service.description)}</p>` : ''}
          </div>
          ${priceDisplay ? `<div class="service-card-footer"><span class="service-card-price">${priceDisplay}</span></div>` : ''}
        `;
        servicesGrid.appendChild(card);
      }
    } else {
      servicesGrid.innerHTML = '<div class="empty-state"><h3>Coming Soon</h3><p>Our services are being updated. Check back soon!</p></div>';
    }

    const branchesGrid = document.getElementById('branches-grid');
    if (branches.length > 0) {
      branchesGrid.innerHTML = '';
      for (const branch of branches) {
        const card = document.createElement('div');
        card.className = 'branch-card';
        card.innerHTML = `
          <h3>${escapeHtml(branch.name)}</h3>
          ${branch.address ? `<p>${escapeHtml(branch.address)}</p>` : ''}
          ${branch.phone ? `<p>${escapeHtml(branch.phone)}</p>` : ''}
          <div style="margin-top:var(--space-3)">
            <a href="book.html?branch=${encodeURIComponent(branch.id)}" class="btn btn-primary btn-sm">Book at this location</a>
          </div>
        `;
        branchesGrid.appendChild(card);
      }
    } else {
      branchesGrid.innerHTML = '<div class="empty-state"><h3>Coming Soon</h3><p>Our branches are being set up. Check back soon!</p></div>';
    }
  } catch (err) {
    console.error('Landing init error:', err);
    document.getElementById('services-grid').innerHTML = '<div class="empty-state"><h3>Unable to load</h3><p>Please refresh the page to try again.</p></div>';
    document.getElementById('branches-grid').innerHTML = '';
  }
}

initLanding();
