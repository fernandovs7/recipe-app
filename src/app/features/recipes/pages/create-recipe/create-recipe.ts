import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { RecipeService } from '../../services/recipe.service';
import { RecipeFormComponent } from '../../components/recipe-form/recipe-form';
import { RecipeFormSubmitValue } from '../../components/recipe-form/recipe-form.model';
import { RecipeImage } from '../../../../core/models/recipe.model';
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

    let uploadedImage: RecipeImage | null = null;

    try {
      let image = undefined;

      if (value.selectedImageFile) {
        uploadedImage = await this.recipeService.uploadRecipeImageVariants(
          value.selectedImageFile,
          value.title || 'Imagen de receta',
        );
        image = uploadedImage;
      }

      await this.recipeService.createRecipe(
        mapRecipeFormToRecipeData(value, image, false),
      );

      await this.router.navigate(['/app']);
    } catch {
      if (uploadedImage) {
        try {
          const imagePaths = [
            uploadedImage.path,
            ...Object.values(uploadedImage.variants ?? {}).map((variant) => variant.path),
          ];

          for (const imagePath of new Set(imagePaths)) {
            await this.recipeService.deleteRecipeImage(imagePath);
          }
        } catch {
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
