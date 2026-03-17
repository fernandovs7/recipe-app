import { RecipeImage } from '../../../../core/models/recipe.model';

export interface RecipeFormIngredientValue {
  id: string;
  name: string;
  quantity: number | null;
  unit: string;
  notes: string;
}

export interface RecipeFormStepValue {
  id: string;
  instruction: string;
}

export interface RecipeFormSubmitValue {
  title: string;
  description: string;
  notes: string;
  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  category: string;
  tags: string[];
  ingredients: RecipeFormIngredientValue[];
  steps: RecipeFormStepValue[];
  selectedImageFile: File | null;
  existingImage: RecipeImage | null;
}
