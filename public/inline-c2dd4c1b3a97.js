// Fuerte invalidación de caché para navegadores móviles rebeldes
    if ('caches' in window) {
      caches.keys().then(function(names) {
        for (let name of names) {
          if (name.includes('finanzapp-static-v5') || name.includes('finanzapp-shell-v5')) {
            caches.delete(name);
          }
        }
      });
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for (let registration of registrations) {
          registration.unregister(); // Destruir cualquier SW anterior
        }
      });
    }

    (function () {
      try {
        var cta = document.getElementById('ctaPrimary');
        if (cta && localStorage.getItem('loggedIn') === 'true') {
          cta.href = '/pages/Dashboard/Dashboard.html';
          cta.innerHTML = '<i class="fas fa-th-large"></i> Ir al Dashboard';
        }
      } catch (e) {}
    })();
