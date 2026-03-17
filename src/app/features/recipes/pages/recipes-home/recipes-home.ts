import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../../../core/services/auth.service';
import { Router } from '@angular/router';
import { RecipeService } from '../../services/recipe.service';
import { IconComponent } from '../../../../shared/components/icon/icon';

@Component({
  selector: 'app-recipes-home',
  imports: [IconComponent],
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
      .slice(0, 3),
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
    this.router.navigate(['/app/recipes', recipeId]);
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

    return category
      .split(/[\s-]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
