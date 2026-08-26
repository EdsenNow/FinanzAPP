import React, { useState, useEffect } from 'react';
import { useFinanceStore } from '../stores/useFinanceStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useThemeStore } from '../stores/useThemeStore';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import MobileNav from '../components/layout/MobileNav';
import MobileDrawer from '../components/layout/MobileDrawer';
import CustomAlert from '../components/common/CustomAlert';
import { 
  User, 
  Settings, 
  Sun, 
  Moon, 
  Download, 
  Upload, 
  Trash2, 
  ShieldCheck, 
  Mail, 
  Check, 
  FileText,
  DollarSign
} from 'lucide-react';
import { exportToJSON, exportToPDF } from '../services/exportService';
import { checkGmailStatus, disconnectGmail, getGmailAuthUrl } from '../services/gmailService';

const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'Dólar Estadounidense ($)' },
  { code: 'EUR', symbol: '€', label: 'Euro (€)' },
  { code: 'MXN', symbol: '$', label: 'Peso Mexicano ($)' },
  { code: 'COP', symbol: '$', label: 'Peso Colombiano ($)' },
  { code: 'ARS', symbol: '$', label: 'Peso Argentino ($)' },
  { code: 'CLP', symbol: '$', label: 'Peso Chileno ($)' },
  { code: 'PEN', symbol: 'S/', label: 'Sol Peruano (S/)' },
  { code: 'BRL', symbol: 'R$', label: 'Real Brasileño (R$)' }
];

