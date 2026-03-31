/**
 * utils.js - Calculos nutricionales y helpers
 */

/**
 * Calcula la Tasa Metabólica Basal (TMB) usando la ecuacion de Mifflin-St Jeor
 */
export function calcularTMB(peso, estatura, edad, sexo) {
  if (sexo === 'masculino') {
    return 10 * peso + 6.25 * estatura - 5 * edad + 5;
  } else {
    return 10 * peso + 6.25 * estatura - 5 * edad - 161;
  }
}

/**
 * Calcula el Gasto Energetico Total Diario (TDEE)
 */
export function calcularTDEE(tmb, nivelActividad) {
  const factores = {
    bajo: 1.2,
    moderado: 1.55,
    alto: 1.725,
  };
  return tmb * (factores[nivelActividad] || 1.2);
}

/**
 * Genera un ID unico
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Formatea una fecha a string legible
 */
export function formatDate(date) {
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Formatea fecha corta
 */
export function formatDateShort(date) {
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Muestra un toast/notificacion
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()" style="padding: 2px 8px; font-size: 14px;">x</button>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Espera un numero de milisegundos
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Escapa HTML para prevenir XSS
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
