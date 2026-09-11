(function() {
  'use strict';

  const loginScreen = document.getElementById('loginScreen');
  const emailLoginScreen = document.getElementById('emailLoginScreen');
  const emailRegisterScreen = document.getElementById('emailRegisterScreen');
  const forgotPasswordScreen = document.getElementById('forgotPasswordScreen');
  
  const showEmailLoginBtn = document.getElementById('showEmailLogin');
  const showRegisterLink = document.getElementById('showRegister');
  const showRegisterFromEmailLink = document.getElementById('showRegisterFromEmail');
  const showLoginLink = document.getElementById('showLogin');
  const showForgotPasswordLink = document.getElementById('showForgotPassword');
  const backFromLoginBtn = document.getElementById('backFromLogin');
  const backFromRegisterBtn = document.getElementById('backFromRegister');
  const backFromRecoveryBtn = document.getElementById('backFromRecovery');
  const loginAsGuestBtn = document.getElementById('loginAsGuest');
  
  const emailLoginButton = document.getElementById('emailLoginButton');
  const emailRegisterButton = document.getElementById('registerButton');
  const sendRecoveryEmailButton = document.getElementById('sendRecoveryEmailButton');
  const googleSignInBtn = document.getElementById('googleSignInBtn');

  function showScreen(screen) {
    [loginScreen, emailLoginScreen, emailRegisterScreen, forgotPasswordScreen].forEach(s => {
      if (s) s.classList.add('hidden');
    });
    if (screen) screen.classList.remove('hidden');
  }

  if (showEmailLoginBtn) {
    showEmailLoginBtn.addEventListener('click', () => showScreen(emailLoginScreen));
  }

  if (showRegisterLink) {
    showRegisterLink.addEventListener('click', (e) => {
      e.preventDefault();
      showScreen(emailRegisterScreen);
    });
  }

  if (showRegisterFromEmailLink) {
    showRegisterFromEmailLink.addEventListener('click', (e) => {
      e.preventDefault();
      showScreen(emailRegisterScreen);
    });
  }

  if (showLoginLink) {
    showLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      showScreen(emailLoginScreen);
    });
  }

  if (backFromLoginBtn) {
    backFromLoginBtn.addEventListener('click', () => showScreen(loginScreen));
  }

  if (backFromRegisterBtn) {
    backFromRegisterBtn.addEventListener('click', () => showScreen(loginScreen));
  }

  if (showForgotPasswordLink) {
    showForgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      // Pre-fill email if user already typed it
      const currentEmail = document.getElementById('email')?.value.trim();
      const recoveryEmailInput = document.getElementById('recoveryEmail');
      if (currentEmail && recoveryEmailInput) {
        recoveryEmailInput.value = currentEmail;
      }
      showScreen(forgotPasswordScreen);
    });
  }

  if (backFromRecoveryBtn) {
    backFromRecoveryBtn.addEventListener('click', () => showScreen(emailLoginScreen));
  }

  const DEFAULT_SETTINGS = {
    theme: 'dark',
    categoryViewMode: 'compact',
    currency: 'DOP',
    numberFormat: 'us',
    tooltips: 'on',
    shortcuts: 'on',
    dateFormat: 'dmy',
    confirmDelete: 'on',
    autoRenewBudgets: 'on',
    txPerPage: '10',
    showCents: 'off',
    censorAmounts: 'off'
  };

  function asegurarConfiguracionPorDefecto() {
    try {
      const existing = localStorage.getItem('finanzapp:settings:v1');
      if (!existing) {
        localStorage.setItem('finanzapp:settings:v1', JSON.stringify(DEFAULT_SETTINGS));
      }
      if (!localStorage.getItem('theme')) {
        localStorage.setItem('theme', 'dark');
      }
    } catch {}
  }

  if (loginAsGuestBtn) {
    loginAsGuestBtn.addEventListener('click', () => {
      asegurarConfiguracionPorDefecto();
      const guestProfile = {
        provider: 'guest',
        uid: 'guest',
        name: 'Invitado',
        email: '',
        picture: ''
      };
      localStorage.setItem('loggedIn', '1');
      localStorage.setItem('authUser', JSON.stringify(guestProfile));
      window.location.href = '../Categorias/Categorias.html';
    });
  }

  // --- Integración de Google Identity Services (GIS) ---
  const originalGoogleBtnContent = googleSignInBtn ? googleSignInBtn.innerHTML : '';
  let googleTokenClient = null;

  function showGoogleLoading(isLoading) {
    const gsiContainer = document.getElementById('gsiButtonContainer');
    if (isLoading) {
      if (googleSignInBtn) {
        googleSignInBtn.disabled = true;
        googleSignInBtn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin"></i> Iniciando sesión con Google...';
        window.LucideHelper?.refresh(googleSignInBtn);
      }
      if (gsiContainer) gsiContainer.style.pointerEvents = 'none';
    } else {
      if (googleSignInBtn) {
        googleSignInBtn.disabled = false;
        googleSignInBtn.innerHTML = originalGoogleBtnContent;
        window.LucideHelper?.refresh(googleSignInBtn);
      }
      if (gsiContainer) gsiContainer.style.pointerEvents = 'auto';
    }
  }

  async function processSuccessfulLogin(result) {
    asegurarConfiguracionPorDefecto();

    try {
      if (result.user && window.firebaseAuth && window.firebaseAuth.saveUserSession) {
        window.firebaseAuth.saveUserSession(result.user);
      }
    } catch (e) {}

    (async () => {
      try {
        if (window.FirestoreDB && result.user) {
          await window.FirestoreDB.init();
          window.FirestoreDB.setCurrentUser(result.user.uid);
          const userData = await window.FirestoreDB.loadAllUserData();
          if ((!userData || (!userData.transactions || userData.transactions.length === 0)) 
              && localStorage.getItem('transactions')) {
            await window.FirestoreDB.migrateFromLocalStorage();
          }
        }
      } catch (firestoreError) {
        console.warn('Firestore sync after GIS login failed:', firestoreError);
      }
    })();

    setTimeout(() => {
      window.location.replace('/pages/Categorias/Categorias.html');
    }, 300);
  }

  async function handleGoogleCredential(credential) {
    if (!credential) return;
    showGoogleLoading(true);

    try {
      const result = await window.firebaseAuth.loginWithGoogleIdToken(credential);
      if (result && result.success) {
        await processSuccessfulLogin(result);
        return;
      }

      showGoogleLoading(false);
      const isCancelled = result?.cancelled || 
                          result?.error === 'auth/popup-closed-by-user' || 
                          result?.error === 'auth/cancelled-popup-request' ||
                          String(result?.rawError || '').includes('closed-by-user');

      if (!result || !result.success) {
        if (!isCancelled) {
          showAlert('Error al iniciar sesión', result?.message || 'No se pudo iniciar sesión con Google.', { variant: 'error' });
        }
      }
    } catch (err) {
      showGoogleLoading(false);
      console.error('[Login] Error procesando credencial de Google:', err);
      showAlert('Error', 'Ocurrió un error al procesar el inicio de sesión con Google.', { variant: 'error' });
    }
  }

  async function handleGoogleAccessToken(accessToken) {
    if (!accessToken) return;
    showGoogleLoading(true);

    try {
      const result = await window.firebaseAuth.loginWithGoogleAccessToken(accessToken);
      if (result && result.success) {
        await processSuccessfulLogin(result);
        return;
      }

      showGoogleLoading(false);
      if (result && result.message) {
        showAlert('Error al iniciar sesión', result.message, { variant: 'error' });
      }
    } catch (err) {
      showGoogleLoading(false);
      console.error('[Login] Error procesando access token de Google:', err);
      showAlert('Error', 'Ocurrió un error al procesar el inicio de sesión con Google.', { variant: 'error' });
    }
  }

  function initGoogleIdentityServices(retries = 0) {
    if (!window.google?.accounts) {
      if (retries < 25) {
        setTimeout(() => initGoogleIdentityServices(retries + 1), 150);
      } else {
        const gsiContainer = document.getElementById('gsiButtonContainer');
        if (googleSignInBtn) googleSignInBtn.style.display = 'flex';
        if (gsiContainer) gsiContainer.style.display = 'none';
      }
      return;
    }

    const clientId = window.APP_CONFIG?.googleClientId || "569331846575-djonqen9ib9jrek93o0hpjem189ppjsm.apps.googleusercontent.com";

    try {
      // 1. Google One Tap prompt e inicialización de credenciales (ID Token)
      if (window.google.accounts.id) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response && response.credential) {
              handleGoogleCredential(response.credential);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
          itp_support: true
        });

        // Renderizar el botón oficial de Google que recomienda la cuenta recordada con flechas de selección
        const gsiContainer = document.getElementById('gsiButtonContainer');
        if (gsiContainer) {
          const renderGsiBtn = () => {
            const authCard = document.querySelector('.auth-card') || gsiContainer;
            const containerWidth = Math.min(400, Math.max(240, (authCard ? authCard.clientWidth - 48 : gsiContainer.clientWidth) || 340));
            window.google.accounts.id.renderButton(gsiContainer, {
              type: 'standard',
              theme: 'outline',
              size: 'large',
              text: 'continue_with',
              shape: 'rectangular',
              logo_alignment: 'left',
              width: containerWidth
            });
          };

          renderGsiBtn();
          if (googleSignInBtn) googleSignInBtn.style.display = 'none';
          gsiContainer.style.display = 'flex';

          window.addEventListener('resize', () => {
            if (gsiContainer.style.display !== 'none') {
              renderGsiBtn();
            }
          });
        }

        const logoutTimestamp = localStorage.getItem('logoutTimestamp');
        const recentLogout = logoutTimestamp && (Date.now() - parseInt(logoutTimestamp)) < 1500;
        if (!recentLogout) {
          window.google.accounts.id.prompt();
        }
      }

      // 2. OAuth2 TokenClient para el botón personalizado
      if (window.google.accounts.oauth2) {
        googleTokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'email profile openid',
          callback: (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              handleGoogleAccessToken(tokenResponse.access_token);
            }
          }
        });
      }
    } catch (initErr) {
      console.error('[Login] Error inicializando GIS:', initErr);
      const gsiContainer = document.getElementById('gsiButtonContainer');
      if (googleSignInBtn) googleSignInBtn.style.display = 'flex';
      if (gsiContainer) gsiContainer.style.display = 'none';
    }
  }

  // Iniciar GIS tan pronto cargue el script
  initGoogleIdentityServices();

  // Click handler para el botón personalizado de Google
  if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', async () => {
      // Si TokenClient está listo, usarlo para solicitar acceso
      if (googleTokenClient) {
        try {
          googleTokenClient.requestAccessToken({ prompt: 'select_account' });
          return;
        } catch (e) {
          console.warn('[Login] TokenClient falló, intentando One Tap:', e);
        }
      }

      // Si One Tap está disponible, mostrar el prompt
      if (window.google?.accounts?.id) {
        window.google.accounts.id.prompt();
        return;
      }

      // Fallback estándar con Firebase Auth si GIS no estuviera disponible
      googleSignInBtn.disabled = true;
      googleSignInBtn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin"></i> Iniciando sesión...';
      window.LucideHelper?.refresh(googleSignInBtn);

      try {
        const result = await window.firebaseAuth.loginWithGoogle();
        if (result && result.redirect) return;

        if (result && result.success) {
          await processSuccessfulLogin(result);
          return;
        }

        const isCancelled = result?.cancelled || 
                            result?.error === 'auth/popup-closed-by-user' || 
                            result?.error === 'auth/cancelled-popup-request' ||
                            String(result?.rawError || '').includes('closed-by-user') ||
                            String(result?.message || '').includes('cancelado');

        if (!result || !result.success) {
          if (!isCancelled) {
            showAlert('Error al iniciar sesión', result?.message || 'No se pudo iniciar sesión con Google.', { variant: 'error' });
          }
        }
      } catch (error) {
        console.error('Error en fallback Google:', error);
        showAlert('Error', 'Ocurrió un error inesperado al conectar con Google.', { variant: 'error' });
      } finally {
        googleSignInBtn.disabled = false;
        googleSignInBtn.innerHTML = originalGoogleBtnContent;
        window.LucideHelper?.refresh(googleSignInBtn);
      }
    });
  }

  if (emailLoginButton) {
    emailLoginButton.addEventListener('click', async () => {
      const email = document.getElementById('email')?.value.trim();
      const password = document.getElementById('password')?.value;

      if (!email || !password) {
        showAlert('Error', 'Por favor completa todos los campos', { variant: 'error' });
        return;
      }

      if (!isValidEmail(email)) {
        showAlert('Error', 'Por favor ingresa un correo electrónico válido', { variant: 'error' });
        return;
      }

      emailLoginButton.disabled = true;
      emailLoginButton.innerHTML = '<i data-lucide="loader-2" class="lucide-spin"></i> Iniciando sesión...';
      window.LucideHelper?.refresh(emailLoginButton);

      try {
      const rememberMe = document.getElementById('rememberMe')?.checked ?? true;
      const result = await window.firebaseAuth.loginWithEmail(email, password, rememberMe);
        if (result.success) {
          asegurarConfiguracionPorDefecto();
          try {
            if (window.FirestoreDB && result.user) {
              const firestoreTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Firestore timeout')), 5000)
              );
              
              const firestoreInit = (async () => {
                await window.FirestoreDB.init();
                window.FirestoreDB.setCurrentUser(result.user.uid);
                
                const userData = await window.FirestoreDB.loadAllUserData();
                
                if ((!userData || (!userData.transactions || userData.transactions.length === 0)) 
                    && localStorage.getItem('transactions')) {
                  await window.FirestoreDB.migrateFromLocalStorage();
                }
              })();
              
              await Promise.race([firestoreInit, firestoreTimeout]);
            }
          } catch (firestoreError) {
          }
          
          window.location.href = '../Categorias/Categorias.html';
        } else if (result.error === 'auth/email-not-verified') {
          // Correo no verificado: mostrar error con opción de reenviar
          showAlert(
            'Correo No Verificado',
            result.message + (result.canResend ? ' ¿Deseas que te reenviemos el correo de verificación?' : ''),
            { variant: 'error' }
          );
          emailLoginButton.disabled = false;
          emailLoginButton.textContent = 'Iniciar Sesión';

          // Ofrecer reenvío si es posible
          if (result.canResend) {
            setTimeout(async () => {
              const resend = await showAlert(
                '¿Reenviar Verificación?',
                'Te enviamos otro correo de verificación.',
                { variant: 'confirm', confirmText: 'Reenviar', cancelText: 'No gracias' }
              );
              if (resend === 'confirm') {
                await window.firebaseAuth.resendVerificationEmail(result.email, result.password);
                showAlert('Correo Enviado', 'Revisa tu bandeja de entrada o la carpeta de SPAM / Correo no deseado.', { variant: 'success' });
              }

            }, 200);
          }
        } else {
          showAlert('Error', result.message, { variant: 'error' });
          emailLoginButton.disabled = false;
          emailLoginButton.textContent = 'Iniciar Sesión';
        }
      } catch (error) {
        showAlert('Error', 'Ocurrió un error inesperado. Por favor intenta nuevamente.', { variant: 'error' });
        emailLoginButton.disabled = false;
        emailLoginButton.textContent = 'Iniciar Sesión';
      }
    });

    ['email', 'password'].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            emailLoginButton.click();
          }
        });
      }
    });
  }

  if (sendRecoveryEmailButton) {
    sendRecoveryEmailButton.addEventListener('click', async () => {
      const email = document.getElementById('recoveryEmail')?.value.trim();

      if (!email) {
        showAlert('Error', 'Por favor ingresa tu correo electrónico', { variant: 'error' });
        return;
      }

      if (!isValidEmail(email)) {
        showAlert('Error', 'Por favor ingresa un correo electrónico válido', { variant: 'error' });
        return;
      }

      sendRecoveryEmailButton.disabled = true;
      sendRecoveryEmailButton.innerHTML = '<i data-lucide="loader-2" class="lucide-spin"></i> Enviando...';
      window.LucideHelper?.refresh(sendRecoveryEmailButton);

      try {
        const result = await window.firebaseAuth.resetPassword(email);
        if (result.success) {
          showAlert('¡Correo Enviado!', result.message, { variant: 'success' });
          setTimeout(() => {
            showScreen(emailLoginScreen);
            sendRecoveryEmailButton.disabled = false;
            sendRecoveryEmailButton.textContent = 'Enviar enlace de recuperación';
            if (document.getElementById('recoveryEmail')) {
              document.getElementById('recoveryEmail').value = '';
            }
          }, 3000);
        } else {
          showAlert('Error', result.message, { variant: 'error' });
          sendRecoveryEmailButton.disabled = false;
          sendRecoveryEmailButton.textContent = 'Enviar enlace de recuperación';
        }
      } catch (error) {
        showAlert('Error', 'Ocurrió un error inesperado. Por favor intenta nuevamente.', { variant: 'error' });
        sendRecoveryEmailButton.disabled = false;
        sendRecoveryEmailButton.textContent = 'Enviar enlace de recuperación';
      }
    });

    const recoveryInput = document.getElementById('recoveryEmail');
    if (recoveryInput) {
      recoveryInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          sendRecoveryEmailButton.click();
        }
      });
    }
  }

  if (emailRegisterButton) {
    emailRegisterButton.addEventListener('click', async () => {
      const name = document.getElementById('registerName')?.value.trim();
      const email = document.getElementById('registerEmail')?.value.trim();
      const password = document.getElementById('registerPassword')?.value;
      const confirmPassword = document.getElementById('registerPasswordConfirm')?.value;
      clearRegisterErrors();

      if (!name) {
        setRegisterError('registerNameError', 'Nombre requerido');
      }
      if (!email) {
        setRegisterError('registerEmailError', 'Correo requerido');
      }
      if (!password) {
        setRegisterError('registerPasswordError', 'Contraseña requerida');
      }
      if (!confirmPassword) {
        setRegisterError('registerPasswordConfirmError', 'Confirmar contraseña requerido');
      }

      if (!name || !email || !password || !confirmPassword) {
        return;
      }

      if (!isValidEmail(email)) {
        setRegisterError('registerEmailError', 'Ingresa un correo electrónico válido');
        return;
      }

      if (!isValidPassword(password)) {
        setRegisterError('registerPasswordError', 'Mínimo 8 caracteres y 2 números');
        return;
      }

      if (password !== confirmPassword) {
        setRegisterError('registerPasswordConfirmError', 'Contraseñas no coinciden');
        return;
      }

      emailRegisterButton.disabled = true;
      emailRegisterButton.innerHTML = '<i data-lucide="loader-2" class="lucide-spin"></i> Creando cuenta...';
      window.LucideHelper?.refresh(emailRegisterButton);

      try {
        const result = await window.firebaseAuth.registerWithEmail(email, password, name);
        if (result.success) {
          showAlert('¡Cuenta Creada!', result.message, { variant: 'success' });

          // No redirigir: el usuario debe verificar su correo primero
          setTimeout(() => {
            showScreen(emailLoginScreen);
            emailRegisterButton.disabled = false;
            emailRegisterButton.textContent = 'Crear Cuenta';
          }, 3000);
        } else {
          showAlert('Error', result.message, { variant: 'error' });
          emailRegisterButton.disabled = false;
          emailRegisterButton.textContent = 'Crear Cuenta';
        }
      } catch (error) {
        showAlert('Error', 'Ocurrió un error inesperado. Por favor intenta nuevamente.', { variant: 'error' });
        emailRegisterButton.disabled = false;
        emailRegisterButton.textContent = 'Crear Cuenta';
      }
    });

    ['registerName', 'registerEmail', 'registerPassword', 'registerPasswordConfirm'].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            emailRegisterButton.click();
          }
        });

        input.addEventListener('input', () => {
          setRegisterError(`${id}Error`, '');
        });
      }
    });
  }

  function clearRegisterErrors() {
    ['registerNameError', 'registerEmailError', 'registerPasswordError', 'registerPasswordConfirmError'].forEach(id => {
      const node = document.getElementById(id);
      if (node) {
        node.textContent = '';
        node.classList.add('hidden');
      }
    });
  }

  function setRegisterError(id, message) {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = message;
    if (message) {
      node.classList.remove('hidden');
    } else {
      node.classList.add('hidden');
    }
  }

  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function isValidPassword(password) {
    // Mínimo 8 caracteres, al menos 2 números
    const minLength = password.length >= 8;
    const numberCount = (password.match(/\d/g) || []).length >= 2;
    return minLength && numberCount;
  }

  (async () => {
    const LOGOUT_BLOCK_MS = 1500;

    try {
      const initialized = await window.firebaseAuth.init();
      if (!initialized && googleSignInBtn) {
        googleSignInBtn.disabled = true;
        googleSignInBtn.innerHTML = '<i data-lucide="alert-triangle"></i> Firebase no disponible';
        window.LucideHelper?.refresh(googleSignInBtn);
      }

      if (initialized && window.firebaseAuth?.auth) {
        window.firebaseAuth.auth.onAuthStateChanged((user) => {
          const logoutTimestamp = localStorage.getItem('logoutTimestamp');
          const recentLogout = logoutTimestamp && (Date.now() - parseInt(logoutTimestamp)) < LOGOUT_BLOCK_MS;

          if (user && !recentLogout) {
            try { window.firebaseAuth?.saveUserSession(user); } catch (e) {}
            window.location.replace('/pages/Categorias/Categorias.html');
          }
        });
      }

      const logoutTimestamp = localStorage.getItem('logoutTimestamp');
      const recentLogout = logoutTimestamp && (Date.now() - parseInt(logoutTimestamp)) < LOGOUT_BLOCK_MS;
      const isLoggedIn = localStorage.getItem('loggedIn');
      if (isLoggedIn === '1' && !recentLogout) {
        window.location.replace('/pages/Categorias/Categorias.html');
      }
    } catch (err) {
      console.warn('[Login] Error en chequeo inicial de autenticación:', err);
    }
  })();

})();
