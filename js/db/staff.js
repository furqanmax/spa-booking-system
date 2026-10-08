import { db } from '../firebase.js';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc,
  query, where, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { cacheGet, cacheSet, cacheRemove, invalidateBranch } from '../cache.js';

const STAFF_CACHE_TTL = 300000;

const staffConverter = {
  toFirestore: (data) => {
    const { id, ...rest } = data;
    return { ...rest, updatedAt: serverTimestamp() };
  },
  fromFirestore: (snap) => ({ id: snap.id, ...snap.data() })
};

export async function getStaffList(branchId, forceRefresh = false) {
  const cacheKey = `staff_branch_${branchId}`;
  if (!forceRefresh) {
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
  }
  const q = query(
    collection(db, 'staff'),
    where('branchId', '==', branchId),
    where('isActive', '==', true)
  );
  const snap = await getDocs(q.withConverter(staffConverter));
  const staff = snap.docs.map(d => d.data());
  cacheSet(cacheKey, staff, STAFF_CACHE_TTL);
  return staff;
}

export async function getAllStaff(branchId) {
  const q = query(
    collection(db, 'staff'),
    where('branchId', '==', branchId)
  );
  const snap = await getDocs(q.withConverter(staffConverter));
  return snap.docs.map(d => d.data());
}

export async function getStaff(staffId) {
  const snap = await getDoc(doc(db, 'staff', staffId).withConverter(staffConverter));
  if (!snap.exists()) return null;
  return snap.data();
}

export async function createStaff(data) {
  const ref = await addDoc(collection(db, 'staff'), {
    ...data,
    isActive: true,
    createdAt: serverTimestamp()
  });
  cacheRemove(`staff_branch_${data.branchId}`);
  return ref.id;
}

export async function updateStaff(staffId, data) {
  const existing = await getStaff(staffId);
  if (!existing) throw new Error('Staff not found');
  await updateDoc(doc(db, 'staff', staffId), {
    ...data,
    updatedAt: serverTimestamp()
  });
  cacheRemove(`staff_branch_${existing.branchId}`);
}

export async function deleteStaff(staffId) {
  const existing = await getStaff(staffId);
  if (!existing) throw new Error('Staff not found');
  await deleteDoc(doc(db, 'staff', staffId));
  cacheRemove(`staff_branch_${existing.branchId}`);
}

export async function getStaffAvailability(staffId, forceRefresh = false) {
  const cacheKey = `staff_avail_${staffId}`;
  if (!forceRefresh) {
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
  }
  const snap = await getDocs(collection(db, 'staff', staffId, 'availability'));
  const result = {};
  snap.forEach(d => { result[d.id] = d.data(); });
  cacheSet(cacheKey, result, STAFF_CACHE_TTL);
  return result;
}

export async function updateStaffAvailability(staffId, dayOfWeek, data) {
  await setDoc(doc(db, 'staff', staffId, 'availability', dayOfWeek), data);
  cacheRemove(`staff_avail_${staffId}`);
}

export async function getStaffHolidays(staffId, date) {
  const cacheKey = `staff_holidays_${staffId}_${date}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const snap = await getDocs(
    query(collection(db, 'staff', staffId, 'holidays'), where('date', '==', date))
  );
  const holidays = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cacheSet(cacheKey, holidays, STAFF_CACHE_TTL);
  return holidays;
}

export async function addStaffHoliday(staffId, data) {
  const ref = await addDoc(collection(db, 'staff', staffId, 'holidays'), data);
  cacheRemove(`staff_holidays_${staffId}_${data.date}`);
  return ref.id;
}

export async function removeStaffHoliday(staffId, holidayId, date) {
  await deleteDoc(doc(db, 'staff', staffId, 'holidays', holidayId));
  cacheRemove(`staff_holidays_${staffId}_${date}`);
}

export async function getServicesForStaff(staffId) {
  const staff = await getStaff(staffId);
  if (!staff) return [];
  return staff.serviceIds || [];
}
