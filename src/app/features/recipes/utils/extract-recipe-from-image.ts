export interface ImportedRecipeIngredient {
  name: string;
  quantity: string | null;
  unit: string;
  notes: string;
}

export interface ImportedRecipeStep {
  instruction: string;
}

export interface ImportedRecipeDraft {
  title: string;
  description: string;
  notes: string;
  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  category: string;
  tags: string[];
  ingredients: ImportedRecipeIngredient[];
  steps: ImportedRecipeStep[];
}

export interface ImportedRecipeResult {
  rawText: string;
  recipe: ImportedRecipeDraft;
}

const SECTION_HEADINGS = {
  ingredients: [
    'ingredientes',
    'ingredients',
    'para la masa',
    'para el relleno',
    'para servir',
  ],
  steps: [
    'preparacion',
    'preparación',
    'instrucciones',
    'instructions',
    'modo de preparacion',
    'modo de preparación',
    'pasos',
    'elaboracion',
    'elaboración',
    'procedimiento',
    'directions',
    'method',
  ],
  notes: ['notas', 'tips', 'observaciones', 'sugerencias', 'notes'],
} as const;

const UNIT_PATTERN =
  'kg|g|gr|gramos?|ml|l|litros?|tazas?|tza|cucharadas?|cucharaditas?|cda|cdas|cdta|cdtas|oz|lb|lbs|unidades?|unidad|pieza|piezas|dientes?|ramas?|paquetes?|latas?';

export async function extractRecipeFromImage(
  file: File,
  onProgress?: (progress: number, status: string) => void,
): Promise<ImportedRecipeResult> {
  const { createWorker, PSM } = await import('tesseract.js');

  const worker = await createWorker(['spa', 'eng'], 1, {
    logger: (message) => {
      onProgress?.(message.progress, normalizeStatus(message.status));
    },
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: '1',
    });

    const result = await worker.recognize(file);
    const rawText = normalizeOcrText(result.data.text);

    return {
      rawText,
      recipe: parseRecipeFromText(rawText),
    };
  } finally {
    await worker.terminate();
  }
}

function parseRecipeFromText(rawText: string): ImportedRecipeDraft {
  const lines = rawText
    .split('\n')
    .map((line) => normalizeLine(line))
    .filter(Boolean);
  const sections = splitIntoSections(lines);
  const title = extractTitle(lines);
  const description = extractDescription(lines, title);
  const ingredients = parseIngredients(sections.ingredients);
  const steps = parseSteps(sections.steps);
  const notes = sections.notes.join('\n');
  const servings = extractNumber(rawText, /\b(?:porciones|rinde|sirve\s+para|serves?)[:\s]+(\d{1,2})\b/i);
  const prepTimeMinutes = extractNumber(
    rawText,
    /\b(?:prep(?:aracion|aración)?|preparacion|preparación)[:\s]+(\d{1,3})\s*(?:min|minutos?)\b/i,
  );
  const cookTimeMinutes = extractNumber(
    rawText,
    /\b(?:coccion|cocción|horneado|cook(?:ing)?\s*time)[:\s]+(\d{1,3})\s*(?:min|minutos?)\b/i,
  );

  return {
    title,
    description,
    notes,
    servings,
    prepTimeMinutes,
    cookTimeMinutes,
    category: '',
    tags: inferTags(rawText),
    ingredients,
    steps,
  };
}

function splitIntoSections(lines: string[]): Record<'ingredients' | 'steps' | 'notes', string[]> {
  const sections = {
    ingredients: [] as string[],
    steps: [] as string[],
    notes: [] as string[],
  };

  let activeSection: keyof typeof sections | null = null;

  for (const line of lines) {
    const heading = getSectionHeading(line);

    if (heading) {
      activeSection = heading;
      continue;
    }

    if (activeSection) {
      sections[activeSection].push(line);
    }
  }

  if (!sections.ingredients.length) {
    sections.ingredients.push(...lines.filter((line) => looksLikeIngredient(line)));
  }

  if (!sections.steps.length) {
    sections.steps.push(...lines.filter((line) => looksLikeStep(line)));
  }

  return sections;
}

function extractTitle(lines: string[]): string {
  return (
    lines.find((line) => {
      if (getSectionHeading(line)) {
        return false;
      }

      if (line.length > 80) {
        return false;
      }

      return /[a-zA-Záéíóúñ]/.test(line);
    }) ?? ''
  );
}

function extractDescription(lines: string[], title: string): string {
  const candidates = lines.filter(
    (line) => line !== title && !getSectionHeading(line) && line.length >= 24 && line.length <= 180,
  );

  return candidates[0] ?? '';
}

function parseIngredients(lines: string[]): ImportedRecipeIngredient[] {
  return uniqueBy(
    lines
      .flatMap((line) => splitCompoundIngredientLine(line))
      .map((line) => line.replace(/^[\-\u2022*•]+/, '').trim())
      .filter((line) => line.length >= 2)
      .map((line) => parseIngredientLine(line))
      .filter((ingredient) => ingredient.name.length >= 2),
    (ingredient) => `${ingredient.quantity}|${ingredient.unit}|${ingredient.name}|${ingredient.notes}`,
  ).slice(0, 40);
}

