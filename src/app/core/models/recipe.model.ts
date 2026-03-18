export type RecipeImageSizeKey = 'thumbnail' | 'medium' | 'full';

export interface RecipeImageVariant {
  url: string;
  path: string;
  width: number;
  height: number;
}

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
  width?: number;
  height?: number;
  variants?: Partial<Record<RecipeImageSizeKey, RecipeImageVariant>>;
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
