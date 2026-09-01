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
  });

  const CURRENCY_LOCALE_MAP = {
    DOP: { locale: 'es-DO', currency: 'DOP' },
    USD: { locale: 'en-US', currency: 'USD' },
    EUR: { locale: 'es-ES', currency: 'EUR' }
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
    elements.categoryViewPreference = document.getElementById('categoryViewPreference');
    elements.currencyPreference = document.getElementById('currencyPreference');
    elements.numberFormatPreference = document.getElementById('numberFormatPreference');
    elements.tooltipsPreference = document.getElementById('tooltipsPreference');
    elements.shortcutsPreference = document.getElementById('shortcutsPreference');
    elements.dateFormatPreference = document.getElementById('dateFormatPreference');
    elements.confirmDeletePreference = document.getElementById('confirmDeletePreference');
    elements.autoRenewBudgetsPreference = document.getElementById('autoRenewBudgetsPreference');
    elements.txPerPagePreference = document.getElementById('txPerPagePreference');
    elements.showCentsPreference = document.getElementById('showCentsPreference');
    elements.censorAmountsPreference = document.getElementById('censorAmountsPreference');
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

    window.addEventListener('storage', (e) => {
      if (e.key === 'theme' && e.newValue) {
        applyTheme(e.newValue, false);
        setDropdownValue('themePreference', e.newValue);
      }
    });

    initImapSection();
  }

  // ── Sección IMAP ──────────────────────────────────────────────────────────

  function initImapSection() {
    const saveBtn = document.getElementById('saveImapBtn');
    const syncBtn = document.getElementById('syncImapBtn');
    const openTutorialBtn = document.getElementById('openTutorialBtn');
    const closeTutorialBtn = document.getElementById('closeTutorialBtn');
    const tutorialModal = document.getElementById('tutorialModal');
    const overlay = document.getElementById('alertOverlay');
    
    if (openTutorialBtn && tutorialModal) {
      openTutorialBtn.addEventListener('click', (e) => {
        e.preventDefault();
        tutorialModal.classList.remove('hidden');
        tutorialModal.style.display = 'block';
        if (overlay) {
          overlay.classList.remove('hidden');
          overlay.style.display = 'block';
        }
      });
    }

    if (closeTutorialBtn && tutorialModal) {
      closeTutorialBtn.addEventListener('click', (e) => {
        e.preventDefault();
        tutorialModal.classList.add('hidden');
        tutorialModal.style.display = 'none';
        if (overlay) {
          overlay.classList.add('hidden');
          overlay.style.display = 'none';
        }
      });
    }

    // Permitir cerrar haciendo clic en el overlay
    if (overlay && tutorialModal) {
      overlay.addEventListener('click', () => {
        if (!tutorialModal.classList.contains('hidden') && tutorialModal.style.display !== 'none') {
          tutorialModal.classList.add('hidden');
          tutorialModal.style.display = 'none';
          overlay.classList.add('hidden');
          overlay.style.display = 'none';
        }
      });
    }

    const toggleBtn = document.getElementById('toggleImapPassword');
    const passInput = document.getElementById('imapPassword');
    const passIcon = document.getElementById('toggleImapPasswordIcon');

    if (toggleBtn && passInput) {
      toggleBtn.addEventListener('click', () => {
        const isPassword = passInput.type === 'password';
        passInput.type = isPassword ? 'text' : 'password';
        if (passIcon) {
          passIcon.className = isPassword ? 'far fa-eye-slash' : 'far fa-eye';
        }
      });
    }
    
    if (!saveBtn) return;

    // Cargar credenciales guardadas
    loadImapCredentials();

    saveBtn.addEventListener('click', async () => {
      const email = document.getElementById('imapEmail').value.trim();
      const password = document.getElementById('imapPassword').value.replace(/\s+/g, '').trim();
      const senders = document.getElementById('imapSenders').value.split(',').map(s => s.trim()).filter(Boolean);

      if (!email || !password || senders.length === 0) {
        if (typeof window._configMostrarToast === 'function') {
          window._configMostrarToast('Por favor completa todos los campos.', 'error');
        }
        return;
      }

      if (password.length !== 16) {
        if (typeof window._configMostrarToast === 'function') {
          window._configMostrarToast(`La Contraseña de App de Google debe tener exactamente 16 letras (sin espacios). La que ingresaste tiene ${password.length} caracteres.`, 'error');
        }
        return;
      }

      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

      try {
        if (window.FirestoreDB) {
          await window.FirestoreDB.saveImapSettings({ email, appPassword: password, targetSenders: senders });
          if (syncBtn) syncBtn.style.display = 'inline-flex';
          if (typeof window._configMostrarToast === 'function') {
            window._configMostrarToast('Credenciales guardadas correctamente.', 'success');
          }
        }
      } catch (e) {
        console.error('Error al guardar IMAP', e);
        if (typeof window._configMostrarToast === 'function') {
          window._configMostrarToast('Error al guardar. Verifica tu conexión.', 'error');
        }
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Guardar';
      }
    });

    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        syncBtn.disabled = true;
        syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';

        try {
          if (window.SyncAPI && typeof window.SyncAPI.syncImapOnDemand === 'function') {
            const result = await window.SyncAPI.syncImapOnDemand();
            
            if (result && Array.isArray(result.transactions) && result.transactions.length > 0) {
                if (window.FirestoreDB?.ensureFirebaseInitialized) {
                  window.FirestoreDB.ensureFirebaseInitialized();
                }
                const user = (window.firebase && window.firebase.apps && window.firebase.apps.length > 0 && typeof window.firebase.auth === 'function')
                  ? window.firebase.auth().currentUser
                  : null;
                const storageKey = user ? `finanzapp:gmail:pending_notifications:${user.uid}` : 'finanzapp:gmail:pending_notifications';
                const rawExisting = localStorage.getItem(storageKey) || '[]';
                let existing = Array.isArray(JSON.parse(rawExisting)) ? JSON.parse(rawExisting) : [];
                const existingKeys = new Set(existing.map(n => n.id || `${n.amount}_${n.description}_${n.date}`));

                for (const tx of result.transactions) {
                  const key = tx.id || `${tx.amount}_${tx.description}_${tx.date}`;
                  if (!existingKeys.has(key)) {
                    existing.push({
                      id: tx.id || ('notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
                      amount: tx.amount,
                      description: tx.description || 'Transacción Bancaria',
                      subject: tx.subject || '',
                      date: tx.date || new Date().toISOString(),
                      type: tx.type || 'expense',
                      timestamp: Date.now()
                    });
                    existingKeys.add(key);
                  }
                }

                localStorage.setItem(storageKey, JSON.stringify(existing));
                window.dispatchEvent(new CustomEvent('finanzapp:gmail:notifications-updated'));
              } catch (err) {
                console.warn('Error saving notifications to localStorage', err);
              }
            }

            if (typeof window._configMostrarToast === 'function') {
              window._configMostrarToast('Sincronización completada: ' + (result.count || 0) + ' transacciones nuevas.', 'success');
            }
          } else {
            throw new Error('SyncAPI no disponible');
          }
        } catch (e) {
          console.error(e);
          if (typeof window._configMostrarToast === 'function') {
            window._configMostrarToast(e.message || 'Error al sincronizar.', 'error');
          }
        } finally {
          syncBtn.disabled = false;
          syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Sincronizar';
        }
      });
    }
  }
  
  async function loadImapCredentials() {
    if (!window.FirestoreDB) return;
    try {
      const settings = await window.FirestoreDB.getImapSettings();
      if (settings) {
        if (settings.email) document.getElementById('imapEmail').value = settings.email;
        if (settings.appPassword) document.getElementById('imapPassword').value = settings.appPassword;
        if (settings.targetSenders) document.getElementById('imapSenders').value = settings.targetSenders.join(', ');
        const syncBtn = document.getElementById('syncImapBtn');
        if (syncBtn) syncBtn.style.display = 'inline-flex';
      }
    } catch (e) {
      console.warn('Error loading IMAP settings', e);
    }
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

          if (dd.id === 'themePreference') {
            applyTheme(val, true);
            state.settings.theme = val;
            persistSettings();
          }

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
      categoryViewMode: raw?.categoryViewMode === 'extended' ? 'extended' : 'compact',
      currency: CURRENCY_LOCALE_MAP[raw?.currency] ? raw.currency : DEFAULT_SETTINGS.currency,
      numberFormat: raw?.numberFormat === 'eu' ? 'eu' : 'us',
      tooltips: raw?.tooltips === 'off' ? 'off' : 'on',
      shortcuts: raw?.shortcuts === 'off' ? 'off' : 'on',
      dateFormat: raw?.dateFormat === 'mdy' ? 'mdy' : 'dmy',
      confirmDelete: raw?.confirmDelete === 'off' ? 'off' : 'on',
      autoRenewBudgets: raw?.autoRenewBudgets === 'off' ? 'off' : 'on',
      txPerPage: ['10','25','50','all'].includes(String(raw?.txPerPage)) ? String(raw.txPerPage) : '10',
      showCents: raw?.showCents === 'on' ? 'on' : 'off',
      censorAmounts: raw?.censorAmounts === 'on' ? 'on' : 'off'
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
    setDropdownValue('categoryViewPreference', state.settings.categoryViewMode || 'compact');
    setDropdownValue('currencyPreference', state.settings.currency || 'DOP');
    setDropdownValue('numberFormatPreference', state.settings.numberFormat || 'us');
    setDropdownValue('tooltipsPreference', state.settings.tooltips || 'on');
    setDropdownValue('shortcutsPreference', state.settings.shortcuts || 'on');
    setDropdownValue('dateFormatPreference', state.settings.dateFormat || 'dmy');
    setDropdownValue('confirmDeletePreference', state.settings.confirmDelete || 'on');
    setDropdownValue('autoRenewBudgetsPreference', state.settings.autoRenewBudgets || 'on');
    setDropdownValue('txPerPagePreference', state.settings.txPerPage || '10');
    setDropdownValue('showCentsPreference', state.settings.showCents || 'off');
    setDropdownValue('censorAmountsPreference', state.settings.censorAmounts || 'off');
  }

  function readSettingsFromForm() {
    return sanitizeSettings({
      theme: getDropdownValue('themePreference') || state.settings.theme,
      categoryViewMode: getDropdownValue('categoryViewPreference') || state.settings.categoryViewMode,
      currency: getDropdownValue('currencyPreference'),
      numberFormat: getDropdownValue('numberFormatPreference'),
      tooltips: getDropdownValue('tooltipsPreference'),
      shortcuts: getDropdownValue('shortcutsPreference'),
      dateFormat: getDropdownValue('dateFormatPreference'),
      confirmDelete: getDropdownValue('confirmDeletePreference'),
      autoRenewBudgets: getDropdownValue('autoRenewBudgetsPreference'),
      txPerPage: getDropdownValue('txPerPagePreference'),
      showCents: getDropdownValue('showCentsPreference'),
      censorAmounts: getDropdownValue('censorAmountsPreference') || state.settings.censorAmounts
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
      if (state.settings.theme) {
        localStorage.setItem('theme', state.settings.theme);
      }
      // Actualizar flag global y clase para censura inmediata en esta misma pestaña
      try {
        if (window.Core?.helpers && window.Helpers) {
          window.Helpers.applyAppSettings();
        } else if (window.Helpers) {
          window.Helpers.applyAppSettings();
        }
        // Toggle clase global
        const censored = state.settings.censorAmounts === 'on';
        document.documentElement.classList.toggle('censor-amounts', censored);
        if (document.body) document.body.classList.toggle('censor-amounts', censored);
        window.__appCensorAmounts = censored;
      } catch {}
      // Notificar a otras pestañas / páginas
      try {
        window.dispatchEvent(new CustomEvent('finanzapp:settings:updated', { detail: state.settings }));
        window.dispatchEvent(new StorageEvent('storage', { key: SETTINGS_KEY, newValue: JSON.stringify(state.settings) }));
      } catch {}
    } catch {
      window._configMostrarToast('No se pudieron guardar las preferencias.', 'error');
    }

    // Sincronizar TODA la configuración a Firestore para que se sincronice en tiempo real en todos los dispositivos
    try {
      if (window.FirestoreDB) {
        window.FirestoreDB.saveSettings(state.settings).catch(() => {});
      }
    } catch (e) {
      // No bloquear si Firestore falla
    }
  }


  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || localStorage.getItem('theme') || state.settings.theme || 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    state.settings.theme = next;
    applyTheme(next, true);
    persistSettings();
    applySettingsToForm();
    updateFormatPreview();
  }

  function applyTheme(theme, persist) {
    const normalized = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', normalized);
    document.body.setAttribute('data-theme', normalized);
    document.documentElement.style.backgroundColor = normalized === 'light' ? '#f5efea' : '#191724';
    document.body.style.backgroundColor = normalized === 'light' ? '#f5efea' : '#191724';

    if (persist) {
      localStorage.setItem('theme', normalized);
      try {
        state.settings.theme = normalized;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
        if (window.FirestoreDB && typeof window.FirestoreDB.saveSettings === 'function' && window.FirestoreDB.currentUserId) {
          window.FirestoreDB.saveSettings(state.settings).catch(() => {});
        }
      } catch (e) {}
    }

    updateThemeIcon(normalized);
  }

  window.addEventListener('storage', (e) => {
    if (e.key === 'theme' && e.newValue) {
      applyTheme(e.newValue, false);
      if (state.settings) state.settings.theme = e.newValue;
      try { applySettingsToForm(); } catch (err) {}
    }
  });

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
    // La vista previa nunca se censura, incluso si "Censurar montos" está activado
    const money = formatCurrencyBySettings(sample, { currency, numberFormat, showCents });

    const date = formatDatePreview(new Date(), { numberFormat });
    elements.formatPreview.innerHTML = `<span>${money}</span><span class="preview-separator"> · </span><span>${date}</span>`;
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

  const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_IMPORT_STRING_LENGTH = 5000;
  const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  function hasForbiddenKeys(value) {
    if (value === null || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some(hasForbiddenKeys);
    return Object.keys(value).some(key => FORBIDDEN_KEYS.has(key)) ||
           Object.values(value).some(hasForbiddenKeys);
  }

  function isValidImportAmount(amount) {
    return typeof amount === 'number' && Number.isFinite(amount) && Math.abs(amount) <= 1e12;
  }

  function isValidImportDate(value) {
    if (value instanceof Date) return !isNaN(value.getTime());
    if (typeof value !== 'string') return false;
    return !isNaN(new Date(value).getTime());
  }

  function isValidImportString(value) {
    return typeof value !== 'string' || value.length <= MAX_IMPORT_STRING_LENGTH;
  }

  function validateImportPayload(state) {
    if (!state || typeof state !== 'object') return false;

    const transactions = Array.isArray(state.transactions) ? state.transactions : [];
    for (const t of transactions) {
      if (!isValidImportAmount(t?.amount)) return false;
      if (!isValidImportDate(t?.date)) return false;
      if (!isValidImportString(t?.description)) return false;
      if (!isValidImportString(t?.id)) return false;
    }

    const categories = Array.isArray(state.categories) ? state.categories : [];
    for (const c of categories) {
      if (!isValidImportString(c?.name)) return false;
      if (!isValidImportString(c?.id)) return false;
      const nested = Array.isArray(c?.transactions) ? c.transactions : [];
      for (const t of nested) {
        if (!isValidImportAmount(t?.amount)) return false;
        if (!isValidImportDate(t?.date)) return false;
        if (!isValidImportString(t?.description)) return false;
        if (!isValidImportString(t?.id)) return false;
      }
    }

    return true;
  }

  function normalizeState(raw) {
    if (!raw || typeof raw !== 'object') {
      return {
        transactions: [],
        categories: [],
        budgets: {}
      };
    }

    if (hasForbiddenKeys(raw)) {
      throw new Error('Formato de respaldo no válido.');
    }

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
      if (file.size > MAX_IMPORT_FILE_SIZE) {
        throw new Error('El archivo de respaldo es demasiado grande.');
      }

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
    if (!parsed || typeof parsed !== 'object' || hasForbiddenKeys(parsed)) return null;

    const sourceState = parsed.state && typeof parsed.state === 'object'
      ? parsed.state
      : parsed;

    if (!sourceState || hasForbiddenKeys(sourceState)) return null;

    const normalizedState = normalizeState(sourceState);

    if (!validateImportPayload(normalizedState)) return null;

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
      'Se eliminaran todas tus categorias y presupuestos. Esta accion no se puede deshacer.',
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

      // Guardar estado vacio via DataStore (local + Firestore si hay sesion)
      await store.save(emptyState);
      state.snapshot = emptyState;

      // Asegurar persistencia en Firestore directamente, incluso si DataStore.save
      // no pudo sincronizar por falta de sesion inicial (race con waitForAuth).
      // IMPORTANTE: borrar también las subcolecciones antiguas `transactions` y
      // `categories` que FirestoreDB.loadAll rescata automáticamente si el
      // documento principal queda vacío. Sin borrarlas, los 95 transacciones
      // y 12 categorías vuelven a aparecer tras el reinicio.
      try {
        if (window.FirestoreDB && window.firebase) {
          if (!window.FirestoreDB.initialized || !window.FirestoreDB.currentUserId) {
            try {
              const uid = await window.FirestoreDB.waitForAuth(3000);
              if (uid) {
                await window.FirestoreDB.init(uid);
                window.FirestoreDB.setCurrentUser(uid);
              }
            } catch {}
          }
          if (window.FirestoreDB.initialized && window.FirestoreDB.currentUserId && window.FirestoreDB.db) {
            const userRef = window.FirestoreDB._userDoc();
            // Borrar subcolecciones legacy que causan el rescate
            try {
              const txSnap = await userRef.collection('transactions').get();
              const catSnap = await userRef.collection('categories').get();
              const allDocs = [...(txSnap.docs || []), ...(catSnap.docs || [])];
              if (allDocs.length > 0) {
                // Firestore limita a 500 ops por batch
                const chunks = [];
                for (let i = 0; i < allDocs.length; i += 450) chunks.push(allDocs.slice(i, i + 450));
                for (const chunk of chunks) {
                  const batch = window.FirestoreDB.db.batch();
                  chunk.forEach(d => batch.delete(d.ref));
                  await batch.commit();
                }
                console.log('[Configuracion] Subcolecciones antiguas borradas:', allDocs.length, 'docs');
              }
            } catch (e) {
              console.warn('[Configuracion] No se pudieron borrar subcolecciones:', e);
            }
            await window.FirestoreDB.saveAll(emptyState);
          }
        }
      } catch (e) {
        console.warn('[Configuracion] No se pudo limpiar Firestore directamente:', e);
      }

      // Limpieza exhaustiva de localStorage: borrar TODAS las variantes
      // prefijadas por usuario y claves legacy, para evitar que boot() de
      // Categorias re-hidrate datos antiguos o vuelva a sembrar defaults.
      try {
        const prefix = 'finanzapp:data:v1';
        // Recoger todos los uids que aparecen en localStorage
        const uids = new Set();
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k || !k.startsWith(prefix + ':')) continue;
          const parts = k.split(':');
          // formato: finanzapp:data:v1:{uid}:categories|transactions|budgets
          if (parts.length >= 4) {
            const uid = parts.slice(3, parts.length - 1).join(':');
            if (uid) uids.add(uid);
          }
        }
        // Incluir tambien uid actual por si no habia claves aún
        try {
          const raw = localStorage.getItem('authUser');
          if (raw && raw !== 'guest') {
            const u = JSON.parse(raw);
            const cur = u.uid || u.email || 'guest';
            if (cur) uids.add(cur);
          } else {
            uids.add('guest');
          }
        } catch { uids.add('guest'); }

        uids.forEach(uid => {
          try {
            localStorage.setItem(`${prefix}:${uid}:categories`, '[]');
            localStorage.setItem(`${prefix}:${uid}:transactions`, '[]');
            localStorage.setItem(`${prefix}:${uid}:budgets`, '{}');
          } catch {}
        });

        // Claves legacy / fallback que usan Presupuestos/Categorias
        localStorage.setItem('categories', '[]');
        localStorage.setItem('transactions', '[]');
        localStorage.setItem('budgets', '{}');
        localStorage.setItem('finanzapp:budgets', JSON.stringify([]));
        // Tambien limpiar posibles objetos sueltos
        try { localStorage.removeItem('finanzapp:budgets:backup'); } catch {}
      } catch (e) {}

      // Notificar a las demas paginas / pestañas que los datos fueron reiniciados
      try {
        window.dispatchEvent(new CustomEvent('finanzapp:data:updated', { detail: emptyState }));
        if (window.DataEvents && typeof window.DataEvents.emit === 'function') {
          window.DataEvents.emit('datos:actualizados', emptyState);
          window.DataEvents.emit('transactionChanged', { action: 'clearAll' });
        }
      } catch {}

      await refreshDataSummary();
      if (typeof window._configMostrarToast === 'function') {
        window._configMostrarToast('Categorias y presupuestos eliminados correctamente.', 'success');
      } else {
        setStatus(elements.backupStatus, 'Categorias y presupuestos eliminados correctamente.', 'success');
      }
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

  const _statusTimers = new WeakMap();

  function setStatus(target, text, type, duration = 5000) {
    if (!target) return;

    if (_statusTimers.has(target)) {
      clearTimeout(_statusTimers.get(target));
      _statusTimers.delete(target);
    }

    target.textContent = text;
    target.classList.remove('is-success', 'is-error');

    if (type === 'error') {
      target.classList.add('is-error');
    } else if (type === 'success') {
      target.classList.add('is-success');
    }

    if (duration > 0 && text) {
      const timer = setTimeout(() => {
        target.textContent = '';
        target.classList.remove('is-success', 'is-error');
        _statusTimers.delete(target);
      }, duration);
      _statusTimers.set(target, timer);
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
    window._configMostrarToast = function (message, variant, duration = 5000) {
      if (window.__appTooltips === false) return;
      const container = _getToastContainer();
      
      // Limpiar toasts anteriores para no acumular mensajes
      Array.from(container.children).forEach(child => {
        if (child._t) { clearTimeout(child._t); child._t = null; }
        if (child.parentNode) child.parentNode.removeChild(child);
      });

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
      toast._t = setTimeout(() => _hideToast(toast), duration);
    };
  })();

  async function handleLogout() {
    const result = await confirmAction(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas cerrar sesión?',
      { emphasis: 'danger' }
    );

    if (result !== 'confirm') return;

    try {
      sessionStorage.setItem('finanzapp:logged_out', '1');
      localStorage.setItem('logoutTimestamp', Date.now().toString());

      if (window.firebaseAuth && typeof window.firebaseAuth.logout === 'function') {
        await window.firebaseAuth.logout();
      } else if (window.firebase && typeof window.firebase.auth === 'function') {
        try {
          await window.firebase.auth().signOut();
        } catch (e) {
          console.warn('Error en signOut de Firebase:', e);
        }
      }
    } catch (err) {
      console.error('Error durante el cierre de sesión:', err);
    } finally {
      sessionStorage.setItem('finanzapp:logged_out', '1');
      localStorage.setItem('logoutTimestamp', Date.now().toString());
      localStorage.removeItem('loggedIn');
      localStorage.removeItem('authUser');
      window.location.replace('/pages/Login/Login.html?logout=true');
    }
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
      const handleRemoteUpdate = async () => {
        loadSettings();
        applySettingsToForm();
        updateFormatPreview();
        await refreshDataSummary();
      };

      if (window.DataEvents) {
        window.DataEvents.on('datos:actualizados', handleRemoteUpdate);
      }
      window.addEventListener('finanzapp:data:updated', handleRemoteUpdate);
    }

  }

  const _configuracionApp = new ConfiguracionApp(); // eslint-disable-line no-unused-vars
})();
