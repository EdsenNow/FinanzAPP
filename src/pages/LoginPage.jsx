import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useThemeStore } from '../stores/useThemeStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const { 
    user, 
    signInWithGoogle, 
    signInWithGoogleCredential,
    signInWithEmail, 
    signUpWithEmail, 
    sendPasswordReset, 
    loginAsGuest 
  } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const [mode, setMode] = useState('menu'); // 'menu' | 'login' | 'register' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Initialize Google Identity Services (GIS) One Tap / Silent OAuth
  useEffect(() => {
    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: "569331846575-djonqen9ib9jrek93o0hpjem189ppjsm.apps.googleusercontent.com",
          callback: async (response) => {
            if (response.credential) {
              setLoading(true);
              setErrorMessage(null);
              try {
                await signInWithGoogleCredential(response.credential);
                navigate('/dashboard');
              } catch (e) {
                setErrorMessage(getFriendlyErrorMessage(e));
              } finally {
                setLoading(false);
              }
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true
        });
      } catch (e) {
        console.warn('GIS One Tap init notice:', e);
      }
    }
  }, [signInWithGoogleCredential, navigate]);

  const getFriendlyErrorMessage = (err) => {
    const code = err?.code || '';
    if (code === 'auth/popup-closed-by-user' || err?.error === 'popup_closed_by_user') return 'La ventana de inicio de sesión de Google fue cerrada.';
    if (code === 'auth/unauthorized-domain') return 'El dominio no está en la lista de dominios autorizados de Firebase.';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'Correo electrónico o contraseña incorrectos.';
    if (code === 'auth/email-already-in-use') return 'Ya existe una cuenta registrada con este correo electrónico.';
    if (code === 'auth/weak-password') return 'La contraseña debe tener al menos 6 caracteres.';
    if (code === 'auth/too-many-requests') return 'Demasiados intentos fallidos. Por favor, intenta más tarde.';
    return err?.message || 'Error durante la autenticación';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
        navigate('/dashboard');
      } else if (mode === 'register') {
        await signUpWithEmail(email, password, displayName);
        navigate('/dashboard');
      } else if (mode === 'reset') {
        await sendPasswordReset(email);
        setSuccessMessage('Correo de recuperación enviado. Revisa tu bandeja de entrada.');
      }
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setLoading(true);
    try {
      const loggedUser = await signInWithGoogle();
      if (loggedUser) navigate('/dashboard');
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.error !== 'popup_closed_by_user') {
        setErrorMessage(getFriendlyErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = () => {
    loginAsGuest();
    navigate('/dashboard');
  };

  return (
    <div className="login-page">
      {/* Background Animated Orbs */}
      <div className="bg-orb-container" aria-hidden="true">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
        <div className="orb orb-4"></div>
        <div className="orb orb-5"></div>
      </div>

      <div id="authScreens">
        <div className="auth-container">
          <div className="auth-card">
            {/* Header */}
            <div className="auth-header">
              <div className="auth-logo">
                <div className="logo-icon">
                  <i className="fas fa-wallet"></i>
                </div>
              </div>
              <h1 className="auth-title">
                {mode === 'register' ? 'Crea tu cuenta' : mode === 'reset' ? 'Recuperar Contraseña' : 'Bienvenido'}
              </h1>
              <p className="auth-subtitle">
                {mode === 'register' ? 'Gestiona tus finanzas fácilmente' : mode === 'reset' ? 'Ingresa tu correo' : 'Accede a tu cuenta'}
              </p>
            </div>

            {/* Alerts */}
            {errorMessage && (
              <div className="alert-message danger" style={{ margin: '12px 0', padding: '10px 14px', borderRadius: '8px', background: 'rgba(235, 111, 146, 0.15)', color: '#eb6f92', fontSize: '0.85rem' }}>
                <i className="fas fa-exclamation-circle"></i> {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="alert-message success" style={{ margin: '12px 0', padding: '10px 14px', borderRadius: '8px', background: 'rgba(45, 149, 123, 0.15)', color: '#2D957B', fontSize: '0.85rem' }}>
                <i className="fas fa-check-circle"></i> {successMessage}
              </div>
            )}

            {mode === 'menu' ? (
              <div className="auth-options">
                <button className="btn btn-google" id="googleSignInBtn" type="button" onClick={handleGoogleLogin} disabled={loading}>
                  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.73 1.22 9.23 3.22l6.9-6.9C35.97 1.76 30.34 0 24 0 14.64 0 6.6 5.38 2.7 13.22l8.02 6.23C12.6 13.32 17.9 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.5 24.5c0-1.64-.15-3.22-.43-4.74H24v9.01h12.65c-.55 2.98-2.18 5.5-4.63 7.18l7.12 5.53c4.17-3.85 6.36-9.52 6.36-16.98z"/>
                    <path fill="#FBBC05" d="M10.72 28.45c-.52-1.55-.82-3.2-.82-4.95 0-1.75.3-3.4.82-4.95l-8.02-6.23C.98 15.86 0 19.79 0 23.5c0 3.71.98 7.64 2.7 10.18l8.02-6.23z"/>
                    <path fill="#34A853" d="M24 48c6.34 0 11.67-2.09 15.56-5.65l-7.12-5.53c-1.97 1.32-4.5 2.1-8.44 2.1-6.1 0-11.4-3.82-13.28-9.2l-8.02 6.23C6.6 42.62 14.64 48 24 48z"/>
                    <path fill="none" d="M0 0h48v48H0z"/>
                  </svg>
                  {loading ? 'Conectando...' : 'Continuar con Google'}
                </button>

                <div className="auth-divider" role="separator" aria-label="o">
                  <span>o</span>
                </div>

                <button className="btn btn-primary" id="showEmailLogin" type="button" onClick={() => setMode('login')}>
                  <i className="fas fa-envelope"></i> Continuar con correo
                </button>

                <div className="guest-login-container">
                  <button className="btn btn-guest" id="guestLoginBtn" type="button" onClick={handleGuestMode}>
                    <i className="fas fa-user-clock"></i> Continuar como invitado
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="auth-form">
                {mode === 'register' && (
                  <div className="form-group">
                    <label htmlFor="displayName">Nombre</label>
                    <input
                      type="text"
                      className="form-control"
                      id="displayName"
                      required
                      placeholder="Tu nombre completo"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="email">Correo electrónico</label>
                  <input
                    type="email"
                    className="form-control"
                    id="email"
                    required
                    placeholder="ejemplo@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {mode !== 'reset' && (
                  <div className="form-group">
                    <label htmlFor="password">Contraseña</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="form-control"
                        id="password"
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--gray)',
                          cursor: 'pointer'
                        }}
                      >
                        <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                  </div>
                )}

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }} disabled={loading}>
                  {loading ? 'Cargando...' : mode === 'login' ? 'Iniciar Sesión' : mode === 'register' ? 'Registrarse' : 'Enviar Enlace'}
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px', textAlign: 'center', fontSize: '0.85rem' }}>
                  {mode === 'login' && (
                    <>
                      <button type="button" className="btn-link" onClick={() => setMode('reset')} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
                        ¿Olvidaste tu contraseña?
                      </button>
                      <button type="button" className="btn-link" onClick={() => setMode('register')} style={{ background: 'none', border: 'none', color: 'var(--light)', cursor: 'pointer' }}>
                        ¿No tienes cuenta? <strong style={{ color: 'var(--primary)' }}>Regístrate</strong>
                      </button>
                    </>
                  )}
                  {mode === 'register' && (
                    <button type="button" className="btn-link" onClick={() => setMode('login')} style={{ background: 'none', border: 'none', color: 'var(--light)', cursor: 'pointer' }}>
                      ¿Ya tienes cuenta? <strong style={{ color: 'var(--primary)' }}>Inicia Sesión</strong>
                    </button>
                  )}
                  <button type="button" className="btn-link" onClick={() => setMode('menu')} style={{ background: 'none', border: 'none', color: 'var(--gray)', cursor: 'pointer', marginTop: '4px' }}>
                    <i className="fas fa-arrow-left"></i> Volver a opciones
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Footer Legal */}
      <footer style={{ textAlign: 'center', padding: '16px', fontSize: '0.8rem', opacity: 0.7 }}>
        <Link to="/privacidad" style={{ color: 'inherit', margin: '0 8px' }}>Política de Privacidad</Link>
        •
        <Link to="/terminos" style={{ color: 'inherit', margin: '0 8px' }}>Términos de Servicio</Link>
      </footer>
    </div>
  );
}
