document.getElementById('mobileCreateAction')?.addEventListener('click', function () {
      if (window.PresupuestosApp && typeof window.PresupuestosApp.abrirModalCrear === 'function') {
        window.PresupuestosApp.abrirModalCrear();
      } else {
        const trigger = document.getElementById('addBudgetBtn');
        if (trigger) {
          trigger.click();
        }
      }
    });

    (function () {
      const dropdown = document.getElementById('mobileActionsDropdown');
      const toggle = document.getElementById('mobileActionsToggle');
      const panel = document.getElementById('mobileActionsPanel');
      if (!dropdown || !toggle || !panel) return;
      const closeBtn = document.getElementById('mobileActionsClose');

      const mobileName = document.getElementById('mobileDrawerName');
      const mobileEmail = document.getElementById('mobileDrawerEmail');
      const mobileAvatar = document.getElementById('mobileDrawerAvatar');

      const syncDrawerProfile = function () {
        try {
          const raw = localStorage.getItem('authUser');
          const profile = raw && raw !== 'guest' ? JSON.parse(raw) : {};
          const fallbackName = document.querySelector('.sidebar .user-name')?.textContent?.trim() || '';
          const fallbackEmail = document.querySelector('.sidebar .user-email')?.textContent?.trim() || '';

          const displayName = profile.name || profile.displayName || fallbackName || 'Invitado';
          const displayEmail = profile.email || fallbackEmail || '';
          const picture = profile.picture || profile.photoURL || '';

          if (mobileName) mobileName.textContent = displayName;
          if (mobileEmail) {
            mobileEmail.textContent = displayEmail || 'Sin correo';
            mobileEmail.style.display = 'block';
          }

          if (mobileAvatar) {
            mobileAvatar.innerHTML = '';
            if (picture) {
              const img = document.createElement('img');
              img.src = picture;
              img.alt = displayName;
              mobileAvatar.appendChild(img);
            } else {
              mobileAvatar.textContent = (displayName || 'U').trim().charAt(0).toUpperCase();
            }
          }
        } catch (_) {
        }
      };

      syncDrawerProfile();

      const subpanel = document.createElement('div');
      subpanel.id = 'mobileActionsSubpanel';
      subpanel.className = 'mobile-actions-subpanel';
      panel.appendChild(subpanel);
      let activeSubmenuAction = null;

      const closePanel = function () {
        dropdown.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        clearSubpanel();
      };

      const clearSubpanel = function () {
        subpanel.classList.remove('open');
        subpanel.classList.remove('is-month');
        subpanel.innerHTML = '';
        activeSubmenuAction = null;
        if (subpanel.parentElement !== panel) {
          panel.appendChild(subpanel);
        }
      };

      const openInlineSubpanel = function (actionKey, anchorBtn, renderContent) {
        if (!anchorBtn) return;
        if (activeSubmenuAction === actionKey && subpanel.classList.contains('open')) {
          clearSubpanel();
          return;
        }

        clearSubpanel();
        renderContent();
        anchorBtn.insertAdjacentElement('afterend', subpanel);
        subpanel.classList.add('open');
        activeSubmenuAction = actionKey;
      };

      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        syncDrawerProfile();
        dropdown.classList.toggle('open');
        toggle.setAttribute('aria-expanded', dropdown.classList.contains('open') ? 'true' : 'false');
      });

      closeBtn?.addEventListener('click', function (e) {
        e.stopPropagation();
        closePanel();
      });

      const openFilterDropdown = function (id) {
        const dd = document.getElementById(id);
        if (!dd) return;
        document.querySelectorAll('.custom-dropdown.open').forEach(function (d) { d.classList.remove('open'); });
        dd.classList.add('open');
      };

      const openOptionsSubmenu = function (dropdownId, actionKey, anchorBtn) {
        const dropdownEl = document.getElementById(dropdownId);
        const selectedEl = dropdownEl?.querySelector('.custom-dropdown-selected');
        const options = dropdownEl?.querySelectorAll('.custom-dropdown-option');
        if (!dropdownEl || !selectedEl || !options?.length) return;

        openInlineSubpanel(actionKey, anchorBtn, function () {
          const currentValue = selectedEl.getAttribute('data-value') || '';
          subpanel.innerHTML = '';
          subpanel.classList.toggle('is-month', dropdownId === 'monthFilter');

          options.forEach(function (opt) {
            const value = opt.getAttribute('data-value') || '';
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'mobile-actions-option' + (value === currentValue ? ' active' : '');
            item.textContent = opt.textContent;
            item.addEventListener('click', function () {
              opt.click();
              closePanel();
            });
            subpanel.appendChild(item);
          });
        });
      };

      panel.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');

        if (action === 'year') {
          openOptionsSubmenu('yearFilter', 'year', btn);
        } else if (action === 'month') {
          openOptionsSubmenu('monthFilter', 'month', btn);
        } else if (action === 'clear') {
          document.getElementById('clearFiltersBtn')?.click();
          clearSubpanel();
        } else if (action === 'theme') {
          document.getElementById('themeToggle')?.click();
          closePanel();
        } else if (action === 'logout') {
          document.getElementById('logoutButton')?.click();
          closePanel();
        }
      });

      document.addEventListener('click', function (e) {
        if (!dropdown.contains(e.target)) {
          closePanel();
        }
      });

      window.addEventListener('scroll', closePanel, { passive: true });
    })();
