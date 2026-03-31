/**
 * app.js - Entry point principal de NutriPlan Pro
 */

// Importar estilos
import '../css/variables.css';
import '../css/base.css';
import '../css/components.css';
import '../css/layout.css';

// Importar modulos
import { getApiKey, saveApiKey, getTheme, saveTheme, getHistory, saveToHistory, deleteFromHistory, getHistoryEntry } from './storage.js';
import { initWizard, resetWizard } from './wizard.js';
import { generateMinuta, cancelGeneration } from './gemini.js';
import { renderMinuta, getCurrentMinuta, setCurrentMinuta } from './minutaView.js';
import { renderShoppingList } from './shoppingList.js';
import { generatePDF } from './pdfGenerator.js';
import { showToast, generateId, formatDate, formatDateShort, escapeHtml } from './utils.js';

// ============================
// Estado de la aplicacion
// ============================
let currentScreen = 'home';

// ============================
// Inicializacion
// ============================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavigation();
  initWizard(handleGenerate);
  initSettingsPage();
  initModalHandlers();
  renderHistoryList();
});

// ============================
// Tema
// ============================
function initTheme() {
  const theme = getTheme();
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcons(theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  saveTheme(next);
  updateThemeIcons(next);
}

function updateThemeIcons(theme) {
  const moonIcon = document.getElementById('theme-icon-moon');
  const sunIcon = document.getElementById('theme-icon-sun');
  if (theme === 'dark') {
    moonIcon.style.display = 'block';
    sunIcon.style.display = 'none';
  } else {
    moonIcon.style.display = 'none';
    sunIcon.style.display = 'block';
  }
}

// ============================
// Navegacion
// ============================
function initNavigation() {
  // Home link
  document.getElementById('nav-home-link').addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('home');
  });

  // Boton nueva minuta
  document.getElementById('btn-new-minuta').addEventListener('click', () => {
    navigateTo('wizard');
    resetWizard();
  });

  // Boton nueva minuta (desde la vista de minuta)
  document.getElementById('btn-new-from-minuta').addEventListener('click', () => {
    navigateTo('wizard');
    resetWizard();
  });

  // Settings
  document.getElementById('btn-settings').addEventListener('click', () => {
    navigateTo('settings');
    renderHistoryList();
  });

  // History (va a settings)
  document.getElementById('btn-history').addEventListener('click', () => {
    navigateTo('settings');
    renderHistoryList();
  });

  // Theme toggles
  document.getElementById('btn-theme-toggle').addEventListener('click', toggleTheme);
  document.getElementById('btn-theme-toggle-settings').addEventListener('click', toggleTheme);

  // View toggles en la minuta
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchMinutaView(view);
    });
  });

  // Descargar PDF
  document.getElementById('btn-download-pdf').addEventListener('click', handleDownloadPDF);

  // Cancelar generacion
  document.getElementById('btn-cancel-generation').addEventListener('click', () => {
    cancelGeneration();
    navigateTo('wizard');
    showToast('Generacion cancelada', 'info');
  });

  // Evento personalizado de navegacion
  window.addEventListener('navigate', (e) => {
    navigateTo(e.detail);
  });
}

