import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { firebaseConfig } from './firebase-config';

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const storage = getStorage(firebaseApp);

void setPersistence(auth, browserLocalPersistence).catch(() => {
  // Persistence is optional; storage restrictions must not prevent the app from rendering.
});
