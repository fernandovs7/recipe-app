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
import { RECIPE_CATEGORIES, getRecipeCategoryLabel } from '../../../../core/constants/recipe-categories';
import { formatDuration } from '../../../../core/utils/format-duration';

type QuantityFormatStyle =
  | 'integer'
  | 'decimal-comma'
  | 'decimal-dot'
  | 'fraction'
  | 'mixed-fraction';

const FRACTION_FRIENDLY_UNITS = new Set(['taza', 'cda', 'cdta', 'unidad', 'unidads', 'unidad(s)']);

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
  private favoriteBounceTimeout: ReturnType<typeof setTimeout> | null = null;

  recipe = signal<Recipe | null>(null);
  loading = signal(true);
  favoriteSaving = signal(false);
  favoriteBounceActive = signal(false);
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
    } catch {
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

    if (nextFavoriteValue) {
      this.triggerFavoriteBounce();
    }

    try {
      await this.recipeService.updateRecipeFavorite(currentRecipe.id, nextFavoriteValue);
    } catch {
      this.recipe.set(currentRecipe);
    } finally {
      this.favoriteSaving.set(false);
    }
  }

  private triggerFavoriteBounce(): void {
    if (this.favoriteBounceTimeout) {
      clearTimeout(this.favoriteBounceTimeout);
    }

    this.favoriteBounceActive.set(false);

    requestAnimationFrame(() => {
      this.favoriteBounceActive.set(true);
      this.favoriteBounceTimeout = setTimeout(() => {
        this.favoriteBounceActive.set(false);
        this.favoriteBounceTimeout = null;
      }, 650);
    });
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
    } catch {
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

    return getRecipeCategoryLabel(categoryValue) ?? categoryValue;
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

    const scaledQuantity = quantity ? this.scaleQuantity(quantity, unit) : '';

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

  private scaleQuantity(quantity: string, unit?: string): string {
    const baseServings = this.recipe()?.servings;
    const currentServings = this.displayedServings();

    if (!baseServings || !currentServings || baseServings <= 0) {
      return quantity;
    }

    if (baseServings === currentServings) {
      return quantity.trim();
    }

    const parsedQuantity = this.parseQuantity(quantity);

    if (parsedQuantity === null) {
      return quantity;
    }

    const scaledValue = (parsedQuantity.value * currentServings) / baseServings;
    return this.formatScaledQuantity(scaledValue, parsedQuantity.style, unit);
  }

  private parseQuantity(
    value: string,
  ): { value: number; style: QuantityFormatStyle } | null {
    const normalizedValue = value.trim().replace(',', '.');

    const mixedFractionMatch = normalizedValue.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixedFractionMatch) {
      const [, whole, numerator, denominator] = mixedFractionMatch;
      return {
        value: Number(whole) + Number(numerator) / Number(denominator),
        style: 'mixed-fraction',
      };
    }

    const fractionMatch = normalizedValue.match(/^(\d+)\/(\d+)$/);
    if (fractionMatch) {
      const [, numerator, denominator] = fractionMatch;
      return {
        value: Number(numerator) / Number(denominator),
        style: 'fraction',
      };
    }

    if (/^\d+[.,]\d+$/.test(value.trim())) {
      const numericValue = Number(normalizedValue);
      return Number.isFinite(numericValue)
        ? {
            value: numericValue,
            style: value.includes(',') ? 'decimal-comma' : 'decimal-dot',
          }
        : null;
    }

    const numericValue = Number(normalizedValue);
    return Number.isFinite(numericValue)
      ? {
          value: numericValue,
          style: Number.isInteger(numericValue) ? 'integer' : 'decimal-comma',
        }
      : null;
  }

  private formatScaledQuantity(
    value: number,
    style: QuantityFormatStyle,
    unit?: string,
  ): string {
    const shouldUseFraction =
      style === 'fraction' ||
      style === 'mixed-fraction' ||
      (style === 'integer' && this.isFractionFriendlyUnit(unit));

    if (shouldUseFraction) {
      const fractionValue = this.formatAsFraction(value);

      if (fractionValue) {
        return fractionValue;
      }
    }

    if (style === 'integer') {
      if (Number.isInteger(value)) {
        return String(value);
      }
    }

    const roundedValue = Math.round(value * 100) / 100;
    const formattedValue = new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(roundedValue);

    return style === 'decimal-dot' ? formattedValue.replace(',', '.') : formattedValue;
  }

  private isFractionFriendlyUnit(unit?: string): boolean {
    if (!unit) {
      return false;
    }

    const normalizedUnit = unit
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[().]/g, '');

    return FRACTION_FRIENDLY_UNITS.has(normalizedUnit);
  }

  private formatAsFraction(value: number): string | null {
    const roundedInteger = Math.round(value);

    if (Math.abs(value - roundedInteger) < 0.01) {
      return String(roundedInteger);
    }

    const whole = Math.floor(value);
    const fraction = value - whole;
    const approximation = this.approximateFraction(fraction);

    if (!approximation) {
      return null;
    }

    let normalizedWhole = whole;
    let numerator = approximation.numerator;
    const denominator = approximation.denominator;

    if (numerator === denominator) {
      normalizedWhole += 1;
      numerator = 0;
    }

    if (numerator === 0) {
      return String(normalizedWhole);
    }

    return normalizedWhole > 0
      ? `${normalizedWhole} ${numerator}/${denominator}`
      : `${numerator}/${denominator}`;
  }

  private approximateFraction(
    value: number,
  ): { numerator: number; denominator: number } | null {
    const candidateDenominators = [2, 3, 4, 5, 6, 8];
    let bestMatch: { numerator: number; denominator: number; error: number } | null = null;

    for (const denominator of candidateDenominators) {
      const numerator = Math.round(value * denominator);
      const approximation = numerator / denominator;
      const error = Math.abs(value - approximation);

      if (!bestMatch || error < bestMatch.error) {
        bestMatch = { numerator, denominator, error };
      }
    }

    if (!bestMatch || bestMatch.error > 0.04) {
      return null;
    }

    const divisor = this.greatestCommonDivisor(bestMatch.numerator, bestMatch.denominator);

    return {
      numerator: bestMatch.numerator / divisor,
      denominator: bestMatch.denominator / divisor,
    };
  }

  private greatestCommonDivisor(a: number, b: number): number {
    let left = Math.abs(a);
    let right = Math.abs(b);

    while (right !== 0) {
      const remainder = left % right;
      left = right;
      right = remainder;
    }

    return left || 1;
  }
}
