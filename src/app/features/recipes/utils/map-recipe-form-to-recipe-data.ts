import { Recipe, RecipeImage } from '../../../core/models/recipe.model';
import { RecipeFormSubmitValue } from '../components/recipe-form/recipe-form.model';

export function mapRecipeFormToRecipeData(
  value: RecipeFormSubmitValue,
  image: RecipeImage | null | undefined,
  favorite: boolean,
): Omit<Recipe, 'id' | 'userId' | 'createdAt' | 'updatedAt'> {
  return {
    title: value.title,
    description: value.description,
    notes: value.notes,
    ingredients: value.ingredients.map((ingredient) => ({
      id: ingredient.id || crypto.randomUUID(),
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      notes: ingredient.notes,
    })),
    steps: value.steps.map((step, index) => ({
      id: step.id || crypto.randomUUID(),
      order: index + 1,
      instruction: step.instruction,
    })),
    image: image === undefined ? undefined : image,
    servings: value.servings,
    prepTimeMinutes: value.prepTimeMinutes,
    cookTimeMinutes: value.cookTimeMinutes,
    totalTimeMinutes: (value.prepTimeMinutes ?? 0) + (value.cookTimeMinutes ?? 0) || null,
    category: value.category,
    tags: value.tags,
    favorite,
  };
}
