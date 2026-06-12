/**
 * @fileoverview Página de Configuración de FinanzApp.
 *
 * Permite gestionar preferencias de visualización (tema, moneda, formato),
 * exportar e importar respaldos JSON, reiniciar datos del usuario y
 * visualizar el perfil de la cuenta activa.
 *
 * @module Configuracion
 */
(function () {
  'use strict';

  const SETTINGS_KEY = 'finanzapp:settings:v1';
  const LAST_BACKUP_KEY = 'finanzapp:lastBackupAt';

  const DEFAULT_SETTINGS = Object.freeze({
    theme: 'dark',
    currency: 'USD',
    numberFormat: 'us',
    tooltips: 'on',
    shortcuts: 'on',
    dateFormat: 'dmy',
    confirmDelete: 'on',
    txPerPage: 'all',
    showCents: 'on'
  });

  const CURRENCY_LOCALE_MAP = {
    USD: { locale: 'en-US', currency: 'USD' },
    EUR: { locale: 'es-ES', currency: 'EUR' },
    GBP: { locale: 'en-GB', currency: 'GBP' },
    DOP: { locale: 'es-DO', currency: 'DOP' },
    COP: { locale: 'es-CO', currency: 'COP' },
    MXN: { locale: 'es-MX', currency: 'MXN' },
    ARS: { locale: 'es-AR', currency: 'ARS' },
    CLP: { locale: 'es-CL', currency: 'CLP' },
    PEN: { locale: 'es-PE', currency: 'PEN' },
    BRL: { locale: 'pt-BR', currency: 'BRL' }
  };

  const createFirestoreStore = window.Core?.storeFactories?.createFirestoreStore;
  const store = typeof createFirestoreStore === 'function' ? createFirestoreStore() : null;

  const state = {
    settings: { ...DEFAULT_SETTINGS },
    snapshot: {
      transactions: [],
      categories: [],
      budgets: {}
    }
  };

  const elements = {};

  if (typeof window !== 'undefined' && window.sidebarRenderer) {
    window.sidebarRenderer.render('configuracion');
  }

  async function init() {
    cacheElements();
    attachEvents();

    const initialTheme = localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
    applyTheme(initialTheme, false);

    loadSettings();
    applySettingsToForm();
    initConfigDropdowns();
    updateFormatPreview();
    populateUserInfo();
    initProfileTooltip();

    await refreshDataSummary();
    refreshBackupMeta();
  }

  function cacheElements() {
    elements.themeToggle = document.getElementById('themeToggle');
    elements.logoutButton = document.getElementById('logoutButton');
    elements.themeShortcutBtn = document.getElementById('themeShortcutBtn');
    elements.logoutShortcutBtn = document.getElementById('logoutShortcutBtn');
    elements.logoutNowBtn = document.getElementById('logoutNowBtn');

    elements.preferencesForm = document.getElementById('preferencesForm');
    elements.themePreference = document.getElementById('themePreference');
    elements.currencyPreference = document.getElementById('currencyPreference');
    elements.numberFormatPreference = document.getElementById('numberFormatPreference');
    elements.tooltipsPreference = document.getElementById('tooltipsPreference');
    elements.shortcutsPreference = document.getElementById('shortcutsPreference');
    elements.dateFormatPreference = document.getElementById('dateFormatPreference');
    elements.confirmDeletePreference = document.getElementById('confirmDeletePreference');
    elements.txPerPagePreference = document.getElementById('txPerPagePreference');
    elements.showCentsPreference = document.getElementById('showCentsPreference');
    elements.formatPreview = document.getElementById('formatPreview');
    elements.preferencesStatus = document.getElementById('preferencesStatus');

    elements.resetPreferencesBtn = document.getElementById('resetPreferencesBtn');

    elements.exportBackupBtn = document.getElementById('exportBackupBtn');
    elements.importBackupInput = document.getElementById('importBackupInput');
    elements.clearDataBtn = document.getElementById('clearDataBtn');
    elements.backupStatus = document.getElementById('backupStatus');
    elements.backupMeta = document.getElementById('backupMeta');

    elements.categoriesCount = document.getElementById('categoriesCount');
    elements.transactionsCount = document.getElementById('transactionsCount');
    elements.budgetsCount = document.getElementById('budgetsCount');

    elements.profileName = document.getElementById('profileName');
    elements.profileEmail = document.getElementById('profileEmail');
    elements.profileProvider = document.getElementById('profileProvider');
    elements.profileUid = document.getElementById('profileUid');
    elements.profileAvatarLarge = document.getElementById('profileAvatarLarge');
  }

  function attachEvents() {
    elements.themeToggle?.addEventListener('click', toggleTheme);
    elements.themeShortcutBtn?.addEventListener('click', toggleTheme);

    elements.logoutButton?.addEventListener('click', handleLogout);
    elements.logoutShortcutBtn?.addEventListener('click', handleLogout);
    elements.logoutNowBtn?.addEventListener('click', handleLogout);

    elements.preferencesForm?.addEventListener('submit', onSavePreferences);
    elements.resetPreferencesBtn?.addEventListener('click', onResetPreferences);

    elements.exportBackupBtn?.addEventListener('click', onExportBackup);
    elements.importBackupInput?.addEventListener('change', onImportBackup);
    elements.clearDataBtn?.addEventListener('click', onClearData);

    initGmailSection();
  }

  // ── Sección Gmail ──────────────────────────────────────────────────────────

  function initGmailSection() {
    const connectBtn = document.getElementById('gmailConnectBtn');
    const discBtn    = document.getElementById('gmailDisconnectBtn');

    if (!connectBtn && !discBtn) return;

    updateGmailStatus();

    connectBtn?.addEventListener('click', async () => {
      connectBtn.disabled = true;
      connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Conectando...';
      try {
        await window.GmailAPI.signInInteractive();
        updateGmailStatus();
      } catch (err) {
        if (err.message !== 'popup_blocked') {
          console.error('[Config] Error conectando Gmail:', err);
          window._configMostrarToast(err.message || 'Error al conectar con Gmail.', 'error');
        }
      } finally {
        connectBtn.disabled = false;
        connectBtn.innerHTML = '<i class="fas fa-plug"></i> Conectar Gmail';
      }
    });

    discBtn?.addEventListener('click', () => {
      window.GmailAPI?.signOut();
      updateGmailStatus();
    });
  }

  function waitForGmailAPI(cb) {
    if (window.GmailAPI) { cb(); return; }
    let n = 0;
    const t = setInterval(() => {
      if (window.GmailAPI) { clearInterval(t); cb(); }
      else if (++n > 30) clearInterval(t);
    }, 100);
  }

  function updateGmailStatus() {
    const dot     = document.getElementById('gmailStatusDot');
    const text    = document.getElementById('gmailStatusText');
    const conBtn  = document.getElementById('gmailConnectBtn');
    const discBtn = document.getElementById('gmailDisconnectBtn');
    if (!dot) return;

    waitForGmailAPI(() => {
      if (window.GmailAPI.isSignedIn()) {
        dot.style.background  = '';
        dot.classList.remove('dot-disconnected');
        dot.classList.add('dot-connected');
        text.textContent      = 'Conectado';
        conBtn.style.display  = 'none';
        discBtn.style.display = '';
      } else {
        dot.style.background  = '';
        dot.classList.remove('dot-connected');
        dot.classList.add('dot-disconnected');
        text.textContent      = 'Desconectado';
        conBtn.style.display  = '';
        discBtn.style.display = 'none';
      }
    });
  }

  // --- Custom dropdown helpers ---

  function getDropdownValue(id) {
    const el = document.getElementById(id);
    if (!el) return '';
    if (el.tagName === 'SELECT') return el.value;
    return el.querySelector('.custom-dropdown-selected')?.getAttribute('data-value') ?? '';
  }

  function setDropdownValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT') { el.value = String(value); return; }
    const selEl = el.querySelector('.custom-dropdown-selected');
    const opts = el.querySelectorAll('.custom-dropdown-option');
    opts.forEach(opt => {
      const match = opt.getAttribute('data-value') === String(value);
      opt.classList.toggle('selected', match);
      if (match && selEl) {
        selEl.querySelector('span').textContent = opt.textContent.trim();
        selEl.setAttribute('data-value', String(value));
      }
    });
  }

  function initConfigDropdowns() {
    const dropdowns = document.querySelectorAll('.preferences-card .custom-dropdown');
    dropdowns.forEach(dd => {
      const selEl = dd.querySelector('.custom-dropdown-selected');
      if (!selEl) return;

      selEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dd.classList.contains('open');
        document.querySelectorAll('.preferences-card .custom-dropdown.open').forEach(d => d.classList.remove('open'));
        if (!isOpen) dd.classList.add('open');
      });

      selEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selEl.click();
        } else if (e.key === 'Escape') {
          dd.classList.remove('open');
        }
      });

      dd.querySelectorAll('.custom-dropdown-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = opt.getAttribute('data-value');

          // Opcion especial: mostrar/ocultar panel de atajos sin guardar el valor
          if (dd.id === 'shortcutsPreference' && val === 'view') {
            dd.classList.remove('open');
            const panel = document.getElementById('shortcutsList');
            if (panel) panel.classList.toggle('hidden');
            return;
          }

          setDropdownValue(dd.id, val);
          dd.classList.remove('open');
          updateFormatPreview();
        });
      });
    });

    document.addEventListener('click', () => {
      document.querySelectorAll('.preferences-card .custom-dropdown.open').forEach(d => d.classList.remove('open'));
    });
  }

  // --- End custom dropdown helpers ---

  function sanitizeSettings(raw) {
    const safe = {
      theme: raw?.theme === 'light' ? 'light' : 'dark',
      currency: CURRENCY_LOCALE_MAP[raw?.currency] ? raw.currency : DEFAULT_SETTINGS.currency,
      numberFormat: raw?.numberFormat === 'eu' ? 'eu' : 'us',
      tooltips: raw?.tooltips === 'off' ? 'off' : 'on',
      shortcuts: raw?.shortcuts === 'off' ? 'off' : 'on',
      dateFormat: raw?.dateFormat === 'mdy' ? 'mdy' : 'dmy',
      confirmDelete: raw?.confirmDelete === 'off' ? 'off' : 'on',
      txPerPage: ['10','25','50','all'].includes(String(raw?.txPerPage)) ? String(raw.txPerPage) : '10',
      showCents: raw?.showCents === 'off' ? 'off' : 'on'
    };
    return safe;
  }

  function loadSettings() {
    const storedTheme = localStorage.getItem('theme') === 'light' ? 'light' : 'dark';

    try {
      const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      state.settings = { ...DEFAULT_SETTINGS, ...sanitizeSettings(raw) };

      // El tema visual activo es global para toda la app y debe prevalecer
      // sobre cualquier valor historico guardado dentro de SETTINGS_KEY.
      state.settings.theme = storedTheme;
    } catch {
      state.settings = { ...DEFAULT_SETTINGS, theme: storedTheme };
    }

    const activeTheme = state.settings.theme || storedTheme;
    applyTheme(activeTheme, true);
  }

  function applySettingsToForm() {
    setDropdownValue('themePreference', state.settings.theme || 'dark');
    setDropdownValue('currencyPreference', state.settings.currency);
    setDropdownValue('numberFormatPreference', state.settings.numberFormat);
    setDropdownValue('tooltipsPreference', state.settings.tooltips || 'on');
    setDropdownValue('shortcutsPreference', state.settings.shortcuts || 'on');
    setDropdownValue('dateFormatPreference', state.settings.dateFormat || 'dmy');
    setDropdownValue('confirmDeletePreference', state.settings.confirmDelete || 'on');
    setDropdownValue('txPerPagePreference', state.settings.txPerPage || 'all');
    setDropdownValue('showCentsPreference', state.settings.showCents || 'on');
  }

  function readSettingsFromForm() {
    return sanitizeSettings({
      theme: getDropdownValue('themePreference') || state.settings.theme,
      currency: getDropdownValue('currencyPreference'),
      numberFormat: getDropdownValue('numberFormatPreference'),
      tooltips: getDropdownValue('tooltipsPreference'),
      shortcuts: getDropdownValue('shortcutsPreference'),
      dateFormat: getDropdownValue('dateFormatPreference'),
      confirmDelete: getDropdownValue('confirmDeletePreference'),
      txPerPage: getDropdownValue('txPerPagePreference'),
      showCents: getDropdownValue('showCentsPreference')
    });
  }

  function onSavePreferences(event) {
    event.preventDefault();
    state.settings = readSettingsFromForm();
    persistSettings();
    applyTheme(state.settings.theme, true);
    updateFormatPreview();
    window._configMostrarToast('Preferencias guardadas correctamente.', 'success');
  }

  async function onResetPreferences() {
    const result = await confirmAction(
      'Restablecer preferencias',
      'Se restauraran los valores por defecto de visualizacion y formato.'
    );

    if (result !== 'confirm') return;

    state.settings = { ...DEFAULT_SETTINGS };
    persistSettings();
    applyTheme(state.settings.theme, true);
    applySettingsToForm();
    updateFormatPreview();
    window._configMostrarToast('Preferencias restablecidas.', 'success');
  }

  function persistSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    } catch {
      window._configMostrarToast('No se pudieron guardar las preferencias.', 'error');
    }

    // Sincronizar la moneda al perfil de Firestore para que el backend
    // (gmailPubSubHandler) use la moneda correcta al parsear correos bancarios.
    try {
      if (window.FirestoreDB && state.settings.currency) {
        window.FirestoreDB.saveSettings({ currency: state.settings.currency }).catch(() => {});
      }
    } catch (e) {
      // No bloquear si Firestore falla
    }
  }

  function toggleTheme() {
    const next = (localStorage.getItem('theme') || state.settings.theme) === 'light' ? 'dark' : 'light';
    applyTheme(next, true);

    state.settings.theme = next;
    persistSettings();
    applySettingsToForm();
    updateFormatPreview();
  }

  function applyTheme(theme, persist) {
    const normalized = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', normalized);
    document.body.setAttribute('data-theme', normalized);

    if (persist) {
      localStorage.setItem('theme', normalized);
    }

    updateThemeIcon(normalized);
  }

  function updateThemeIcon(theme) {
    const iconClass = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';

    const sidebarIcon = elements.themeToggle?.querySelector('i');
    if (sidebarIcon) sidebarIcon.className = iconClass;
  }

  function updateFormatPreview() {
    if (!elements.formatPreview) return;

    const currency = getDropdownValue('currencyPreference') || DEFAULT_SETTINGS.currency;
    const numberFormat = getDropdownValue('numberFormatPreference') === 'eu' ? 'eu' : 'us';
    const showCents = getDropdownValue('showCentsPreference') !== 'off';

    const sample = 1234.56;
    const money = formatCurrencyBySettings(sample, { currency, numberFormat, showCents });

    const date = formatDatePreview(new Date(), { numberFormat });
    elements.formatPreview.textContent = `${money} · ${date}`;
  }

  function formatCurrencyBySettings(value, settings) {
    const currencyMeta = CURRENCY_LOCALE_MAP[settings.currency] || CURRENCY_LOCALE_MAP.USD;
    const showCents = settings.showCents !== false && settings.showCents !== 'off';

    // Obtener el símbolo de moneda usando la configuración regional del propio currency
    // y solicitando la forma estrecha ('narrowSymbol') cuando esté disponible. Esto
    // evita que elegir un 'numberFormat' global (p.ej. 'eu') cambie el símbolo usado
    // para monedas locales como COP, que de otra forma podrían mostrarse como 'COP'.
    const symbolFormatter = new Intl.NumberFormat(currencyMeta.locale, {
      style: 'currency',
      currency: currencyMeta.currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0
    });

    const parts = symbolFormatter.formatToParts(value);
    const symbol = parts.filter(p => p.type === 'currency').map(p => p.value).join('').trim();

    // Formatear solo la parte numérica según la preferencia del usuario (US/EU)
    const numericLocale = settings.numberFormat === 'eu' ? 'es-ES' : 'en-US';
    const numberFormatter = new Intl.NumberFormat(numericLocale, {
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
      useGrouping: true
    });

    const amount = numberFormatter.format(value);

    // Para monedas que comparten el símbolo "$" (varios pesos latinoamericanos),
    // mostrar una etiqueta corta junto al signo para evitar ambigüedad.
    const shortLabelMap = {
      COP: 'COL', // Colombia
      DOP: 'RD',  // República Dominicana (RD$ en la UI)
      MXN: 'MX',  // México
      ARS: 'ARS', // Argentina
      CLP: 'CLP'  // Chile
    };

    if (symbol === '$') {
      // Mostrar solo '$' para USD; para los demás pesos mostrar etiqueta corta (COL$, RD$, MX$, etc.)
      if (currencyMeta.currency === 'USD') {
        return `${symbol}${amount}`;
      }
      const short = shortLabelMap[currencyMeta.currency] || currencyMeta.currency;
      return `${short}${symbol}${amount}`;
    }

    return `${symbol}${amount}`;
  }

  function formatDatePreview(date, settings) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());
    const format = getDropdownValue && typeof getDropdownValue === 'function'
      ? getDropdownValue('dateFormatPreference')
      : settings?.dateFormat;

    if (format === 'mdy') {
      return `${month} / ${day} / ${year}`;
    }

    return `${day} / ${month} / ${year}`;
  }

  async function refreshDataSummary() {
    if (!store) {
      setStatus(elements.backupStatus, 'No se pudo inicializar el almacenamiento de datos.', 'error');
      return;
    }

    try {
      const loaded = await store.load();
      state.snapshot = normalizeState(loaded);

      try {
        const rootCategories = JSON.parse(localStorage.getItem('categories') || '[]');
        if (rootCategories.length > 0 && state.snapshot.categories.length === 0) {
          state.snapshot.categories = rootCategories;
        }
        
        const rootTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
        if (rootTransactions.length > 0 && state.snapshot.transactions.length === 0) {
          state.snapshot.transactions = rootTransactions;
        }

        const rootBudgets = JSON.parse(localStorage.getItem('finanzapp:budgets') || 'null');
        if (rootBudgets && Object.keys(rootBudgets).length > 0 && Object.keys(state.snapshot.budgets).length === 0) {
          state.snapshot.budgets = rootBudgets;
        }
      } catch (e) {}

      const categoryCount = state.snapshot.categories.length;
      const txCount = countTransactions(state.snapshot);
      const budgetCount = countBudgets(state.snapshot);

      if (elements.categoriesCount) elements.categoriesCount.textContent = String(categoryCount);
      if (elements.transactionsCount) elements.transactionsCount.textContent = String(txCount);
      if (elements.budgetsCount) elements.budgetsCount.textContent = String(budgetCount);
    } catch (error) {
      console.error('Error cargando resumen de datos:', error);
      setStatus(elements.backupStatus, 'No se pudo leer el estado actual de tus datos.', 'error');
    }
  }

  function normalizeState(raw) {
    const normalized = {
      transactions: Array.isArray(raw?.transactions) ? raw.transactions : [],
      categories: Array.isArray(raw?.categories) ? raw.categories : [],
      budgets: raw?.budgets && typeof raw.budgets === 'object' ? raw.budgets : {}
    };

    return normalized;
  }

  function countTransactions(snapshot) {
    const topLevel = Array.isArray(snapshot.transactions) ? snapshot.transactions.length : 0;
    const nested = (snapshot.categories || []).reduce((sum, category) => {
      return sum + (Array.isArray(category?.transactions) ? category.transactions.length : 0);
    }, 0);

    return Math.max(topLevel, nested);
  }

  function countBudgets(snapshot) {
    if (Array.isArray(snapshot.budgets)) {
      return snapshot.budgets.length;
    }

    if (snapshot.budgets && typeof snapshot.budgets === 'object') {
      return Object.keys(snapshot.budgets).length;
    }

    return 0;
  }

  async function onExportBackup() {
    if (!store) return;

    try {
      const loaded = await store.load();
      state.snapshot = normalizeState(loaded);

      try {
        const rootCategories = JSON.parse(localStorage.getItem('categories') || '[]');
        if (rootCategories.length > 0 && state.snapshot.categories.length === 0) {
          state.snapshot.categories = rootCategories;
        }
        
        const rootTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
        if (rootTransactions.length > 0 && state.snapshot.transactions.length === 0) {
          state.snapshot.transactions = rootTransactions;
        }

        const rootBudgets = JSON.parse(localStorage.getItem('finanzapp:budgets') || 'null');
        if (rootBudgets && Object.keys(rootBudgets).length > 0 && Object.keys(state.snapshot.budgets).length === 0) {
          state.snapshot.budgets = rootBudgets;
        }
      } catch (e) {
        console.warn('Error reading root localStorage for export:', e);
      }

      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: state.settings,
        state: state.snapshot
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const now = new Date();
      const filename = `finanzapp-respaldo-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      localStorage.setItem(LAST_BACKUP_KEY, payload.exportedAt);
      refreshBackupMeta();
      // Mostrar toast en lugar de mensaje en la UI de estado
      if (typeof window._configMostrarToast === 'function') {
        window._configMostrarToast('Respaldo exportado correctamente.', 'success');
      } else {
        setStatus(elements.backupStatus, 'Respaldo exportado correctamente.', 'success');
      }
    } catch (error) {
      console.error('Error exportando respaldo:', error);
      setStatus(elements.backupStatus, 'No se pudo exportar el respaldo.', 'error');
    }
  }

  async function onImportBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const payload = normalizeImportPayload(parsed);

      if (!payload) {
        throw new Error('Formato de respaldo invalido.');
      }

      const result = await confirmAction(
        'Importar respaldo',
        'Esta accion reemplazara tus datos actuales por los del archivo seleccionado.',
        { emphasis: 'danger' }
      );

      if (result !== 'confirm') {
        return;
      }

      if (!store) {
        throw new Error('No hay almacenamiento disponible para importar datos.');
      }

      await store.save(payload.state);
      state.snapshot = payload.state;

      try {
        localStorage.setItem('categories', JSON.stringify(payload.state.categories || []));
        localStorage.setItem('transactions', JSON.stringify(payload.state.transactions || []));
        localStorage.setItem('finanzapp:budgets', JSON.stringify(payload.state.budgets || {}));
        localStorage.setItem('budgets', JSON.stringify(payload.state.budgets || {}));
      } catch (e) {
        console.warn('Error writing to root localStorage for import:', e);
      }

      if (payload.settings) {
        state.settings = { ...DEFAULT_SETTINGS, ...payload.settings };
        persistSettings();
        applyTheme(state.settings.theme, true);
        applySettingsToForm();
        updateFormatPreview();
      }

      localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
      refreshBackupMeta();
      await refreshDataSummary();

      setStatus(elements.backupStatus, 'Respaldo importado y aplicado correctamente.', 'success');
    } catch (error) {
      console.error('Error importando respaldo:', error);
      setStatus(elements.backupStatus, 'No se pudo importar el respaldo. Verifica el archivo.', 'error');
    } finally {
      event.target.value = '';
    }
  }

  function normalizeImportPayload(parsed) {
    if (!parsed || typeof parsed !== 'object') return null;

    const sourceState = parsed.state && typeof parsed.state === 'object'
      ? parsed.state
      : parsed;

    if (!sourceState) return null;

    const normalizedState = normalizeState(sourceState);

    const hasData =
      normalizedState.transactions.length > 0 ||
      normalizedState.categories.length > 0 ||
      countBudgets(normalizedState) > 0;

    if (!hasData && !parsed.state) {
      return null;
    }

    const settings = parsed.settings ? sanitizeSettings(parsed.settings) : null;

    return {
      state: normalizedState,
      settings
    };
  }

  async function onClearData() {
    const result = await confirmAction(
      'Reiniciar datos financieros',
      'Se eliminaran todas las categorias, transacciones y presupuestos de este usuario.',
      { emphasis: 'danger' }
    );

    if (result !== 'confirm') return;

    try {
      if (!store) {
        throw new Error('No se pudo acceder al almacenamiento para borrar datos.');
      }

      const emptyState = {
        transactions: [],
        categories: [],
        budgets: {}
      };

      await store.save(emptyState);
      state.snapshot = emptyState;

      try {
        localStorage.setItem('categories', '[]');
        localStorage.setItem('transactions', '[]');
        localStorage.setItem('finanzapp:budgets', '[]');
        localStorage.setItem('budgets', '{}');
      } catch (e) {}

      await refreshDataSummary();
      setStatus(elements.backupStatus, 'Datos reiniciados correctamente.', 'success');
    } catch (error) {
      console.error('Error reiniciando datos:', error);
      setStatus(elements.backupStatus, 'No fue posible reiniciar los datos.', 'error');
    }
  }

  

  function refreshBackupMeta() {
    if (!elements.backupMeta) return;

    const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
    if (!lastBackup) {
      elements.backupMeta.textContent = 'Sin respaldo exportado en esta sesion.';
      return;
    }

    const date = new Date(lastBackup);
    if (Number.isNaN(date.getTime())) {
      elements.backupMeta.textContent = 'Sin respaldo exportado en esta sesion.';
      return;
    }

    elements.backupMeta.textContent = `Ultimo respaldo: ${date.toLocaleString('es-ES')}`;
  }

  function setStatus(target, text, type) {
    if (!target) return;

    target.textContent = text;
    target.classList.remove('is-success', 'is-error');

    if (type === 'error') {
      target.classList.add('is-error');
    } else if (type === 'success') {
      target.classList.add('is-success');
    }
  }

  (function () {
    let _toastContainer = null;
    function _getToastContainer() {
      if (!_toastContainer) {
        _toastContainer = document.createElement('div');
        _toastContainer.className = 'toast-container';
        document.body.appendChild(_toastContainer);
      }
      return _toastContainer;
    }
    function _hideToast(toast) {
      if (!toast) return;
      if (toast._t) { clearTimeout(toast._t); toast._t = null; }
      toast.classList.remove('show');
      toast.classList.add('hide');
      setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 400);
    }
    window._configMostrarToast = function (message, variant) {
      if (window.__appTooltips === false) return;
      const container = _getToastContainer();
      const toast = document.createElement('div');
      toast.className = 'toast toast-' + (variant || 'success');
      toast.setAttribute('role', variant === 'error' ? 'alert' : 'status');
      toast.setAttribute('aria-live', variant === 'error' ? 'assertive' : 'polite');
      toast.setAttribute('aria-atomic', 'true');
      const content = document.createElement('div');
      content.className = 'toast-content';
      content.textContent = String(message ?? '');
      const btn = document.createElement('button');
      btn.className = 'toast-close';
      btn.setAttribute('aria-label', 'Cerrar');
      btn.innerHTML = '&times;';
      btn.onclick = () => _hideToast(toast);
      toast.append(content, btn);
      container.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add('show'));
      toast._t = setTimeout(() => _hideToast(toast), 3000);
      while (container.children.length > 3) {
        const first = container.firstElementChild;
        if (first._t) { clearTimeout(first._t); first._t = null; }
        if (first.parentNode) first.parentNode.removeChild(first);
      }
    };
  })();

  async function handleLogout() {
    const result = await confirmAction(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas cerrar sesión?',
      { emphasis: 'danger' }
    );

    if (result !== 'confirm') return;

    localStorage.removeItem('loggedIn');
    localStorage.removeItem('authUser');
    window.location.href = '../Login/Login.html';
  }

  function confirmAction(title, message, options = {}) {
    if (typeof window.showAlert === 'function') {
      return window.showAlert(title, message, {
        variant: 'confirm',
        ...options
      });
    }

    const ok = window.confirm(message);
    return Promise.resolve(ok ? 'confirm' : 'cancel');
  }

  function populateUserInfo() {
    const profile = getProfile();
    const displayName = profile.name || profile.displayName || profile.email?.split('@')[0] || 'Usuario';
    const displayEmail = profile.email || '';
    const provider = profile.provider || (profile.uid === 'guest' ? 'guest' : 'local');
    const providerLabel = provider === 'google' ? 'Google' : (provider === 'guest' ? 'Invitado' : 'Cuenta local');
    const uidShort = profile.uid ? String(profile.uid).slice(0, 12) : 'Sin UID';

    if (elements.profileName) elements.profileName.textContent = displayName;
    if (elements.profileEmail) elements.profileEmail.textContent = displayEmail || 'Sin correo asociado';
    if (elements.profileProvider) elements.profileProvider.textContent = providerLabel;
    if (elements.profileUid) elements.profileUid.textContent = uidShort;

    const sidebarName = document.querySelector('.sidebar .user-name');
    const sidebarEmail = document.querySelector('.sidebar .user-email');
    const sidebarAvatar = document.querySelector('.sidebar .user-avatar');

    if (sidebarName) sidebarName.textContent = displayName;
    if (sidebarEmail) {
      sidebarEmail.textContent = displayEmail;
      sidebarEmail.style.display = displayEmail ? 'block' : 'none';
    }

    renderAvatar(sidebarAvatar, displayName, profile.picture || profile.photoURL);
    renderAvatar(elements.profileAvatarLarge, displayName, profile.picture || profile.photoURL);

    const tooltipName = document.querySelector('#profileTooltip .tooltip-name');
    const tooltipEmail = document.querySelector('#profileTooltip .tooltip-email');
    if (tooltipName) tooltipName.textContent = displayName;
    if (tooltipEmail) {
      tooltipEmail.textContent = displayEmail;
      tooltipEmail.style.display = displayEmail ? 'block' : 'none';
    }
  }

  function getProfile() {
    try {
      const raw = localStorage.getItem('authUser');
      if (!raw || raw === 'guest') {
        return { name: 'Invitado', email: '', uid: 'guest', provider: 'guest' };
      }

      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object'
        ? parsed
        : { name: 'Usuario', email: '', uid: 'guest', provider: 'local' };
    } catch {
      return { name: 'Usuario', email: '', uid: 'guest', provider: 'local' };
    }
  }

  function renderAvatar(container, name, pictureUrl) {
    if (!container) return;

    container.innerHTML = '';
    if (pictureUrl) {
      const img = document.createElement('img');
      img.src = pictureUrl;
      img.alt = name || 'Usuario';
      container.appendChild(img);
      return;
    }

    const initial = (name || 'U').trim().charAt(0).toUpperCase();
    container.textContent = initial || 'U';
  }

  function initProfileTooltip() {
    const userInfo = document.getElementById('userInfoHover') || document.querySelector('.sidebar .user-info');
    const tooltip = document.getElementById('profileTooltip');
    if (!userInfo || !tooltip) return;

    let hideTimeout;

    function showTooltip() {
      clearTimeout(hideTimeout);
      tooltip.classList.add('show');
    }

    function hideTooltip() {
      hideTimeout = setTimeout(() => {
        tooltip.classList.remove('show');
      }, 180);
    }

    userInfo.addEventListener('mouseenter', showTooltip);
    userInfo.addEventListener('mouseleave', hideTooltip);
    tooltip.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
    tooltip.addEventListener('mouseleave', hideTooltip);
  }

  /**
   * Controlador de página que extiende BasePage.
   * Delega el bootstrap completo a `init()` y registra
   * la recarga de datos ante eventos cross-tab.
   *
   * @extends {window.BasePage}
   */
  class ConfiguracionApp extends window.BasePage {
    /**
     * Punto de entrada tras DOMContentLoaded.
     * Llama a `init()` que gestiona DOM, eventos y carga de datos.
     *
     * @override
     * @returns {Promise<void>}
     */
    async _init() {
      await init();
      this._bindCrossTabEvents();
    }

    /**
     * Suscribe a `datos:actualizados` para recargar el resumen
     * de datos cuando otra pestaña persiste cambios.
     *
     * @override
     */
    _bindCrossTabEvents() {
      if (!window.DataEvents) return;
      window.DataEvents.on('datos:actualizados', async () => {
        await refreshDataSummary();
      });
    }
  }

  const _configuracionApp = new ConfiguracionApp(); // eslint-disable-line no-unused-vars
})();