function parseIngredientLine(line: string): ImportedRecipeIngredient {
  const cleanedLine = line.replace(/^\d+[.)]\s*/, '').trim();
  const match = cleanedLine.match(
    new RegExp(
      `^(?<quantity>\\d+(?:[.,]\\d+)?(?:\\s*[/-]\\s*\\d+(?:[.,]\\d+)?)?)?\\s*(?<unit>${UNIT_PATTERN})?\\s*(?<name>.+)$`,
      'i',
    ),
  );

  if (!match?.groups) {
    return { name: cleanedLine, quantity: null, unit: '', notes: '' };
  }

  const nameWithNotes = normalizeIngredientName(match.groups['name'] ?? cleanedLine);
  const noteParts = nameWithNotes.split(/\s+-\s+|\s+\((.+)\)$/).filter(Boolean);
  const name = noteParts[0]?.trim() ?? cleanedLine;
  const notes = noteParts.length > 1 ? noteParts.slice(1).join(' ').trim() : '';

  return {
    quantity: cleanQuantity(match.groups['quantity'] ?? ''),
    unit: normalizeUnit(match.groups['unit'] ?? ''),
    name,
    notes,
  };
}

function parseSteps(lines: string[]): ImportedRecipeStep[] {
  const joinedSteps = lines
    .flatMap((line) => splitNumberedSteps(line))
    .map((line) => line.replace(/^\d+[.)]\s*/, '').trim())
    .filter((line) => line.length >= 8);

  return uniqueBy(
    joinedSteps.map((instruction) => ({ instruction })),
    (step) => step.instruction,
  ).slice(0, 30);
}

function inferTags(rawText: string): string[] {
  const normalizedText = rawText.toLowerCase();
  const tagRules = [
    { tag: 'vegetariana', pattern: /\bvegetar/i },
    { tag: 'picante', pattern: /\bpicante|chile|ají|aji/i },
    { tag: 'saludable', pattern: /\bsaludable|healthy|light/i },
    { tag: 'casera', pattern: /\bcaser[ao]s?|homemade/i },
    { tag: 'rapida', pattern: /\br[aá]pid[ao]s?|quick/i },
    { tag: 'facil', pattern: /\bf[aá]cil|easy/i },
  ];

  return tagRules.filter(({ pattern }) => pattern.test(normalizedText)).map(({ tag }) => tag);
}

function extractNumber(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);

  if (!match?.[1]) {
    return null;
  }

  return Number.parseInt(match[1], 10) || null;
}

function getSectionHeading(line: string): 'ingredients' | 'steps' | 'notes' | null {
  const normalized = stripAccents(line.toLowerCase()).replace(/[:.]$/, '').trim();

  for (const [section, headings] of Object.entries(SECTION_HEADINGS)) {
    if (headings.some((heading) => normalized === stripAccents(heading))) {
      return section as 'ingredients' | 'steps' | 'notes';
    }
  }

  return null;
}

function looksLikeIngredient(line: string): boolean {
  return (
    /^[\-\u2022*•]?\s*\d/.test(line) ||
    new RegExp(`\\b(${UNIT_PATTERN})\\b`, 'i').test(line)
  );
}

function looksLikeStep(line: string): boolean {
  return /^\d+[.)]\s+/.test(line) || /\bmezcla|cocina|hornea|agrega|sirve|mezclar|cortar|bake|mix/i.test(line);
}

function splitCompoundIngredientLine(line: string): string[] {
  if (/[,;]\s/.test(line) && !/^\d+[.)]\s/.test(line)) {
    const parts = line
      .split(/[;]+/)
      .flatMap((part) => (part.includes(', ') ? part.split(/,\s/) : [part]))
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.every((part) => looksLikeIngredient(part))) {
      return parts;
    }
  }

  return [line];
}

function splitNumberedSteps(line: string): string[] {
  const matches = Array.from(line.matchAll(/(?:^|\s)(\d+[.)]\s+[^0-9]+?)(?=(?:\s\d+[.)]\s)|$)/g))
    .map((match) => match[1]?.trim())
    .filter(Boolean) as string[];

  if (matches.length > 1) {
    return matches;
  }

  return [line];
}

function normalizeOcrText(text: string): string {
  return text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeLine(line: string): string {
  return line
    .replace(/[|]/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeIngredientName(name: string): string {
  return name.replace(/\s+/g, ' ').replace(/[;,]+$/, '').trim();
}

function cleanQuantity(quantity: string): string | null {
  const cleaned = quantity.replace(/\s+/g, ' ').trim();
  return cleaned || null;
}

function normalizeUnit(unit: string): string {
  return unit.toLowerCase().replace(/\.$/, '');
}

function normalizeStatus(status: string): string {
  const normalized = stripAccents(status.toLowerCase());

  if (normalized.includes('loading')) {
    return 'Cargando motor OCR';
  }

  if (normalized.includes('initializing')) {
    return 'Preparando reconocimiento';
  }

  if (normalized.includes('recognizing')) {
    return 'Leyendo receta';
  }

  return 'Procesando imagen';
}

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = getKey(item);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
