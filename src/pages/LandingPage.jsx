import React from 'react';
import { Link } from 'react-router-dom';
import { useThemeStore } from '../stores/useThemeStore';
import { 
  Sparkles, 
  ShieldCheck, 
  Wallet, 
  PieChart, 
  Mail, 
  ArrowRight, 
  Sun, 
  Moon, 
  CheckCircle2 
} from 'lucide-react';

export default function LandingPage() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <div className="min-h-screen bg-dark text-light flex flex-col justify-between selection:bg-primary selection:text-dark">
      {/* Navigation */}
      <header className="max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-dark font-bold shadow-neon-primary">
            <Sparkles className="w-5 h-5 text-dark" />
          </div>
          <span className="font-bold text-lg tracking-tight text-light">FinanzApp</span>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-white/5 text-gray hover:text-light transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 icon-sun" /> : <Moon className="w-5 h-5 icon-moon" />}
          </button>
          <Link
            to="/login"
            className="btn-neon-primary text-xs px-4 py-2"
          >
            <span>Acceder</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-6 py-12 text-center space-y-8 my-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
          <ShieldCheck className="w-4 h-4" />
          <span>Certificación de Seguridad Google CASA AL1</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-light tracking-tight leading-tight">
          Control total de tus finanzas <br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
            con inteligencia y privacidad
          </span>
        </h1>

        <p className="text-base sm:text-lg text-gray max-w-2xl mx-auto leading-relaxed">
          Monitorea ingresos, gastos y presupuestos en tiempo real. Sincronización automática de movimientos bancarios con encriptación de nivel militar.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            to="/login"
            className="btn-neon-primary text-sm px-6 py-3 shadow-neon-hover text-base"
          >
            <span>Comenzar Gratis</span>
            <ArrowRight className="w-5 h-5" />
          </Link>

          <Link
            to="/dashboard"
            className="btn-secondary-custom text-sm px-6 py-3 text-base"
          >
            <span>Ver Demo Local</span>
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 text-left">
          <div className="card-glass p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-light">Gestión de Presupuestos</h3>
            <p className="text-xs text-gray leading-relaxed">
              Define metas semanales o mensuales por categoría con medidores de progreso visuales y alertas automáticas.
            </p>
          </div>

          <div className="card-glass p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center">
              <PieChart className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-light">Analíticas y Estadísticas</h3>
            <p className="text-xs text-gray leading-relaxed">
              Gráficos interactivos de flujo de caja anual, distribución de consumo y mapas de calor diarios.
            </p>
          </div>

          <div className="card-glass p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-light">Detección Bancaria Gmail</h3>
            <p className="text-xs text-gray leading-relaxed">
              Detecta transacciones en correos de tu banco para agregarlas a tus categorías con un solo clic.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full px-6 py-8 border-t border-white/5 flex flex-wrap items-center justify-between gap-4 text-xs text-gray">
        <p>© {new Date().getFullYear()} FinanzApp. Todos los derechos reservados.</p>
        <div className="flex items-center gap-6">
          <Link to="/privacidad" className="hover:text-primary transition-colors">
            Política de Privacidad
          </Link>
          <Link to="/terminos" className="hover:text-primary transition-colors">
            Términos de Servicio
          </Link>
        </div>
      </footer>
    </div>
  );
}
