import { db } from '../firebase.js';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc,
  query, where, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { cacheGet, cacheSet, cacheRemove, invalidateBranch } from '../cache.js';

const SERVICES_CACHE_TTL = 3600000;

const serviceConverter = {
  toFirestore: (data) => {
    const { id, ...rest } = data;
    return { ...rest, updatedAt: serverTimestamp() };
  },
  fromFirestore: (snap) => ({ id: snap.id, ...snap.data() })
};

export async function getServices(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = cacheGet('services_all');
    if (cached) return cached;
  }
  const q = query(collection(db, 'services'), orderBy('sortOrder'));
  const snap = await getDocs(q.withConverter(serviceConverter));
  const services = snap.docs.map(d => d.data());
  cacheSet('services_all', services, SERVICES_CACHE_TTL);
  return services;
}

export async function getVisibleServices(forceRefresh = false) {
  const all = await getServices(forceRefresh);
  return all.filter(s => s.isActive !== false && s.isVisibleOnLanding !== false);
}

export async function getService(serviceId) {
  const cached = cacheGet(`service_${serviceId}`);
  if (cached) return cached;
  const snap = await getDoc(doc(db, 'services', serviceId).withConverter(serviceConverter));
  if (!snap.exists()) return null;
  const data = snap.data();
  cacheSet(`service_${serviceId}`, data, SERVICES_CACHE_TTL);
  return data;
}

export async function createService(data) {
  const ref = await addDoc(collection(db, 'services'), {
    ...data,
    isActive: true,
    isVisibleOnLanding: true,
    sortOrder: data.sortOrder || 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  cacheRemove('services_all');
  return ref.id;
}

export async function updateService(serviceId, data) {
  await updateDoc(doc(db, 'services', serviceId), {
    ...data,
    updatedAt: serverTimestamp()
  });
  cacheRemove('services_all');
  cacheRemove(`service_${serviceId}`);
}

export async function deleteService(serviceId) {
  await deleteDoc(doc(db, 'services', serviceId));
  cacheRemove('services_all');
  cacheRemove(`service_${serviceId}`);
}

export async function getServicePricing(serviceId, branchId) {
  const cached = cacheGet(`service_price_${serviceId}_${branchId}`);
  if (cached) return cached;
  const snap = await getDoc(doc(db, 'services', serviceId, 'pricing', branchId));
  if (!snap.exists()) return null;
  const data = { id: snap.id, ...snap.data() };
  cacheSet(`service_price_${serviceId}_${branchId}`, data, SERVICES_CACHE_TTL);
  return data;
}

export async function updateServicePricing(serviceId, branchId, data) {
  await setDoc(doc(db, 'services', serviceId, 'pricing', branchId), data, { merge: true });
  cacheRemove(`service_price_${serviceId}_${branchId}`);
  invalidateBranch(branchId);
}

export async function getServiceAvailability(serviceId, forceRefresh = false) {
  const cached = cacheGet(`service_avail_${serviceId}`);
  if (cached && !forceRefresh) return cached;
  const snap = await getDocs(collection(db, 'services', serviceId, 'availability'));
  const result = {};
  snap.forEach(d => { result[d.id] = d.data(); });
  cacheSet(`service_avail_${serviceId}`, result, SERVICES_CACHE_TTL);
  return result;
}

export async function updateServiceAvailability(serviceId, dayOfWeek, data) {
  await setDoc(doc(db, 'services', serviceId, 'availability', dayOfWeek), data);
  cacheRemove(`service_avail_${serviceId}`);
}

export async function getBranchServices(branchId, forceRefresh = false) {
  const services = await getServices(forceRefresh);
  const result = [];
  for (const service of services) {
    const pricing = await getServicePricing(service.id, branchId);
    if (pricing && pricing.isAvailableAtBranch !== false) {
      result.push({ ...service, pricing });
    }
  }
  return result;
}
