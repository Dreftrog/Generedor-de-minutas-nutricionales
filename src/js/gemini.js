/**
 * gemini.js - Integracion con Google Gemini API
 */

import { calcularTMB, calcularTDEE, sleep } from './utils.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

let abortController = null;

/**
 * Genera la minuta completa (semana por semana)
 * @param {Object} clientData - Datos del cliente
 * @param {Function} onProgress - Callback de progreso (0-100)
 * @param {Function} onStatusChange - Callback de estado
 * @returns {Object} Minuta completa
 */
export async function generateMinuta(clientData, onProgress, onStatusChange) {
  const apiKey = API_KEY;

  abortController = new AbortController();

  const tmb = calcularTMB(clientData.weight, clientData.height, clientData.age, clientData.sex);
  const tdee = calcularTDEE(tmb, clientData.activity);

  // Calcular ajuste calorico con deficit saludable
  let caloriasDiarias = tdee;
  let deficitDiario = 0;
  const diffPeso = clientData.weight - clientData.goalWeight;

  if (clientData.goalType === 'bajar' || diffPeso > 0) {
    // Deficit saludable: entre 500 y 800 kcal/dia
    // 500 kcal/dia = ~0.5 kg/semana = ~2 kg/mes
    // 800 kcal/dia = ~0.8 kg/semana = ~3.3 kg/mes
    deficitDiario = Math.min(Math.max(diffPeso * 70, 400), 800);
    caloriasDiarias = tdee - deficitDiario;
  } else if (clientData.goalType === 'subir') {
    deficitDiario = 0;
    caloriasDiarias = tdee + 400;
  }
  caloriasDiarias = Math.round(Math.max(caloriasDiarias, 1200)); // Minimo 1200 kcal
  deficitDiario = Math.round(tdee - caloriasDiarias);

  // Calcular estimacion de baja de peso mensual
  // 1 kg de grasa corporal = ~7700 kcal
  const bajaEstimadaMensual = deficitDiario > 0 ? parseFloat(((deficitDiario * 30) / 7700).toFixed(1)) : 0;

  const minutaCompleta = {
    clientData,
    calculosCaloricos: {
      tmb: Math.round(tmb),
      tdee: Math.round(tdee),
      caloriasDiarias,
      deficit: deficitDiario,
      bajaEstimadaMensual,
    },
    semanas: [],
    listaCompras: [],
    recomendaciones: null,
  };

  // Generar en 2 bloques (dias 1-15 y 16-30) para mayor velocidad
  const bloques = [
    { bloque: 1, diaInicio: 1, diaFin: 15, label: 'Dias 1-15' },
    { bloque: 2, diaInicio: 16, diaFin: 30, label: 'Dias 16-30' },
  ];

  for (let i = 0; i < bloques.length; i++) {
    const { bloque, diaInicio, diaFin, label } = bloques[i];
    if (abortController.signal.aborted) throw new Error('Generacion cancelada');

    onStatusChange(`Generando ${label}...`);
    onProgress(i / bloques.length * 80);

    const prompt = buildWeekPrompt(clientData, caloriasDiarias, bloque, diaInicio, diaFin);

    let attempts = 0;
    let blockData = null;

    while (attempts < 3 && !blockData) {
      try {
        const response = await callGeminiAPI(prompt, apiKey);
        blockData = parseWeekResponse(response, diaInicio, diaFin);
      } catch (err) {
        attempts++;
        if (attempts >= 3) throw err;
        onStatusChange(`Reintentando ${label} (intento ${attempts + 1})...`);
        await sleep(1500 * attempts);
      }
    }

    // Dividir en semanas de 7 dias para la vista
    const dias = blockData;
    if (bloque === 1) {
      minutaCompleta.semanas.push({ numero: 1, dias: dias.slice(0, 7) });
      minutaCompleta.semanas.push({ numero: 2, dias: dias.slice(7) });
    } else {
      minutaCompleta.semanas.push({ numero: 3, dias: dias.slice(0, 7) });
      minutaCompleta.semanas.push({ numero: 4, dias: dias.slice(7) });
    }

    onProgress((i + 1) / bloques.length * 80);

    // Espera minima entre bloques
    if (i < bloques.length - 1) {
      await sleep(1000);
    }
  }

  // Generar lista de compras y recomendaciones
  if (!abortController.signal.aborted) {
    onStatusChange('Generando lista de compras y recomendaciones...');
    onProgress(85);

    const extrasPrompt = buildExtrasPrompt(clientData, caloriasDiarias, minutaCompleta);
    try {
      const extrasResponse = await callGeminiAPI(extrasPrompt, apiKey);
      const extras = parseExtrasResponse(extrasResponse);
      minutaCompleta.listaCompras = extras.listaCompras;
      minutaCompleta.recomendaciones = extras.recomendaciones;
    } catch (err) {
      console.error('Error generando extras:', err);
      minutaCompleta.listaCompras = [];
      minutaCompleta.recomendaciones = {
        hidratacion: ['Beber al menos 2 litros de agua al dia', 'Evitar bebidas azucaradas'],
        horarios: ['Desayuno: 7:00-8:00', 'Colacion AM: 10:00-10:30', 'Almuerzo: 13:00-14:00', 'Colacion PM: 16:00-16:30', 'Cena: 19:00-20:00'],
        consejos: ['Respetar los horarios de comida', 'Masticar lento', 'Dormir al menos 7-8 horas'],
      };
    }

    onProgress(100);
  }

  return minutaCompleta;
}

