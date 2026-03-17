import { effect, inject, Injectable, signal } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { Recipe } from '../../../core/models/recipe.model';

import { removeUndefinedFields } from '../../../core/utils/remove-undefined-fields';

import {
  doc,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';

import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../../../core/firebase.config';

import { db } from '../../../core/firebase.config';

@Injectable({
  providedIn: 'root',
})
export class RecipeService {
  private authService = inject(AuthService);

  recipes = signal<Recipe[]>([]);
  loading = signal(false);

  private unsubscribeRecipes: Unsubscribe | null = null;

  constructor() {
    effect(() => {
      const user = this.authService.user();
      if (this.unsubscribeRecipes) {
        this.unsubscribeRecipes();
        this.unsubscribeRecipes = null;
      }
      if (!user) {
        this.recipes.set([]);
        this.loading.set(false);
        return;
      }
      this.listenToRecipes(user.uid);
    });
  }

  private listenToRecipes(userId: string): void {
    this.loading.set(true);

    const recipesRef = collection(db, 'recipes');
    const recipesQuery = query(recipesRef, where('userId', '==', userId));

    this.unsubscribeRecipes = onSnapshot(
      recipesQuery,
      (snapshot) => {
        const recipes = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Recipe[];

        this.recipes.set(recipes);
        this.loading.set(false);
      },
      (error) => {
        console.error('Error loading recipes:', error);
        this.recipes.set([]);
        this.loading.set(false);
      },
    );
  }

  async createRecipe(
    recipeData: Omit<Recipe, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<void> {
    const user = this.authService.user();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const recipesRef = collection(db, 'recipes');

    const recipe = removeUndefinedFields({
      ...recipeData,
      userId: user.uid,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await addDoc(recipesRef, recipe);
  }

  async updateRecipe(
    recipeId: string,
    recipeData: Omit<Recipe, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<void> {
    const user = this.authService.user();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const recipeRef = doc(db, 'recipes', recipeId);
    const existingRecipe = await this.getRecipeById(recipeId);

    if (!existingRecipe) {
      throw new Error('Recipe not found or access denied');
    }

    const updatedRecipe = removeUndefinedFields({
      ...recipeData,
      updatedAt: Date.now(),
    });

    await updateDoc(recipeRef, updatedRecipe);

    const previousImagePath = existingRecipe.image?.path;
    const nextImagePath = recipeData.image?.path;

    if (previousImagePath && previousImagePath !== nextImagePath) {
      await this.deleteRecipeImage(previousImagePath);
    }

    this.recipes.update((recipes) =>
      recipes.map((recipe) =>
        recipe.id === recipeId
          ? {
              ...recipe,
              ...recipeData,
              updatedAt: Date.now(),
            }
          : recipe,
      ),
    );
  }

  async uploadRecipeImage(
    file: Blob,
    fileExtension = 'webp',
  ): Promise<{ url: string; path: string }> {
    const user = this.authService.user();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const fileName = `${crypto.randomUUID()}.${fileExtension}`;
    const path = `recipes/${user.uid}/${fileName}`;

    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, file, {
      contentType: 'image/webp',
    });

    const url = await getDownloadURL(storageRef);

    return { url, path };
  }

  async getRecipeById(recipeId: string): Promise<Recipe | null> {
    const user = this.authService.user();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const recipeRef = doc(db, 'recipes', recipeId);
    const recipeSnapshot = await getDoc(recipeRef);

    if (!recipeSnapshot.exists()) {
      return null;
    }

    const recipe = {
      id: recipeSnapshot.id,
      ...recipeSnapshot.data(),
    } as Recipe;

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

    const recipeRef = doc(db, 'recipes', recipeId);

    await updateDoc(recipeRef, {
      favorite,
      updatedAt: Date.now(),
    });

    this.recipes.update((recipes) =>
      recipes.map((recipe) =>
        recipe.id === recipeId
          ? {
              ...recipe,
              favorite,
              updatedAt: Date.now(),
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

    const recipeRef = doc(db, 'recipes', recipeId);
    const existingRecipe = await this.getRecipeById(recipeId);

    if (!existingRecipe) {
      throw new Error('Recipe not found or access denied');
    }

    await deleteDoc(recipeRef);

    if (existingRecipe.image?.path) {
      await this.deleteRecipeImage(existingRecipe.image.path);
    }

    this.recipes.update((recipes) => recipes.filter((recipe) => recipe.id !== recipeId));
  }

  async deleteRecipeImage(imagePath: string): Promise<void> {
    try {
      const imageRef = ref(storage, imagePath);
      await deleteObject(imageRef);
    } catch (error) {
      console.error('Error deleting recipe image:', error);
      throw error;
    }
  }
}
