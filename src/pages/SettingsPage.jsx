import React, { useState, useEffect } from 'react';
import { useFinanceStore } from '../stores/useFinanceStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useThemeStore } from '../stores/useThemeStore';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import MobileNav from '../components/layout/MobileNav';
import MobileDrawer from '../components/layout/MobileDrawer';
import CustomAlert from '../components/common/CustomAlert';
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
    <div className="settings-page">
      <div className="app-container">
        <Sidebar />

        <div className="main-content">
          <Header
            title="Configuración"
            onOpenDrawer={() => setIsDrawerOpen(true)}
          />

          <div className="config-grid">
            {/* Profile Card */}
            <article className="config-card profile-card">
              <div className="profile-main" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="profile-avatar-large" id="profileAvatarLarge" style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--primary)', color: '#191724', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.4rem' }}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="profile-name" id="profileName" style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{displayName}</p>
                  <p className="profile-email" id="profileEmail" style={{ color: 'var(--gray)', fontSize: '0.85rem' }}>{displayEmail}</p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(45,149,123,0.15)', color: '#2D957B', fontWeight: 'bold' }}>
                      {isGuest ? 'Invitado Local' : 'Cuenta Activa'}
                    </span>
                  </div>
                </div>
              </div>
            </article>

            {/* Preferences Form */}
            <article className="config-card preferences-card">
              <h2 className="card-title">Preferencias Generales</h2>
              <form onSubmit={handleSavePreferences} className="settings-form" style={{ marginTop: '16px' }}>
                <div className="settings-section">
                  <div className="settings-section-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', marginBottom: '16px' }}>
                    <i className="fas fa-palette" style={{ color: 'var(--primary)' }}></i>
                    <span>Visualización y Formato</span>
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label>Moneda Principal</label>
                    <select
                      className="form-control"
                      value={selectedCurrency}
                      onChange={(e) => {
                        setSelectedCurrency(e.target.value);
                        const found = CURRENCIES.find((c) => c.code === e.target.value);
                        if (found) setCurrencySymbol(found.symbol);
                      }}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label>Símbolo de Moneda</label>
                    <input
                      type="text"
                      className="form-control"
                      value={currencySymbol}
                      onChange={(e) => setCurrencySymbol(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label>Tema Visual</label>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      <button
                        type="button"
                        className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setTheme('dark')}
                      >
                        <i className="fas fa-moon"></i> Oscuro (Rosé Pine)
                      </button>
                      <button
                        type="button"
                        className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setTheme('light')}
                      >
                        <i className="fas fa-sun"></i> Claro
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px' }}>
                    {saveSuccess && (
                      <span style={{ color: '#2D957B', fontSize: '0.85rem', fontWeight: 'bold' }}>
                        <i className="fas fa-check"></i> Preferencias guardadas
                      </span>
                    )}
                    <button type="submit" className="btn btn-primary" style={{ marginLeft: 'auto' }}>
                      Guardar Preferencias
                    </button>
                  </div>
                </div>
              </form>
            </article>

            {/* Integrations (Gmail) */}
            <article className="config-card">
              <h2 className="card-title">
                <i className="fas fa-envelope" style={{ color: '#f6c177' }}></i> Sincronización Bancaria con Gmail
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--gray)', margin: '12px 0', lineHeight: 1.5 }}>
                Detecta automáticamente transferencias y compras en tus correos de notificaciones bancarias de forma privada y segura.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: gmailConnected ? '#2D957B' : 'var(--gray)' }}></span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
                    {gmailConnected ? 'Conectado a Gmail' : 'No vinculado'}
                  </span>
                </div>

                {gmailConnected ? (
                  <button type="button" onClick={handleDisconnectGmail} className="btn btn-danger">
                    Desconectar
                  </button>
                ) : (
                  <button type="button" disabled={isGuest} onClick={handleConnectGmail} className="btn btn-primary">
                    {isGuest ? 'Requiere cuenta' : 'Vincular Gmail'}
                  </button>
                )}
              </div>
            </article>

            {/* Respaldo y Datos */}
            <article className="config-card">
              <h2 className="card-title">
                <i className="fas fa-database" style={{ color: 'var(--secondary)' }}></i> Respaldo y Datos
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={() => exportToJSON(categories, budgets, settings)} className="btn btn-secondary">
                  <i className="fas fa-file-code"></i> Exportar JSON
                </button>
                <button type="button" onClick={() => exportToPDF(categories, settings)} className="btn btn-secondary">
                  <i className="fas fa-file-pdf"></i> Reporte PDF
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
                  className="btn btn-secondary"
                >
                  <i className="fas fa-file-import"></i> Importar Respaldo
                </button>
                <button type="button" onClick={() => setIsConfirmResetOpen(true)} className="btn btn-danger">
                  <i className="fas fa-trash"></i> Borrar Todo
                </button>
              </div>
            </article>
          </div>
        </div>
      </div>

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
