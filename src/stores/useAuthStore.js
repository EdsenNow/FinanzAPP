import { create } from 'zustand';
import { 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  signInWithCredential,
  GoogleAuthProvider,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signOut, 
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';

const GOOGLE_CLIENT_ID = "569331846575-djonqen9ib9jrek93o0hpjem189ppjsm.apps.googleusercontent.com";

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
        console.warn('Redirect result notice:', err);
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

  signInWithGoogleCredential: async (idToken) => {
    set({ loading: true, authError: null });
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const res = await signInWithCredential(auth, credential);
      set({ user: res.user, isGuest: false, loading: false });
      localStorage.removeItem('isGuest');
      return res.user;
    } catch (err) {
      set({ authError: err.message, loading: false });
      throw err;
    }
  },

  signInWithGoogle: async () => {
    set({ loading: true, authError: null });

    // Approach 1: Try direct Google Identity Services Token Client (immune to iframe / domain CORS blocks)
    if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
      try {
        const user = await new Promise((resolve, reject) => {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: "email profile openid",
            callback: async (tokenResponse) => {
              if (tokenResponse.error) {
                reject(tokenResponse);
                return;
              }
              try {
                const credential = GoogleAuthProvider.credential(null, tokenResponse.access_token);
                const res = await signInWithCredential(auth, credential);
                set({ user: res.user, isGuest: false, loading: false });
                localStorage.removeItem('isGuest');
                resolve(res.user);
              } catch (e) {
                reject(e);
              }
            },
            error_callback: (err) => reject(err)
          });
          client.requestAccessToken({ prompt: 'select_account' });
        });
        return user;
      } catch (gisErr) {
        console.warn('GIS Token client fallback to Firebase popup:', gisErr);
      }
    }

    // Approach 2: Standard Firebase popup
    try {
      const res = await signInWithPopup(auth, googleProvider);
      set({ user: res.user, isGuest: false, loading: false });
      localStorage.removeItem('isGuest');
      return res.user;
    } catch (err) {
      console.warn('Popup fallback notice:', err);
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          set({ authError: redirectErr.message, loading: false });
          throw redirectErr;
        }
      }
      set({ authError: err.message, loading: false });
      throw err;
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
