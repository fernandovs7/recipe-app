import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RecipeService } from '../../services/recipe.service';
import { Recipe } from '../../../../core/models/recipe.model';
import { IconComponent } from '../../../../shared/components/icon/icon';
import { RECIPE_CATEGORIES } from '../../../../core/constants/recipe-categories';
import { formatDuration } from '../../../../core/utils/format-duration';

@Component({
  selector: 'app-view-recipe',
  imports: [IconComponent, RouterLink],
  templateUrl: './view-recipe.html',
  styleUrl: './view-recipe.scss',
})
export class ViewRecipe {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private recipeService = inject(RecipeService);

  recipe = signal<Recipe | null>(null);
  loading = signal(true);
  favoriteSaving = signal(false);
  deleteModalOpen = signal(false);
  deleting = signal(false);
  error = signal('');
  categories = RECIPE_CATEGORIES;

  constructor() {
    this.loadRecipe();
  }

  async loadRecipe(): Promise<void> {
    const recipeId = this.route.snapshot.paramMap.get('id');

    if (!recipeId) {
      this.error.set('No se encontró el id de la receta.');
      this.loading.set(false);
      return;
    }

    try {
      const recipe = await this.recipeService.getRecipeById(recipeId);

      if (!recipe) {
        this.error.set('La receta no existe o no tienes acceso.');
        return;
      }

      this.recipe.set(recipe);
    } catch (error) {
      console.error(error);
      this.error.set('Ocurrió un error cargando la receta.');
    } finally {
      this.loading.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/app']);
  }

  async toggleFavorite(): Promise<void> {
    const currentRecipe = this.recipe();

    if (!currentRecipe || this.favoriteSaving()) {
      return;
    }

    const nextFavoriteValue = !currentRecipe.favorite;

    this.favoriteSaving.set(true);
    this.recipe.set({
      ...currentRecipe,
      favorite: nextFavoriteValue,
    });

    try {
      await this.recipeService.updateRecipeFavorite(currentRecipe.id, nextFavoriteValue);
    } catch (error) {
      console.error(error);
      this.recipe.set(currentRecipe);
    } finally {
      this.favoriteSaving.set(false);
    }
  }

  openDeleteModal(): void {
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    if (this.deleting()) {
      return;
    }

    this.deleteModalOpen.set(false);
  }

  async deleteRecipe(): Promise<void> {
    const currentRecipe = this.recipe();

    if (!currentRecipe || this.deleting()) {
      return;
    }

    this.deleting.set(true);

    try {
      await this.recipeService.deleteRecipe(currentRecipe.id);
      this.deleteModalOpen.set(false);
      await this.router.navigate(['/app']);
    } catch (error) {
      console.error(error);
      this.error.set('No pudimos borrar la receta. Intenta de nuevo.');
      this.deleteModalOpen.set(false);
    } finally {
      this.deleting.set(false);
    }
  }

  categoryLabel(categoryValue?: string): string {
    if (!categoryValue) {
      return 'Sin categoría';
    }

    return (
      this.categories.find((category) => category.value === categoryValue)?.label ?? categoryValue
    );
  }

  tagLabel(tag: string): string {
    return tag
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  durationLabel(minutes: number | null | undefined): string {
    return formatDuration(minutes);
  }
}
