/**
 * shoppingList.js - Renderizado de la lista de compras
 */

import { escapeHtml } from './utils.js';

let currentWeek = 1;
let listaCompras = [];

/**
 * Renderiza la lista de compras
 */
export function renderShoppingList(lista) {
  listaCompras = lista;
  currentWeek = 1;
  renderShoppingWeekTabs();
  renderShoppingContent();
}

function renderShoppingWeekTabs() {
  const container = document.getElementById('shopping-week-tabs');
  container.innerHTML = '';

  if (!listaCompras.length) return;

  listaCompras.forEach((semana, i) => {
    const tab = document.createElement('button');
    tab.className = `tab ${i + 1 === currentWeek ? 'active' : ''}`;
    tab.textContent = `Semana ${semana.semana || i + 1}`;
    tab.addEventListener('click', () => {
      currentWeek = i + 1;
      renderShoppingWeekTabs();
      renderShoppingContent();
    });
    container.appendChild(tab);
  });
}

function renderShoppingContent() {
  const container = document.getElementById('shopping-list-container');
  container.innerHTML = '';

  if (!listaCompras.length) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        <h3>Lista de compras no disponible</h3>
        <p>No se pudo generar la lista de compras para esta minuta.</p>
      </div>
    `;
    return;
  }

  const semana = listaCompras[currentWeek - 1];
  if (!semana || !semana.categorias) return;

  semana.categorias.forEach(categoria => {
    const catDiv = document.createElement('div');
    catDiv.className = 'shopping-category';
    catDiv.innerHTML = `
      <div class="shopping-category-header">${escapeHtml(categoria.nombre)}</div>
      <div class="shopping-items">
        ${(categoria.items || []).map(item => `
          <div class="shopping-item">
            <span class="shopping-item-name">${escapeHtml(item.nombre)}</span>
            <span class="shopping-item-amount">${escapeHtml(item.cantidad)}</span>
          </div>
        `).join('')}
      </div>
    `;
    container.appendChild(catDiv);
  });
}
