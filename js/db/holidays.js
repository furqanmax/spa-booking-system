import { db } from '../firebase.js';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { cacheGet, cacheSet, cacheRemove, invalidateBranch } from '../cache.js';

const HOLIDAYS_CACHE_TTL = 3600000;

export async function getBranchHolidays(branchId, forceRefresh = false) {
  const cacheKey = `holidays_branch_${branchId}`;
  if (!forceRefresh) {
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
  }
  const snap = await getDocs(
    query(collection(db, 'holidays'), where('branchId', '==', branchId))
  );
  const holidays = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cacheSet(cacheKey, holidays, HOLIDAYS_CACHE_TTL);
  return holidays;
}

export async function getHolidayForDate(branchId, date) {
  const holidays = await getBranchHolidays(branchId);
  return holidays.filter(h => {
    if (h.date === date) return true;
    if (h.isRecurring) {
      const monthDay = date.slice(5);
      const holidayMonthDay = h.date.slice(5);
      return monthDay === holidayMonthDay;
    }
    return false;
  });
}

export async function isBranchHoliday(branchId, date) {
  const holidays = await getHolidayForDate(branchId, date);
  return holidays.some(h => h.affectsAllStaff !== false || h.branchId === branchId);
}

export async function createHoliday(data) {
  const ref = await addDoc(collection(db, 'holidays'), {
    ...data,
    createdAt: serverTimestamp()
  });
  cacheRemove(`holidays_branch_${data.branchId}`);
  invalidateBranch(data.branchId);
  return ref.id;
}

export async function updateHoliday(holidayId, data) {
  await updateDoc(doc(db, 'holidays', holidayId), data);
  if (data.branchId) {
    cacheRemove(`holidays_branch_${data.branchId}`);
  }
}

export async function deleteHoliday(holidayId, branchId) {
  await deleteDoc(doc(db, 'holidays', holidayId));
  cacheRemove(`holidays_branch_${branchId}`);
}
