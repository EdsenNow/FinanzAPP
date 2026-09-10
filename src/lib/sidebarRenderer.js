/**
 * sidebarRenderer.js — Componente de navegación unificado para FinanzApp.
 * Centraliza la estructura de enlaces, iconos y estados activos tanto para la barra
 * lateral de escritorio (#sidebar) como para la barra de navegación inferior móvil (.mobile-nav).
 */
(function() {
  'use strict';

  const NAV_ITEMS = [
    {
      id: 'categorias',
      label: 'Categorías',
      shortLabel: 'Categorías',
      href: '/pages/Categorias/Categorias.html',
      icon: 'layout-grid'
    },
    {
      id: 'presupuestos',
      label: 'Presupuestos',
      shortLabel: 'Presupuesto',
      href: '/pages/Presupuestos/Presupuestos.html',
      icon: 'wallet'
    },
    {
      id: 'estadistica',
      label: 'Estadísticas',
      shortLabel: 'Estadística',
      href: '/pages/Estadistica/Estadistica.html',
      icon: 'pie-chart'
    },
    {
      id: 'configuracion',
      label: 'Configuración',
      shortLabel: 'Config',
      href: '/pages/Configuracion/Configuracion.html',
      icon: 'settings'
    }
  ];

  class SidebarRenderer {
    /**
     * Renderiza o actualiza la navegación resaltando la página activa.
     * @param {'categorias'|'presupuestos'|'estadistica'|'configuracion'} activePageId
     */
    render(activePageId) {
      this.activePage = (activePageId || '').toLowerCase().trim();
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this._apply());
      } else {
        this._apply();
      }
    }

    _apply() {
      this._renderDesktopNav();
      this._renderMobileNav();
      this._refreshIcons();
    }

    _renderDesktopNav() {
      const navContainer = document.querySelector('#sidebar .nav-links') || document.querySelector('.sidebar .nav-links');
      if (!navContainer) return;

      navContainer.innerHTML = NAV_ITEMS.map(item => {
        const isActive = item.id === this.activePage;
        return `
        <a href="${item.href}" class="nav-item${isActive ? ' active' : ''}" ${isActive ? 'aria-current="page"' : ''}>
          <i data-lucide="${item.icon}"></i>
          <span>${item.label}</span>
        </a>`;
      }).join('\n');
    }

    _renderMobileNav() {
      let mobileNav = document.querySelector('nav.mobile-nav');
      if (!mobileNav) {
        mobileNav = document.createElement('nav');
        mobileNav.className = 'mobile-nav';
        mobileNav.setAttribute('aria-label', 'Navegación móvil');
        document.body.appendChild(mobileNav);
      }

      mobileNav.innerHTML = NAV_ITEMS.map(item => {
        const isActive = item.id === this.activePage;
        return `
    <a href="${item.href}" class="mobile-nav-item${isActive ? ' active' : ''}" ${isActive ? 'aria-current="page"' : ''}>
      <i data-lucide="${item.icon}" aria-hidden="true"></i>
      <span class="mobile-nav-label">${item.shortLabel}</span>
    </a>`;
      }).join('\n');
    }

    _refreshIcons() {
      try {
        if (window.LucideHelper && typeof window.LucideHelper.refresh === 'function') {
          window.LucideHelper.refresh();
        } else if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons();
        }
      } catch (e) {
        console.warn('[sidebarRenderer] Error refrescando iconos Lucide:', e);
      }
    }
  }

  window.sidebarRenderer = new SidebarRenderer();
})();

