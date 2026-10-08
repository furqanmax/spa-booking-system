const routes = new Map();
let currentRoute = null;
let currentCleanup = null;
let container = null;
let defaultRoute = null;

export function setContainer(el) {
  container = el;
}

export function addRoute(name, { render, cleanup, title }) {
  routes.set(name, { render, cleanup, title });
}

export function setDefault(name) {
  defaultRoute = name;
}

export function navigate(name, params = {}) {
  if (!routes.has(name)) {
    console.error(`Route "${name}" not found`);
    return;
  }
  if (currentCleanup) {
    try { currentCleanup(); } catch (e) { console.error('Route cleanup error:', e); }
  }
  currentRoute = name;
  const route = routes.get(name);
  const title = typeof route.title === 'function' ? route.title(params) : route.title;
  if (title) document.title = title;
  const mainEl = document.getElementById('dashboard-content') || container;
  if (mainEl) {
    mainEl.innerHTML = '<div class="loading-spinner"></div>';
  }
  Promise.resolve(route.render(params, mainEl)).then(cleanupFn => {
    currentCleanup = cleanupFn || null;
  }).catch(err => {
    console.error('Route render error:', err);
    if (mainEl) {
      mainEl.innerHTML = `<div class="empty-state"><h3>Error loading view</h3><p>${err.message || 'An unexpected error occurred'}</p></div>`;
    }
  });
}

export function getCurrentRoute() {
  return currentRoute;
}
