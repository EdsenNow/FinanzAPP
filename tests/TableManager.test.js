import { describe, it, expect, beforeEach } from 'vitest';
import '../src/lib/TableManager.js';

function renderTable(id, options = {}) {
  const searchInput = options.searchInputId
    ? `<input id="${options.searchInputId}" />`
    : '';
  const controls = ['prevBtnId', 'nextBtnId', 'pageInfoId', 'tableInfoId']
    .filter(key => options[key])
    .map(key => `<span id="${options[key]}"></span>`)
    .join('');

  document.body.innerHTML = `
    ${searchInput}
    ${controls}
    <table id="${id}">
      <thead>
        <tr>
          <th class="sortable" data-key="name">Nombre <i class="sort-icon fas"></i></th>
          <th class="sortable" data-key="amount">Monto <i class="sort-icon fas"></i></th>
          <th>Porcentaje</th>
          <th>Barra</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;
}

describe('TableManager', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('no falla si la tabla no existe', () => {
    expect(() => new window.TableManager('missing')).not.toThrow();
  });

  it('renderiza filas con paginación por defecto', () => {
    renderTable('testTable');
    const manager = new window.TableManager('testTable');
    manager.actualizarDatos([
      { name: 'A', amount: 100 },
      { name: 'B', amount: 200 },
      { name: 'C', amount: 300 }
    ]);
    const rows = document.querySelectorAll('#testTable tbody tr');
    expect(rows.length).toBe(3);
  });

  it('respeta itemsPerPage', () => {
    renderTable('testTable');
    const manager = new window.TableManager('testTable', { itemsPerPage: 2 });
    manager.actualizarDatos([
      { name: 'A', amount: 100 },
      { name: 'B', amount: 200 },
      { name: 'C', amount: 300 }
    ]);
    expect(document.querySelectorAll('#testTable tbody tr').length).toBe(2);
  });

  it('navega entre páginas', () => {
    const options = { pageInfoId: 'pageInfo', itemsPerPage: 2 };
    renderTable('testTable', options);
    const manager = new window.TableManager('testTable', options);
    manager.actualizarDatos([
      { name: 'A', amount: 100 },
      { name: 'B', amount: 200 },
      { name: 'C', amount: 300 },
      { name: 'D', amount: 400 }
    ]);
    expect(document.getElementById('pageInfo').textContent).toBe('1 / 2');
    manager.paginaSiguiente();
    expect(document.getElementById('pageInfo').textContent).toBe('2 / 2');
  });

  it('filtra por término de búsqueda', () => {
    const options = { searchInputId: 'search' };
    renderTable('testTable', options);
    const manager = new window.TableManager('testTable', options);
    manager.actualizarDatos([
      { name: 'Comida', amount: 100 },
      { name: 'Transporte', amount: 200 },
      { name: 'Comida rápida', amount: 300 }
    ]);
    document.getElementById('search').value = 'comida';
    manager.manejarBusqueda();
    expect(document.querySelectorAll('#testTable tbody tr').length).toBe(2);
  });

  it('ordena por columna y alterna dirección', () => {
    renderTable('testTable');
    const manager = new window.TableManager('testTable', { sortKey: 'name', sortDirection: 'asc' });
    manager.actualizarDatos([
      { name: 'B', amount: 200 },
      { name: 'A', amount: 100 },
      { name: 'C', amount: 300 }
    ]);
    manager.manejarOrden('name');
    let firstCell = document.querySelector('#testTable tbody tr:first-child td');
    expect(firstCell.textContent).toBe('C'); // cambió a desc
    manager.manejarOrden('name');
    firstCell = document.querySelector('#testTable tbody tr:first-child td');
    expect(firstCell.textContent).toBe('A'); // volvió a asc
  });

  it('muestra mensaje cuando no hay datos', () => {
    renderTable('testTable');
    const manager = new window.TableManager('testTable');
    manager.actualizarDatos([]);
    const cell = document.querySelector('#testTable tbody tr td');
    expect(cell.textContent).toContain('No hay datos');
  });

  it('soporta itemsPerPage = Infinity', () => {
    renderTable('testTable');
    const manager = new window.TableManager('testTable', { itemsPerPage: Infinity });
    const data = Array.from({ length: 20 }, (_, i) => ({ name: `Item ${i}`, amount: i }));
    manager.actualizarDatos(data);
    expect(document.querySelectorAll('#testTable tbody tr').length).toBe(20);
  });
});
