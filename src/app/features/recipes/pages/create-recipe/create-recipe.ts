import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { RecipeService } from '../../services/recipe.service';
import { RecipeFormComponent } from '../../components/recipe-form/recipe-form';
import { RecipeFormSubmitValue } from '../../components/recipe-form/recipe-form.model';
import { optimizeImage } from '../../../../core/utils/optimize-image';
import { IMAGE_OPTIMIZATION_OPTIONS } from '../../../../core/constants/image-upload';
import { mapRecipeFormToRecipeData } from '../../utils/map-recipe-form-to-recipe-data';

@Component({
  selector: 'app-create-recipe',
  imports: [RecipeFormComponent],
  templateUrl: './create-recipe.html',
  styleUrl: './create-recipe.scss',
})
export class CreateRecipe {
  private recipeService = inject(RecipeService);
  private router = inject(Router);

  saving = signal(false);
  submitError = signal<string | null>(null);

  async saveRecipe(value: RecipeFormSubmitValue): Promise<void> {
    this.submitError.set(null);
    this.saving.set(true);

    let uploadedImagePath: string | null = null;

    try {
      let image = undefined;

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
      }

      await this.recipeService.createRecipe(
        mapRecipeFormToRecipeData(value, image, false),
      );

      await this.router.navigate(['/app']);
    } catch (error) {
      console.error('Error creating recipe:', error);

      if (uploadedImagePath) {
        try {
          await this.recipeService.deleteRecipeImage(uploadedImagePath);
        } catch (cleanupError) {
          console.error('Error cleaning up uploaded image:', cleanupError);
        }
      }

      this.submitError.set('No pudimos guardar la receta. Intenta de nuevo.');
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/app']);
  }
}
