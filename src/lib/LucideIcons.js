(function() {
  'use strict';

  /**
   * Mapeo inteligente de clases históricas de FontAwesome 5 a nombres de Lucide Icons.
   * Permite retrocompatibilidad total con categorías guardadas en Firebase y Datos.json.
   */
  const FA_TO_LUCIDE_MAP = {
    // Finanzas e Ingresos
    'fa-money-bill-wave': 'banknote',
    'fa-money-bill-wave-alt': 'banknote',
    'fa-money-bill': 'banknote',
    'fa-money-bill-alt': 'banknote',
    'fa-money-check': 'credit-card',
    'fa-money-check-alt': 'credit-card',
    'fa-wallet': 'wallet',
    'fa-coins': 'coins',
    'fa-piggy-bank': 'piggy-bank',
    'fa-credit-card': 'credit-card',
    'fa-hand-holding-usd': 'hand-coins',
    'fa-dollar-sign': 'dollar-sign',
    'fa-euro-sign': 'euro',
    'fa-pound-sign': 'pound-sterling',
    'fa-chart-line': 'trending-up',
    'fa-chart-pie': 'pie-chart',
    'fa-chart-bar': 'bar-chart-3',
    'fa-chart-area': 'activity',
    'fa-file-invoice-dollar': 'receipt',
    'fa-receipt': 'receipt',
    'fa-cash-register': 'receipt',
    'fa-calculator': 'calculator',
    'fa-landmark': 'landmark',
    'fa-donate': 'heart-handshake',

    // Navegación y UI
    'fa-th-large': 'layout-grid',
    'fa-shapes': 'shapes',
    'fa-cog': 'settings',
    'fa-cogs': 'settings',
    'fa-bell': 'bell',
    'fa-bell-slash': 'bell-off',
    'fa-search': 'search',
    'fa-filter': 'filter',
    'fa-thumbtack': 'pin',
    'fa-edit': 'pencil',
    'fa-pen': 'pencil',
    'fa-trash': 'trash-2',
    'fa-trash-alt': 'trash-2',
    'fa-sync-alt': 'rotate-cw',
    'fa-sync': 'rotate-cw',
    'fa-history': 'history',
    'fa-calendar': 'calendar',
    'fa-calendar-alt': 'calendar',
    'fa-calendar-day': 'calendar-days',
    'fa-calendar-week': 'calendar-range',
    'fa-calendar-check': 'calendar-check',
    'fa-arrow-up': 'arrow-up',
    'fa-arrow-down': 'arrow-down',
    'fa-arrow-right': 'arrow-right',
    'fa-arrow-left': 'arrow-left',
    'fa-chevron-up': 'chevron-up',
    'fa-chevron-down': 'chevron-down',
    'fa-chevron-left': 'chevron-left',
    'fa-chevron-right': 'chevron-right',
    'fa-plus': 'plus',
    'fa-plus-circle': 'plus-circle',
    'fa-minus': 'minus',
    'fa-minus-circle': 'minus-circle',
    'fa-check': 'check',
    'fa-check-circle': 'check-circle',
    'fa-check-double': 'check-check',
    'fa-times': 'x',
    'fa-times-circle': 'x-circle',
    'fa-exclamation-triangle': 'alert-triangle',
    'fa-exclamation-circle': 'alert-circle',
    'fa-info-circle': 'info',
    'fa-question-circle': 'help-circle',
    'fa-moon': 'moon',
    'fa-sun': 'sun',
    'fa-sign-in-alt': 'log-in',
    'fa-sign-out-alt': 'log-out',
    'fa-eye': 'eye',
    'fa-eye-slash': 'eye-off',
    'fa-lock': 'lock',
    'fa-lock-open': 'unlock',
    'fa-key': 'key',
    'fa-envelope': 'mail',
    'fa-user': 'user',
    'fa-users': 'users',
    'fa-user-circle': 'user-circle',
    'fa-user-shield': 'shield-alert',
    'fa-user-secret': 'user-x',
    'fa-shield-alt': 'shield',
    'fa-database': 'database',
    'fa-server': 'server',
    'fa-cloud': 'cloud',
    'fa-cloud-upload-alt': 'cloud-upload',
    'fa-cloud-download-alt': 'cloud-download',
    'fa-download': 'download',
    'fa-upload': 'upload',
    'fa-file-export': 'file-up',
    'fa-file-import': 'file-down',
    'fa-file-code': 'file-code',
    'fa-file-pdf': 'file-text',
    'fa-file-excel': 'sheet',
    'fa-file-alt': 'file-text',
    'fa-file-contract': 'file-signature',
    'fa-external-link-alt': 'external-link',
    'fa-link': 'link',
    'fa-unlink': 'unlink',
    'fa-ellipsis-v': 'more-vertical',
    'fa-ellipsis-h': 'more-horizontal',
    'fa-bars': 'menu',
    'fa-spinner': 'loader-2',

    // Categorías de Vida Cotidiana
    'fa-utensils': 'utensils',
    'fa-coffee': 'coffee',
    'fa-glass-martini-alt': 'wine',
    'fa-glass-cheers': 'sparkles',
    'fa-hamburger': 'sandwich',
    'fa-pizza-slice': 'pizza',
    'fa-car': 'car',
    'fa-car-side': 'car',
    'fa-taxi': 'car',
    'fa-bus': 'bus',
    'fa-subway': 'train',
    'fa-plane': 'plane',
    'fa-gas-pump': 'fuel',
    'fa-biking': 'bike',
    'fa-bicycle': 'bike',
    'fa-home': 'home',
    'fa-building': 'building-2',
    'fa-bolt': 'zap',
    'fa-water': 'droplets',
    'fa-wifi': 'wifi',
    'fa-tv': 'tv',
    'fa-shopping-cart': 'shopping-cart',
    'fa-shopping-bag': 'shopping-bag',
    'fa-store': 'store',
    'fa-tag': 'tag',
    'fa-tags': 'tags',
    'fa-gift': 'gift',
    'fa-tshirt': 'shirt',
    'fa-glasses': 'glasses',
    'fa-heartbeat': 'heart-pulse',
    'fa-heart': 'heart',
    'fa-hospital': 'stethoscope',
    'fa-hospital-alt': 'stethoscope',
    'fa-medkit': 'briefcase-medical',
    'fa-pills': 'pill',
    'fa-graduation-cap': 'graduation-cap',
    'fa-book': 'book-open',
    'fa-book-open': 'book-open',
    'fa-laptop': 'laptop',
    'fa-laptop-code': 'code',
    'fa-mobile-alt': 'smartphone',
    'fa-mobile': 'smartphone',
    'fa-desktop': 'monitor',
    'fa-gamepad': 'gamepad-2',
    'fa-film': 'film',
    'fa-music': 'music',
    'fa-headphones': 'headphones',
    'fa-camera': 'camera',
    'fa-paw': 'paw-print',
    'fa-dog': 'dog',
    'fa-cat': 'cat',
    'fa-dumbbell': 'dumbbell',
    'fa-running': 'footprints',
    'fa-briefcase': 'briefcase',
    'fa-tools': 'wrench',
    'fa-wrench': 'wrench',
    'fa-hammer': 'hammer',
    'fa-paint-brush': 'palette',
    'fa-palette': 'palette',
    'fa-sparkles': 'sparkles',
    'fa-magic': 'wand-2',
    'fa-tree': 'trees',
    'fa-leaf': 'leaf'
  };

  /**
   * Catálogo de iconos organizados por temáticas para el selector de iconos de Categorías.
   */
  const CATEGORY_ICON_CATALOG = [
    // Finanzas e Ingresos
    { name: 'wallet', label: 'Billetera', group: 'Finanzas' },
    { name: 'banknote', label: 'Efectivo / Nómina', group: 'Finanzas' },
    { name: 'coins', label: 'Monedas', group: 'Finanzas' },
    { name: 'piggy-bank', label: 'Ahorros', group: 'Finanzas' },
    { name: 'credit-card', label: 'Tarjeta de Crédito', group: 'Finanzas' },
    { name: 'hand-coins', label: 'Préstamos / Cobros', group: 'Finanzas' },
    { name: 'trending-up', label: 'Inversiones', group: 'Finanzas' },
    { name: 'receipt', label: 'Facturas', group: 'Finanzas' },
    { name: 'landmark', label: 'Banco', group: 'Finanzas' },
    { name: 'dollar-sign', label: 'Divisas', group: 'Finanzas' },

    // Comida y Bebidas
    { name: 'utensils', label: 'Restaurante / Comida', group: 'Comida' },
    { name: 'coffee', label: 'Cafetería', group: 'Comida' },
    { name: 'shopping-cart', label: 'Supermercado', group: 'Comida' },
    { name: 'pizza', label: 'Comida Rápida', group: 'Comida' },
    { name: 'wine', label: 'Bebidas / Bares', group: 'Comida' },

    // Transporte y Viajes
    { name: 'car', label: 'Vehículo / Gasolina', group: 'Transporte' },
    { name: 'fuel', label: 'Combustible', group: 'Transporte' },
    { name: 'bus', label: 'Transporte Público', group: 'Transporte' },
    { name: 'plane', label: 'Viajes / Vuelos', group: 'Transporte' },
    { name: 'train', label: 'Tren / Metro', group: 'Transporte' },
    { name: 'bike', label: 'Bicicleta', group: 'Transporte' },
    { name: 'wrench', label: 'Mantenimiento Mecánico', group: 'Transporte' },

    // Hogar y Servicios
    { name: 'home', label: 'Vivienda / Alquiler', group: 'Hogar' },
    { name: 'building-2', label: 'Mantenimiento / Condominio', group: 'Hogar' },
    { name: 'zap', label: 'Electricidad / Luz', group: 'Hogar' },
    { name: 'droplets', label: 'Agua / Servicios', group: 'Hogar' },
    { name: 'wifi', label: 'Internet / WiFi', group: 'Hogar' },
    { name: 'tv', label: 'Cable / TV', group: 'Hogar' },
    { name: 'smartphone', label: 'Telefonía Móvil', group: 'Hogar' },

    // Compras y Estilo de Vida
    { name: 'shopping-bag', label: 'Compras / Tiendas', group: 'Compras' },
    { name: 'shirt', label: 'Ropa / Moda', group: 'Compras' },
    { name: 'gift', label: 'Regalos', group: 'Compras' },
    { name: 'glasses', label: 'Accesorios', group: 'Compras' },
    { name: 'tag', label: 'Ofertas / Descuentos', group: 'Compras' },

    // Salud y Cuidado
    { name: 'heart-pulse', label: 'Salud / Médico', group: 'Salud' },
    { name: 'stethoscope', label: 'Consultas / Seguro', group: 'Salud' },
    { name: 'pill', label: 'Farmacia / Medicamentos', group: 'Salud' },
    { name: 'dumbbell', label: 'Gimnasio / Fitness', group: 'Salud' },
    { name: 'sparkles', label: 'Belleza / Cuidado Personal', group: 'Salud' },

    // Educación y Trabajo
    { name: 'graduation-cap', label: 'Universidad / Cursos', group: 'Educación' },
    { name: 'book-open', label: 'Libros / Estudios', group: 'Educación' },
    { name: 'briefcase', label: 'Trabajo / Oficina', group: 'Trabajo' },
    { name: 'laptop', label: 'Tecnología / Software', group: 'Trabajo' },

    // Entretenimiento y Mascotas
    { name: 'gamepad-2', label: 'Videojuegos', group: 'Entretenimiento' },
    { name: 'film', label: 'Cine / Streaming', group: 'Entretenimiento' },
    { name: 'music', label: 'Música / Conciertos', group: 'Entretenimiento' },
    { name: 'paw-print', label: 'Mascotas', group: 'Entretenimiento' }
  ];

  class LucideHelperClass {
    constructor() {
      this.catalog = CATEGORY_ICON_CATALOG;
    }

    /**
     * Convierte cualquier identificador (clase FontAwesome o nombre Lucide) a un nombre limpio de Lucide.
     * @param {string} iconStr
     * @returns {string} Nombre del icono Lucide (ej: 'wallet', 'utensils', etc.)
     */
    faToLucide(iconStr) {
      if (!iconStr) return 'wallet';
      const clean = String(iconStr).trim().toLowerCase();

      // Si ya es un nombre limpio sin prefijos fa
      if (!clean.includes('fa-') && !clean.includes('fas ') && !clean.includes('fab ') && !clean.includes('far ')) {
        return clean.replace(/^lucide-/, '');
      }

      // Buscar si alguna clase de FontAwesome coincide en el mapa
      const classes = clean.split(/\s+/);
      for (const cls of classes) {
        if (FA_TO_LUCIDE_MAP[cls]) {
          return FA_TO_LUCIDE_MAP[cls];
        }
      }

      // Probar removiendo el prefijo 'fa-'
      for (const cls of classes) {
        if (cls.startsWith('fa-')) {
          const rawName = cls.replace(/^fa-/, '');
          if (FA_TO_LUCIDE_MAP[cls]) return FA_TO_LUCIDE_MAP[cls];
          if (window.lucide?.icons?.[rawName]) return rawName;
        }
      }

      return 'wallet';
    }

    /**
     * Genera un tag HTML `<i data-lucide="..." class="..."></i>`
     * @param {string} iconNameOrFa 
     * @param {object|string} options Opciones o nombre de clase CSS
     * @returns {string}
     */
    renderIcon(iconNameOrFa, options = {}) {
      const className = typeof options === 'string' ? options : (options.class || '');
      const lucideName = this.faToLucide(iconNameOrFa);
      return `<i data-lucide="${lucideName}" class="lucide-icon ${className}"></i>`;
    }

    /**
     * Genera directamente el SVG en string usando la API de Lucide si está cargada.
     * @param {string} iconNameOrFa 
     * @param {object} attrs Atributos SVG (class, size, strokeWidth, etc.)
     * @returns {string}
     */
    renderSvg(iconNameOrFa, attrs = {}) {
      const name = this.faToLucide(iconNameOrFa);
      if (window.lucide && window.lucide.icons && window.lucide.icons[name]) {
        return window.lucide.icons[name].toSvg({
          class: `lucide-icon ${attrs.class || ''}`.trim(),
          width: attrs.size || attrs.width || 20,
          height: attrs.size || attrs.height || 20,
          'stroke-width': attrs.strokeWidth || attrs['stroke-width'] || 2,
          ...attrs
        });
      }
      return `<i data-lucide="${name}" class="lucide-icon ${attrs.class || ''}"></i>`;
    }

    /**
     * Ejecuta `lucide.createIcons()` en todo el documento o en un nodo específico.
     * @param {HTMLElement} [rootNode]
     */
    refresh(rootNode) {
      if (typeof window.lucide !== 'undefined' && typeof window.lucide.createIcons === 'function') {
        try {
          if (rootNode && rootNode instanceof HTMLElement) {
            window.lucide.createIcons({ root: rootNode });
          } else {
            window.lucide.createIcons();
          }
        } catch (e) {
          console.warn('[LucideHelper] Error refrescando iconos:', e);
        }
      }
    }

    /**
     * Retorna el catálogo completo de iconos para el selector visual.
     */
    getCatalog() {
      return this.catalog;
    }

    /**
     * Deduce el icono de Lucide más representativo a partir del nombre de una categoría.
     * @param {string} nombre 
     * @returns {string} Nombre del icono Lucide
     */
    getCategoryIcon(nombre) {
      const n = (nombre || '').toLowerCase();
      if (n.includes('aliment') || n.includes('comida') || n.includes('restaur') || n.includes('super') || n.includes('cena') || n.includes('almuerz')) return 'utensils';
      if (n.includes('transp') || n.includes('gasolin') || n.includes('vehic') || n.includes('auto') || n.includes('carro') || n.includes('uber') || n.includes('taxi') || n.includes('combust')) return 'car';
      if (n.includes('vivien') || n.includes('casa') || n.includes('hogar') || n.includes('alquiler') || n.includes('renta') || n.includes('hipotec')) return 'home';
      if (n.includes('servici') || n.includes('luz') || n.includes('agua') || n.includes('electr') || n.includes('internet') || n.includes('gas') || n.includes('telef')) return 'zap';
      if (n.includes('salud') || n.includes('medic') || n.includes('farmac') || n.includes('doctor') || n.includes('hospital') || n.includes('dent') || n.includes('seguro')) return 'activity';
      if (n.includes('educ') || n.includes('estudio') || n.includes('curso') || n.includes('univers') || n.includes('coleg') || n.includes('libro')) return 'graduation-cap';
      if (n.includes('entreten') || n.includes('ocio') || n.includes('divers') || n.includes('cine') || n.includes('juego') || n.includes('stream') || n.includes('netflix') || n.includes('spotify')) return 'gamepad-2';
      if (n.includes('ropa') || n.includes('vest') || n.includes('calzado') || n.includes('moda') || n.includes('zapat')) return 'shirt';
      if (n.includes('ahorro') || n.includes('invers') || n.includes('fondo') || n.includes('banco')) return 'piggy-bank';
      if (n.includes('viaje') || n.includes('vacac') || n.includes('hotel') || n.includes('vuelo')) return 'plane';
      if (n.includes('mascota') || n.includes('veterin') || n.includes('perro') || n.includes('gato')) return 'paw-print';
      if (n.includes('trabajo') || n.includes('negoc') || n.includes('oficin') || n.includes('emprend')) return 'briefcase';
      if (n.includes('gym') || n.includes('depor') || n.includes('fit') || n.includes('ejercic')) return 'dumbbell';
      if (n.includes('compra') || n.includes('shopping') || n.includes('tienda')) return 'shopping-bag';
      return 'wallet';
    }
  }

  const helper = new LucideHelperClass();
  window.LucideHelper = helper;
  window.lucideIcon = (name, className) => helper.renderIcon(name, className);
  window.lucideSvg = (name, attrs) => helper.renderSvg(name, attrs);

  // Escuchar cuando el DOM esté listo para procesar iconos automáticamente
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => helper.refresh());
  } else {
    setTimeout(() => helper.refresh(), 0);
  }
})();
