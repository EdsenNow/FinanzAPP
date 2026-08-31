const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'src/pages/Configuracion/Configuracion.html');
let content = fs.readFileSync(htmlPath, 'utf8');

const oldGmailSectionRegex = /<!-- ===== Notificaciones bancarias ===== -->[\s\S]*?<\/article>/;

const newImapSection = `<!-- ===== Sincronización IMAP ===== -->
          <article class="config-card quick-actions-card">
            <h2 class="card-title">Sincronización Bancaria (IMAP)</h2>
            <p class="helper-text gmail-helper-text">
              FinanzApp monitorea tus correos de forma segura usando IMAP para detectar tus transacciones sin necesidad de auditorías costosas.
            </p>

            <form id="imapConfigForm" class="settings-form">
              <div class="setting-row" style="flex-direction: column; align-items: flex-start; margin-bottom: 15px;">
                <label>Correo Electrónico de Google</label>
                <input type="email" id="imapEmail" class="form-control" placeholder="tu-correo@gmail.com" required style="width: 100%; margin-top: 5px; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--text-main);">
              </div>
              
              <div class="setting-row" style="flex-direction: column; align-items: flex-start; margin-bottom: 15px;">
                <label>
                  Contraseña de Aplicación 
                  <a href="#" id="openTutorialBtn" style="font-size: 13px; margin-left: 10px; color: var(--accent-blue); text-decoration: none;">¿Cómo generar una?</a>
                </label>
                <input type="password" id="imapPassword" class="form-control" placeholder="16 letras sin espacios" required style="width: 100%; margin-top: 5px; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--text-main);">
              </div>

              <div class="setting-row" style="flex-direction: column; align-items: flex-start; margin-bottom: 15px;">
                <label>Correos de Bancos a monitorear (Separados por coma)</label>
                <input type="text" id="imapSenders" class="form-control" placeholder="notificaciones@bbva.com, alertas@bhd.com" required style="width: 100%; margin-top: 5px; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--text-main);">
              </div>

              <div class="settings-actions" style="margin-top: 20px; justify-content: flex-start; gap: 10px;">
                <button type="button" id="saveImapBtn" class="btn btn-primary">
                  <i class="fas fa-save"></i> Guardar Credenciales
                </button>
                <button type="button" id="syncImapBtn" class="btn btn-secondary" style="display: none;">
                  <i class="fas fa-sync-alt"></i> Sincronizar Ahora
                </button>
              </div>
              <p class="settings-status" id="imapStatusText" style="margin-top: 10px; font-size: 14px;"></p>
            </form>
          </article>`;

content = content.replace(oldGmailSectionRegex, newImapSection);

const tutorialModal = `
  <div class="custom-alert hidden" id="tutorialModal" role="dialog" aria-modal="true" tabindex="-1" style="max-width: 500px; width: 90%; z-index: 10000; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--surface-light); padding: 25px; border-radius: 12px; border: 1px solid var(--border-color); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <h3 class="custom-alert-title" style="margin-top:0;">¿Cómo generar una Contraseña de Aplicación?</h3>
    <div class="custom-alert-message" style="text-align: left; font-size: 14px; margin-top: 15px; color: var(--text-main); line-height: 1.5;">
      <p style="margin-bottom: 10px;">1. Ve a los ajustes de seguridad de tu <a href="https://myaccount.google.com/security" target="_blank" style="color: var(--accent-blue); text-decoration: underline;">Cuenta de Google</a>.</p>
      <p style="margin-bottom: 10px;">2. Asegúrate de tener activada la <strong>Verificación en 2 pasos</strong>.</p>
      <p style="margin-bottom: 10px;">3. Busca la opción <strong>Contraseñas de aplicación</strong>.</p>
      <img src="/assets/app_password_tutorial.jpg" alt="Tutorial" style="width: 100%; border-radius: 8px; margin: 15px 0; border: 1px solid var(--border-color);">
      <p style="margin-bottom: 10px;">4. Genera una contraseña, cópiala y pégala aquí (asegúrate de quitar los espacios en blanco).</p>
    </div>
    <div class="custom-alert-buttons" style="margin-top: 20px; text-align: right;">
      <button class="btn btn-primary" id="closeTutorialBtn">Entendido</button>
    </div>
  </div>
`;

// Insert modal before </main>
content = content.replace('</main>', tutorialModal + '\n    </main>');

// Remove GIS script
content = content.replace('<script src="https://accounts.google.com/gsi/client" async defer></script>', '');
// Change GmailAPI.js to SyncAPI.js
content = content.replace('<script src="/lib/GmailAPI.js?v=202605180003"></script>', '<script src="/lib/SyncAPI.js"></script>');

fs.writeFileSync(htmlPath, content);
console.log('Configuracion.html updated successfully');
