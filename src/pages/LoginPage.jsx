import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useThemeStore } from '../stores/useThemeStore';
import { 
  Sparkles, 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  Sun, 
  Moon, 
  AlertCircle,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, isGuest, signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset, loginAsGuest, authError } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'reset'
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
      setErrorMessage(err.message || 'Error durante la autenticación');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      setErrorMessage(err.message || 'Error con Google Sign-In');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = () => {
    loginAsGuest();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-dark text-light flex flex-col justify-between p-4 selection:bg-primary selection:text-dark">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between max-w-6xl mx-auto w-full py-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-dark font-bold shadow-neon-primary">
            <Sparkles className="w-4 h-4 text-dark" />
          </div>
          <span className="font-bold text-sm tracking-tight text-light">FinanzApp</span>
        </Link>

        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-white/5 text-gray hover:text-light transition-colors"
          title="Cambiar tema"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 icon-sun" /> : <Moon className="w-4 h-4 icon-moon" />}
        </button>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md mx-auto my-8">
        <div className="card-glass p-8 relative shadow-2xl border border-white/10">
          {/* Brand Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-extrabold text-light tracking-tight">
              {mode === 'login' && 'Bienvenido de nuevo'}
              {mode === 'register' && 'Crea tu cuenta'}
              {mode === 'reset' && 'Recuperar contraseña'}
            </h1>
            <p className="text-xs text-gray mt-1">
              {mode === 'login' && 'Ingresa tus credenciales para acceder a tus finanzas'}
              {mode === 'register' && 'Comienza a gestionar tu dinero con inteligencia'}
              {mode === 'reset' && 'Ingresa tu correo para recibir un enlace de restablecimiento'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          {mode !== 'reset' && (
            <div className="grid grid-cols-2 p-1 bg-white/5 rounded-xl mb-6 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`py-2 rounded-lg transition-all ${
                  mode === 'login'
                    ? 'bg-primary text-dark font-bold shadow-neon-primary'
                    : 'text-gray hover:text-light'
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`py-2 rounded-lg transition-all ${
                  mode === 'register'
                    ? 'bg-primary text-dark font-bold shadow-neon-primary'
                    : 'text-gray hover:text-light'
                }`}
              >
                Registrarse
              </button>
            </div>
          )}

          {/* Alerts */}
          {errorMessage && (
            <div className="p-3 mb-4 rounded-xl bg-danger/15 border border-danger/30 text-danger text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 mb-4 rounded-xl bg-success/15 border border-success/30 text-success text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-gray uppercase mb-1.5">
                  Nombre Completo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Tu nombre"
                    className="w-full bg-input-bg border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-light placeholder-gray/50 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray uppercase mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="w-full bg-input-bg border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-light placeholder-gray/50 focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray uppercase">
                    Contraseña
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setMode('reset')}
                      className="text-xs text-primary hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-input-bg border border-white/10 rounded-xl pl-9 pr-10 py-2.5 text-sm text-light placeholder-gray/50 focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray hover:text-light"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-neon-primary py-2.5 text-sm justify-center disabled:opacity-50 mt-2"
            >
              {loading ? 'Cargando...' : mode === 'login' ? 'Iniciar Sesión' : mode === 'register' ? 'Registrarse' : 'Enviar Correo'}
            </button>
          </form>

          {mode === 'reset' && (
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-xs text-primary hover:underline"
              >
                Volver al inicio de sesión
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <span className="relative bg-card-bg px-3 text-[11px] text-gray uppercase font-semibold">
              O continúa con
            </span>
          </div>

          {/* Social and Guest Login */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 hover:bg-gray-100 font-semibold text-xs py-2.5 px-4 rounded-xl shadow-md transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continuar con Google</span>
            </button>

            <button
              type="button"
              onClick={handleGuestMode}
              className="w-full btn-secondary-custom text-xs py-2.5 justify-center text-light"
            >
              <span>Explorar como Invitado (Modo Local)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer Legal Links */}
      <footer className="text-center py-4 text-xs text-gray flex items-center justify-center gap-4">
        <Link to="/privacidad" className="hover:text-primary transition-colors">
          Política de Privacidad
        </Link>
        <span>•</span>
        <Link to="/terminos" className="hover:text-primary transition-colors">
          Términos de Servicio
        </Link>
      </footer>
    </div>
  );
}
