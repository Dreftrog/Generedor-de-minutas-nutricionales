/**
 * wizard.js - Logica del formulario wizard multi-paso
 */

import { showToast } from './utils.js';

let currentStep = 1;
const totalSteps = 4;

// Datos almacenados del tags input
const tagsData = {
  likes: [],
  dislikes: [],
  allergies: [],
};

/**
 * Inicializa el wizard
 */
export function initWizard(onGenerate) {
  setupStepNavigation(onGenerate);
  setupActivitySelector();
  setupChips();
  setupTagsInputs();
  setupEditButtons();
}

/**
 * Resetea el wizard al paso 1
 */
export function resetWizard() {
  currentStep = 1;
  updateWizardUI();
  // Limpiar formularios
  document.querySelectorAll('.wizard-panel input, .wizard-panel textarea, .wizard-panel select').forEach(el => {
    if (el.type === 'checkbox' || el.type === 'radio') {
      el.checked = false;
    } else if (el.tagName === 'SELECT') {
      // Restaurar al primer valor con option (no vaciar)
      el.selectedIndex = 0;
    } else {
      el.value = '';
    }
  });
  // Limpiar chips
  document.querySelectorAll('.chip.active').forEach(c => c.classList.remove('active'));
  // Limpiar activity
  document.querySelectorAll('.activity-option.selected').forEach(a => a.classList.remove('selected'));
  // Limpiar tags
  tagsData.likes = [];
  tagsData.dislikes = [];
  tagsData.allergies = [];
  renderTags('likes');
  renderTags('dislikes');
  renderTags('allergies');
}

function setupStepNavigation(onGenerate) {
  // Siguiente desde paso 1
  document.getElementById('btn-step-1-next').addEventListener('click', () => {
    if (validateStep1()) {
      goToStep(2);
    }
  });

  // Paso 2
  document.getElementById('btn-step-2-prev').addEventListener('click', () => goToStep(1));
  document.getElementById('btn-step-2-next').addEventListener('click', () => goToStep(3));

  // Paso 3
  document.getElementById('btn-step-3-prev').addEventListener('click', () => goToStep(2));
  document.getElementById('btn-step-3-next').addEventListener('click', () => {
    goToStep(4);
    renderReview();
  });

  // Paso 4
  document.getElementById('btn-step-4-prev').addEventListener('click', () => goToStep(3));
  document.getElementById('btn-generate').addEventListener('click', () => {
    if (onGenerate) onGenerate(collectFormData());
  });

  // Cancelar
  document.getElementById('btn-wizard-cancel').addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'home' }));
  });
}

function setupActivitySelector() {
  const options = document.querySelectorAll('.activity-option');
  options.forEach(opt => {
    opt.addEventListener('click', () => {
      options.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      opt.querySelector('input[type="radio"]').checked = true;
    });
  });
}

function setupChips() {
  document.querySelectorAll('.chip-group .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const cb = chip.querySelector('input[type="checkbox"]');
      cb.checked = !cb.checked;
      chip.classList.toggle('active', cb.checked);
    });
  });
}

function setupTagsInputs() {
  setupSingleTagInput('likes');
  setupSingleTagInput('dislikes');
  setupSingleTagInput('allergies');
}

function setupSingleTagInput(type) {
  const input = document.getElementById(`${type}-tags-input`);
  const container = document.getElementById(`${type}-tags-container`);

  container.addEventListener('click', () => input.focus());

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      e.preventDefault();
      const val = input.value.trim();
      if (!tagsData[type].includes(val)) {
        tagsData[type].push(val);
        renderTags(type);
      }
      input.value = '';
    } else if (e.key === 'Backspace' && !input.value && tagsData[type].length > 0) {
      tagsData[type].pop();
      renderTags(type);
    }
  });
}

function renderTags(type) {
  const container = document.getElementById(`${type}-tags-container`);
  const input = document.getElementById(`${type}-tags-input`);

  // Remover tags existentes
  container.querySelectorAll('.tag').forEach(t => t.remove());

  // Crear nuevos tags
  tagsData[type].forEach((val, idx) => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = `${val} <span class="tag-remove" data-type="${type}" data-index="${idx}">x</span>`;
    container.insertBefore(tag, input);
  });

  // Event listeners para eliminar
  container.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const t = btn.dataset.type;
      const i = parseInt(btn.dataset.index);
      tagsData[t].splice(i, 1);
      renderTags(t);
    });
  });
}

function setupEditButtons() {
  document.querySelectorAll('[data-edit-step]').forEach(btn => {
    btn.addEventListener('click', () => {
      const step = parseInt(btn.dataset.editStep);
      goToStep(step);
    });
  });
}

function goToStep(step) {
  currentStep = step;
  updateWizardUI();
}

function updateWizardUI() {
  // Actualizar paneles
  document.querySelectorAll('.wizard-panel').forEach((panel, i) => {
    panel.classList.toggle('active', i + 1 === currentStep);
  });

  // Actualizar indicadores de progreso
  document.querySelectorAll('.wizard-step').forEach((ws, i) => {
    const stepNum = i + 1;
    ws.classList.remove('active', 'completed');
    if (stepNum === currentStep) {
      ws.classList.add('active');
    } else if (stepNum < currentStep) {
      ws.classList.add('completed');
    }
  });

  // Actualizar conectores
  for (let i = 1; i < totalSteps; i++) {
    const connector = document.getElementById(`connector-${i}-${i + 1}`);
    if (connector) {
      connector.classList.toggle('completed', i < currentStep);
    }
  }
}

