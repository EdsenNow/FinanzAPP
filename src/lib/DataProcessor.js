/**
 * DataProcessor / ProcesadorDatos — Transforma transacciones brutas en
 * agregados y estadísticas para los gráficos y tablas de Dashboard y Estadísticas.
 */
class DataProcessor {
  constructor() {
    this.MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  }

  /**
   * Normaliza un valor de fecha a un objeto `Date`.
   * @param {Date|string} date - Valor de fecha crudo de una transacción.
   * @returns {Date}
   */
  _parseFecha(date) {
    return date instanceof Date ? date : new Date(date);
  }

  /**
   * Filtra transacciones de todas las categorías, opcionalmente por año y/o mes.
   * @param {Array} categorias - Arreglo de categorías con una propiedad `transactions`.
   * @param {object} [filtros={}] - Filtros opcionales `{ year, month }`.
   * @returns {Array} Arreglo plano de transacciones con la propiedad `category` añadida.
   */
  filtrarTransacciones(categorias, filtros = {}) {
    const { year, month } = filtros;
    const transacciones = [];
    (categorias || []).forEach(categoria => {
      (categoria.transactions || []).forEach(tx => {
        const fecha = this._parseFecha(tx.date);
        if (Number.isNaN(fecha.getTime())) return;
        if (year != null && fecha.getFullYear() !== year) return;
        if (month != null && fecha.getMonth() !== month) return;
        transacciones.push({ ...tx, category: categoria.name });
      });
    });
    return transacciones;
  }

  /**
   * Acumula transacciones en totales mensuales de ingresos y gastos.
   * @param {Array} transacciones - Arreglo plano de transacciones.
   * @returns {{ income: number[], expenses: number[] }} Dos arreglos de 12 elementos indexados por mes.
   */
  calcularMensual(transacciones) {
    const ingresos = Array(12).fill(0);
    const gastos = Array(12).fill(0);
    transacciones.forEach(tx => {
      const mes = this._parseFecha(tx.date).getMonth();
      if (tx.type === 'income') ingresos[mes] += tx.amount;
      else gastos[mes] += tx.amount;
    });
    return { income: ingresos, expenses: gastos };
  }

  /**
   * Calcula el balance neto acumulado (ingresos − gastos) mes a mes.
   * @param {number[]} ingresos - Totales mensuales de ingresos (12 elementos).
   * @param {number[]} gastos   - Totales mensuales de gastos (12 elementos).
   * @returns {number[]} Balance neto acumulado por mes.
   */
  calcularAcumulado(ingresos, gastos) {
    let suma = 0;
    return ingresos.map((ing, i) => (suma += ing - gastos[i]));
  }

  /**
   * Agrupa transacciones por categoría y devuelve arreglos ordenados para gastos e ingresos.
   * @param {Array} transacciones - Arreglo plano de transacciones.
   * @returns {{ expenses: Array, income: Array }} Cada ítem tiene `{ name, amount }`.
   */
  calcularDivisionCategorias(transacciones) {
    const mapaGastos = new Map();
    const mapaIngresos = new Map();
    transacciones.forEach(tx => {
      const mapa = tx.type === 'income' ? mapaIngresos : mapaGastos;
      mapa.set(tx.category, (mapa.get(tx.category) || 0) + tx.amount);
    });
    const aArreglo = (mapa) => Array.from(mapa.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
    return { expenses: aArreglo(mapaGastos), income: aArreglo(mapaIngresos) };
  }

  /**
   * Calcula los totales de hoy y el promedio diario neto de los últimos 30 días.
   * @param {Array} transacciones - Arreglo plano de transacciones.
   * @returns {{ incomeToday: number, expensesToday: number, avgDaily: number }}
   */
  calcularEstadisticasDiarias(transacciones) {
    const hoy = new Date();
    const inicio = new Date();
    inicio.setDate(hoy.getDate() - 29);

    let ingresosHoy = 0;
    let gastosHoy = 0;

    // Inicializa los 30 días con neto cero para garantizar cobertura completa
    const netoPorFecha = new Map();
    for (let i = 0; i < 30; i++) {
      const fecha = new Date(inicio);
      fecha.setDate(inicio.getDate() + i);
      netoPorFecha.set(fecha.toISOString().slice(0, 10), 0);
    }

    transacciones.forEach(tx => {
      const fecha = this._parseFecha(tx.date);
      if (Number.isNaN(fecha.getTime())) return;
      const key = fecha.toISOString().slice(0, 10);
      const esHoy =
        fecha.getFullYear() === hoy.getFullYear() &&
        fecha.getMonth() === hoy.getMonth() &&
        fecha.getDate() === hoy.getDate();
      if (esHoy) {
        if (tx.type === 'income') ingresosHoy += tx.amount;
        else gastosHoy += tx.amount;
      }
      if (fecha >= inicio && fecha <= hoy) {
        const delta = tx.type === 'income' ? tx.amount : -tx.amount;
        netoPorFecha.set(key, (netoPorFecha.get(key) || 0) + delta);
      }
    });

    const valores = [...netoPorFecha.values()];
    const promedioDiario = valores.length
      ? valores.reduce((s, v) => s + v, 0) / valores.length
      : 0;
    return { incomeToday: ingresosHoy, expensesToday: gastosHoy, avgDaily: promedioDiario };
  }

  /**
   * Suma gastos por día del mes (días 1–31) para las transacciones dadas.
   * @param {Array} transacciones - Arreglo plano de transacciones.
   * @returns {number[]} Arreglo de 31 elementos donde índice 0 = día 1.
   */
  calcularGastosPorDia(transacciones) {
    const gastosPorDia = Array(31).fill(0);
    transacciones.forEach(tx => {
      if (tx.type !== 'expense') return;
      const fecha = this._parseFecha(tx.date);
      if (Number.isNaN(fecha.getTime())) return;
      const dia = Math.max(0, Math.min(30, fecha.getDate() - 1));
      gastosPorDia[dia] += tx.amount;
    });
    return gastosPorDia;
  }

  /**
   * Mapea una lista de categorías a objetos listos para tabla, incluyendo porcentaje.
   * @param {Array}  lista - Arreglo de `{ name, amount, id? }`.
   * @param {string} tipo  - Etiqueta usada para generar IDs de respaldo (p. ej. `'expense'`).
   * @returns {Array} Arreglo con `{ id, name, amount, percent, type }` por ítem.
   */
  prepararDatosTabla(lista, tipo) {
    const total = lista.reduce((sum, item) => sum + item.amount, 0) || 1;
    return lista.map((item, index) => ({
      id: item.id || `${tipo}_${index + 1}`,
      name: item.name,
      amount: item.amount,
      percent: (item.amount / total) * 100,
      type: tipo
    }));
  }
}

window.ProcesadorDatos = DataProcessor;
window.DataProcessor = DataProcessor;
