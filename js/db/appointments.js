import { db } from '../firebase.js';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, orderBy, limit, startAfter, serverTimestamp, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { cacheGet, cacheSet, cacheRemove } from '../cache.js';

const PAGE_SIZE = 20;

const appointmentConverter = {
  toFirestore: (data) => {
    const { id, ...rest } = data;
    return { ...rest, updatedAt: serverTimestamp() };
  },
  fromFirestore: (snap) => ({ id: snap.id, ...snap.data() })
};

export async function getAppointmentsByBranch(branchId, dateStart, dateEnd, lastDoc = null) {
  let q = query(
    collection(db, 'appointments'),
    where('branchId', '==', branchId),
    where('date', '>=', dateStart),
    where('date', '<=', dateEnd),
    orderBy('date'),
    orderBy('startTime'),
    limit(PAGE_SIZE)
  );
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }
  const snap = await getDocs(q.withConverter(appointmentConverter));
  return {
    appointments: snap.docs.map(d => d.data()),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === PAGE_SIZE
  };
}

export async function getAppointmentsByStaff(staffId, dateStart, dateEnd) {
  const q = query(
    collection(db, 'appointments'),
    where('staffId', '==', staffId),
    where('date', '>=', dateStart),
    where('date', '<=', dateEnd),
    orderBy('date'),
    orderBy('startTime')
  );
  const snap = await getDocs(q.withConverter(appointmentConverter));
  return snap.docs.map(d => d.data());
}

export async function getAppointmentsByCustomer(customerId, lastDoc = null) {
  let q = query(
    collection(db, 'appointments'),
    where('customerId', '==', customerId),
    orderBy('date', 'desc'),
    orderBy('startTime', 'desc'),
    limit(PAGE_SIZE)
  );
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }
  const snap = await getDocs(q.withConverter(appointmentConverter));
  return {
    appointments: snap.docs.map(d => d.data()),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === PAGE_SIZE
  };
}

export async function getAppointmentsForDate(branchId, date) {
  const q = query(
    collection(db, 'appointments'),
    where('branchId', '==', branchId),
    where('date', '==', date)
  );
  const snap = await getDocs(q.withConverter(appointmentConverter));
  return snap.docs.map(d => d.data());
}

export async function getAppointment(appointmentId) {
  const snap = await getDoc(doc(db, 'appointments', appointmentId).withConverter(appointmentConverter));
  if (!snap.exists()) return null;
  return snap.data();
}

export async function createAppointment(data) {
  const existing = await getAppointmentsForDate(data.branchId, data.date);
  const conflict = existing.find(apt =>
    apt.staffId === data.staffId &&
    apt.status !== 'cancelled' &&
    apt.startTime === data.startTime
  );
  const ref = await addDoc(collection(db, 'appointments'), {
    ...data,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return { id: ref.id, conflict: !!conflict };
}

export async function createAppointmentWithTransaction(data) {
  try {
    const result = await runTransaction(db, async (transaction) => {
      const appointmentsRef = collection(db, 'appointments');
      const q = query(
        appointmentsRef,
        where('branchId', '==', data.branchId),
        where('date', '==', data.date),
        where('staffId', '==', data.staffId),
        where('status', 'in', ['pending', 'confirmed'])
      );
      const snap = await transaction.get(q);
      const conflicting = snap.docs.filter(d => {
        const apt = d.data();
        return apt.startTime === data.startTime;
      });
      if (conflicting.length > 0) {
        return { success: false, conflict: true, message: 'Slot already booked' };
      }
      const newRef = doc(collection(db, 'appointments'));
      transaction.set(newRef, {
        ...data,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { success: true, id: newRef.id, conflict: false };
    });
    return result;
  } catch (err) {
    return { success: false, conflict: false, error: err.message };
  }
}

export async function updateAppointment(appointmentId, data) {
  await updateDoc(doc(db, 'appointments', appointmentId), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function cancelAppointment(appointmentId, reason, cancelledBy) {
  await updateDoc(doc(db, 'appointments', appointmentId), {
    status: 'cancelled',
    cancelledAt: serverTimestamp(),
    cancelledBy,
    cancellationReason: reason || null,
    updatedAt: serverTimestamp()
  });
}

export async function completeAppointment(appointmentId) {
  await updateDoc(doc(db, 'appointments', appointmentId), {
    status: 'completed',
    updatedAt: serverTimestamp()
  });
}

export async function noShowAppointment(appointmentId) {
  await updateDoc(doc(db, 'appointments', appointmentId), {
    status: 'no_show',
    updatedAt: serverTimestamp()
  });
}

export async function getAppointmentCount(branchId, date, status = null) {
  let q = query(
    collection(db, 'appointments'),
    where('branchId', '==', branchId),
    where('date', '==', date)
  );
  if (status) {
    q = query(q, where('status', '==', status));
  }
  const snap = await getDocs(q);
  return snap.size;
}

export async function getRecentAppointments(branchId, daysBack = 7) {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - daysBack);
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = today.toISOString().split('T')[0];
  return getAppointmentsByBranch(branchId, startStr, endStr);
}
