import { create } from 'zustand';
import { 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signOut, 
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';

function isMobileOrRestrictedBrowser() {
  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod|android|mobile|firefox/.test(ua);
}

export const useAuthStore = create((set, get) => ({
  user: null,
  isGuest: false,
  loading: true,
  authError: null,

  initAuth: () => {
    // Check for existing guest session in localStorage
    const savedGuest = localStorage.getItem('isGuest') === 'true';
    if (savedGuest) {
      set({
        isGuest: true,
        user: { uid: 'guest_user', displayName: 'Invitado', email: 'invitado@byfinanzapp.com', isAnonymous: true },
        loading: false
      });
    }

    // Process redirect result if applicable
    getRedirectResult(auth)
      .then((result) => {
        if (result && result.user) {
          set({ user: result.user, isGuest: false, loading: false });
          localStorage.removeItem('isGuest');
        }
      })
      .catch((err) => {
        console.warn('Redirect result error:', err);
      });

    // Listen to auth state
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        set({ user: firebaseUser, isGuest: false, loading: false });
        localStorage.removeItem('isGuest');
      } else if (!get().isGuest) {
        set({ user: null, isGuest: false, loading: false });
      }
    });

    return unsubscribe;
  },

  signInWithGoogle: async () => {
    set({ loading: true, authError: null });
    try {
      if (isMobileOrRestrictedBrowser()) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      const res = await signInWithPopup(auth, googleProvider);
      set({ user: res.user, isGuest: false, loading: false });
      localStorage.removeItem('isGuest');
      return res.user;
    } catch (err) {
      console.warn('Popup failed, falling back to redirect:', err);
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectErr) {
        set({ authError: redirectErr.message, loading: false });
        throw redirectErr;
      }
    }
  },

  signInWithEmail: async (email, password) => {
    set({ loading: true, authError: null });
    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      set({ user: res.user, isGuest: false, loading: false });
      localStorage.removeItem('isGuest');
      return res.user;
    } catch (err) {
      set({ authError: err.message, loading: false });
      throw err;
    }
  },

  signUpWithEmail: async (email, password, displayName) => {
    set({ loading: true, authError: null });
    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(res.user, { displayName });
      }
      set({ user: res.user, isGuest: false, loading: false });
      localStorage.removeItem('isGuest');
      return res.user;
    } catch (err) {
      set({ authError: err.message, loading: false });
      throw err;
    }
  },

  sendPasswordReset: async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      set({ authError: err.message });
      throw err;
    }
  },

  loginAsGuest: () => {
    const guestUser = { uid: 'guest_user', displayName: 'Invitado', email: 'invitado@byfinanzapp.com', isAnonymous: true };
    localStorage.setItem('isGuest', 'true');
    set({ user: guestUser, isGuest: true, loading: false });
  },

  logout: async () => {
    set({ loading: true });
    try {
      localStorage.removeItem('isGuest');
      await signOut(auth);
      set({ user: null, isGuest: false, loading: false });
    } catch (err) {
      set({ authError: err.message, loading: false });
    }
  }
}));
