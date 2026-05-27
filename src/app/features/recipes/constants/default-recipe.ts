import { Recipe } from '../../../core/models/recipe.model';

export const DEFAULT_RECIPE_SEEDED_METADATA_KEY = 'default_recipe_seeded';

export function createDefaultRecipeData(): Omit<Recipe, 'id' | 'userId' | 'createdAt' | 'updatedAt'> {
  return {
    title: 'Tostadas con aguacate y huevo',
    description:
      'Una receta sencilla y rapida para arrancar tu recetario con un desayuno completo.',
    notes:
      'Puedes cambiar el pan por tortilla o agregar chile en hojuelas si te gusta un toque picante.',
    ingredients: [
      {
        id: crypto.randomUUID(),
        name: 'Pan integral',
        quantity: '2',
        unit: 'rebanadas',
      },
      {
        id: crypto.randomUUID(),
        name: 'Aguacate maduro',
        quantity: '1',
        unit: 'unidad',
      },
      {
        id: crypto.randomUUID(),
        name: 'Huevos',
        quantity: '2',
        unit: 'unidades',
      },
      {
        id: crypto.randomUUID(),
        name: 'Jugo de limon',
        quantity: '1',
        unit: 'cdita',
      },
      {
        id: crypto.randomUUID(),
        name: 'Sal',
        quantity: '1/4',
        unit: 'cdita',
      },
      {
        id: crypto.randomUUID(),
        name: 'Pimienta negra',
        quantity: '1',
        unit: 'pizca',
      },
    ],
    steps: [
      {
        id: crypto.randomUUID(),
        order: 1,
        instruction: 'Tuesta el pan hasta que quede dorado y crujiente.',
      },
      {
        id: crypto.randomUUID(),
        order: 2,
        instruction:
          'Machaca el aguacate con el jugo de limon, la sal y la pimienta hasta obtener una mezcla cremosa.',
      },
      {
        id: crypto.randomUUID(),
        order: 3,
        instruction: 'Cocina los huevos en una sarten al gusto.',
      },
      {
        id: crypto.randomUUID(),
        order: 4,
        instruction: 'Unta el aguacate sobre las tostadas y corona cada una con un huevo.',
      },
    ],
    image: {
      url: 'assets/images/recipes/default-avocado-toast.webp',
      path: 'assets/images/recipes/default-avocado-toast.webp',
      alt: 'Tostadas con aguacate y huevo',
    },
    servings: 2,
    prepTimeMinutes: 10,
    cookTimeMinutes: 5,
    totalTimeMinutes: 15,
    category: 'desayuno',
    tags: ['facil', 'desayuno', 'rapido'],
    favorite: true,
  };
}
