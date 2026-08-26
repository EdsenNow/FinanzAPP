import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  initializeAuth, 
  browserLocalPersistence, 
  browserPopupRedirectResolver, 
  GoogleAuthProvider 
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider, CustomProvider } from 'firebase/app-check';

const isLocalhost = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '0.0.0.0'
);

const firebaseConfig = {
  apiKey: "AIzaSyCrOwLwoJlXyMloxNoaq13J3fvRFJcQcjg",
  authDomain: "byfinanzapp.com",
  projectId: "finanzapp-fb",
  storageBucket: "finanzapp-fb.firebasestorage.app",
  messagingSenderId: "569331846575",
  appId: "1:569331846575:web:705bef3d333be927a9735a",
  measurementId: "G-C6PQHRTNXJ"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
auth.languageCode = 'es';
export const db = getFirestore(app);

const DEBUG_APP_CHECK_TOKEN = "e8c5d9a1-7b2f-4c3e-9a1d-8f5b4c3e2a1d";

if (typeof window !== 'undefined') {
  if (isLocalhost) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = DEBUG_APP_CHECK_TOKEN;
  }
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider("6Lc0XnItAAAAAPBtdMopqdHuT3U5Q2Td8Bx5SErI"),
      isTokenAutoRefreshEnabled: true
    });
  } catch (err) {
    console.warn('App Check initialization notice:', err);
  }
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const APP_CONFIG = window.APP_CONFIG || {
  googleClientId: "569331846575-djonqen9ib9jrek93o0hpjem189ppjsm.apps.googleusercontent.com",
  gmailClientId: "569331846575-djonqen9ib9jrek93o0hpjem189ppjsm.apps.googleusercontent.com",
  gmailBackendUrl: "https://us-central1-finanzapp-fb.cloudfunctions.net/api",
  recaptchaSiteKey: "6Lc0XnItAAAAAPBtdMopqdHuT3U5Q2Td8Bx5SErI",
  appCheckEnabled: true
};

export default app;
