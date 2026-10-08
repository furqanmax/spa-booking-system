import '../../firebase.js';
import { initAuth, getUser, getStaff, onAuthChange, logoutUser, getEffectiveRole, refreshUser } from '../../auth.js';
import { setContainer, addRoute, navigate } from '../../router.js';
import { getBranch } from '../../db/branches.js';
import { escapeHtml } from '../../utils.js';
import { showToast } from '../../components.js';

import { renderBranches } from './branches.js';
import { renderServices } from './services.js';
import { renderStaff } from './staff.js';
import { renderAvailability } from './availability.js';
import { renderAdminAppointments } from './appointments.js';
import { renderCalendar } from './calendar.js';
import { renderHolidays } from './holidays.js';
import { renderLandingEditor } from './landingEditor.js';
import { renderMyAppointments } from '../user/myAppointments.js';
import { renderProfile } from '../user/profile.js';

const navItems = {
  superadmin: [
    { id: 'dashboard', label: 'Overview', icon: '&#9632;' },
    { id: 'branches', label: 'Branches', icon: '&#9679;' },
    { id: 'services', label: 'Services', icon: '&#9679;' },
    { id: 'staff', label: 'Staff', icon: '&#9679;' },
    { id: 'availability', label: 'Availability', icon: '&#9679;' },
    { id: 'appointments', label: 'Appointments', icon: '&#9679;' },
    { id: 'calendar', label: 'Calendar', icon: '&#9679;' },
    { id: 'holidays', label: 'Holidays', icon: '&#9679;' },
    { id: 'landing', label: 'Landing Page', icon: '&#9679;' },
    { id: 'profile', label: 'Profile', icon: '&#9679;' }
  ],
  admin: [
    { id: 'dashboard', label: 'Overview', icon: '&#9632;' },
    { id: 'branches', label: 'Branches', icon: '&#9679;' },
    { id: 'services', label: 'Services', icon: '&#9679;' },
    { id: 'staff', label: 'Staff', icon: '&#9679;' },
    { id: 'availability', label: 'Availability', icon: '&#9679;' },
    { id: 'appointments', label: 'Appointments', icon: '&#9679;' },
    { id: 'calendar', label: 'Calendar', icon: '&#9679;' },
    { id: 'holidays', label: 'Holidays', icon: '&#9679;' },
    { id: 'landing', label: 'Landing Page', icon: '&#9679;' },
    { id: 'profile', label: 'Profile', icon: '&#9679;' }
  ],
  manager: [
    { id: 'dashboard', label: 'Overview', icon: '&#9632;' },
    { id: 'services', label: 'Services', icon: '&#9679;' },
    { id: 'staff', label: 'Staff', icon: '&#9679;' },
    { id: 'availability', label: 'Availability', icon: '&#9679;' },
    { id: 'appointments', label: 'Appointments', icon: '&#9679;' },
    { id: 'calendar', label: 'Calendar', icon: '&#9679;' },
    { id: 'holidays', label: 'Holidays', icon: '&#9679;' },
    { id: 'profile', label: 'Profile', icon: '&#9679;' }
  ],
  staff: [
    { id: 'dashboard', label: 'My Schedule', icon: '&#9632;' },
    { id: 'calendar', label: 'Calendar', icon: '&#9679;' },
    { id: 'availability', label: 'My Availability', icon: '&#9679;' },
    { id: 'profile', label: 'Profile', icon: '&#9679;' }
  ],
  reception: [
    { id: 'dashboard', label: 'Overview', icon: '&#9632;' },
    { id: 'appointments', label: 'Appointments', icon: '&#9679;' },
    { id: 'calendar', label: 'Calendar', icon: '&#9679;' },
    { id: 'profile', label: 'Profile', icon: '&#9679;' }
  ],
  user: [
    { id: 'my-appointments', label: 'My Appointments', icon: '&#9632;' },
    { id: 'profile', label: 'Profile', icon: '&#9679;' }
  ]
};

async function initDashboard() {
  await initAuth();

  if (!getUser()) {
    window.location.href = 'login.html?returnUrl=' + encodeURIComponent('dashboard.html');
    return;
  }

  setContainer(document.getElementById('dashboard-content'));

  setupRoutes();
  setupNavigation();
  updateSidebar();

  const hash = window.location.hash.slice(1) || 'dashboard';
  navigate(hash);
}

function setupRoutes() {
  addRoute('dashboard', { render: renderDashboardOverview, title: 'Dashboard — Serenity Spa' });
  addRoute('branches', { render: renderBranches, title: 'Branches — Serenity Spa' });
  addRoute('services', { render: renderServices, title: 'Services — Serenity Spa' });
  addRoute('staff', { render: renderStaff, title: 'Staff — Serenity Spa' });
  addRoute('availability', { render: renderAvailability, title: 'Availability — Serenity Spa' });
  addRoute('appointments', { render: renderAdminAppointments, title: 'Appointments — Serenity Spa' });
  addRoute('calendar', { render: renderCalendar, title: 'Calendar — Serenity Spa' });
  addRoute('holidays', { render: renderHolidays, title: 'Holidays — Serenity Spa' });
  addRoute('landing', { render: renderLandingEditor, title: 'Landing Page — Serenity Spa' });
  addRoute('my-appointments', { render: renderMyAppointments, title: 'My Appointments — Serenity Spa' });
  addRoute('profile', { render: renderProfile, title: 'Profile — Serenity Spa' });
}