/**
 * Cancela la generacion en curso
 */
export function cancelGeneration() {
  if (abortController) {
    abortController.abort();
  }
}

/**
 * Construye el prompt para una semana especifica
 */
function buildWeekPrompt(data, caloriasDiarias, semana, diaInicio, diaFin) {
  const restricciones = [];
  if (data.dietTypes.length) restricciones.push(`Tipo de alimentacion: ${data.dietTypes.join(', ')}`);
  if (data.likes.length) restricciones.push(`Alimentos que le gustan: ${data.likes.join(', ')}`);
  if (data.dislikes.length) restricciones.push(`Alimentos que NO le gustan: ${data.dislikes.join(', ')}`);
  if (data.allergies.length) restricciones.push(`Alergias: ${data.allergies.join(', ')}`);
  if (data.exceptions) restricciones.push(`Excepciones: ${data.exceptions}`);

  const condiciones = [];
  if (data.healthConditions.length) condiciones.push(data.healthConditions.join(', '));
  if (data.otherHealth) condiciones.push(data.otherHealth);
  if (data.medications) condiciones.push(`Medicamentos: ${data.medications}`);

  return `Actua como nutricionista profesional. Genera el plan alimenticio para los dias ${diaInicio} al ${diaFin} (Semana ${semana}) de una minuta mensual.

DATOS DEL CLIENTE:
- Nombre: ${data.name}
- Edad: ${data.age} años
- Sexo: ${data.sex}
- Peso actual: ${data.weight} kg
- Estatura: ${data.height} cm
- Peso objetivo: ${data.goalWeight} kg
- Objetivo: ${data.goalType} de peso
- Nivel de actividad: ${data.activity}
- Calorias diarias objetivo: ${caloriasDiarias} kcal

PREFERENCIAS Y RESTRICCIONES:
${restricciones.length ? restricciones.join('\n') : 'Sin restricciones especificas'}

CONDICIONES DE SALUD:
${condiciones.length ? condiciones.join('\n') : 'Sin condiciones reportadas'}

INSTRUCCIONES:
1. Genera EXACTAMENTE los dias ${diaInicio} al ${diaFin}.
2. Cada dia debe tener: Desayuno, Colacion AM, Almuerzo, Colacion PM, Cena.
3. Cada comida debe incluir: nombre del plato, alimentos con cantidad en gramos/ml y calorias por alimento.
4. Las calorias totales del dia deben aproximarse a ${caloriasDiarias} kcal.
5. Incluir macronutrientes aproximados por dia (proteinas g, carbohidratos g, grasas g).
6. NO repetir excesivamente los platos entre dias.
7. Usar alimentos accesibles en Chile.
8. Adaptar a las preferencias y condiciones del cliente.

RESPONDE EXCLUSIVAMENTE en formato JSON valido con esta estructura exacta (sin texto adicional, sin markdown, sin backticks):
{
  "dias": [
    {
      "numero": ${diaInicio},
      "comidas": [
        {
          "tipo": "Desayuno",
          "hora": "07:30",
          "nombre": "Nombre del plato",
          "alimentos": [
            {"nombre": "Alimento", "cantidad": "150g", "calorias": 120}
          ],
          "caloriasTotales": 350
        },
        {
          "tipo": "Colacion AM",
          "hora": "10:00",
          "nombre": "Nombre",
          "alimentos": [...],
          "caloriasTotales": 150
        },
        {
          "tipo": "Almuerzo",
          "hora": "13:00",
          "nombre": "Nombre del plato",
          "alimentos": [...],
          "caloriasTotales": 500
        },
        {
          "tipo": "Colacion PM",
          "hora": "16:00",
          "nombre": "Nombre",
          "alimentos": [...],
          "caloriasTotales": 150
        },
        {
          "tipo": "Cena",
          "hora": "19:30",
          "nombre": "Nombre del plato",
          "alimentos": [...],
          "caloriasTotales": 450
        }
      ],
      "caloriasTotal": ${caloriasDiarias},
      "macros": {"proteinas": 100, "carbohidratos": 200, "grasas": 55}
    }
  ]
}`;
}

/**
 * Construye el prompt para extras (lista de compras + recomendaciones)
 */
