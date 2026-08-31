const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/lib/BasePage.js');
let content = fs.readFileSync(file, 'utf8');

const syncMethod = `
  /**
   * Dispara la sincronización IMAP en segundo plano si está configurada.
   * @protected
   */
  async _triggerImapSync() {
    try {
      if (window.FirestoreDB && window.SyncAPI && typeof window.SyncAPI.syncImapOnDemand === 'function') {
        const settings = await window.FirestoreDB.getImapSettings();
        if (settings && settings.email && settings.appPassword) {
          console.log('[BasePage] Iniciando sincronización IMAP en segundo plano...');
          window.SyncAPI.syncImapOnDemand().then(result => {
            if (result && result.count > 0) {
              if (typeof window._configMostrarToast === 'function') {
                window._configMostrarToast('Sincronización IMAP exitosa: ' + result.count + ' transacciones nuevas', 'success');
              }
              // Forzar recarga de datos
              if (window.DataEvents) {
                window.DataEvents.emit('datos:actualizados');
              }
            }
          }).catch(e => console.warn('[BasePage] Error en sincronización IMAP', e));
        }
      }
    } catch(e) {
       console.warn('[BasePage] Error chequeando configuración IMAP', e);
    }
  }
`;

// Insert the method
content = content.replace(/_bindCrossTabEvents\(\)\s*\{/, match => syncMethod + '\n  ' + match);

// Call it at the end of _init
content = content.replace(/this\._bindCrossTabEvents\(\);\s*\}/, match => match.replace('}', '  this._triggerImapSync();\n  }'));

fs.writeFileSync(file, content);
console.log('BasePage.js updated');
