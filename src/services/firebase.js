import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const firebaseConfig = {
  apiKey: "AIzaSyCrOwLwoJlXyMloxNoaq13J3fvRFJcQcjg",
  authDomain: isLocalhost ? "finanzapp-fb.firebaseapp.com" : (window.location?.hostname?.includes('byfinanzapp.com') ? "byfinanzapp.com" : "finanzapp-fb.firebaseapp.com"),
  projectId: "finanzapp-fb",
  storageBucket: "finanzapp-fb.firebasestorage.app",
  messagingSenderId: "569331846575",
  appId: "1:569331846575:web:705bef3d333be927a9735a",
  measurementId: "G-C6PQHRTNXJ"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
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
