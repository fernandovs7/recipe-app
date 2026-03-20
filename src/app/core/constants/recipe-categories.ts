export interface RecipeCategoryOption {
  value: string;
  label: string;
  legacyValues?: string[];
}

export const RECIPE_CATEGORIES: RecipeCategoryOption[] = [
  { value: 'desayuno', label: 'Desayuno', legacyValues: ['breakfast'] },
  { value: 'almuerzo', label: 'Almuerzo', legacyValues: ['lunch'] },
  { value: 'cena', label: 'Cena', legacyValues: ['dinner'] },
  { value: 'entrada', label: 'Entrada / Aperitivo', legacyValues: ['appetizer'] },
  { value: 'plato-fuerte', label: 'Plato fuerte', legacyValues: ['main-course'] },
  { value: 'acompanamiento', label: 'Acompañamiento', legacyValues: ['side-dish'] },
  { value: 'pasta', label: 'Pasta' },
  { value: 'arroz', label: 'Arroz', legacyValues: ['rice'] },
  { value: 'ensalada', label: 'Ensalada', legacyValues: ['salad'] },
  { value: 'sopa', label: 'Sopa / Crema', legacyValues: ['soup'] },
  { value: 'pan', label: 'Pan / Panadería', legacyValues: ['bread'] },
  { value: 'pizza', label: 'Pizza' },
  { value: 'parrilla', label: 'Parrilla / BBQ', legacyValues: ['bbq'] },
  { value: 'mariscos', label: 'Mariscos / Pescado', legacyValues: ['seafood'] },
  { value: 'vegetariano', label: 'Vegetariano', legacyValues: ['vegetarian'] },
  { value: 'postre', label: 'Postre', legacyValues: ['dessert'] },
  { value: 'merienda', label: 'Snack', legacyValues: ['snack'] },
  { value: 'bebida', label: 'Bebida', legacyValues: ['drink'] },
  { value: 'salsa', label: 'Salsa', legacyValues: ['sauce'] },
  { value: 'otra', label: 'Otra', legacyValues: ['other'] },
];

const RECIPE_CATEGORY_LOOKUP = new Map(
  RECIPE_CATEGORIES.flatMap((category) => [
    [category.value, category],
    ...(category.legacyValues ?? []).map((legacyValue) => [legacyValue, category] as const),
  ]),
);

export function normalizeRecipeCategoryValue(value?: string | null): string {
  if (!value) {
    return '';
  }

  const normalizedValue = value.trim().toLowerCase();
  return RECIPE_CATEGORY_LOOKUP.get(normalizedValue)?.value ?? normalizedValue;
}

export function getRecipeCategoryLabel(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();
  return RECIPE_CATEGORY_LOOKUP.get(normalizedValue)?.label ?? null;
}
