// Firebase Authentication Module
// Maneja todas las operaciones de autenticación con Firebase

class FirebaseAuth {
  constructor() {
    this.auth = null;
    this.initialized = false;
    this.LOGOUT_BLOCK_MS = 60000; // bloquear re-login durante 60s tras logout
    this._signingOut = false;
  }

  // Inicializar Firebase
  async init() {
    if (this.initialized) return true;

    try {
      // Verificar que Firebase esté cargado
      if (!window.firebase) {
        return false;
      }

      // Always use the custom domain as authDomain so the Firebase auth iframe
      // is loaded from the same origin as the app (byfinanzapp.com), preventing
      // cross-origin iframe blocking by modern browsers (Safari ITP, Chrome ETP).
      const defaultAuthDomain = "byfinanzapp.com";

      const defaultConfig = {
        apiKey: "YOUR_FIREBASE_API_KEY",
        authDomain: defaultAuthDomain,
        projectId: "finanzapp-fb",
        storageBucket: "finanzapp-fb.firebasestorage.app",
        messagingSenderId: "YOUR_PROJECT_NUMBER",
        appId: "YOUR_APP_ID",
        measurementId: "YOUR_MEASUREMENT_ID"
      };
      const rawConfig = (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey) 
        ? window.FIREBASE_CONFIG 
        : (window.APP_CONFIG?.firebaseConfig || defaultConfig);
      
      const config = { ...rawConfig };

      // Sincronizar authDomain con el entorno actual:
      // En localhost/127.0.0.1, usar el authDomain canónico de Firebase (finanzapp-fb.firebaseapp.com)
      // En producción, usar el dominio personalizado o el host actual
      if (typeof window !== 'undefined' && window.location && window.location.hostname) {
        const currentHost = window.location.hostname;
        if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
          config.authDomain = `${config.projectId || 'finanzapp-fb'}.firebaseapp.com`;
        } else if (currentHost.includes('web.app') || currentHost.includes('firebaseapp.com') || currentHost === config.authDomain) {
          config.authDomain = currentHost;
        }
      }
      
      if (!config || !config.apiKey) {
        return false;
      }

      // Inicializar Firebase
      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }

      // Inicializar App Check (si está habilitado en config).
      // Soporta reCAPTCHA v2/v3 y Enterprise sin bloquear autenticación si falla.
      try {
        const isLocalhost = typeof window !== 'undefined' && 
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

        if (isLocalhost) {
          self.FIREBASE_APPCHECK_DEBUG_TOKEN = 'e8c5d9a1-7b2f-4c3e-9a1d-8f5b4c3e2a1d';
        }

        const appCheckEnabled = window.APP_CONFIG?.appCheckEnabled === true;
        const siteKey = window.APP_CONFIG?.recaptchaSiteKey;
        if (appCheckEnabled && siteKey && firebase.appCheck) {
          let appCheckProvider = null;
          if (isLocalhost) {
            appCheckProvider = new firebase.appCheck.CustomProvider({
              getToken: () => Promise.resolve({ token: 'e8c5d9a1-7b2f-4c3e-9a1d-8f5b4c3e2a1d', expireTimeMillis: Date.now() + 3600000 })
            });
          } else if (firebase.appCheck.ReCaptchaEnterpriseProvider) {
            appCheckProvider = new firebase.appCheck.ReCaptchaEnterpriseProvider(siteKey);
          } else if (firebase.appCheck.ReCaptchaV3Provider) {
            appCheckProvider = new firebase.appCheck.ReCaptchaV3Provider(siteKey);
          }
          if (appCheckProvider) {
            firebase.appCheck().activate(appCheckProvider, true);
          }

          try {
            await firebase.appCheck().getToken();
          } catch (tokenErr) {
            // Silencioso en desarrollo/producción
          }
        }
      } catch (e) {
        // Silencioso
      }


      this.auth = firebase.auth();
      this.initialized = true;

      // Configurar el idioma en español
      this.auth.languageCode = 'es';

