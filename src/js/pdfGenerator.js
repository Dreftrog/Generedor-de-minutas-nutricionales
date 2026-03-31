/**
 * pdfGenerator.js - Generacion de PDF profesional con jsPDF
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Colores del brand
const COLORS = {
  primary: [16, 185, 129],     // esmeralda
  primaryDark: [4, 120, 87],
  secondary: [20, 184, 166],   // teal
  accent: [245, 158, 11],      // amber
  dark: [15, 23, 42],
  gray: [100, 116, 139],
  lightGray: [241, 245, 249],
  white: [255, 255, 255],
  protein: [59, 130, 246],
  carbs: [245, 158, 11],
  fat: [239, 68, 68],
};

/**
 * Genera y descarga el PDF de la minuta
 */
export function generatePDF(minuta) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  let y = margin;

  // === PAGINA 1: PORTADA ===
  drawCoverPage(doc, minuta, pageWidth, pageHeight, margin, contentWidth);

  // === PAGINAS DE DIAS ===
  minuta.semanas.forEach((semana, semIdx) => {
    semana.dias.forEach((dia) => {
      doc.addPage();
      y = margin;
      y = drawDayPage(doc, dia, minuta, y, margin, contentWidth, pageWidth, pageHeight, semIdx + 1);
    });
  });

  // === LISTA DE COMPRAS ===
  if (minuta.listaCompras && minuta.listaCompras.length) {
    minuta.listaCompras.forEach((semana, i) => {
      doc.addPage();
      drawShoppingListPage(doc, semana, i + 1, margin, contentWidth, pageWidth);
    });
  }

  // === RECOMENDACIONES ===
  if (minuta.recomendaciones) {
    doc.addPage();
    drawRecommendationsPage(doc, minuta.recomendaciones, margin, contentWidth, pageWidth);
  }

  // Agregar numeros de pagina
  addPageNumbers(doc, pageWidth, pageHeight);

  // Descargar
  const fileName = `minuta_${minuta.clientData.name.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

function drawCoverPage(doc, minuta, pageWidth, pageHeight, margin, contentWidth) {
  const { clientData, calculosCaloricos } = minuta;

  // Fondo
  doc.setFillColor(...COLORS.dark);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Barra decorativa superior
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 4, 'F');

  // Titulo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(...COLORS.white);
  doc.text('NutriPlan Pro', pageWidth / 2, 50, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(...COLORS.primary);
  doc.text('Minuta Nutricional Mensual', pageWidth / 2, 62, { align: 'center' });

  // Linea decorativa
  const lineY = 72;
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - 30, lineY, pageWidth / 2 + 30, lineY);

  // Datos del cliente - Card
  const cardY = 85;
  const cardH = 90;
  doc.setFillColor(30, 41, 59); // slate-800
  doc.roundedRect(margin, cardY, contentWidth, cardH, 4, 4, 'F');

  doc.setFontSize(12);
  doc.setTextColor(...COLORS.primary);
  doc.text('DATOS DEL CLIENTE', margin + 10, cardY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225); // slate-300

  const col1X = margin + 10;
  const col2X = pageWidth / 2 + 5;
  let infoY = cardY + 24;

  const goalLabels = { bajar: 'Bajar de peso', mantener: 'Mantener peso', subir: 'Subir de peso' };
  const goalLabel = goalLabels[clientData.goalType] || clientData.goalType || 'Bajar de peso';

  const infoLines = [
    ['Nombre:', clientData.name, 'Edad:', `${clientData.age} años`],
    ['Sexo:', clientData.sex, 'Actividad:', clientData.activity],
    ['Peso actual:', `${clientData.weight} kg`, 'Estatura:', `${clientData.height} cm`],
    ['Peso objetivo:', `${clientData.goalWeight} kg`, 'Objetivo:', goalLabel],
  ];

  infoLines.forEach(line => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(148, 163, 184);
    doc.text(line[0], col1X, infoY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.white);
    doc.text(line[1], col1X + 30, infoY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(148, 163, 184);
    doc.text(line[2], col2X, infoY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.white);
    doc.text(line[3], col2X + 28, infoY);

    infoY += 13;
  });

  // Calculos caloricos card
  const calY = cardY + cardH + 15;
  const calH = 50;
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, calY, contentWidth, calH, 4, 4, 'F');

  doc.setFontSize(12);
  doc.setTextColor(...COLORS.primary);
  doc.text('CALCULO CALORICO', margin + 10, calY + 12);

  const calValues = [
    { label: 'TMB', value: `${calculosCaloricos.tmb}`, unit: 'kcal' },
    { label: 'TDEE', value: `${calculosCaloricos.tdee}`, unit: 'kcal' },
    { label: 'Cal. Diarias', value: `${calculosCaloricos.caloriasDiarias}`, unit: 'kcal' },
    { label: 'Deficit', value: `-${calculosCaloricos.deficit}`, unit: 'kcal' },
  ];

  if (calculosCaloricos.bajaEstimadaMensual > 0) {
    calValues.push({ label: 'Baja est./mes', value: `~${calculosCaloricos.bajaEstimadaMensual}`, unit: 'kg' });
  }

  const boxWidth = (contentWidth - 50) / calValues.length;
  const boxY = calY + 20;

  calValues.forEach((v, i) => {
    const bx = margin + 10 + i * (boxWidth + 8);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(v.label, bx, boxY);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const isHighlight = v.label === 'Cal. Diarias';
    const isBaja = v.label === 'Baja est./mes';
    doc.setTextColor(...(isHighlight ? COLORS.primary : isBaja ? COLORS.accent : COLORS.white));
    doc.text(v.value, bx, boxY + 10);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(v.unit, bx + doc.getTextWidth(v.value) + 2, boxY + 10);
  });

  // Preferencias si las hay
  let prefY = calY + calH + 15;

  if (clientData.dietTypes && clientData.dietTypes.length) {
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(margin, prefY, contentWidth, 25, 4, 4, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text('Tipo de alimentacion:', margin + 10, prefY + 10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.white);
    doc.text(clientData.dietTypes.join(', '), margin + 10, prefY + 19);
    prefY += 30;
  }

  if (clientData.healthConditions && clientData.healthConditions.length) {
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(margin, prefY, contentWidth, 25, 4, 4, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text('Condiciones de salud:', margin + 10, prefY + 10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.white);
    doc.text(clientData.healthConditions.join(', '), margin + 10, prefY + 19);
  }

  // Fecha
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageWidth / 2, pageHeight - 20, { align: 'center' });

  // Barra decorativa inferior
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, pageHeight - 4, pageWidth, 4, 'F');
}

function drawDayPage(doc, dia, minuta, y, margin, contentWidth, pageWidth, pageHeight) {
  const caloriasTotal = dia.caloriasTotal || dia.comidas.reduce((sum, c) => sum + (c.caloriasTotales || 0), 0);

  // Header del dia
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.white);
  doc.text(`Dia ${dia.numero}`, margin, 12);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${caloriasTotal} kcal`, pageWidth - margin, 10, { align: 'right' });

  doc.setFontSize(8);
  doc.text(
    `P: ${dia.macros.proteinas}g  |  C: ${dia.macros.carbohidratos}g  |  G: ${dia.macros.grasas}g`,
    pageWidth - margin, 18, { align: 'right' }
  );

  // Nombre del cliente (cabecera)
  doc.setFontSize(8);
  doc.setTextColor(209, 250, 229);
  doc.text(minuta.clientData.name, margin, 22);

  y = 35;

  // Tabla de comidas
  const tableBody = [];

  dia.comidas.forEach(comida => {
    // Fila principal de la comida
    tableBody.push([
      { content: comida.tipo, styles: { fontStyle: 'bold', fillColor: [240, 253, 244], textColor: COLORS.primaryDark } },
      { content: comida.hora, styles: { fontStyle: 'bold', fillColor: [240, 253, 244], textColor: COLORS.primaryDark } },
      { content: comida.nombre, styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } },
      { content: '', styles: { fillColor: [240, 253, 244] } },
      { content: `${comida.caloriasTotales} kcal`, styles: { fontStyle: 'bold', fillColor: [240, 253, 244], textColor: COLORS.accent, halign: 'right' } },
    ]);

    // Filas de alimentos
    comida.alimentos.forEach(alimento => {
      tableBody.push([
        '',
        '',
        alimento.nombre,
        alimento.cantidad,
        { content: `${alimento.calorias} kcal`, styles: { halign: 'right', textColor: COLORS.gray } },
      ]);
    });
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Comida', 'Hora', 'Alimento', 'Cantidad', 'Calorias']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.dark,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 9,
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: COLORS.dark,
      lineColor: [226, 232, 240],
      lineWidth: 0.3,
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 15, halign: 'center' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 22, halign: 'right' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // Resumen al final de la tabla
  const finalY = doc.lastAutoTable.finalY + 5;

  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(margin, finalY, contentWidth, 18, 3, 3, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text(`Total del dia: ${caloriasTotal} kcal`, margin + 5, finalY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const macroX = margin + 5;
  doc.setTextColor(...COLORS.protein);
  doc.text(`Proteinas: ${dia.macros.proteinas}g`, macroX, finalY + 14);
  doc.setTextColor(...COLORS.carbs);
  doc.text(`Carbohidratos: ${dia.macros.carbohidratos}g`, macroX + 40, finalY + 14);
  doc.setTextColor(...COLORS.fat);
  doc.text(`Grasas: ${dia.macros.grasas}g`, macroX + 90, finalY + 14);

  return finalY + 20;
}

function drawShoppingListPage(doc, semana, semanaNum, margin, contentWidth, pageWidth) {
  // Header
  doc.setFillColor(...COLORS.primaryDark);
  doc.rect(0, 0, pageWidth, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.white);
  doc.text(`Lista de Compras - Semana ${semanaNum}`, margin, 14);

  let y = 28;

  if (!semana.categorias) return;

  semana.categorias.forEach(cat => {
    if (y > 260) {
      doc.addPage();
      y = margin;
    }

    // Categoria header
    doc.setFillColor(...COLORS.lightGray);
    doc.roundedRect(margin, y, contentWidth, 8, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primaryDark);
    doc.text(cat.nombre, margin + 4, y + 6);
    y += 12;

    // Items
    (cat.items || []).forEach(item => {
      if (y > 275) {
        doc.addPage();
        y = margin;
      }
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.dark);
      doc.text(`- ${item.nombre}`, margin + 6, y);
      doc.setTextColor(...COLORS.gray);
      doc.text(item.cantidad, pageWidth - margin, y, { align: 'right' });
      y += 6;
    });

    y += 5;
  });
}

function drawRecommendationsPage(doc, recs, margin, contentWidth, pageWidth) {
  // Header
  doc.setFillColor(...COLORS.primaryDark);
  doc.rect(0, 0, pageWidth, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.white);
  doc.text('Recomendaciones Finales', margin, 14);

  let y = 32;

  const sections = [
    { title: 'Hidratacion Diaria', items: recs.hidratacion || [] },
    { title: 'Horarios Recomendados', items: recs.horarios || [] },
    { title: 'Consejos para Mejorar Resultados', items: recs.consejos || [] },
  ];

  sections.forEach(section => {
    if (!section.items.length) return;

    doc.setFillColor(...COLORS.lightGray);
    doc.roundedRect(margin, y, contentWidth, 8, 2, 2, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primaryDark);
    doc.text(section.title, margin + 4, y + 6);
    y += 14;

    section.items.forEach(item => {
      if (y > 275) {
        doc.addPage();
        y = margin;
      }
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.dark);

      // Word wrap
      const lines = doc.splitTextToSize(`- ${item}`, contentWidth - 10);
      lines.forEach(line => {
        doc.text(line, margin + 6, y);
        y += 5;
      });
      y += 2;
    });

    y += 8;
  });
}

function addPageNumbers(doc, pageWidth, pageHeight) {
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Pagina ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
  }
}
