import { jsPDF } from 'jspdf';
import type { Recipe } from '../../../core/models/recipe.model';

export interface RecipePdfBuildOptions {
  recipe: Recipe;
  categoryLabel: string;
  servingsLabel: string | null;
  prepLabel: string;
  cookLabel: string;
  ingredientLines: string[];
}

function slugifyFileBase(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return base || 'receta';
}

export function recipePdfFileName(recipe: Recipe): string {
  return `${slugifyFileBase(recipe.title)}.pdf`;
}

export function buildRecipePdfBlob(options: RecipePdfBuildOptions): Blob {
  const { recipe, categoryLabel, servingsLabel, prepLabel, cookLabel, ingredientLines } = options;

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  const maxW = pageW - 2 * margin;
  let y = margin + 4;

  const needsNewPage = (lineHeight: number) => y + lineHeight > pageH - margin;

  const writeBlock = (
    text: string,
    fontSize: number,
    style: 'normal' | 'bold' | 'italic',
    lineHeight: number,
  ) => {
    doc.setFont('helvetica', style === 'bold' ? 'bold' : style === 'italic' ? 'italic' : 'normal');
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxW);
    for (const line of lines) {
      if (needsNewPage(lineHeight)) {
        doc.addPage();
        y = margin + 4;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
  };

  writeBlock(recipe.title, 18, 'bold', 8);
  y += 1;

  const metaParts = [categoryLabel];
  if (servingsLabel) {
    metaParts.push(`Porciones: ${servingsLabel}`);
  }
  metaParts.push(`Prep: ${prepLabel}`, `Cocción: ${cookLabel}`);
  writeBlock(metaParts.join(' · '), 10, 'normal', 5.5);
  y += 1;

  if (recipe.description?.trim()) {
    writeBlock(recipe.description.trim(), 11, 'italic', 6);
    y += 1;
  }

  writeBlock('Ingredientes', 13, 'bold', 7);
  y += 0.5;

  for (const line of ingredientLines) {
    writeBlock(`• ${line}`, 11, 'normal', 6);
  }
  y += 1;

  writeBlock('Preparación', 13, 'bold', 7);
  y += 0.5;

  const sortedSteps = [...recipe.steps].sort((a, b) => a.order - b.order);
  for (const step of sortedSteps) {
    writeBlock(`${step.order}. ${step.instruction}`, 11, 'normal', 6);
    y += 0.5;
  }

  if (recipe.notes?.trim()) {
    y += 2;
    writeBlock('Notas del chef', 13, 'bold', 7);
    y += 0.5;
    writeBlock(recipe.notes.trim(), 11, 'normal', 6);
  }

  return doc.output('blob');
}