function buildExtrasPrompt(data, caloriasDiarias, minuta) {
  // Extraer nombres de alimentos unicos de toda la minuta
  const alimentosSet = new Set();
  minuta.semanas.forEach(semana => {
    semana.dias.forEach(dia => {
      dia.comidas.forEach(comida => {
        comida.alimentos.forEach(alimento => {
          alimentosSet.add(alimento.nombre);
        });
      });
    });
  });

  return `Actua como nutricionista profesional. Basandote en la siguiente lista de alimentos usados en una minuta mensual de 30 dias, genera la lista de compras semanal y recomendaciones.

ALIMENTOS UTILIZADOS: ${Array.from(alimentosSet).join(', ')}

DATOS DEL CLIENTE:
- Calorias diarias: ${caloriasDiarias} kcal
- Peso actual: ${data.weight} kg
- Peso objetivo: ${data.goalWeight} kg
- Objetivo: ${data.goalType} de peso

RESPONDE EXCLUSIVAMENTE en formato JSON valido (sin texto adicional, sin markdown, sin backticks):
{
  "listaCompras": [
    {
      "semana": 1,
      "categorias": [
        {
          "nombre": "Frutas y Verduras",
          "items": [
            {"nombre": "Manzana", "cantidad": "14 unidades"},
            {"nombre": "Espinaca", "cantidad": "500g"}
          ]
        },
        {
          "nombre": "Proteinas",
          "items": [...]
        },
        {
          "nombre": "Cereales y Legumbres",
          "items": [...]
        },
        {
          "nombre": "Lacteos y Alternativas",
          "items": [...]
        },
        {
          "nombre": "Otros",
          "items": [...]
        }
      ]
    },
    {"semana": 2, "categorias": [...]},
    {"semana": 3, "categorias": [...]},
    {"semana": 4, "categorias": [...]}
  ],
  "recomendaciones": {
    "hidratacion": [
      "Beber al menos 2 litros de agua al dia",
      "Otra recomendacion..."
    ],
    "horarios": [
      "Desayuno: 7:00 - 8:00",
      "Colacion AM: 10:00 - 10:30",
      "Almuerzo: 13:00 - 14:00",
      "Colacion PM: 16:00 - 16:30",
      "Cena: 19:00 - 20:00"
    ],
    "consejos": [
      "Consejo personalizado 1",
      "Consejo personalizado 2"
    ]
  }
}`;
}

/**
 * Llama a la API de Gemini
 */
async function callGeminiAPI(prompt, apiKey) {
  const url = `${API_BASE}?key=${apiKey}`;

  const body = {
    contents: [{
      parts: [{ text: prompt }],
    }],
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 65536,
      responseMimeType: 'application/json',
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: abortController?.signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `Error HTTP ${response.status}`;
    throw new Error(message);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Respuesta vacia de la API');
  }

  return text;
}

/**
 * Parsea la respuesta de una semana
 */
function parseWeekResponse(responseText, diaInicio, diaFin) {
  try {
    // Intentar limpiar la respuesta
    let cleaned = responseText.trim();
    // Eliminar backticks de markdown si existen
    cleaned = cleaned.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');

    const data = JSON.parse(cleaned);
    const dias = data.dias || data;

    if (!Array.isArray(dias)) {
      throw new Error('Formato invalido: se esperaba un array de dias');
    }

    // Validar y normalizar cada dia
    return dias.map((dia, idx) => ({
      numero: dia.numero || diaInicio + idx,
      comidas: (dia.comidas || []).map(comida => ({
        tipo: comida.tipo || 'Comida',
        hora: comida.hora || '00:00',
        nombre: comida.nombre || 'Sin nombre',
        alimentos: (comida.alimentos || []).map(alimento => ({
          nombre: alimento.nombre || 'Alimento',
          cantidad: alimento.cantidad || '-',
          calorias: parseInt(alimento.calorias) || 0,
        })),
        caloriasTotales: parseInt(comida.caloriasTotales) || 0,
      })),
      caloriasTotal: parseInt(dia.caloriasTotal) || 0,
      macros: {
        proteinas: parseInt(dia.macros?.proteinas) || 0,
        carbohidratos: parseInt(dia.macros?.carbohidratos) || 0,
        grasas: parseInt(dia.macros?.grasas) || 0,
      },
    }));
  } catch (err) {
    console.error('Error parseando respuesta:', err, responseText);
    throw new Error(`Error al procesar la respuesta de la semana: ${err.message}`);
  }
}

/**
 * Parsea la respuesta de extras
 */
function parseExtrasResponse(responseText) {
  try {
    let cleaned = responseText.trim();
    cleaned = cleaned.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
    const data = JSON.parse(cleaned);

    return {
      listaCompras: data.listaCompras || [],
      recomendaciones: data.recomendaciones || {
        hidratacion: [],
        horarios: [],
        consejos: [],
      },
    };
  } catch (err) {
    console.error('Error parseando extras:', err);
    return {
      listaCompras: [],
      recomendaciones: {
        hidratacion: ['Beber al menos 2 litros de agua al dia'],
        horarios: ['Desayuno: 7:00-8:00', 'Almuerzo: 13:00-14:00', 'Cena: 19:00-20:00'],
        consejos: ['Mantener horarios regulares de comida'],
      },
    };
  }
}
