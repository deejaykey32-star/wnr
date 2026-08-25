import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

let app: any = null;
let auth: any = null;
let db: any = null;
let googleProvider: any = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = (firebaseConfig as any).firestoreDatabaseId
    ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
    : getFirestore(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({
    prompt: 'select_account'
  });
} catch (err) {
  console.warn('[Firebase] Warning during initialization:', err);
}

export { app, auth, db, googleProvider };

// Standard login / logout utilities
export const loginWithGoogle = async () => {
  if (!auth || !googleProvider) {
    console.warn("Firebase Auth is not initialized.");
    return null;
  }
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Google Sign-In Error:", error);
    if (
      error?.code === 'auth/popup-blocked' ||
      error?.code === 'auth/cancelled-popup-request'
    ) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw error;
  }
};

// Call this on app load to handle redirect login result
export const handleRedirectLogin = async () => {
  if (!auth) return null;
  try {
    const result = await getRedirectResult(auth);
    return result?.user ?? null;
  } catch (error) {
    console.error("Redirect Sign-In Result Error:", error);
    return null;
  }
};

export const logout = async () => {
  if (!auth) return;
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Sign-Out Error:", error);
    throw error;
  }
};

export { onAuthStateChanged, getRedirectResult };
export type { User };
