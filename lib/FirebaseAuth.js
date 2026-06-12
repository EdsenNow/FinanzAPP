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

      // Obtener configuración
      const config = window.FIREBASE_CONFIG || window.APP_CONFIG?.firebaseConfig;
      
      if (!config || !config.apiKey) {
        return false;
      }

      // Inicializar Firebase
      if (!firebase.apps.length) {
        firebase.initializeApp(config);
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
          this.saveUserSession(redirectResult.user);
        }
      } catch (err) {
        // ignora errores de redirect
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
        message: 'Cuenta creada. Revisa tu correo y haz clic en el enlace de verificación para poder iniciar sesión.'
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
          message: 'Debes verificar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.',
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

  // Login con Google
  async loginWithGoogle() {
    try {
      if (!this.initialized) {
        await this.init();
      }

      if (!this.auth) {
        throw new Error('Firebase Auth no está inicializado');
      }

      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      // Intentar popup primero; si falla por políticas de navegador, hacer redirect
      try {
        // Si el usuario inicia manualmente el login, permitirlo removiendo
        // cualquier marca de logout reciente que bloquee el re-login automático.
        localStorage.removeItem('logoutTimestamp');
        await this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        const result = await this.auth.signInWithPopup(provider);
        if (result && result.user) {
          this.saveUserSession(result.user);
          return { success: true, user: result.user, message: 'Inicio de sesión con Google exitoso' };
        }
      } catch (popupError) {
        const popupErrorCodes = ['auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/operation-not-allowed', 'auth/web-storage-unsupported'];
        if (popupError && popupError.code && popupErrorCodes.includes(popupError.code)) {
          try {
            await this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            await this.auth.signInWithRedirect(provider);
            // La llamada redirigirá la página; devolver indicación para que el llamador la maneje
            return { success: true, redirect: true, message: 'Redirigiendo para iniciar sesión con Google' };
          } catch (redirErr) {
            return this.handleAuthError(redirErr);
          }
        }
        return this.handleAuthError(popupError);
      }

      return { success: false, message: 'No se completó el inicio de sesión con Google' };
    } catch (error) {
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
      'auth/popup-closed-by-user': 'Inicio de sesión cancelado',
      'auth/cancelled-popup-request': 'Operación cancelada',
      'auth/popup-blocked': 'El navegador bloqueó la ventana emergente'
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
