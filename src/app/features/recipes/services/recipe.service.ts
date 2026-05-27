import { effect, inject, Injectable, signal } from '@angular/core';
import { PostgrestError, User as SupabaseUser } from '@supabase/supabase-js';
import { AuthService } from '../../../core/services/auth.service';
import { Recipe, RecipeImage } from '../../../core/models/recipe.model';
import {
  createDefaultRecipeData,
  DEFAULT_RECIPE_SEEDED_METADATA_KEY,
} from '../constants/default-recipe';
import { removeUndefinedFields } from '../../../core/utils/remove-undefined-fields';
import {
  IMAGE_SIZES,
  ImageSizeKey,
  optimizeImageVariants,
} from '../../../core/utils/optimize-image';
import { supabase } from '../../../core/supabase.config';

interface RecipeRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  notes: string | null;
  ingredients: Recipe['ingredients'];
  steps: Recipe['steps'];
  image: RecipeImage | null;
  servings: number | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  total_time_minutes: number | null;
  category: string | null;
  tags: string[];
  favorite: boolean;
  created_at: number;
  updated_at: number;
}

@Injectable({
  providedIn: 'root',
})
export class RecipeService {
  private authService = inject(AuthService);
  private defaultRecipeSeedRequests = new Map<string, Promise<Recipe | null>>();

  recipes = signal<Recipe[]>([]);
  loading = signal(false);

  constructor() {
    effect(() => {
      const user = this.authService.user();

      if (!user) {
        this.recipes.set([]);
        this.loading.set(false);
        return;
      }

      void this.loadRecipes(user.uid);
    });
  }