function navigateTo(screen) {
  currentScreen = screen;
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
  });
  const targetScreen = document.getElementById(`screen-${screen}`);
  if (targetScreen) {
    targetScreen.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function switchMinutaView(view) {
  // Actualizar tabs activos
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  // Mostrar/ocultar vistas
  document.getElementById('minuta-schedule-view').style.display = view === 'schedule' ? 'block' : 'none';
  document.getElementById('minuta-shopping-view').style.display = view === 'shopping' ? 'block' : 'none';
  document.getElementById('minuta-recommendations-view').style.display = view === 'recommendations' ? 'block' : 'none';
}

// ============================
// Generacion de minuta
// ============================
async function handleGenerate(formData) {
  const apiKey = getApiKey();
  if (!apiKey) {
    openApiKeyModal(() => handleGenerate(formData));
    return;
  }

  navigateTo('loading');

  try {
    const minuta = await generateMinuta(
      formData,
      (progress) => {
        document.getElementById('loading-progress').style.width = `${progress}%`;
      },
      (status) => {
        document.getElementById('loading-subtitle').textContent = status;
        // Actualizar texto de bloque
        const diasMatch = status.match(/Dias (\d+)-(\d+)/);
        if (diasMatch) {
          document.getElementById('loading-week-text').textContent = `Bloque ${diasMatch[1] === '1' ? '1' : '2'} de 2`;
        }
      }
    );

    // Guardar en historial
    const entry = {
      id: generateId(),
      clientName: formData.name,
      date: new Date().toISOString(),
      data: minuta,
    };
    saveToHistory(entry);

    // Mostrar la minuta
    showMinuta(minuta);
    showToast('Minuta generada exitosamente', 'success');
  } catch (err) {
    console.error('Error generando minuta:', err);
    if (err.message === 'Generacion cancelada') return;
    navigateTo('wizard');
    showToast(`Error: ${err.message}`, 'error');
  }
}

function showMinuta(minuta) {
  // Titulo
  document.getElementById('minuta-title').textContent = `Minuta de ${minuta.clientData.name}`;
  document.getElementById('minuta-date').textContent = `Generada: ${formatDate(new Date())}`;

  // Renderizar la minuta
  renderMinuta(minuta);

  // Renderizar lista de compras
  renderShoppingList(minuta.listaCompras);

  // Renderizar recomendaciones
  renderRecommendations(minuta.recomendaciones);

  // Navegar a la vista
  navigateTo('minuta');
  switchMinutaView('schedule');
}

function renderRecommendations(recs) {
  const container = document.getElementById('recommendations-grid');
  if (!recs) {
    container.innerHTML = '<p class="text-muted">No hay recomendaciones disponibles.</p>';
    return;
  }

  container.innerHTML = '';

  const sections = [
    { title: 'Hidratacion Diaria', items: recs.hidratacion || [], icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>' },
    { title: 'Horarios Recomendados', items: recs.horarios || [], icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' },
    { title: 'Consejos para Mejorar Resultados', items: recs.consejos || [], icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' },
  ];

  sections.forEach(section => {
    if (!section.items.length) return;

    const card = document.createElement('div');
    card.className = 'card recommendation-card';
    card.innerHTML = `
      <h4>${section.icon} ${section.title}</h4>
      <ul>
        ${section.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>
    `;
    container.appendChild(card);
  });
}

// ============================
// PDF
// ============================
function handleDownloadPDF() {
  const minuta = getCurrentMinuta();
  if (!minuta) {
    showToast('No hay minuta para descargar', 'error');
    return;
  }

  try {
    generatePDF(minuta);
    showToast('PDF descargado exitosamente', 'success');
  } catch (err) {
    console.error('Error generando PDF:', err);
    showToast(`Error generando PDF: ${err.message}`, 'error');
  }
}

// ============================
// Settings
// ============================
function initSettingsPage() {
  // Cargar API key
  const apiKeyInput = document.getElementById('api-key-input');
  const savedKey = getApiKey();
  if (savedKey) {
    apiKeyInput.value = savedKey;
  }

  // Guardar API key
  document.getElementById('btn-save-api-key').addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      saveApiKey(key);
      showToast('API Key guardada', 'success');
    } else {
      showToast('Ingresa una API Key valida', 'error');
    }
  });
}

function renderHistoryList() {
  const history = getHistory();
  const list = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');

  if (!history.length) {
    list.style.display = 'none';
    empty.style.display = 'flex';
    return;
  }

  list.style.display = 'flex';
  empty.style.display = 'none';
  list.innerHTML = '';

  history.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div class="history-item-info">
        <span class="history-item-name">${escapeHtml(entry.clientName)}</span>
        <span class="history-item-date">${formatDateShort(new Date(entry.date))}</span>
      </div>
      <div class="history-item-actions">
        <button class="btn btn-ghost btn-sm" data-action="view" data-id="${entry.id}" title="Ver">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button class="btn btn-ghost btn-sm" data-action="pdf" data-id="${entry.id}" title="Descargar PDF">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${entry.id}" title="Eliminar" style="color: var(--color-error);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    `;

    // Event listeners
    item.querySelector('[data-action="view"]').addEventListener('click', (e) => {
      e.stopPropagation();
      const histEntry = getHistoryEntry(entry.id);
      if (histEntry && histEntry.data) {
        showMinuta(histEntry.data);
      }
    });

    item.querySelector('[data-action="pdf"]').addEventListener('click', (e) => {
      e.stopPropagation();
      const histEntry = getHistoryEntry(entry.id);
      if (histEntry && histEntry.data) {
        try {
          generatePDF(histEntry.data);
          showToast('PDF descargado', 'success');
        } catch (err) {
          showToast('Error generando PDF', 'error');
        }
      }
    });

    item.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Eliminar esta minuta del historial?')) {
        deleteFromHistory(entry.id);
        renderHistoryList();
        showToast('Minuta eliminada del historial', 'info');
      }
    });

    // Click on item to view
    item.addEventListener('click', () => {
      const histEntry = getHistoryEntry(entry.id);
      if (histEntry && histEntry.data) {
        showMinuta(histEntry.data);
      }
    });

    list.appendChild(item);
  });
}

// ============================
// Modal API Key
// ============================
let modalCallback = null;

function initModalHandlers() {
  document.getElementById('btn-close-modal').addEventListener('click', closeApiKeyModal);
  document.getElementById('btn-modal-cancel').addEventListener('click', closeApiKeyModal);
  document.getElementById('btn-modal-save-key').addEventListener('click', () => {
    const key = document.getElementById('modal-api-key-input').value.trim();
    if (key) {
      saveApiKey(key);
      document.getElementById('api-key-input').value = key;
      closeApiKeyModal();
      showToast('API Key guardada', 'success');
      if (modalCallback) {
        modalCallback();
        modalCallback = null;
      }
    } else {
      showToast('Ingresa una API Key valida', 'error');
    }
  });

  // Cerrar modal al hacer click fuera
  document.getElementById('modal-api-key').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      closeApiKeyModal();
    }
  });
}

function openApiKeyModal(callback) {
  modalCallback = callback;
  document.getElementById('modal-api-key').classList.add('active');
}

function closeApiKeyModal() {
  document.getElementById('modal-api-key').classList.remove('active');
  modalCallback = null;
}
