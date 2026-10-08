import { db } from '../firebase.js';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc,
  query, where, orderBy, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { cacheGet, cacheSet, cacheRemove, invalidateBranch } from '../cache.js';
import { getStaffRole, getCurrentBranchId } from '../auth.js';

const BRANCHES_CACHE_TTL = 3600000;

const branchConverter = {
  toFirestore: (data) => {
    const { id, ...rest } = data;
    return { ...rest, updatedAt: serverTimestamp() };
  },
  fromFirestore: (snap) => ({ id: snap.id, ...snap.data() })
};

export async function getBranches(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = cacheGet('branches_all');
    if (cached) return cached;
  }
  const q = query(collection(db, 'branches'), orderBy('name'));
  const snap = await getDocs(q.withConverter(branchConverter));
  const branches = snap.docs.map(d => d.data());
  cacheSet('branches_all', branches, BRANCHES_CACHE_TTL);
  return branches;
}

export async function getActiveBranches(forceRefresh = false) {
  const all = await getBranches(forceRefresh);
  return all.filter(b => b.isActive !== false);
}

export async function getBranch(branchId) {
  const cached = cacheGet(`branch_${branchId}`);
  if (cached) return cached;
  const snap = await getDoc(doc(db, 'branches', branchId).withConverter(branchConverter));
  if (!snap.exists()) return null;
  const data = snap.data();
  cacheSet(`branch_${branchId}`, data, BRANCHES_CACHE_TTL);
  return data;
}

export async function createBranch(data) {
  const ref = await addDoc(collection(db, 'branches'), {
    ...data,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  cacheRemove('branches_all');
  return ref.id;
}

export async function updateBranch(branchId, data) {
  await updateDoc(doc(db, 'branches', branchId), {
    ...data,
    updatedAt: serverTimestamp()
  });
  cacheRemove('branches_all');
  cacheRemove(`branch_${branchId}`);
  invalidateBranch(branchId);
}

export async function deleteBranch(branchId) {
  await deleteDoc(doc(db, 'branches', branchId));
  cacheRemove('branches_all');
  cacheRemove(`branch_${branchId}`);
}

export async function getBranchConfig(branchId, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = cacheGet(`branch_config_${branchId}`);
    if (cached) return cached;
  }
  const snap = await getDoc(doc(db, 'branches', branchId, 'config', 'settings'));
  if (!snap.exists()) return null;
  const config = { id: snap.id, ...snap.data() };
  cacheSet(`branch_config_${branchId}`, config, BRANCHES_CACHE_TTL);
  return config;
}

export async function updateBranchConfig(branchId, data) {
  await setDoc(doc(db, 'branches', branchId, 'config', 'settings'), data, { merge: true });
  cacheRemove(`branch_config_${branchId}`);
  invalidateBranch(branchId);
}

export async function getBranchAvailability(branchId, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = cacheGet(`branch_avail_${branchId}`);
    if (cached) return cached;
  }
  const snap = await getDocs(collection(db, 'branches', branchId, 'availability'));
  const result = {};
  snap.forEach(d => { result[d.id] = d.data(); });
  cacheSet(`branch_avail_${branchId}`, result, BRANCHES_CACHE_TTL);
  return result;
}

export async function updateBranchAvailability(branchId, dayOfWeek, data) {
  await setDoc(doc(db, 'branches', branchId, 'availability', dayOfWeek), data);
  cacheRemove(`branch_avail_${branchId}`);
  invalidateBranch(branchId);
}
