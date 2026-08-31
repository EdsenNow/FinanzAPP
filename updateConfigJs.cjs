const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, 'src/pages/Configuracion/Configuracion.js');
let content = fs.readFileSync(jsPath, 'utf8');

const oldGmailSectionRegex = /\/\/ ── Sección Gmail ──────────────────────────────────────────────────────────[\s\S]*?(?=\/\/ --- Custom dropdown helpers ---)/;

const newImapSection = `// ── Sección IMAP ──────────────────────────────────────────────────────────

  function initImapSection() {
    const saveBtn = document.getElementById('saveImapBtn');
    const syncBtn = document.getElementById('syncImapBtn');
    const openTutorialBtn = document.getElementById('openTutorialBtn');
    const closeTutorialBtn = document.getElementById('closeTutorialBtn');
    const tutorialModal = document.getElementById('tutorialModal');
    
    if (openTutorialBtn && tutorialModal) {
      openTutorialBtn.addEventListener('click', (e) => {
        e.preventDefault();
        tutorialModal.classList.remove('hidden');
      });
    }

    if (closeTutorialBtn && tutorialModal) {
      closeTutorialBtn.addEventListener('click', () => {
        tutorialModal.classList.add('hidden');
      });
    }
    
    if (!saveBtn) return;

    // Cargar credenciales guardadas
    loadImapCredentials();

    saveBtn.addEventListener('click', async () => {
      const email = document.getElementById('imapEmail').value.trim();
      const password = document.getElementById('imapPassword').value.trim();
      const senders = document.getElementById('imapSenders').value.split(',').map(s => s.trim()).filter(Boolean);
      const statusEl = document.getElementById('imapStatusText');

      if (!email || !password || senders.length === 0) {
        setStatus(statusEl, 'Por favor completa todos los campos.', 'error');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

      try {
        if (window.FirestoreDB) {
          await window.FirestoreDB.saveImapSettings({ email, appPassword: password, targetSenders: senders });
          setStatus(statusEl, 'Credenciales guardadas correctamente.', 'success');
          syncBtn.style.display = 'inline-block';
        }
      } catch (e) {
        console.error('Error al guardar IMAP', e);
        setStatus(statusEl, 'Error al guardar. Verifica tu conexión.', 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Credenciales';
      }
    });

    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        const statusEl = document.getElementById('imapStatusText');
        syncBtn.disabled = true;
        syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
        setStatus(statusEl, 'Sincronizando con el servidor...', 'info');

        try {
          if (window.SyncAPI && typeof window.SyncAPI.syncImapOnDemand === 'function') {
            const result = await window.SyncAPI.syncImapOnDemand();
            setStatus(statusEl, 'Sincronización completada: ' + result.count + ' transacciones nuevas.', 'success');
          } else {
            throw new Error('SyncAPI no disponible');
          }
        } catch (e) {
          console.error(e);
          setStatus(statusEl, e.message || 'Error al sincronizar.', 'error');
        } finally {
          syncBtn.disabled = false;
          syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Sincronizar Ahora';
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
        document.getElementById('syncImapBtn').style.display = 'inline-block';
      }
    } catch (e) {
      console.warn('Error loading IMAP settings', e);
    }
  }

  `;

content = content.replace(oldGmailSectionRegex, newImapSection);

// We also need to replace `initGmailSection();` with `initImapSection();` in `attachEvents()`
content = content.replace('initGmailSection();', 'initImapSection();');

fs.writeFileSync(jsPath, content);
console.log('Configuracion.js updated successfully');
