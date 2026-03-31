/**
 * storage.js - Persistencia en localStorage
 */

const KEYS = {
  API_KEY: 'nutriplan_api_key',
  THEME: 'nutriplan_theme',
  HISTORY: 'nutriplan_history',
};

export function getApiKey() {
  return localStorage.getItem(KEYS.API_KEY) || '';
}

export function saveApiKey(key) {
  localStorage.setItem(KEYS.API_KEY, key);
}

export function getTheme() {
  return localStorage.getItem(KEYS.THEME) || 'dark';
}

export function saveTheme(theme) {
  localStorage.setItem(KEYS.THEME, theme);
}

export function getHistory() {
  try {
    const data = localStorage.getItem(KEYS.HISTORY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveToHistory(entry) {
  const history = getHistory();
  // Entry: { id, clientName, date, data (minuta completa) }
  history.unshift(entry);
  // Maximo 20 entradas
  if (history.length > 20) history.pop();
  localStorage.setItem(KEYS.HISTORY, JSON.stringify(history));
}

export function deleteFromHistory(id) {
  const history = getHistory().filter(e => e.id !== id);
  localStorage.setItem(KEYS.HISTORY, JSON.stringify(history));
}

export function getHistoryEntry(id) {
  return getHistory().find(e => e.id === id) || null;
}
