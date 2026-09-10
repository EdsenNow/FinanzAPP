/**
 * @fileoverview Módulo de gestión de modales para Categorías.
 *
 * Centraliza la apertura, cierre, accesibilidad (foco/ARIA) y
 * configuración de los modales de categorías y transacciones.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CategoriasModals = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  /**
   * Abre un modal, gestiona la visibilidad ARIA y enfoca el primer elemento interactivo.
   * @param {HTMLElement} modal
   * @param {HTMLElement|null} [triggerElement]
   */
  function abrirModal(modal, triggerElement = null) {
    if (!modal || typeof document === 'undefined') return;

    document.querySelectorAll('.modal.active').forEach(m => {
      if (m !== modal) {
        m.classList.remove('active');
        m.setAttribute('aria-hidden', 'true');
      }
    });

    modal.classList.add('active');
    modal.removeAttribute('inert');
    modal.setAttribute('aria-hidden', 'false');
    if (document.body) document.body.classList.add('modal-open');

    const firstFocusable = modal.querySelector('input, button, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) {
      setTimeout(() => {
        try {
          firstFocusable.focus();
        } catch (e) {
          console.warn('No se pudo enfocar el primer elemento del modal:', e);
        }
      }, 100);
    }

    if (triggerElement && document.contains(triggerElement)) {
      modal._triggerElement = triggerElement;
    }
  }

  /**
   * Cierra un modal y restaura el foco al elemento disparador.
   * @param {HTMLElement} modal
   */
  function cerrarModal(modal) {
    if (!modal || typeof document === 'undefined') return;
    try {
      const triggerEl = modal._triggerElement || null;
      const hadFocusInside = modal.contains(document.activeElement);

      modal.classList.remove('active');
      modal.setAttribute('inert', '');
      limpiarBloqueoScroll();

      if (hadFocusInside && document.body) {
        try {
          document.body.setAttribute('tabindex', '-1');
          document.body.focus();
        } catch {}
      }

      setTimeout(() => {
        let restored = false;
        try {
          if (triggerEl && typeof triggerEl.focus === 'function' && document.contains(triggerEl) && triggerEl.offsetParent !== null) {
            triggerEl.focus();
            restored = true;
          }
        } catch (e) {
          console.warn('No se pudo restaurar foco al trigger:', e);
        }

        if (!restored) {
          const fallback = document.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
          if (fallback && document.contains(fallback)) {
            try { fallback.focus(); } catch {}
          }
        }

        if (document.body && document.body.getAttribute('tabindex') === '-1') {
          document.body.removeAttribute('tabindex');
        }

        modal.setAttribute('aria-hidden', 'true');
        modal.removeAttribute('inert');
        modal._triggerElement = null;
      }, 40);
    } catch (e) {
      console.error('Error cerrando modal:', e);
    }
  }

  /**
   * Restablece el scroll del body cuando no hay modales ni alertas activas.
   */
  function limpiarBloqueoScroll() {
    if (typeof document === 'undefined') return;
    const hasModal = !!document.querySelector('.modal.active');
    const overlay = document.getElementById('alertOverlay');
    const alertBox = document.getElementById('customAlert');
    const alertVisible = (overlay && !overlay.classList.contains('hidden')) || (alertBox && !alertBox.classList.contains('hidden'));
    if (!hasModal && document.body) document.body.classList.remove('modal-open');
    if (!alertVisible && document.body) document.body.classList.remove('no-scroll');
    if (!hasModal && !alertVisible && document.body) document.body.style.overflow = '';
  }

  /**
   * Abre el modal de edición de categoría cargando los valores correspondientes.
   * @param {*} categoryId
   * @param {Function} buscarCategoriaFn
   * @param {Function} [abrirModalFn]
   */
  function mostrarModalEditarCategoria(categoryId, buscarCategoriaFn, abrirModalFn = abrirModal) {
    if (typeof document === 'undefined') return;
    const category = typeof buscarCategoriaFn === 'function' ? buscarCategoriaFn(categoryId) : null;
    if (!category) {
      console.error('No se encontró la categoría para editar:', categoryId);
      return;
    }

    const editCategoryId = document.getElementById('editCategoryId');
    const editCategoryName = document.getElementById('editCategoryName');
    const editCategoryModal = document.getElementById('editCategoryModal');

    if (editCategoryId) editCategoryId.value = categoryId;
    if (editCategoryName) editCategoryName.value = category.name || '';
    if (editCategoryModal) abrirModalFn(editCategoryModal);

    document.querySelectorAll('.category-menu.active').forEach(menu => menu.classList.remove('active'));
  }

  /**
   * Muestra la confirmación para eliminar una categoría.
   * @param {*} categoryId
   * @param {Function} buscarCategoriaFn
   * @param {Function} onConfirmCallback
   * @param {Function} [escFn]
   */
  function mostrarModalEliminarCategoria(categoryId, buscarCategoriaFn, onConfirmCallback, escFn) {
    if (typeof document === 'undefined') return;
    const category = typeof buscarCategoriaFn === 'function' ? buscarCategoriaFn(categoryId) : null;
    if (!category) {
      console.error('No se encontró la categoría para eliminar:', categoryId);
      return;
    }

    document.querySelectorAll('.category-menu.active').forEach(menu => menu.classList.remove('active'));

    const escapeText = escFn || ((text) => String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));

    if (window.__appConfirmDelete === false) {
      if (typeof onConfirmCallback === 'function') onConfirmCallback();
      return;
    }

    if (typeof window.mostrarBottomDrawer === 'function') {
      window.mostrarBottomDrawer({
        mensajeHtml: `¿Eliminar la categoría "<strong>${escapeText(category.name)}</strong>"?<br>Se eliminarán todas sus transacciones.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        variant: 'danger',
        onConfirm: onConfirmCallback
      });
    } else if (typeof window.showAlert === 'function') {
      window.showAlert(
        'Eliminar Categoría',
        `¿Eliminar la categoría "${category.name}"? Se eliminarán todas sus transacciones.`,
        { variant: 'confirm', emphasis: 'danger' }
      ).then(result => {
        if (result === 'confirm' && typeof onConfirmCallback === 'function') {
          onConfirmCallback();
        }
      });
    } else {
      if (window.confirm(`¿Eliminar la categoría "${category.name}"?`)) {
        if (typeof onConfirmCallback === 'function') onConfirmCallback();
      }
    }
  }

  /**
   * Abre el modal de atajos de teclado.
   * @param {HTMLElement|null} [triggerEl]
   * @param {Function} [abrirModalFn]
   */
  function abrirModalAtajos(triggerEl = null, abrirModalFn = abrirModal) {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('shortcutsModal');
    if (modal) abrirModalFn(modal, triggerEl);
  }

  const CategoriasModals = {
    abrirModal,
    cerrarModal,
    limpiarBloqueoScroll,
    mostrarModalEditarCategoria,
    mostrarModalEliminarCategoria,
    abrirModalAtajos
  };

  if (typeof window !== 'undefined') window.CategoriasModals = CategoriasModals;
  if (typeof globalThis !== 'undefined') globalThis.CategoriasModals = CategoriasModals;

  return CategoriasModals;
});

