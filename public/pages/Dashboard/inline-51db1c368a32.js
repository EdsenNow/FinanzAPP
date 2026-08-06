document.getElementById('mobileCreateAction')?.addEventListener('click', function () {
      const trigger = document.getElementById('addCategoryBtn');
      if (trigger) {
        trigger.click();
      }
    });

    (function () {
      const dropdown = document.getElementById('mobileActionsDropdown');
      const toggle = document.getElementById('mobileActionsToggle');
      const panel = document.getElementById('mobileActionsPanel');
      if (!dropdown || !toggle || !panel) return;
      const closeBtn = document.getElementById('mobileActionsClose');
      const notifDropdown = document.getElementById('mobileNotificationsDropdown');
      const notifPanel = document.getElementById('mobileNotificationsPanel');
      const notifCloseBtn = document.getElementById('mobileNotificationsClose');
      const notifList = document.getElementById('mobileNotificationsList');
      const notifClearBtn = document.getElementById('mobileNotificationsClearBtn');

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

      const closeNotificationsMenu = function () {
        notifDropdown?.classList.remove('open');
      };

      const readMobileNotifications = function () {
        try {
          const raw = JSON.parse(localStorage.getItem('finanzapp:gmail:notifications') || '[]');
          if (!Array.isArray(raw)) return [];
          return raw.slice(0, 30);
        } catch (_) {
          return [];
        }
      };

      const fmtMobileNotifDate = function (rawDate) {
        const d = new Date(rawDate);
        if (isNaN(d.getTime())) return '';
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      };

      const fmtMobileNotifAmount = function (amount) {
        const value = Number(amount);
        if (!isFinite(value)) return '';
        return `$${value.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      };

      const renderNotificationsMenu = function () {
        if (!notifList) return;
        const list = readMobileNotifications();
        notifList.innerHTML = '';

        if (!list.length) {
          const empty = document.createElement('div');
          empty.className = 'mobile-actions-option';
          empty.textContent = 'Sin notificaciones pendientes.';
          empty.setAttribute('aria-disabled', 'true');
          notifList.appendChild(empty);
          if (notifClearBtn) notifClearBtn.style.display = 'none';
          return;
        }

        list.forEach(function (notif) {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'mobile-actions-option';
          const desc = (notif.description || notif.subject || 'Transacción').trim();
          const amount = fmtMobileNotifAmount(notif.amount);
          const date = fmtMobileNotifDate(notif.date);
          item.textContent = `${desc} ${amount}${date ? ` · ${date}` : ''}`.trim();
          item.addEventListener('click', function () {
            window.dispatchEvent(new CustomEvent('finanzapp:gmail:open-review', {
              detail: { id: notif.id }
            }));
            closeNotificationsMenu();
          });
          notifList.appendChild(item);
        });

        if (notifClearBtn) notifClearBtn.style.display = '';
      };

      const openNotificationsMenu = function () {
        if (!notifPanel || !notifDropdown) return;
        renderNotificationsMenu();
        notifDropdown.classList.add('open');
      };

      const clearSubpanel = function () {
        panel.classList.remove('has-subpanel');
        subpanel.classList.remove('open');
        subpanel.classList.remove('is-month');
        subpanel.classList.remove('is-search');
        subpanel.innerHTML = '';
        activeSubmenuAction = null;
        if (subpanel.parentElement !== panel) {
          panel.appendChild(subpanel);
        }
      };

      const openInlineSubpanel = function (actionKey, anchorBtn, renderContent) {
        if (!anchorBtn) return false;
        if (activeSubmenuAction === actionKey && subpanel.classList.contains('open')) {
          clearSubpanel();
          return false;
        }

        clearSubpanel();
        renderContent();
        anchorBtn.insertAdjacentElement('afterend', subpanel);
        panel.classList.add('has-subpanel');
        subpanel.classList.add('open');
        activeSubmenuAction = actionKey;
        return true;
      };

      const updateFilterButtonState = function () {
        const monthVal = document.querySelector('#monthFilter .custom-dropdown-selected')?.getAttribute('data-value') || '';
        const yearVal = document.querySelector('#yearFilter .custom-dropdown-selected')?.getAttribute('data-value') || '';
        const searchVal = (document.getElementById('searchInput')?.value || '').trim();
        panel.querySelector('[data-action="month"]')?.classList.toggle('filter-active', monthVal !== '');
        panel.querySelector('[data-action="year"]')?.classList.toggle('filter-active', yearVal !== '');
        panel.querySelector('[data-action="search"]')?.classList.toggle('filter-active', searchVal !== '');
      };

      const createSubpanelHeader = function (title) {
        const header = document.createElement('div');
        header.className = 'mobile-actions-subpanel-header';

        const label = document.createElement('span');
        label.textContent = title;

        const backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.className = 'mobile-actions-subpanel-back';
        backBtn.textContent = 'Volver';
        backBtn.addEventListener('click', function () {
          clearSubpanel();
        });

        header.appendChild(label);
        header.appendChild(backBtn);
        return header;
      };

      const openPanel = function () {
        syncDrawerProfile();
        updateFilterButtonState();
        closeNotificationsMenu();
        dropdown.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
      };

      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        if (dropdown.classList.contains('open')) {
          closePanel();
        } else {
          openPanel();
        }
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
          subpanel.classList.remove('is-search');
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

      const openSearchSubmenu = function (anchorBtn) {
        const source = document.getElementById('searchInput');
        if (!source) return;

        const opened = openInlineSubpanel('search', anchorBtn, function () {
          subpanel.innerHTML = '';
          subpanel.classList.add('is-search');
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'mobile-actions-subpanel-input';
          input.placeholder = source.placeholder || 'Buscar...';
          input.value = source.value || '';

          input.addEventListener('input', function () {
            source.value = input.value;
            source.dispatchEvent(new Event('input', { bubbles: true }));
          });

          subpanel.appendChild(input);
        });

        if (opened) {
          setTimeout(function () {
            const input = subpanel.querySelector('.mobile-actions-subpanel-input');
            if (input) input.focus();
          }, 0);
        }
      };

      const openExportSubmenu = function (anchorBtn) {
        openInlineSubpanel('export', anchorBtn, function () {
          subpanel.innerHTML = '';
          // subpanel.appendChild(createSubpanelHeader('Exportar'));

          const jsonBtn = document.createElement('button');
          jsonBtn.type = 'button';
          jsonBtn.className = 'mobile-actions-option';
          jsonBtn.textContent = 'Exportar JSON';
          jsonBtn.addEventListener('click', function () {
            document.getElementById('exportJsonBtn')?.click();
            closePanel();
          });

          const pdfBtn = document.createElement('button');
          pdfBtn.type = 'button';
          pdfBtn.className = 'mobile-actions-option';
          pdfBtn.textContent = 'Exportar PDF';
          pdfBtn.addEventListener('click', function () {
            document.getElementById('exportPdfBtn')?.click();
            closePanel();
          });

          subpanel.appendChild(jsonBtn);
          subpanel.appendChild(pdfBtn);
        });
      };

      panel.addEventListener('click', function (e) {
        e.stopPropagation();
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');

        if (action === 'search') {
          openSearchSubmenu(btn);
        } else if (action === 'year') {
          openOptionsSubmenu('yearFilter', 'year', btn);
        } else if (action === 'month') {
          openOptionsSubmenu('monthFilter', 'month', btn);
        } else if (action === 'clear') {
          document.getElementById('clearFiltersBtn')?.click();
          clearSubpanel();
          panel.querySelectorAll('.filter-active').forEach(function (b) { b.classList.remove('filter-active'); });
        } else if (action === 'notifications') {
          closePanel();
          openNotificationsMenu();
        } else if (action === 'export') {
          openExportSubmenu(btn);
        } else if (action === 'import') {
          document.getElementById('importFileInput')?.click();
          closePanel();
        } else if (action === 'theme') {
          document.getElementById('themeToggle')?.click();
          closePanel();
        } else if (action === 'logout') {
          document.getElementById('logoutButton')?.click();
          closePanel();
        } else if (action === 'deleteAll') {
          document.getElementById('clearAllCategoriesBtn')?.click();
          closePanel();
        }
      });

      document.addEventListener('click', function (e) {
        const clickedOutsideMain = !dropdown.contains(e.target);
        const clickedOutsideNotif = !notifPanel || !notifPanel.contains(e.target);
        if (clickedOutsideMain) {
          closePanel();
        }
        if (clickedOutsideNotif) {
          closeNotificationsMenu();
        }
      });

      notifCloseBtn?.addEventListener('click', function (e) {
        e.stopPropagation();
        closeNotificationsMenu();
      });

      notifClearBtn?.addEventListener('click', function () {
        window.dispatchEvent(new CustomEvent('finanzapp:gmail:clear-all'));
        renderNotificationsMenu();
        closeNotificationsMenu();
      });

      window.addEventListener('scroll', function () {
        closePanel();
        closeNotificationsMenu();
      }, { passive: true });

      window.addEventListener('finanzapp:gmail:notifications-updated', function () {
        if (notifDropdown?.classList.contains('open')) {
          renderNotificationsMenu();
        }
      });
    })();