function setupNavigation() {
  const nav = document.getElementById('dashboard-nav');

  onAuthChange(async (user) => {
    updateSidebar();
    const role = getEffectiveRole() || 'user';
    const items = navItems[role] || navItems.user;

    nav.innerHTML = items.map(item => `
      <a class="dashboard-nav-item" data-route="${item.id}" href="#${item.id}">
        <span class="dashboard-nav-item-icon">${item.icon}</span>
        <span>${item.label}</span>
      </a>
    `).join('');

    nav.querySelectorAll('.dashboard-nav-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        nav.querySelectorAll('.dashboard-nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
        navigate(el.dataset.route);
      });
    });

    const currentHash = window.location.hash.slice(1) || 'dashboard';
    const activeItem = nav.querySelector(`[data-route="${currentHash}"]`);
    if (activeItem) activeItem.classList.add('active');
  });

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await logoutUser();
      window.location.href = '/';
    });
  }

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.slice(1) || 'dashboard';
    nav.querySelectorAll('.dashboard-nav-item').forEach(n => n.classList.remove('active'));
    const item = nav.querySelector(`[data-route="${hash}"]`);
    if (item) item.classList.add('active');
    navigate(hash);
  });
}

async function updateSidebar() {
  const user = getUser();
  const staff = getStaff();
  const roleEl = document.getElementById('sidebar-role');
  const nameEl = document.getElementById('sidebar-user-name');
  const branchEl = document.getElementById('sidebar-user-branch');

  if (user) {
    nameEl.textContent = user.name || user.email || 'User';
    const role = getEffectiveRole();
    roleEl.textContent = (role || 'user').charAt(0).toUpperCase() + (role || 'user').slice(1);

    if (staff?.branchId) {
      try {
        const branch = await getBranch(staff.branchId);
        branchEl.textContent = branch?.name || '';
      } catch { branchEl.textContent = ''; }
    } else {
      branchEl.textContent = '';
    }
  }
}

async function renderDashboardOverview(container) {
  const user = getUser();
  const staff = getStaff();
  const role = getEffectiveRole();

  container.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const branchId = staff?.branchId;
    const today = new Date().toISOString().split('T')[0];

    let statsHtml = '';

    if (branchId || user?.role === 'admin' || user?.role === 'superadmin') {
      const branchIdToUse = branchId || (await import('../../db/branches.js')).getBranches().then(b => b[0]?.id);

      if (branchIdToUse) {
        const { getAppointmentsForDate } = await import('../../db/appointments.js');
        const { getActiveBranches } = await import('../../db/branches.js');
        const appts = await getAppointmentsForDate(branchIdToUse, today);
        const branches = user?.role === 'admin' || user?.role === 'superadmin' ? await getActiveBranches() : [];

        statsHtml = `
          <div class="dashboard-stats">
            <div class="stat-card">
              <div class="stat-card-value">${appts.length}</div>
              <div class="stat-card-label">Appointments Today</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-value">${appts.filter(a => a.status === 'confirmed').length}</div>
              <div class="stat-card-label">Confirmed</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-value">${appts.filter(a => a.status === 'pending').length}</div>
              <div class="stat-card-label">Pending</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-value">${branches.length || (branchId ? 1 : 0)}</div>
              <div class="stat-card-label">Active Branches</div>
            </div>
          </div>
        `;
      }
    }

    container.innerHTML = `
      <h2>Welcome, ${escapeHtml(user?.name || user?.email || 'User')}</h2>
      <p style="color:var(--c-stone-600);margin-bottom:var(--space-6)">Role: ${escapeHtml(role || 'user')}</p>
      ${statsHtml || '<div class="empty-state"><h3>Welcome to your dashboard</h3><p>Use the navigation menu to manage your account.</p></div>'}
      ${role === 'staff' ? '<div class="card"><h3>Quick Links</h3><p><a href="#calendar" class="btn btn-primary">View My Calendar</a> <a href="#availability" class="btn btn-secondary" style="margin-left:var(--space-2)">Update My Availability</a></p></div>' : ''}
      ${role === 'reception' ? '<div class="card"><h3>Quick Actions</h3><p><a href="#appointments" class="btn btn-primary">Manage Appointments</a> <a href="#calendar" class="btn btn-secondary" style="margin-left:var(--space-2)">View Calendar</a></p></div>' : ''}
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h3>Error loading dashboard</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

initDashboard();
