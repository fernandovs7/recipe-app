import { effect, inject, Injectable, signal } from '@angular/core';
import { FirebaseError } from 'firebase/app';
import {
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { AuthService } from '../../../core/services/auth.service';
import { firestore, recipeStorage } from '../../../core/firebase.config';
import { Recipe, RecipeImage } from '../../../core/models/recipe.model';
import { createDefaultRecipeData } from '../constants/default-recipe';
import {
  IMAGE_SIZES,
  ImageSizeKey,
  optimizeImageVariants,
} from '../../../core/utils/optimize-image';

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
      const snapshot = await getDocs(
        query(collection(firestore, 'users', userId, 'recipes'), orderBy('createdAt', 'desc')),
      );
      const recipes = snapshot.docs.map((recipeDoc) =>
        this.mapRecipe(recipeDoc.id, recipeDoc.data()),
      );

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
    const recipe = {
      ...recipeData,
      userId: user.uid,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const recipeRef = doc(collection(firestore, 'users', user.uid, 'recipes'));

    await setDoc(recipeRef, this.toRecipeDocument(recipe));
    this.recipes.update((recipes) => [{ id: recipeRef.id, ...recipe }, ...recipes]);
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

    await updateDoc(
      doc(firestore, 'users', user.uid, 'recipes', recipeId),
      this.stripUndefined({
        ...recipeData,
        image: recipeData.image ?? null,
        updatedAt: timestamp,
      }),
    );

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
    const storageRef = ref(recipeStorage, path);

    await uploadBytes(storageRef, file, {
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000',
    });

    const url = await getDownloadURL(storageRef);
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

    const snapshot = await getDoc(doc(firestore, 'users', user.uid, 'recipes', recipeId));

    if (!snapshot.exists()) {
      return null;
    }

    const recipe = this.mapRecipe(snapshot.id, snapshot.data());

    if (recipe.userId !== user.uid) {
      return null;
    }

    return recipe;
  }

  async updateRecipeFavorite(recipeId: string, favorite: boolean): Promise<void> {
    const user = this.authService.user();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const timestamp = Date.now();

    await updateDoc(doc(firestore, 'users', user.uid, 'recipes', recipeId), {
      favorite,
      updatedAt: timestamp,
    });

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

    await deleteDoc(doc(firestore, 'users', user.uid, 'recipes', recipeId));

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
      await deleteObject(ref(recipeStorage, imagePath));
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
    return error instanceof FirebaseError && error.code === 'storage/object-not-found';
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
    const user = this.authService.user();

    if (!user || user.uid !== userId || (await this.hasDefaultRecipeSeeded(userId))) {
      return null;
    }

    const timestamp = Date.now();
    const defaultRecipe = {
      ...createDefaultRecipeData(),
      userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const recipeRef = doc(collection(firestore, 'users', userId, 'recipes'));

    await setDoc(recipeRef, this.toRecipeDocument(defaultRecipe));
    await this.markDefaultRecipeAsSeeded(userId);

    return {
      id: recipeRef.id,
      ...defaultRecipe,
    };
  }

  private async hasDefaultRecipeSeeded(userId: string): Promise<boolean> {
    const profile = await getDoc(doc(firestore, 'users', userId));
    return profile.exists() && profile.data()['defaultRecipeSeeded'] === true;
  }

  private async markDefaultRecipeAsSeeded(userId: string): Promise<void> {
    try {
      await setDoc(doc(firestore, 'users', userId), { defaultRecipeSeeded: true }, { merge: true });
    } catch (error) {
      console.warn('No se pudo marcar la receta por defecto como inicializada.', error);
    }
  }

  private mapRecipe(id: string, data: DocumentData): Recipe {
    return {
      id,
      userId: this.readString(data, 'userId'),
      title: this.readString(data, 'title'),
      description: this.readOptionalString(data, 'description'),
      notes: this.readOptionalString(data, 'notes'),
      ingredients: Array.isArray(data['ingredients']) ? data['ingredients'] : [],
      steps: Array.isArray(data['steps']) ? data['steps'] : [],
      image: this.readImage(data['image']),
      servings: this.readNullableNumber(data, 'servings'),
      prepTimeMinutes: this.readNullableNumber(data, 'prepTimeMinutes'),
      cookTimeMinutes: this.readNullableNumber(data, 'cookTimeMinutes'),
      totalTimeMinutes: this.readNullableNumber(data, 'totalTimeMinutes'),
      category: this.readOptionalString(data, 'category'),
      tags: Array.isArray(data['tags'])
        ? data['tags'].filter((tag: unknown): tag is string => typeof tag === 'string')
        : [],
      favorite: data['favorite'] === true,
      createdAt: this.readNullableNumber(data, 'createdAt') ?? 0,
      updatedAt: this.readNullableNumber(data, 'updatedAt') ?? 0,
    };
  }

  private toRecipeDocument(recipe: Omit<Recipe, 'id'>): Record<string, unknown> {
    return this.stripUndefined({
      userId: recipe.userId,
      title: recipe.title,
      description: recipe.description,
      notes: recipe.notes,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      image: recipe.image ?? null,
      servings: recipe.servings,
      prepTimeMinutes: recipe.prepTimeMinutes,
      cookTimeMinutes: recipe.cookTimeMinutes,
      totalTimeMinutes: recipe.totalTimeMinutes,
      category: recipe.category,
      tags: recipe.tags,
      favorite: recipe.favorite,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
    });
  }

  private stripUndefined(value: unknown): Record<string, unknown> {
    return this.stripUndefinedValue(value) as Record<string, unknown>;
  }

  private stripUndefinedValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.stripUndefinedValue(item));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, entry]) => entry !== undefined)
          .map(([key, entry]) => [key, this.stripUndefinedValue(entry)]),
      );
    }

    return value;
  }

  private readString(data: DocumentData, key: string): string {
    const value = data[key];
    return typeof value === 'string' ? value : '';
  }

  private readOptionalString(data: DocumentData, key: string): string | undefined {
    const value = data[key];
    return typeof value === 'string' && value.trim() ? value : undefined;
  }

  private readNullableNumber(data: DocumentData, key: string): number | null {
    const value = data[key];
    return typeof value === 'number' ? value : null;
  }

  private readImage(value: unknown): RecipeImage | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    return value as RecipeImage;
  }
}