function validateStep1() {
  const name = document.getElementById('client-name').value.trim();
  const age = document.getElementById('client-age').value;
  const sex = document.getElementById('client-sex').value;
  const weight = document.getElementById('client-weight').value;
  const height = document.getElementById('client-height').value;
  const goalWeight = document.getElementById('client-goal-weight').value;
  const activity = document.querySelector('input[name="activity"]:checked');

  if (!name) {
    showToast('Ingresa el nombre del cliente', 'error');
    return false;
  }
  if (!age || age < 10 || age > 100) {
    showToast('Ingresa una edad valida', 'error');
    return false;
  }
  if (!sex) {
    showToast('Selecciona el sexo', 'error');
    return false;
  }
  if (!weight) {
    showToast('Ingresa el peso actual', 'error');
    return false;
  }
  if (!height) {
    showToast('Ingresa la estatura', 'error');
    return false;
  }
  if (!goalWeight) {
    showToast('Ingresa el peso objetivo', 'error');
    return false;
  }
  if (!activity) {
    showToast('Selecciona el nivel de actividad fisica', 'error');
    return false;
  }
  return true;
}

function renderReview() {
  const data = collectFormData();

  // Client data
  const clientGrid = document.getElementById('review-client-data');
  clientGrid.innerHTML = `
    <div class="review-item"><span class="review-label">Nombre</span><span class="review-value">${data.name}</span></div>
    <div class="review-item"><span class="review-label">Edad</span><span class="review-value">${data.age} años</span></div>
    <div class="review-item"><span class="review-label">Sexo</span><span class="review-value">${data.sex}</span></div>
    <div class="review-item"><span class="review-label">Peso actual</span><span class="review-value">${data.weight} kg</span></div>
    <div class="review-item"><span class="review-label">Estatura</span><span class="review-value">${data.height} cm</span></div>
    <div class="review-item"><span class="review-label">Peso objetivo</span><span class="review-value">${data.goalWeight} kg</span></div>
    <div class="review-item"><span class="review-label">Objetivo</span><span class="review-value">${data.goalType}</span></div>
    <div class="review-item"><span class="review-label">Actividad</span><span class="review-value">${data.activity}</span></div>
  `;

  // Preferences
  const prefsDiv = document.getElementById('review-preferences');
  let prefsHtml = '';
  if (data.dietTypes.length) {
    prefsHtml += `<div class="review-item" style="margin-bottom: var(--space-3);"><span class="review-label">Tipo de alimentacion</span><div class="review-tags">${data.dietTypes.map(d => `<span class="tag">${d}</span>`).join('')}</div></div>`;
  }
  if (data.likes.length) {
    prefsHtml += `<div class="review-item" style="margin-bottom: var(--space-3);"><span class="review-label">Le gustan</span><div class="review-tags">${data.likes.map(d => `<span class="tag">${d}</span>`).join('')}</div></div>`;
  }
  if (data.dislikes.length) {
    prefsHtml += `<div class="review-item" style="margin-bottom: var(--space-3);"><span class="review-label">No le gustan</span><div class="review-tags">${data.dislikes.map(d => `<span class="tag">${d}</span>`).join('')}</div></div>`;
  }
  if (data.allergies.length) {
    prefsHtml += `<div class="review-item" style="margin-bottom: var(--space-3);"><span class="review-label">Alergias</span><div class="review-tags">${data.allergies.map(d => `<span class="tag">${d}</span>`).join('')}</div></div>`;
  }
  if (data.exceptions) {
    prefsHtml += `<div class="review-item"><span class="review-label">Excepciones</span><span class="review-value">${data.exceptions}</span></div>`;
  }
  prefsDiv.innerHTML = prefsHtml || '<p class="text-sm text-muted">Sin preferencias especificas</p>';

  // Health
  const healthDiv = document.getElementById('review-health');
  let healthHtml = '';
  if (data.healthConditions.length) {
    healthHtml += `<div class="review-item" style="margin-bottom: var(--space-3);"><span class="review-label">Condiciones</span><div class="review-tags">${data.healthConditions.map(d => `<span class="tag">${d}</span>`).join('')}</div></div>`;
  }
  if (data.otherHealth) {
    healthHtml += `<div class="review-item" style="margin-bottom: var(--space-3);"><span class="review-label">Otras condiciones</span><span class="review-value">${data.otherHealth}</span></div>`;
  }
  if (data.medications) {
    healthHtml += `<div class="review-item"><span class="review-label">Medicamentos</span><span class="review-value">${data.medications}</span></div>`;
  }
  healthDiv.innerHTML = healthHtml || '<p class="text-sm text-muted">Sin condiciones reportadas</p>';
}

/**
 * Recolecta todos los datos del formulario
 */
export function collectFormData() {
  return {
    name: document.getElementById('client-name').value.trim(),
    age: parseInt(document.getElementById('client-age').value),
    sex: document.getElementById('client-sex').value,
    weight: parseFloat(document.getElementById('client-weight').value),
    height: parseInt(document.getElementById('client-height').value),
    goalWeight: parseFloat(document.getElementById('client-goal-weight').value),
    goalType: document.getElementById('client-goal-type').value,
    activity: document.querySelector('input[name="activity"]:checked')?.value || 'bajo',
    dietTypes: getActiveChips('diet-type-chips'),
    likes: [...tagsData.likes],
    dislikes: [...tagsData.dislikes],
    allergies: [...tagsData.allergies],
    exceptions: document.getElementById('exceptions').value.trim(),
    healthConditions: getActiveChips('health-chips'),
    otherHealth: document.getElementById('other-health').value.trim(),
    medications: document.getElementById('medications').value.trim(),
  };
}

function getActiveChips(containerId) {
  const chips = document.querySelectorAll(`#${containerId} .chip.active`);
  return Array.from(chips).map(c => c.dataset.value);
}
