import { Injectable } from '@angular/core';
import { supabase } from '../../../core/supabase.config';
import { ImportedRecipeDraft } from '../utils/extract-recipe-from-image';

interface ImportRecipeAiResponse {
  recipe: ImportedRecipeDraft;
}

@Injectable({
  providedIn: 'root',
})
export class RecipeImportService {
  async refineImportedRecipe(
    rawText: string,
    draft: ImportedRecipeDraft,
  ): Promise<ImportedRecipeDraft> {
    const { data, error } = await supabase.functions.invoke<ImportRecipeAiResponse>(
      'import-recipe-with-ai',
      {
        body: {
          rawText,
          draft,
          targetLanguage: 'es',
        },
      },
    );

    if (error) {
      throw error;
    }

    if (!data?.recipe) {
      throw new Error('AI recipe import returned no recipe');
    }

    return data.recipe;
  }
}
