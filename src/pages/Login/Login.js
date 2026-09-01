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
  
  window.addEventListener('load', async () => {
    const initialized = await window.firebaseAuth.init();
    
    if (initialized) {
    } else {
      if (googleSignInBtn) {
        googleSignInBtn.disabled = true;
        googleSignInBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Firebase no disponible';
      }
    }
  });

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
      window.location.href = '../Dashboard/Dashboard.html';
    });
  }

  if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', async () => {
      googleSignInBtn.disabled = true;
      const originalContent = googleSignInBtn.innerHTML;
      googleSignInBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando sesión...';

      let isDone = false;
      let checkPopupInterval = null;
      let popupWindow = null;

      // Interceptar window.open para capturar la ventana emergente real de Google
      const originalOpen = window.open;
      window.open = function (...args) {
        popupWindow = originalOpen.apply(this, args);
        return popupWindow;
      };

      const restoreButton = () => {
        if (isDone) return;
        isDone = true;
        if (checkPopupInterval) clearInterval(checkPopupInterval);
        window.open = originalOpen;
        googleSignInBtn.disabled = false;
        googleSignInBtn.innerHTML = originalContent;
      };

      // Sondeo ultrarrápido (cada 150ms): solo se restaura si la ventana emergente se ha cerrado realmente
      checkPopupInterval = setInterval(() => {
        if (isDone) {
          clearInterval(checkPopupInterval);
          return;
        }
        if (popupWindow && popupWindow.closed) {
          console.log('[Login] Ventana emergente cerrada por el usuario.');
          restoreButton();
        }
      }, 150);

      try {
        const result = await window.firebaseAuth.loginWithGoogle();

        if (result && result.redirect) {
          return; // redirección en curso
        }

        if (result && result.success) {
          asegurarConfiguracionPorDefecto();
          isDone = true;
          if (checkPopupInterval) clearInterval(checkPopupInterval);
          window.open = originalOpen;

          // Guardar sesión inmediatamente por si Firestore falla
          try {
            if (result.user && window.firebaseAuth && window.firebaseAuth.saveUserSession) {
              window.firebaseAuth.saveUserSession(result.user);
            }
          } catch (e) {}

          // Intentar sincronizar con Firestore sin bloquear la redirección
          (async () => {
            try {
              if (window.FirestoreDB && result.user) {
                const firestoreInit = (async () => {
                  await window.FirestoreDB.init();
                  window.FirestoreDB.setCurrentUser(result.user.uid);
                  const userData = await window.FirestoreDB.loadAllUserData();
                  if ((!userData || (!userData.transactions || userData.transactions.length === 0)) 
                      && localStorage.getItem('transactions')) {
                    await window.FirestoreDB.migrateFromLocalStorage();
                  }
                })();
                await Promise.race([firestoreInit, new Promise(resolve => setTimeout(resolve, 5000))]);
              }
            } catch (firestoreError) {
              console.warn('Firestore sync after login failed:', firestoreError);
            }
          })();

          // Redirigir al Dashboard de inmediato
          setTimeout(() => {
            window.location.replace('/pages/Dashboard/Dashboard.html');
          }, 600);
          return;
        }

        // Casos de error / cancelación
        const isCancelled = result && (result.cancelled || result.error === 'auth/popup-closed-by-user' || result.error === 'auth/cancelled-popup-request' || result.error === 'auth/user-cancelled');
        if (!result || (!isCancelled && !result.success)) {
          showAlert('Error', result?.message || 'No se pudo iniciar sesión con Google.', { variant: 'error' });
        }
        restoreButton();
      } catch (error) {
        console.error('Error inesperado en login con Google:', error);
        restoreButton();
      } finally {
        window.open = originalOpen;
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
      emailLoginButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando sesión...';

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
          
          window.location.href = '../Dashboard/Dashboard.html';
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
      sendRecoveryEmailButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

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
      emailRegisterButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando cuenta...';

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
    const LOGOUT_BLOCK_MS = 60000;
    const logoutTimestamp = localStorage.getItem('logoutTimestamp');
    const recentLogout = logoutTimestamp && (Date.now() - parseInt(logoutTimestamp)) < LOGOUT_BLOCK_MS;

    try {
      const initialized = await window.firebaseAuth.init();
      if (initialized && window.firebaseAuth.auth) {
        const user = await new Promise(resolve => {
          let resolved = false;
          const unsub = window.firebaseAuth.auth.onAuthStateChanged(u => {
            if (!resolved) {
              resolved = true;
              try { unsub(); } catch (e) {}
              resolve(u);
            }
          });
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              try { unsub(); } catch (e) {}
              resolve(window.firebaseAuth.getCurrentUser());
            }
          }, 1500);
        });

        if (user && !recentLogout) {
          try { window.firebaseAuth?.saveUserSession(user); } catch (e) {}
          window.location.replace('/pages/Dashboard/Dashboard.html');
        }
      } else {
        const isLoggedIn = localStorage.getItem('loggedIn');
        if (isLoggedIn === '1' && !recentLogout) {
          window.location.replace('/pages/Dashboard/Dashboard.html');
        }
      }
    } catch (err) {
      const isLoggedIn = localStorage.getItem('loggedIn');
      if (isLoggedIn === '1' && !recentLogout) {
        window.location.replace('/pages/Dashboard/Dashboard.html');
      }
    }
  })();

})();
