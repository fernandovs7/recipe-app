import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RecipeService } from '../../services/recipe.service';
import {
  Recipe,
  RecipeImage,
  RecipeImageSizeKey,
  RecipeIngredient,
} from '../../../../core/models/recipe.model';
import { IconComponent } from '../../../../shared/components/icon/icon';
import { ImageComponent } from '../../../../shared/components/image/image';
import { ImageData } from '../../../../shared/components/image/image-data';
import { RECIPE_CATEGORIES } from '../../../../core/constants/recipe-categories';
import { formatDuration } from '../../../../core/utils/format-duration';

@Component({
  selector: 'app-view-recipe',
  imports: [IconComponent, RouterLink, ImageComponent],
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
  adjustedServings = signal<number | null>(null);
  categories = RECIPE_CATEGORIES;
  readonly displayedServings = computed(() => this.adjustedServings() ?? this.recipe()?.servings ?? null);
  readonly canAdjustServings = computed(() => {
    const servings = this.recipe()?.servings;
    return typeof servings === 'number' && servings > 0;
  });

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
      this.adjustedServings.set(recipe.servings);
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

  decreaseServings(): void {
    if (!this.canAdjustServings()) {
      return;
    }

    const nextValue = Math.max(1, (this.displayedServings() ?? 1) - 1);
    this.adjustedServings.set(nextValue);
  }

  increaseServings(): void {
    if (!this.canAdjustServings()) {
      return;
    }

    this.adjustedServings.set((this.displayedServings() ?? 0) + 1);
  }

  ingredientQuantityLabel(ingredient: RecipeIngredient): string {
    const quantity = ingredient.quantity?.trim();
    const unit = ingredient.unit?.trim();

    if (!quantity && !unit) {
      return '';
    }

    const scaledQuantity = quantity ? this.scaleQuantity(quantity) : '';

    return [scaledQuantity, unit].filter(Boolean).join(' ');
  }

  imageUrl(image: RecipeImage | null | undefined, size: RecipeImageSizeKey): string | undefined {
    return image?.variants?.[size]?.url ?? image?.url;
  }

  imageData(
    image: RecipeImage | null | undefined,
    size: RecipeImageSizeKey,
    alt: string,
    width: number,
    height: number,
  ): ImageData {
    return {
      src: this.imageUrl(image, size) ?? 'assets/images/shared/image-fallback.png',
      alt,
      width,
      height,
      fallback: 'assets/images/shared/image-fallback.png',
      srcset: this.imageSrcSet(image),
      sizes: this.imageSizes(size),
    };
  }

  private imageSrcSet(image: RecipeImage | null | undefined): string | undefined {
    const variants = image?.variants;

    if (!variants) {
      return image?.url;
    }

    const entries = Object.values(variants)
      .filter((variant): variant is NonNullable<typeof variant> => Boolean(variant?.url && variant?.width))
      .sort((left, right) => left.width - right.width)
      .map((variant) => `${variant.url} ${variant.width}w`);

    return entries.length > 0 ? entries.join(', ') : image?.url;
  }

  private imageSizes(size: RecipeImageSizeKey): string {
    switch (size) {
      case 'thumbnail':
        return '(max-width: 640px) 72px, 112px';
      case 'medium':
        return '(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw';
      case 'full':
        return '(max-width: 640px) 100vw, 1600px';
    }
  }

  private scaleQuantity(quantity: string): string {
    const baseServings = this.recipe()?.servings;
    const currentServings = this.displayedServings();

    if (!baseServings || !currentServings || baseServings <= 0) {
      return quantity;
    }

    const parsedQuantity = this.parseQuantity(quantity);

    if (parsedQuantity === null) {
      return quantity;
    }

    const scaledValue = (parsedQuantity * currentServings) / baseServings;
    return this.formatScaledQuantity(scaledValue);
  }

  private parseQuantity(value: string): number | null {
    const normalizedValue = value.trim().replace(',', '.');

    const mixedFractionMatch = normalizedValue.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixedFractionMatch) {
      const [, whole, numerator, denominator] = mixedFractionMatch;
      return Number(whole) + Number(numerator) / Number(denominator);
    }

    const fractionMatch = normalizedValue.match(/^(\d+)\/(\d+)$/);
    if (fractionMatch) {
      const [, numerator, denominator] = fractionMatch;
      return Number(numerator) / Number(denominator);
    }

    const numericValue = Number(normalizedValue);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  private formatScaledQuantity(value: number): string {
    const roundedValue = Math.round(value * 100) / 100;
    return new Intl.NumberFormat('es-ES', {
      maximumFractionDigits: 2,
    }).format(roundedValue);
  }
}
