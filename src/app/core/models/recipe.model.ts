export interface RecipeIngredient {
  id: string;
  name: string;
  quantity: string | null;
  unit?: string;
  notes?: string;
}

export interface RecipeStep {
  id: string;
  order: number;
  instruction: string;
}

export interface RecipeImage {
  url: string;
  path: string;
  alt?: string;
}

export interface Recipe {
  id: string;
  userId: string;

  title: string;
  description?: string;
  notes?: string;

  ingredients: RecipeIngredient[];
  steps: RecipeStep[];

  image?: RecipeImage;

  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes?: number | null;

  category?: string;
  tags: string[];

  favorite: boolean;

  createdAt: number;
  updatedAt: number;
}
