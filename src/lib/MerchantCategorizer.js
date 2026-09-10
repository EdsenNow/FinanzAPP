/**
 * @fileoverview Motor de Categorización Inteligente para FinanzApp.
 *
 * Utiliza reglas heurísticas (dominicanas e internacionales) y aprendizaje
 * adaptativo basado en el historial del usuario para pre-clasificar gastos.
 */

// Diccionario heurístico exhaustivo de patrones comerciales (locales dominicanos e internacionales)
const HEURISTIC_RULES = [
  {
    keywords: [
      'bravo', 'sirena', 'nacional', 'jumbo', 'pedidosya', 'uber eats', 'ubereats',
      'rappi', 'didi food', 'mcdonald', 'wendy', 'burger king', 'kfc', 'pizza hut',
      'domino', 'pizzarelli', 'little caesars', 'papa john', 'restauran', 'cafeteria',
      'bakery', 'panaderia', 'colmado', 'plaza lama', 'ole', 'supermercado', 'almuerzo',
      'cena', 'starbucks', 'dunkin', 'subway', 'taco bell', 'food', 'heladeria',
      'baskin', 'cinnabon', 'pollos victorina', 'chef pepper', 'jade teriyaki', 'amigo',
      'carrefour', 'pola', 'super pola', 'chimi', 'picapollo', 'parrillada', 'bistrot'
    ],
    targetCategoryNames: ['comida', 'alimentos', 'supermercado', 'restaurante', 'alimentacion', 'comestibles']
  },
  {
    keywords: [
      'uber', 'didi', 'cabify', 'indrive', 'lyft', 'bolt', 'gasolin', 'combustible',
      'estacion', 'bomba', 'texaco', 'shell', 'total', 'sunix', 'esso', 'isla', 'terpel',
      'petronan', 'peaje', 'paso rapido', 'parqueo', 'parqueadero', 'metro', 'gomera',
      'taller', 'mecanic', 'autozone', 'repuestos', 'lavado', 'car wash', 'omsa', 'teleferico'
    ],
    targetCategoryNames: ['transporte', 'gasolina', 'combustible', 'vehiculo', 'auto', 'movilidad']
  },
  {
    keywords: [
      'netflix', 'spotify', 'disney', 'hbo', 'max', 'youtube', 'apple music', 'apple.com/bill',
      'amazon prime', 'prime video', 'paramount', 'star+', 'crunchyroll', 'twitch',
      'deezer', 'tidal', 'steam', 'playstation', 'psn', 'xbox', 'nintendo', 'epic games',
      'cine', 'cinema', 'caribbean cinemas', 'palacio del cine', 'boletas', 'concierto', 'teatro', 'audible'
    ],
    targetCategoryNames: ['entretenimiento', 'suscripciones', 'ocio', 'diversion', 'streaming', 'servicios']
  },
  {
    keywords: [
      'claro', 'altice', 'viva', 'edesur', 'edenorte', 'edeeste', 'caasd', 'coraasan',
      'coaarom', 'internet', 'cable', 'energia', 'electricidad', 'luz', 'agua', 'gas propano',
      'propagas', 'tropigas', 'mantenimiento', 'condominio', 'alquiler', 'renta', 'bellon',
      'hache', 'ikea', 'coche arvelo', 'ochoa', 'ferreteria'
    ],
    targetCategoryNames: ['servicios', 'hogar', 'casa', 'servicios publicos', 'vivienda', 'luz', 'agua']
  },
  {
    keywords: [
      'farmacia', 'carol', 'gbc', 'los hidalgos', 'el sol', 'medicin', 'hospital', 'clinica',
      'laboratorio', 'amadita', 'referencia', 'patria rivas', 'dental', 'odontolog', 'optica',
      'doctor', 'medico', 'seguro medico', 'senasa', 'humano', 'palic', 'salud', 'gimnasio',
      'gym', 'smartfit', 'gold gym', 'barberia', 'peluqueria', 'salon', 'spa'
    ],
    targetCategoryNames: ['salud', 'farmacia', 'medicina', 'cuidado personal', 'bienestar', 'belleza']
  },
  {
    keywords: [
      'amazon', 'ebay', 'aliexpress', 'shein', 'temu', 'zara', 'pull&bear', 'bershka',
      'stradivarius', 'mango', 'h&m', 'tienda', 'mall', 'agora', 'blue mall', 'sambil',
      'galeria 360', 'megacentro', 'downtown center', 'corripio', 'anthony', 'jumbo compras'
    ],
    targetCategoryNames: ['compras', 'ropa', 'shopping', 'articulos', 'varios', 'general']
  },
  {
    keywords: [
      'colegio', 'escuela', 'universidad', 'uasd', 'pucmm', 'intec', 'unibe', 'itla',
      'udemy', 'coursera', 'platzi', 'duolingo', 'curso', 'matricula', 'libros', 'libreria', 'cuesta'
    ],
    targetCategoryNames: ['educacion', 'estudio', 'cursos', 'capacitacion', 'libros']
  },
  {
    keywords: [
      'nomina', 'salario', 'honorario', 'deposito', 'pago de cliente', 'sueldo',
      'quincena', 'bono', 'remesa', 'transferencia recibida', 'acreditad', 'cashback', 'interes ganado'
    ],
    targetCategoryNames: ['nomina', 'ingresos', 'salario', 'sueldo', 'ventas', 'otros ingresos']
  }
];

/**
 * Normaliza texto eliminando acentos, puntuación redundante y mayúsculas.
 * @param {string} text
 * @returns {string}
 */
