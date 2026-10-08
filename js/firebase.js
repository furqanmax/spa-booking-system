import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getFirestore, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getAuth, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';

const firebaseConfig = {
    apiKey: "AIzaSyCYw3U2bseN8T54bLXTzveWgu-t6EPmzow",
  authDomain: "inc-exp-55072.firebaseapp.com",
  projectId: "inc-exp-55072",
  storageBucket: "inc-exp-55072.firebasestorage.app",
  messagingSenderId: "958021409545",
  appId: "1:958021409545:web:79b86666cce9705db491d8",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

const PERSISTENCE_KEY = 'firebase_persistence_enabled';

async function initPersistence() {
  if (sessionStorage.getItem(PERSISTENCE_KEY)) return;
  try {
    await enableIndexedDbPersistence(db, { cacheSizeBytes: CACHE_SIZE_UNLIMITED });
    sessionStorage.setItem(PERSISTENCE_KEY, 'true');
  } catch (err) {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore persistence: multiple tabs open, falling back to online-only');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore persistence not supported in this browser');
    }
  }
}

initPersistence();
