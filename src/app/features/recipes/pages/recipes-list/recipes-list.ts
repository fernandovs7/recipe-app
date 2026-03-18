import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { RecipeService } from '../../services/recipe.service';
import { Router } from '@angular/router';
import { IconComponent } from '../../../../shared/components/icon/icon';
import { ImageComponent } from '../../../../shared/components/image/image';
import { ImageData } from '../../../../shared/components/image/image-data';
import { RECIPE_CATEGORIES } from '../../../../core/constants/recipe-categories';
import { formatDuration } from '../../../../core/utils/format-duration';
import { RecipeImage, RecipeImageSizeKey } from '../../../../core/models/recipe.model';

type SortOption = 'newest' | 'oldest' | 'title-asc' | 'title-desc';

@Component({
  selector: 'app-recipes-list',
  imports: [IconComponent, ImageComponent],
  templateUrl: './recipes-list.html',
  styleUrl: './recipes-list.scss',
})
export class RecipesList {
  private recipeService = inject(RecipeService);
  private router = inject(Router);
  private categoriesCatalog = RECIPE_CATEGORIES;

  searchTerm = signal('');
  selectedCategory = signal('');
  sortBy = signal<SortOption>('newest');
  categoryDropdownOpen = signal(false);
  sortDropdownOpen = signal(false);
  loading = this.recipeService.loading;
  sortOptions: { value: SortOption; label: string }[] = [
    { value: 'newest', label: 'Mas recientes' },
    { value: 'oldest', label: 'Mas antiguas' },
    { value: 'title-asc', label: 'Titulo A-Z' },
    { value: 'title-desc', label: 'Titulo Z-A' },
  ];

  categories = computed(() => {
    const categorySet = new Set(
      this.recipeService
        .recipes()
        .map((recipe) => recipe.category)
        .filter((category): category is string => !!category),
    );

    return [...categorySet].sort((a, b) => a.localeCompare(b));
  });

  filteredRecipes = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    const category = this.selectedCategory();
    const sortBy = this.sortBy();

    let recipes = [...this.recipeService.recipes()];

    if (search) {
      recipes = recipes.filter((recipe) => {
        const titleMatch = recipe.title.toLowerCase().includes(search);
        const descriptionMatch = (recipe.description ?? '').toLowerCase().includes(search);
        const tagsMatch = recipe.tags.some((tag) => tag.toLowerCase().includes(search));

        return titleMatch || descriptionMatch || tagsMatch;
      });
    }

    if (category) {
      recipes = recipes.filter((recipe) => recipe.category === category);
    }

    switch (sortBy) {
      case 'newest':
        recipes.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'oldest':
        recipes.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case 'title-asc':
        recipes.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        recipes.sort((a, b) => b.title.localeCompare(a.title));
        break;
    }

    return recipes;
  });

  totalRecipes = computed(() => this.recipeService.recipes().length);

  totalFavorites = computed(
    () => this.recipeService.recipes().filter((recipe) => recipe.favorite).length,
  );

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
  }

  onCategoryChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedCategory.set(value);
  }

  onSortChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as SortOption;
    this.sortBy.set(value);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.selectedCategory.set('');
    this.sortBy.set('newest');
    this.categoryDropdownOpen.set(false);
    this.sortDropdownOpen.set(false);
  }

  toggleCategoryDropdown(): void {
    this.sortDropdownOpen.set(false);
    this.categoryDropdownOpen.update((value) => !value);
  }

  toggleSortDropdown(): void {
    this.categoryDropdownOpen.set(false);
    this.sortDropdownOpen.update((value) => !value);
  }

  selectCategory(value: string): void {
    this.selectedCategory.set(value);
    this.categoryDropdownOpen.set(false);
  }

  selectSort(value: SortOption): void {
    this.sortBy.set(value);
    this.sortDropdownOpen.set(false);
  }

  selectedCategoryLabel(): string {
    return this.selectedCategory() ? this.categoryLabel(this.selectedCategory()) : 'Todas';
  }

  selectedSortLabel(): string {
    return this.sortOptions.find((option) => option.value === this.sortBy())?.label ?? 'Mas recientes';
  }

  goToRecipeDetail(recipeId: string): void {
    this.router.navigate(['/app/recipes', recipeId]);
  }

  goToCreateRecipe(): void {
    this.router.navigate(['/app/recipes/new']);
  }

  goToHome(): void {
    this.router.navigate(['/app']);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;

    if (!this.isClickInsideDropdown(target, '.recipes-list-category-dropdown')) {
      this.categoryDropdownOpen.set(false);
    }

    if (!this.isClickInsideDropdown(target, '.recipes-list-sort-dropdown')) {
      this.sortDropdownOpen.set(false);
    }
  }

  categoryLabel(categoryValue?: string): string {
    if (!categoryValue) {
      return 'Sin categoria';
    }

    return (
      this.categoriesCatalog.find((category) => category.value === categoryValue)?.label ??
      categoryValue
    );
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
    };
  }

  private isClickInsideDropdown(target: HTMLElement | null, selector: string): boolean {
    if (!target) {
      return false;
    }

    return Boolean(target.closest(selector));
  }
}