      // Listener para cambios en el estado de autenticación
      this.auth.onAuthStateChanged(async (user) => {
        try {
          const logoutTimestamp = localStorage.getItem('logoutTimestamp');
          const now = Date.now();
          const recentLogout = logoutTimestamp && (now - parseInt(logoutTimestamp)) < this.LOGOUT_BLOCK_MS;

          if (user) {
            if (recentLogout) {
              // Si hubo un logout reciente, forzar signOut para evitar re-login automático
              if (!this._signingOut) {
                try {
                  this._signingOut = true;
                  await this.auth.signOut();
                } catch (e) {}
                this._signingOut = false;
              }
              return;
            }
            // Usuario válido y no hay logout reciente: guardar sesión
            this.saveUserSession(user);
            // NOTA: NO redirigir aquí. Login.js se encarga de la redirección con un
            // delay de 1s para que Firebase pueda persistir el token en IndexedDB
            // antes de que el Dashboard intente leerlo.
          } else {
            // No hay usuario: limpiar datos de sesión
            localStorage.removeItem('loggedIn');
            localStorage.removeItem('authUser');
          }

          // Limpiar el timestamp de logout una vez expirado
          if (logoutTimestamp && (now - parseInt(logoutTimestamp)) >= this.LOGOUT_BLOCK_MS) {
            localStorage.removeItem('logoutTimestamp');
          }
        } catch (err) {
          // Ignorar errores internos
        }
      });

      // Escuchar cambios de logoutTimestamp en otras pestañas para sincronizar logout
      window.addEventListener('storage', (e) => {
        try {
          if (e.key === 'logoutTimestamp' && e.newValue) {
            localStorage.removeItem('loggedIn');
            localStorage.removeItem('authUser');
            try { this.auth?.signOut(); } catch (e) {}
          }
        } catch (err) {}
      });

