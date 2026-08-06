try {
      // Siempre usar tema oscuro en login
      document.documentElement.removeAttribute('data-theme');
    } catch {}

    // alertConfirm y alertOverlay usan window.showAlert/hideAlert de UI.js (UIManager)
    document.getElementById('alertConfirm').addEventListener('click', () => window.hideAlert());
    document.getElementById('alertOverlay').addEventListener('click', () => {
      if (window.innerWidth <= 980) window.hideAlert();
    });

    // Toggle password visibility
    document.querySelectorAll('.toggle-password').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        
        if (input.type === 'password') {
          input.type = 'text';
          btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
        } else {
          input.type = 'password';
          btn.innerHTML = '<i class="fas fa-eye"></i>';
        }
      });
    });