  private async loadRecipes(userId: string): Promise<void> {
    this.loading.set(true);

    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const recipes = (data ?? []).map((row) => this.mapRecipeRow(row as RecipeRow));

      if (recipes.length > 0) {
        this.recipes.set(recipes);
        return;
      }

      const defaultRecipe = await this.ensureDefaultRecipeForUser(userId);
      this.recipes.set(defaultRecipe ? [defaultRecipe] : []);
    } catch {
      this.recipes.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async createRecipe(
    recipeData: Omit<Recipe, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<void> {
    const user = this.authService.user();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const timestamp = Date.now();
    const recipe = removeUndefinedFields({
      ...recipeData,
      userId: user.uid,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const row = this.mapRecipeToInsertRow(recipe);
    const { data, error } = await supabase.from('recipes').insert(row).select().single();

    if (error) {
      throw error;
    }

    if (data) {
      this.recipes.update((recipes) => [this.mapRecipeRow(data as RecipeRow), ...recipes]);
    }
  }

  async updateRecipe(
    recipeId: string,
    recipeData: Omit<Recipe, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<void> {
    const user = this.authService.user();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const existingRecipe = await this.getRecipeById(recipeId);

    if (!existingRecipe) {
      throw new Error('Recipe not found or access denied');
    }

    const timestamp = Date.now();
    const updatedRecipe = removeUndefinedFields({
      ...recipeData,
      updatedAt: timestamp,
    });

    const { error } = await supabase
      .from('recipes')
      .update(this.mapRecipeToUpdateRow(updatedRecipe))
      .eq('id', recipeId)
      .eq('user_id', user.uid);

    if (error) {
      throw error;
    }

    const previousImagePaths = this.collectRecipeImagePaths(existingRecipe.image);
    const nextImagePaths = new Set(this.collectRecipeImagePaths(recipeData.image));

    for (const previousImagePath of previousImagePaths) {
      if (!nextImagePaths.has(previousImagePath)) {
        await this.deleteRecipeImage(previousImagePath);
      }
    }

    this.recipes.update((recipes) =>
      recipes.map((recipe) =>
        recipe.id === recipeId
          ? {
              ...recipe,
              ...recipeData,
              updatedAt: timestamp,
            }
          : recipe,
      ),
    );
  }

  async uploadRecipeImage(
    file: Blob,
    fileExtension = 'webp',
    fileName?: string,
  ): Promise<{ url: string; path: string }> {
    const user = this.authService.user();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const resolvedFileName = fileName ?? crypto.randomUUID();
    const path = `recipes/${user.uid}/${resolvedFileName}.${fileExtension}`;
    const { error } = await supabase.storage.from('recipes').upload(path, file, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    });

    if (error) {
      throw error;
    }

    const { data } = supabase.storage.from('recipes').getPublicUrl(path);
    const url = data.publicUrl;

    return { url, path };
  }

  async uploadRecipeImageVariants(file: File, alt?: string): Promise<RecipeImage> {
    const optimizedVariants = await optimizeImageVariants(file);
    const assetId = crypto.randomUUID();

    const uploadedEntries = await Promise.all(
      (Object.keys(IMAGE_SIZES) as ImageSizeKey[]).map(async (sizeKey) => {
        const optimizedImage = optimizedVariants[sizeKey];
        const uploadedImage = await this.uploadRecipeImage(
          optimizedImage.blob,
          'webp',
          `${assetId}-${sizeKey}`,
        );

        return [
          sizeKey,
          {
            url: uploadedImage.url,
            path: uploadedImage.path,
            width: optimizedImage.width,
            height: optimizedImage.height,
          },
        ] as const;
      }),
    );

    const variants = Object.fromEntries(uploadedEntries) as Record<
      ImageSizeKey,
      NonNullable<RecipeImage['variants']>[ImageSizeKey]
    >;
    const fullVariant = variants.full;

    if (!fullVariant) {
      throw new Error('No se pudo generar la variante full de la imagen');
    }

    return {
      url: fullVariant.url,
      path: fullVariant.path,
      alt,
      width: fullVariant.width,
      height: fullVariant.height,
      variants,
    };
  }

  async getRecipeById(recipeId: string): Promise<Recipe | null> {
    const user = this.authService.user();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .eq('user_id', user.uid)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return this.mapRecipeRow(data as RecipeRow);
  }

  async updateRecipeFavorite(recipeId: string, favorite: boolean): Promise<void> {
    const user = this.authService.user();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const timestamp = Date.now();
    const { error } = await supabase
      .from('recipes')
      .update({
        favorite,
        updated_at: timestamp,
      })
      .eq('id', recipeId)
      .eq('user_id', user.uid);

    if (error) {
      throw error;
    }

    this.recipes.update((recipes) =>
      recipes.map((recipe) =>
        recipe.id === recipeId
          ? {
              ...recipe,
              favorite,
              updatedAt: timestamp,
            }
          : recipe,
      ),
    );
  }

  async deleteRecipe(recipeId: string): Promise<void> {
    const user = this.authService.user();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const existingRecipe = await this.getRecipeById(recipeId);

    if (!existingRecipe) {
      throw new Error('Recipe not found or access denied');
    }

    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', recipeId)
      .eq('user_id', user.uid);

    if (error) {
      throw error;
    }

    for (const imagePath of this.collectRecipeImagePaths(existingRecipe.image)) {
      await this.deleteRecipeImage(imagePath);
    }

    this.recipes.update((recipes) => recipes.filter((recipe) => recipe.id !== recipeId));
  }

  async deleteRecipeImage(imagePath: string): Promise<void> {
    if (!this.isStoragePath(imagePath)) {
      return;
    }

    try {
      const { error } = await supabase.storage.from('recipes').remove([imagePath]);

      if (error) {
        throw error;
      }
    } catch (error) {
      if (this.isStorageObjectMissing(error)) {
        return;
      }

      throw error;
    }
  }

  private collectRecipeImagePaths(image?: RecipeImage | null): string[] {
    if (!image) {
      return [];
    }

    const paths = [image.path];

    for (const variant of Object.values(image.variants ?? {})) {
      if (variant?.path) {
        paths.push(variant.path);
      }
    }

    return [...new Set(paths.filter(Boolean))];
  }

  private isStorageObjectMissing(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const message = 'message' in error ? String(error.message) : '';

    if (error instanceof PostgrestError) {
      return false;
    }

    return message.toLowerCase().includes('not found');
  }

  private isStoragePath(path: string): boolean {
    return path.startsWith('recipes/');
  }

  private ensureDefaultRecipeForUser(userId: string): Promise<Recipe | null> {
    const ongoingRequest = this.defaultRecipeSeedRequests.get(userId);

    if (ongoingRequest) {
      return ongoingRequest;
    }

    const request = this.seedDefaultRecipeForUser(userId).finally(() => {
      this.defaultRecipeSeedRequests.delete(userId);
    });

    this.defaultRecipeSeedRequests.set(userId, request);
    return request;
  }

  private async seedDefaultRecipeForUser(userId: string): Promise<Recipe | null> {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    if (!user || user.id !== userId || this.hasDefaultRecipeSeeded(user)) {
      return null;
    }

    const timestamp = Date.now();
    const defaultRecipe = removeUndefinedFields({
      ...createDefaultRecipeData(),
      userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const { data, error: insertError } = await supabase
      .from('recipes')
      .insert(this.mapRecipeToInsertRow(defaultRecipe))
      .select('*')
      .single();

    if (insertError) {
      throw insertError;
    }

    await this.markDefaultRecipeAsSeeded(user);

    return data ? this.mapRecipeRow(data as RecipeRow) : null;
  }

  private hasDefaultRecipeSeeded(user: SupabaseUser): boolean {
    if (!user.user_metadata || typeof user.user_metadata !== 'object') {
      return false;
    }

    return user.user_metadata[DEFAULT_RECIPE_SEEDED_METADATA_KEY] === true;
  }

  private async markDefaultRecipeAsSeeded(user: SupabaseUser): Promise<void> {
    const metadata =
      user.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {};

    const { error } = await supabase.auth.updateUser({
      data: {
        ...metadata,
        [DEFAULT_RECIPE_SEEDED_METADATA_KEY]: true,
      },
    });

    if (error) {
      console.warn('No se pudo marcar la receta por defecto como inicializada.', error);
    }
  }

  private mapRecipeRow(row: RecipeRow): Recipe {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description ?? undefined,
      notes: row.notes ?? undefined,
      ingredients: row.ingredients ?? [],
      steps: row.steps ?? [],
      image: row.image ?? null,
      servings: row.servings,
      prepTimeMinutes: row.prep_time_minutes,
      cookTimeMinutes: row.cook_time_minutes,
      totalTimeMinutes: row.total_time_minutes,
      category: row.category ?? undefined,
      tags: row.tags ?? [],
      favorite: row.favorite,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRecipeToInsertRow(recipe: Omit<Recipe, 'id'>): Omit<RecipeRow, 'id'> {
    return {
      user_id: recipe.userId,
      title: recipe.title,
      description: recipe.description ?? null,
      notes: recipe.notes ?? null,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      image: recipe.image ?? null,
      servings: recipe.servings,
      prep_time_minutes: recipe.prepTimeMinutes ?? null,
      cook_time_minutes: recipe.cookTimeMinutes ?? null,
      total_time_minutes: recipe.totalTimeMinutes ?? null,
      category: recipe.category ?? null,
      tags: recipe.tags,
      favorite: recipe.favorite,
      created_at: recipe.createdAt,
      updated_at: recipe.updatedAt,
    };
  }

  private mapRecipeToUpdateRow(
    recipe: Partial<Omit<Recipe, 'id' | 'userId' | 'createdAt'>>,
  ): Partial<Omit<RecipeRow, 'id' | 'user_id' | 'created_at'>> {
    return {
      title: recipe.title,
      description: recipe.description ?? null,
      notes: recipe.notes ?? null,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      image: recipe.image ?? null,
      servings: recipe.servings ?? null,
      prep_time_minutes: recipe.prepTimeMinutes ?? null,
      cook_time_minutes: recipe.cookTimeMinutes ?? null,
      total_time_minutes: recipe.totalTimeMinutes ?? null,
      category: recipe.category ?? null,
      tags: recipe.tags,
      favorite: recipe.favorite,
      updated_at: recipe.updatedAt,
    };
  }
}