      // Procesar resultado de signInWithRedirect (si la app volvió desde un redirect OAuth)
      try {
        const redirectResult = await this.auth.getRedirectResult();
        if (redirectResult && redirectResult.user) {
          localStorage.removeItem('logoutTimestamp');
          this.saveUserSession(redirectResult.user);
          console.log('[FirebaseAuth] Sesión restaurada desde redirect:', redirectResult.user.email);
          const targetUrl = window.location.pathname.includes('/pages/') 
            ? '../Categorias/Categorias.html' 
            : './pages/Categorias/Categorias.html';
          window.location.replace(targetUrl);
          return true;
        }
      } catch (err) {
        console.error('[FirebaseAuth] Error al procesar redirect result:', err?.code, err?.message || err);
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // Guardar sesión del usuario
  saveUserSession(user) {
    const profile = {
      provider: user.providerData[0]?.providerId || 'email',
      uid: user.uid,
      name: user.displayName || user.email?.split('@')[0] || 'Usuario',
      email: user.email || '',
      picture: user.photoURL || '',
      emailVerified: user.emailVerified
    };

    localStorage.setItem('loggedIn', '1');
    localStorage.setItem('authUser', JSON.stringify(profile));
  }

  // Registro con email y contraseña
  async registerWithEmail(email, password, name) {
    try {
      if (!this.initialized) {
        await this.init();
      }

      if (!this.auth) {
        throw new Error('Firebase Auth no está inicializado');
      }

      // Crear usuario
      const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
      
      // Actualizar perfil con el nombre
      if (name) {
        await userCredential.user.updateProfile({
          displayName: name
        });
      }

      // Enviar email de verificación y cerrar sesión hasta que verifique
      await userCredential.user.sendEmailVerification();
      await this.auth.signOut();

      return {
        success: true,
        requiresVerification: true,
        message: '¡Cuenta creada con éxito! Revisa tu bandeja de entrada o la carpeta de SPAM / Correo no deseado y haz clic en el enlace de verificación para activar tu cuenta.'
      };
    } catch (error) {
      return this.handleAuthError(error);
    }
  }

  // Login con email y contraseña
  async loginWithEmail(email, password, rememberMe = true) {
    try {
      if (!this.initialized) {
        await this.init();
      }

      if (!this.auth) {
        throw new Error('Firebase Auth no está inicializado');
      }

      // Persistencia: LOCAL = sobrevive al cerrar el navegador, SESSION = solo pestaña activa
      const persistence = rememberMe
        ? firebase.auth.Auth.Persistence.LOCAL
        : firebase.auth.Auth.Persistence.SESSION;
      await this.auth.setPersistence(persistence);

      const userCredential = await this.auth.signInWithEmailAndPassword(email, password);

      // Bloquear acceso si el correo no ha sido verificado
      if (!userCredential.user.emailVerified) {
        await this.auth.signOut();
        return {
          success: false,
          error: 'auth/email-not-verified',
          message: 'Debes verificar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada o la carpeta de SPAM / Correo no deseado.',
          canResend: true,
          email: email,
          password: password
        };
      }


      this.saveUserSession(userCredential.user);

      return {
        success: true,
        user: userCredential.user,
        message: 'Inicio de sesión exitoso'
      };
    } catch (error) {
      return this.handleAuthError(error);
    }
  }

  // Iniciar sesión con Google directa y rápida
  async loginWithGoogle() {
    try {
      if (!this.initialized) {
        await this.init();
      }

      if (!this.auth) {
        throw new Error('Firebase Auth no está inicializado');
      }

      localStorage.removeItem('logoutTimestamp');

      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      // Detectar navegadores que bloquean cookies de terceros o popups en cross-origin (Firefox, Zen Browser, Safari, Móviles)
      const isPrivacyBrowserOrMobile = /Android|iPhone|iPad|iPod|Mobile|Firefox|FxiOS|Zen/i.test(navigator.userAgent);
      if (isPrivacyBrowserOrMobile) {
        try {
          console.info('[FirebaseAuth] Navegador Firefox/Zen o móvil detectado, usando signInWithRedirect...');
          await this.auth.signInWithRedirect(provider);
          return { success: true, redirect: true, message: 'Redirigiendo para iniciar sesión con Google' };
        } catch (redirErr) {
          console.warn('[FirebaseAuth] signInWithRedirect directo falló, intentando popup:', redirErr);
        }
      }

      try {
        const userCredential = await this.auth.signInWithPopup(provider);
        localStorage.removeItem('logoutTimestamp');
        this.saveUserSession(userCredential.user);
        return {
          success: true,
          user: userCredential.user,
          message: 'Inicio de sesión exitoso con Google'
        };
      } catch (popupError) {
        const code = popupError && popupError.code ? popupError.code : '';
        
        // Si el popup falló por bloqueo, aislamiento de cookies o error de conexión en el popup, usar redirección como fallback
        if (code === 'auth/popup-blocked' || 
            code === 'auth/internal-error' || 
            code === 'auth/network-request-failed' ||
            code === 'auth/popup-closed-by-user' ||
            isPrivacyBrowserOrMobile) {
          console.warn('[FirebaseAuth] Popup falló o fue bloqueado (' + code + '), iniciando fallback con signInWithRedirect...');
          try {
            await this.auth.signInWithRedirect(provider);
            return { success: true, redirect: true, message: 'Redirigiendo para iniciar sesión con Google' };
          } catch (redirectError) {
            console.error('[FirebaseAuth] signInWithRedirect falló (' + redirectError.code + '):', redirectError.message);
            return this.handleAuthError(redirectError);
          }
        }

        if (code === 'auth/cancelled-popup-request' || code === 'auth/user-cancelled') {
          return {
            success: false,
            cancelled: true,
            error: code,
            message: 'Inicio de sesión cancelado'
          };
        }

        console.error('[FirebaseAuth] Error en signInWithPopup:', popupError);
        return this.handleAuthError(popupError);
      }

    } catch (error) {
      console.error('Error en loginWithGoogle:', error);
      return this.handleAuthError(error);
    }
  }

  // Cerrar sesión
  async logout() {
    try {
      // Registrar el timestamp del logout en localStorage (permite notificar otras pestañas)
      const ts = Date.now().toString();
      localStorage.setItem('logoutTimestamp', ts);

      // Intentar cerrar sesión en Firebase
      if (this.auth) {
        try {
          this._signingOut = true;
          await this.auth.signOut();
        } catch (e) {}
        this._signingOut = false;
      }

      // Limpiar datos de sesión del cliente (pero mantener logoutTimestamp)
      localStorage.removeItem('loggedIn');
      localStorage.removeItem('authUser');
      localStorage.removeItem('finanzapp:gmail:pending_notifications');
      localStorage.removeItem('finanzapp:gmail:notifications');
      localStorage.removeItem('finanzapp:categories');
      localStorage.removeItem('finanzapp:transactions');
      localStorage.removeItem('finanzapp:budgets');

      return { success: true };
    } catch (error) {
      return { success: false, message: 'Error al cerrar sesión' };
    }
  }

  // Reenviar correo de verificación
  async resendVerificationEmail(email, password) {
    try {
      if (!this.initialized) await this.init();
      if (!this.auth) throw new Error('Firebase Auth no está inicializado');

      // Iniciar sesión temporalmente para poder enviar el correo
      const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
      await userCredential.user.sendEmailVerification();
      await this.auth.signOut();

      return { success: true };
    } catch (error) {
      return this.handleAuthError(error);
    }
  }

  // Restablecer contraseña
  async resetPassword(email) {
    try {
      if (!this.initialized) {
        await this.init();
      }

      if (!this.auth) {
        throw new Error('Firebase Auth no está inicializado');
      }

      await this.auth.sendPasswordResetEmail(email);

      return {
        success: true,
        message: '¡Correo enviado! Revisa tu bandeja de entrada y también la carpeta de spam.'
      };
    } catch (error) {
      // auth/user-not-found se lanza cuando "Email enumeration protection" está desactivada
      // en Firebase Console → Authentication → Settings → User actions.
      if (error.code === 'auth/user-not-found') {
        return {
          success: false,
          error: 'auth/user-not-found',
          message: 'No existe ninguna cuenta registrada con este correo electrónico.'
        };
      }
      return this.handleAuthError(error);
    }
  }

  // Obtener usuario actual
  getCurrentUser() {
    return this.auth?.currentUser || null;
  }

  // Verificar si el usuario está autenticado
  isAuthenticated() {
    return !!this.auth?.currentUser;
  }

  // Inicializar verificador reCAPTCHA v2 (para verificación de formularios o teléfono)
  initRecaptchaV2(containerId = 'recaptcha-container', options = {}) {
    if (!this.auth || !window.firebase?.auth?.RecaptchaVerifier) return null;
    const siteKey = window.APP_CONFIG?.recaptchaSiteKey;
    try {
      return new firebase.auth.RecaptchaVerifier(containerId, {
        size: options.size || 'normal', // 'normal' para casilla v2, 'invisible' para v2 invisible
        sitekey: siteKey,
        callback: options.callback,
        'expired-callback': options.expiredCallback
      });
    } catch (e) {
      console.warn('[FirebaseAuth] Error al inicializar RecaptchaVerifier v2:', e?.message || e);
      return null;
    }
  }

  // Manejar errores de autenticación
  handleAuthError(error) {
    const errorMessages = {
      'auth/email-already-in-use': 'Este correo electrónico ya está registrado',
      'auth/invalid-email': 'El correo electrónico no es válido',
      'auth/operation-not-allowed': 'Esta operación no está permitida',
      'auth/weak-password': 'La contraseña debe tener al menos 8 caracteres y contener al menos 2 números',
      'auth/user-disabled': 'Esta cuenta ha sido deshabilitada',
      'auth/user-not-found': 'Correo o contraseña incorrectos',
      'auth/wrong-password': 'Correo o contraseña incorrectos',
      'auth/invalid-credential': 'Correo o contraseña incorrectos',
      'auth/too-many-requests': 'Demasiados intentos fallidos. Intenta más tarde',
      'auth/network-request-failed': 'Error de conexión. Verifica tu internet',
      'auth/unauthorized-domain': 'Este dominio o IP no está autorizado en Firebase Console. Usa http://localhost:... en lugar de http://127.0.0.1:... o añade tu dominio/IP en Firebase Console > Authentication > Ajustes > Dominios autorizados.',
      'auth/popup-closed-by-user': 'Inicio de sesión cancelado',
      'auth/cancelled-popup-request': 'Operación cancelada',
      'auth/popup-blocked': 'El navegador bloqueó la ventana emergente',
      'auth/internal-error': 'Error interno de autenticación. Verifica que el inicio de sesión con Google esté habilitado en Firebase Console, que el dominio esté autorizado y que no estés en modo privado o bloqueando cookies de terceros.'
    };

    const message = errorMessages[error.code] || error.message || 'Error desconocido';

    return {
      success: false,
      error: error.code,
      message: message
    };
  }
}

// Crear instancia global
window.firebaseAuth = new FirebaseAuth();