export default function SettingsPage() {
  const { user, isGuest } = useAuthStore();
  const { categories, budgets, settings, updateSettings, importData, loadUserData } = useFinanceStore();
  const { theme, setTheme } = useThemeStore();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState(settings.currency || 'USD');
  const [currencySymbol, setCurrencySymbol] = useState(settings.currencySymbol || '$');
  const [gmailConnected, setGmailConnected] = useState(false);
  const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      loadUserData(user.uid, isGuest);
      if (!isGuest) {
        checkGmailStatus(user.uid).then((res) => setGmailConnected(Boolean(res.connected)));
      }
    }
  }, [user, isGuest, loadUserData]);

  const handleSavePreferences = (e) => {
    e.preventDefault();
    updateSettings({ currency: selectedCurrency, currencySymbol }, user?.uid, isGuest);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleConnectGmail = async () => {
    if (isGuest || !user?.uid) return;
    try {
      const url = await getGmailAuthUrl(user.uid);
      window.location.href = url;
    } catch (err) {
      console.warn('Error connecting Gmail:', err);
    }
  };

  const handleDisconnectGmail = async () => {
    if (!user?.uid) return;
    await disconnectGmail(user.uid);
    setGmailConnected(false);
  };

  const displayName = isGuest ? 'Invitado' : user?.displayName || user?.email?.split('@')[0] || 'Usuario';
  const displayEmail = isGuest ? 'Sin cuenta registrada (Modo Invitado)' : user?.email || '';

  return (
    <div className="min-h-screen bg-dark text-light flex">
      <Sidebar />

      <main className="flex-1 md:ml-64 p-4 md:p-8 pb-24 md:pb-8 max-w-4xl mx-auto w-full">
        <Header
          title="Configuración"
          onOpenDrawer={() => setIsDrawerOpen(true)}
        />

        <div className="space-y-6">
          {/* Profile Card */}
          <div className="card-glass p-6 flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 text-primary flex items-center justify-center text-2xl font-bold">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-base text-light">{displayName}</h2>
              <p className="text-xs text-gray">{displayEmail}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/15 text-success">
                  {isGuest ? 'Invitado Local' : 'Cuenta Activa'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/15 text-secondary flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> CASA AL1 Protegido
                </span>
              </div>
            </div>
          </div>

          {/* Preferences Form */}
          <form onSubmit={handleSavePreferences} className="card-glass p-6 space-y-5">
            <h3 className="font-bold text-sm text-light flex items-center gap-2 border-b border-white/5 pb-3">
              <Settings className="w-4 h-4 text-primary" />
              <span>Preferencias de Moneda y Formato</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray uppercase mb-2">
                  Moneda Principal
                </label>
                <select
                  value={selectedCurrency}
                  onChange={(e) => {
                    setSelectedCurrency(e.target.value);
                    const found = CURRENCIES.find((c) => c.code === e.target.value);
                    if (found) setCurrencySymbol(found.symbol);
                  }}
                  className="w-full bg-input-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm text-light focus:outline-none focus:border-primary cursor-pointer"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray uppercase mb-2">
                  Símbolo de Moneda
                </label>
                <input
                  type="text"
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  className="w-full bg-input-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm text-light focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Theme Selector */}
            <div>
              <label className="block text-xs font-semibold text-gray uppercase mb-2">
                Tema Visual
              </label>
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all ${
                    theme === 'dark'
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-neon-primary'
                      : 'border-white/5 bg-white/5 text-gray hover:text-light'
                  }`}
                >
                  <Moon className="w-4 h-4 icon-moon" />
                  <span>Oscuro (Rosé Pine)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all ${
                    theme === 'light'
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-neon-primary'
                      : 'border-white/5 bg-white/5 text-gray hover:text-light'
                  }`}
                >
                  <Sun className="w-4 h-4 icon-sun" />
                  <span>Claro</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              {saveSuccess && (
                <span className="text-xs text-success flex items-center gap-1.5 font-medium animate-fade-in">
                  <Check className="w-4 h-4" /> Preferencias guardadas
                </span>
              )}
              <div className="ml-auto">
                <button type="submit" className="btn-neon-primary text-xs px-4 py-2">
                  Guardar Preferencias
                </button>
              </div>
            </div>
          </form>

          {/* Integrations (Gmail) */}
          <div className="card-glass p-6 space-y-4">
            <h3 className="font-bold text-sm text-light flex items-center gap-2 border-b border-white/5 pb-3">
              <Mail className="w-4 h-4 text-warning" />
              <span>Sincronización Bancaria con Gmail</span>
            </h3>

            <p className="text-xs text-gray leading-relaxed">
              Detecta automáticamente transferencias y compras en tus correos de notificaciones bancarias de forma privada y encriptada (CASA AL1).
            </p>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${gmailConnected ? 'bg-success' : 'bg-gray'}`} />
                <span className="text-xs font-semibold text-light">
                  {gmailConnected ? 'Conectado a Gmail' : 'No vinculado'}
                </span>
              </div>

              {gmailConnected ? (
                <button
                  type="button"
                  onClick={handleDisconnectGmail}
                  className="btn-secondary-custom text-xs text-danger hover:border-danger px-3 py-1.5"
                >
                  Desconectar
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isGuest}
                  onClick={handleConnectGmail}
                  className="btn-neon-primary text-xs px-3 py-1.5 disabled:opacity-50"
                  title={isGuest ? 'Inicia sesión para vincular Gmail' : ''}
                >
                  {isGuest ? 'Requiere cuenta' : 'Vincular Gmail'}
                </button>
              )}
            </div>
          </div>

          {/* Backup and Data Management */}
          <div className="card-glass p-6 space-y-4">
            <h3 className="font-bold text-sm text-light flex items-center gap-2 border-b border-white/5 pb-3">
              <Download className="w-4 h-4 text-secondary" />
              <span>Respaldo y Seguridad de Datos</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => exportToJSON(categories, budgets, settings)}
                className="btn-secondary-custom text-xs justify-start p-3"
              >
                <Download className="w-4 h-4 text-secondary" />
                <div className="text-left">
                  <p className="font-semibold text-light">Exportar JSON</p>
                  <p className="text-[10px] text-gray">Copia de seguridad completa</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => exportToPDF(categories, settings)}
                className="btn-secondary-custom text-xs justify-start p-3"
              >
                <FileText className="w-4 h-4 text-primary" />
                <div className="text-left">
                  <p className="font-semibold text-light">Reporte PDF</p>
                  <p className="text-[10px] text-gray">Documento imprimible con tablas</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        try {
                          const data = JSON.parse(ev.target.result);
                          importData(data, user?.uid, isGuest);
                          alert('Respaldo restaurado con éxito');
                        } catch (_) {
                          alert('Archivo JSON inválido');
                        }
                      };
                      reader.readAsText(file);
                    }
                  };
                  input.click();
                }}
                className="btn-secondary-custom text-xs justify-start p-3"
              >
                <Upload className="w-4 h-4 text-accent" />
                <div className="text-left">
                  <p className="font-semibold text-light">Importar Respaldo</p>
                  <p className="text-[10px] text-gray">Restaurar datos desde archivo</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsConfirmResetOpen(true)}
                className="btn-secondary-custom text-xs justify-start p-3 text-danger hover:border-danger"
              >
                <Trash2 className="w-4 h-4 icon-trash" />
                <div className="text-left">
                  <p className="font-semibold text-danger">Borrar Todos los Datos</p>
                  <p className="text-[10px] text-gray">Limpieza completa de cuenta</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </main>

      <MobileNav />
      <MobileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />

      {/* Confirm Reset Alert */}
      <CustomAlert
        isOpen={isConfirmResetOpen}
        onClose={() => setIsConfirmResetOpen(false)}
        type="danger"
        title="¿Restablecer todos los datos?"
        message="Esta acción eliminará todas tus categorías, transacciones y presupuestos. Esta acción no se puede deshacer."
        confirmText="Restablecer"
        showCancel={true}
        onConfirm={() => {
          importData({ categories: [], budgets: [], settings }, user?.uid, isGuest);
          setIsConfirmResetOpen(false);
        }}
      />
    </div>
  );
}