function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrae la clave identificadora más representativa de un comercio.
 * @param {string} merchant
 * @returns {string}
 */
function getMerchantKey(merchant) {
  const clean = normalize(merchant);
  const stopWords = [
    'compra', 'consumo', 'pago', 'cargo', 'de', 'en', 'con', 'tarjeta', 'visa', 'mastercard',
    'com', 'net', 'org', 'srl', 'sa', 'inc', 'llc', 'do', 'rd', 'pos', 'terminal'
  ];
  const parts = clean.split(' ').filter(p => p.length >= 2 && !stopWords.includes(p));
  if (!parts.length) return clean;
  if (['supermercados', 'supermercado', 'tiendas', 'tienda', 'banco', 'farmacia', 'restaurante', 'estacion'].includes(parts[0]) && parts.length > 1) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts[0];
}

/**
 * Analiza el historial de transacciones de las categorías del usuario
 * y construye un mapa de aprendizaje de comercio -> categoryId.
 * @param {Array} categories
 * @returns {Map<string, { categoryId: string|number, count: number }>}
 */
function learnFromHistory(categories) {
  const memory = new Map();
  if (!Array.isArray(categories)) return memory;

  categories.forEach(cat => {
    const catId = cat.id;
    const txs = cat.transactions || [];
    txs.forEach(tx => {
      const desc = tx.description || '';
      if (!desc) return;
      const key = getMerchantKey(desc);
      if (!key || key.length < 3) return;

      if (!memory.has(key)) {
        memory.set(key, {});
      }
      const freq = memory.get(key);
      freq[catId] = (freq[catId] || 0) + 1;
    });
  });

  const resultMap = new Map();
  for (const [merchantKey, counts] of memory.entries()) {
    let maxCount = 0;
    let bestCatId = null;
    for (const [catId, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        bestCatId = catId;
      }
    }
    if (bestCatId) {
      resultMap.set(merchantKey, { categoryId: bestCatId, count: maxCount });
    }
  }

  return resultMap;
}

/**
 * Sugiere la categoría más adecuada para una descripción o comercio dado.
 *
 * @param {string} description - Nombre del comercio o descripción del gasto
 * @param {Array} availableCategories - Lista de categorías válidas disponibles
 * @param {Object} [options]
 * @param {Map|Array} [options.historyMemory] - Memoria generada por learnFromHistory o array de categorías
 * @param {string} [options.txType] - 'expense' | 'income'
 * @returns {Object|null} { categoryId, categoryName, confidence, reason }
 */
function suggestCategory(description, availableCategories, options = {}) {
  if (!description || !Array.isArray(availableCategories) || !availableCategories.length) {
    return null;
  }

  const txType = options.txType || 'expense';
  const validCats = availableCategories.filter(c => {
    if (txType === 'expense') return c.fixedType !== 'income';
    if (txType === 'income') return c.fixedType !== 'expense';
    return true;
  });
  if (!validCats.length) return null;

  const normDesc = normalize(description);
  const merchantKey = getMerchantKey(description);

  // 1. Prioridad Máxima: Aprendizaje Histórico del Usuario
  let historyMap = options.historyMemory;
  if (Array.isArray(historyMap)) {
    historyMap = learnFromHistory(historyMap);
  }
  if (historyMap instanceof Map && merchantKey) {
    if (historyMap.has(merchantKey)) {
      const learned = historyMap.get(merchantKey);
      const matchCat = validCats.find(c => String(c.id) === String(learned.categoryId));
      if (matchCat) {
        return {
          categoryId: matchCat.id,
          categoryName: matchCat.name,
          confidence: 'history',
          reason: `Coincide con ${learned.count} gasto(s) previo(s) en ${matchCat.name}`
        };
      }
    }

    for (const [hKey, learned] of historyMap.entries()) {
      if (normDesc.includes(hKey) || hKey.includes(normDesc)) {
        const matchCat = validCats.find(c => String(c.id) === String(learned.categoryId));
        if (matchCat) {
          return {
            categoryId: matchCat.id,
            categoryName: matchCat.name,
            confidence: 'history',
            reason: `Coincide por similitud en ${matchCat.name}`
          };
        }
      }
    }
  }

  // 2. Coincidencia Directa con el Nombre de una Categoría
  for (const cat of validCats) {
    const catNorm = normalize(cat.name);
    if (catNorm && (normDesc.includes(catNorm) || catNorm.includes(normDesc))) {
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        confidence: 'exact_name',
        reason: `El texto coincide con el nombre "${cat.name}"`
      };
    }
  }

  // 3. Reglas Heurísticas de Comercios y Patrones
  for (const rule of HEURISTIC_RULES) {
    const matchesKeyword = rule.keywords.some(kw => normDesc.includes(kw));
    if (matchesKeyword) {
      const matchCat = validCats.find(c => {
        const cNameNorm = normalize(c.name);
        return rule.targetCategoryNames.some(target => cNameNorm.includes(target));
      });
      if (matchCat) {
        return {
          categoryId: matchCat.id,
          categoryName: matchCat.name,
          confidence: 'heuristic',
          reason: `Patrón comercial detectado asignado a "${matchCat.name}"`
        };
      }
    }
  }

  return null;
}

const MerchantCategorizer = {
  normalize,
  getMerchantKey,
  learnFromHistory,
  suggestCategory,
  HEURISTIC_RULES
};

if (typeof window !== 'undefined') {
  window.MerchantCategorizer = MerchantCategorizer;
}
if (typeof globalThis !== 'undefined') {
  globalThis.MerchantCategorizer = MerchantCategorizer;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MerchantCategorizer;
}
