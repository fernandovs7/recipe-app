import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Recipe } from '../../../../core/models/recipe.model';
import { IMAGE_OPTIMIZATION_OPTIONS } from '../../../../core/constants/image-upload';
import { optimizeImage } from '../../../../core/utils/optimize-image';
import { RecipeFormComponent } from '../../components/recipe-form/recipe-form';
import { RecipeFormSubmitValue } from '../../components/recipe-form/recipe-form.model';
import { RecipeService } from '../../services/recipe.service';
import { mapRecipeFormToRecipeData } from '../../utils/map-recipe-form-to-recipe-data';

@Component({
  selector: 'app-edit-recipe',
  imports: [RecipeFormComponent],
  templateUrl: './edit-recipe.html',
  styleUrl: './edit-recipe.scss',
})
export class EditRecipe {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private recipeService = inject(RecipeService);

  recipe = signal<Recipe | null>(null);
  loading = signal(true);
  saving = signal(false);
  error = signal('');
  submitError = signal<string | null>(null);

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

  async saveRecipe(value: RecipeFormSubmitValue): Promise<void> {
    const currentRecipe = this.recipe();

    if (!currentRecipe) {
      return;
    }

    this.submitError.set(null);
    this.saving.set(true);

    let uploadedImagePath: string | null = null;

    try {
      let image = value.existingImage ?? undefined;

      if (value.selectedImageFile) {
        const optimizedImage = await optimizeImage(
          value.selectedImageFile,
          IMAGE_OPTIMIZATION_OPTIONS,
        );

        const uploadedImage = await this.recipeService.uploadRecipeImage(optimizedImage.blob, 'webp');
        uploadedImagePath = uploadedImage.path;

        image = {
          url: uploadedImage.url,
          path: uploadedImage.path,
          alt: value.title || 'Imagen de receta',
        };
      } else if (image) {
        image = {
          ...image,
          alt: value.title || image.alt,
        };
      }

      const recipeData = mapRecipeFormToRecipeData(value, image, currentRecipe.favorite);

      await this.recipeService.updateRecipe(currentRecipe.id, recipeData);

      await this.router.navigate(['/app/recipes', currentRecipe.id]);
    } catch (error) {
      console.error('Error updating recipe:', error);

      if (uploadedImagePath) {
        try {
          await this.recipeService.deleteRecipeImage(uploadedImagePath);
        } catch (cleanupError) {
          console.error('Error cleaning up uploaded image:', cleanupError);
        }
      }

      this.submitError.set('No pudimos guardar los cambios. Intenta de nuevo.');
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    const recipeId = this.recipe()?.id;

    if (recipeId) {
      this.router.navigate(['/app/recipes', recipeId]);
      return;
    }

    this.router.navigate(['/app']);
  }
}
