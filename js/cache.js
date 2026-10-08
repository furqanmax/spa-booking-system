const CACHE_PREFIX = 'spa_cache_';
const VERSION_KEY = CACHE_PREFIX + 'version';
const CACHE_VERSION = '1';

function initVersion() {
  const v = sessionStorage.getItem(VERSION_KEY);
  if (v !== CACHE_VERSION) {
    sessionStorage.clear();
    sessionStorage.setItem(VERSION_KEY, CACHE_VERSION);
  }
}

initVersion();

export function cacheGet(key) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, expiry } = JSON.parse(raw);
    if (Date.now() > expiry) {
      sessionStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function cacheSet(key, data, ttlMs = 3600000) {
  try {
    const item = { data, expiry: Date.now() + ttlMs };
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      sessionStorage.clear();
      sessionStorage.setItem(VERSION_KEY, CACHE_VERSION);
    }
  }
}

export function cacheRemove(key) {
  sessionStorage.removeItem(CACHE_PREFIX + key);
}

export function cacheClear() {
  const keys = Object.keys(sessionStorage);
  for (const key of keys) {
    if (key.startsWith(CACHE_PREFIX) && key !== VERSION_KEY) {
      sessionStorage.removeItem(key);
    }
  }
}

export function cacheGetFresh(key) {
  return cacheGet(key + '_fresh');
}

export function cacheSetFresh(key, data) {
  cacheSet(key + '_fresh', data, 300000);
}

export function invalidateBranch(branchId) {
  const patterns = [
    `branches_${branchId}`,
    `services_pricing_${branchId}`,
    `staff_branch_${branchId}`,
    `branch_config_${branchId}`,
  ];
  for (const p of patterns) cacheRemove(p);
}
