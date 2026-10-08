import { db } from '../firebase.js';
import {
  doc, getDoc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { cacheGet, cacheSet, cacheRemove } from '../cache.js';

const CONFIG_CACHE_TTL = 3600000;

export async function getLandingConfig(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = cacheGet('landing_config');
    if (cached) return cached;
  }
  const snap = await getDoc(doc(db, 'landingPage', 'config'));
  if (!snap.exists()) return null;
  const config = { id: snap.id, ...snap.data() };
  cacheSet('landing_config', config, CONFIG_CACHE_TTL);
  return config;
}

export async function updateLandingConfig(data) {
  await setDoc(doc(db, 'landingPage', 'config'), {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: data.updatedBy || null
  }, { merge: true });
  cacheRemove('landing_config');
}

export async function isLandingPublished() {
  const config = await getLandingConfig();
  return config?.isPublished === true;
}
