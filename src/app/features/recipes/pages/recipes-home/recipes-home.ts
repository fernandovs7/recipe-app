import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../../../core/services/auth.service';
import { Router } from '@angular/router';
import { RecipeService } from '../../services/recipe.service';
import { Recipe } from '../../../../core/models/recipe.model';
import { IconComponent } from '../../../../shared/components/icon/icon';
import { ImageComponent } from '../../../../shared/components/image/image';
import { ImageData } from '../../../../shared/components/image/image-data';
import { formatDuration } from '../../../../core/utils/format-duration';
import { RecipeImage, RecipeImageSizeKey } from '../../../../core/models/recipe.model';
import { getRecipeCategoryLabel } from '../../../../core/constants/recipe-categories';

@Component({
  selector: 'app-recipes-home',
  imports: [IconComponent, ImageComponent],
  templateUrl: './recipes-home.html',
  styleUrl: './recipes-home.scss',
})
export class RecipesHome {
  authService = inject(AuthService);
  recipeService = inject(RecipeService);
  private router = inject(Router);

  recentRecipes = computed(() =>
    [...this.recipeService.recipes()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3),
  );

  favoriteRecipes = computed(() =>
    this.recipeService
      .recipes()
      .filter((recipe) => recipe.favorite)
  );

  randomRecipe = computed(() => {
    const recipes = this.recipeService.recipes();

    if (recipes.length === 0) {
      return null;
    }

    const index = Math.floor(Math.random() * recipes.length);
    return recipes[index];
  });

  totalRecipes = computed(() => this.recipeService.recipes().length);

  totalFavorites = computed(
    () => this.recipeService.recipes().filter((recipe) => recipe.favorite).length,
  );

  async logout(): Promise<void> {
    await this.authService.logout();
    await this.router.navigate(['/login']);
  }

  goToRecipeDetail(recipeId: string): void {
    this.router.navigate(['/app/recipes', recipeId], {
      state: { from: 'home' },
    });
  }

  goToCreateRecipe(): void {
    this.router.navigate(['/app/recipes/new']);
  }

  goToRecipes(): void {
    this.router.navigate(['/app/recipes']);
  }

  firstName(): string {
    const displayName = this.authService.user()?.displayName?.trim();

    if (!displayName) {
      return 'chef';
    }

    return displayName.split(/\s+/)[0] || 'chef';
  }

  categoryLabel(category?: string): string {
    if (!category) {
      return 'Sin categoría';
    }

    const translatedLabel = getRecipeCategoryLabel(category);

    if (translatedLabel) {
      return translatedLabel;
    }

    return category
      .split(/[\s-]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  durationLabel(minutes: number | null | undefined): string {
    return formatDuration(minutes);
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
}
