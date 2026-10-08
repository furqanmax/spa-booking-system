import { auth, db } from './firebase.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { cacheGet, cacheSet, cacheRemove } from './cache.js';

const USER_CACHE_KEY = 'current_user';
const STAFF_CACHE_KEY = 'current_staff';

let currentUser = null;
let currentStaff = null;
let authListeners = [];

export async function initAuth() {
  return new Promise((resolve) => {
    const cached = cacheGet(USER_CACHE_KEY);
    if (cached) {
      currentUser = cached;
    }
    const cachedStaff = cacheGet(STAFF_CACHE_KEY);
    if (cachedStaff) {
      currentStaff = cachedStaff;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            currentUser = { uid: firebaseUser.uid, ...userDoc.data() };
            cacheSet(USER_CACHE_KEY, currentUser, 300000);
          } else {
            currentUser = { uid: firebaseUser.uid, email: firebaseUser.email, role: 'user' };
          }
          const staffDoc = await getDoc(doc(db, 'staff', firebaseUser.uid));
          if (staffDoc.exists()) {
            currentStaff = { id: staffDoc.id, ...staffDoc.data() };
            cacheSet(STAFF_CACHE_KEY, currentStaff, 300000);
          } else {
            currentStaff = null;
            cacheRemove(STAFF_CACHE_KEY);
          }
        } catch (err) {
          console.error('Error loading user data:', err);
        }
      } else {
        currentUser = null;
        currentStaff = null;
        cacheRemove(USER_CACHE_KEY);
        cacheRemove(STAFF_CACHE_KEY);
      }
      for (const listener of authListeners) {
        try { listener(currentUser); } catch (e) { console.error('Auth listener error:', e); }
      }
      resolve(currentUser);
    });
  });
}

export function onAuthChange(callback) {
  authListeners.push(callback);
  if (currentUser) {
    setTimeout(() => callback(currentUser), 0);
  }
  return () => {
    authListeners = authListeners.filter(l => l !== callback);
  };
}

export function getUser() {
  return currentUser;
}

export function getStaff() {
  return currentStaff;
}

export async function refreshUser() {
  if (!auth.currentUser) return null;
  try {
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (userDoc.exists()) {
      currentUser = { uid: auth.currentUser.uid, ...userDoc.data() };
      cacheSet(USER_CACHE_KEY, currentUser, 300000);
    }
    const staffDoc = await getDoc(doc(db, 'staff', auth.currentUser.uid));
    if (staffDoc.exists()) {
      currentStaff = { id: staffDoc.id, ...staffDoc.data() };
      cacheSet(STAFF_CACHE_KEY, currentStaff, 300000);
    } else {
      currentStaff = null;
      cacheRemove(STAFF_CACHE_KEY);
    }
  } catch (err) {
    console.error('Error refreshing user:', err);
  }
  return currentUser;
}

export function hasRole(...roles) {
  if (!currentUser) return false;
  return roles.includes(currentUser.role);
}

export function hasStaffRole(...roles) {
  if (!currentStaff) return false;
  return roles.includes(currentStaff.role);
}

export function getEffectiveRole() {
  if (!currentUser) return null;
  if (currentUser.role === 'superadmin' || currentUser.role === 'admin') return currentUser.role;
  if (currentStaff) return currentStaff.role;
  return 'user';
}

export function isManagerOrAbove(branchId) {
  if (!currentUser) return false;
  if (currentUser.role === 'superadmin' || currentUser.role === 'admin') return true;
  if (!currentStaff) return false;
  if (currentStaff.role === 'manager' && currentStaff.branchId === branchId) return true;
  return false;
}

export function isStaffOfBranch(branchId) {
  if (!currentStaff) return false;
  return currentStaff.branchId === branchId;
}

export function requireAuth(role) {
  if (!currentUser) {
    const returnUrl = window.location.pathname + window.location.hash;
    window.location.href = `login.html?returnUrl=${encodeURIComponent(returnUrl)}`;
    return false;
  }
  if (role && currentUser.role !== role) {
    if (!currentStaff || currentStaff.role !== role) {
      window.location.href = 'login.html?error=unauthorized';
      return false;
    }
  }
  return true;
}

export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function registerUser(email, password, userData = {}) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, 'users', cred.user.uid), {
    uid: cred.user.uid,
    email,
    name: userData.name || email.split('@')[0],
    phone: userData.phone || '',
    role: 'user',
    createdAt: serverTimestamp()
  });
  return cred.user;
}

export async function logoutUser() {
  await signOut(auth);
  currentUser = null;
  currentStaff = null;
  cacheRemove(USER_CACHE_KEY);
  cacheRemove(STAFF_CACHE_KEY);
}

export function getStaffRole() {
  return currentStaff?.role || null;
}

export function getCurrentBranchId() {
  return currentStaff?.branchId || null;
}
