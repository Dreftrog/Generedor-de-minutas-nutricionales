/**
 * minutaView.js - Renderizado de la minuta en vista horario
 */

import { escapeHtml } from './utils.js';

let currentMinuta = null;
let currentWeek = 1;
let expandedDays = new Set();

/**
 * Renderiza la minuta completa
 */
export function renderMinuta(minuta) {
  currentMinuta = minuta;
  currentWeek = 1;
  expandedDays = new Set();

  renderClientSummary(minuta);
  renderWeekTabs();
  renderWeekDays();
}

/**
 * Obtiene la minuta actual
 */
export function getCurrentMinuta() {
  return currentMinuta;
}

/**
 * Establece la minuta actual (para cargar desde historial)
 */
export function setCurrentMinuta(minuta) {
  currentMinuta = minuta;
}

function renderClientSummary(minuta) {
  const { clientData, calculosCaloricos } = minuta;
  const container = document.getElementById('minuta-client-summary');

  const goalLabels = { bajar: 'Bajar de peso', mantener: 'Mantener peso', subir: 'Subir de peso' };
  const goalLabel = goalLabels[clientData.goalType] || clientData.goalType || 'Bajar de peso';

  container.innerHTML = `
    <div class="client-stat">
      <span class="client-stat-label">Cliente</span>
      <span class="client-stat-value">${escapeHtml(clientData.name)}</span>
    </div>
    <div class="client-stat">
      <span class="client-stat-label">Edad</span>
      <span class="client-stat-value">${clientData.age} años</span>
    </div>
    <div class="client-stat">
      <span class="client-stat-label">Objetivo</span>
      <span class="client-stat-value">${escapeHtml(goalLabel)}</span>
    </div>
    <div class="client-stat">
      <span class="client-stat-label">Peso actual</span>
      <span class="client-stat-value">${clientData.weight} kg</span>
    </div>
    <div class="client-stat">
      <span class="client-stat-label">Peso objetivo</span>
      <span class="client-stat-value">${clientData.goalWeight} kg</span>
    </div>
    <div class="client-stat">
      <span class="client-stat-label">TMB</span>
      <span class="client-stat-value">${calculosCaloricos.tmb} kcal</span>
    </div>
    <div class="client-stat">
      <span class="client-stat-label">TDEE</span>
      <span class="client-stat-value">${calculosCaloricos.tdee} kcal</span>
    </div>
    <div class="client-stat">
      <span class="client-stat-label">Calorias diarias</span>
      <span class="client-stat-value" style="color: var(--color-primary-500); font-weight: 700;">${calculosCaloricos.caloriasDiarias} kcal</span>
    </div>
    ${calculosCaloricos.deficit > 0 ? `
    <div class="client-stat">
      <span class="client-stat-label">Deficit diario</span>
      <span class="client-stat-value" style="color: var(--color-accent-500);">-${calculosCaloricos.deficit} kcal</span>
    </div>` : ''}
    ${calculosCaloricos.bajaEstimadaMensual > 0 ? `
    <div class="client-stat">
      <span class="client-stat-label">Baja estimada/mes</span>
      <span class="client-stat-value" style="color: var(--color-primary-400); font-weight: 700;">~${calculosCaloricos.bajaEstimadaMensual} kg</span>
    </div>` : ''}
  `;
}

function renderWeekTabs() {
  const container = document.getElementById('week-tabs');
  container.innerHTML = '';

  for (let i = 1; i <= 4; i++) {
    const diaInicio = (i - 1) * 7 + 1;
    const diaFin = i === 4 ? 30 : i * 7;
    const tab = document.createElement('button');
    tab.className = `tab ${i === currentWeek ? 'active' : ''}`;
    tab.textContent = `Semana ${i} (Dia ${diaInicio}-${diaFin})`;
    tab.addEventListener('click', () => {
      currentWeek = i;
      renderWeekTabs();
      renderWeekDays();
    });
    container.appendChild(tab);
  }
}

function renderWeekDays() {
  const container = document.getElementById('days-grid');
  container.innerHTML = '';

  const semana = currentMinuta.semanas[currentWeek - 1];
  if (!semana) return;

  semana.dias.forEach(dia => {
    const dayCard = createDayCard(dia);
    container.appendChild(dayCard);
  });
}

function createDayCard(dia) {
  const card = document.createElement('div');
  card.className = `day-card${expandedDays.has(dia.numero) ? ' expanded' : ''}`;

  const caloriasTotal = dia.caloriasTotal || dia.comidas.reduce((sum, c) => sum + (c.caloriasTotales || 0), 0);

  card.innerHTML = `
    <div class="day-header">
      <div>
        <span class="day-title">Dia ${dia.numero}</span>
      </div>
      <div class="day-summary">
        <span class="day-calories">${caloriasTotal} kcal</span>
        <div class="day-macros">
          <span><span class="macro-dot protein"></span>P: ${dia.macros.proteinas}g</span>
          <span><span class="macro-dot carbs"></span>C: ${dia.macros.carbohidratos}g</span>
          <span><span class="macro-dot fat"></span>G: ${dia.macros.grasas}g</span>
        </div>
        <svg class="day-expand-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
    </div>
    <div class="day-body">
      <div class="meal-schedule">
        ${dia.comidas.map(comida => createMealItem(comida)).join('')}
      </div>
    </div>
  `;

  // Toggle expand
  const header = card.querySelector('.day-header');
  header.addEventListener('click', () => {
    card.classList.toggle('expanded');
    if (card.classList.contains('expanded')) {
      expandedDays.add(dia.numero);
    } else {
      expandedDays.delete(dia.numero);
    }
  });

  return card;
}

function createMealItem(comida) {
  const tipoBgColors = {
    'Desayuno': 'var(--color-primary-500)',
    'Colacion AM': 'var(--color-secondary-400)',
    'Almuerzo': 'var(--color-accent-500)',
    'Colacion PM': 'var(--color-secondary-400)',
    'Cena': 'var(--color-info)',
  };

  const bgColor = tipoBgColors[comida.tipo] || 'var(--color-primary-500)';

  return `
    <div class="meal-item">
      <div class="meal-time">
        <span class="meal-time-label" style="color: ${bgColor};">${escapeHtml(comida.tipo)}</span>
        <span class="meal-time-value">${comida.hora}</span>
      </div>
      <div class="meal-content">
        <span class="meal-name">${escapeHtml(comida.nombre)}</span>
        <div class="meal-foods">
          ${comida.alimentos.map(a => `
            <div class="food-item">
              <span class="food-name">${escapeHtml(a.nombre)}</span>
              <span class="food-amount">${escapeHtml(a.cantidad)}</span>
              <span class="food-calories">${a.calorias} kcal</span>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="meal-calories-total">${comida.caloriasTotales} kcal</div>
    </div>
  `;
}

/**
 * Expande todos los dias
 */
export function expandAllDays() {
  document.querySelectorAll('.day-card').forEach(card => {
    card.classList.add('expanded');
  });
  const semana = currentMinuta.semanas[currentWeek - 1];
  if (semana) {
    semana.dias.forEach(dia => expandedDays.add(dia.numero));
  }
}

/**
 * Colapsa todos los dias
 */
export function collapseAllDays() {
  document.querySelectorAll('.day-card').forEach(card => {
    card.classList.remove('expanded');
  });
  expandedDays.clear();
}
