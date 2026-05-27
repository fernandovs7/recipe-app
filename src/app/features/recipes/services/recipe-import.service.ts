import { Injectable } from '@angular/core';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../../../core/supabase.config';
import { ImportedRecipeDraft } from '../utils/extract-recipe-from-image';
import { optimizeImage } from '../../../core/utils/optimize-image';

interface ImportRecipeAiResponse {
  recipe: ImportedRecipeDraft;
}

@Injectable({
  providedIn: 'root',
})
export class RecipeImportService {
  async importRecipeFromImage(
    file: File,
    context?: {
      rawText?: string;
      draft?: ImportedRecipeDraft;
    },
  ): Promise<ImportedRecipeDraft> {
    const optimizedImage = await optimizeImage(file, {
      maxWidth: 1280,
      maxHeight: 1800,
      quality: 0.72,
      minQuality: 0.56,
      maxBytes: 350 * 1024,
      outputType: 'image/jpeg',
    });

    const imageDataUrl = await this.blobToDataUrl(optimizedImage.blob);

    return this.requestAiRecipe({
      imageDataUrl,
      rawText: context?.rawText,
      draft: context?.draft,
      targetLanguage: 'es',
    });
  }

  private async requestAiRecipe(body: {
    imageDataUrl?: string;
    rawText?: string;
    draft?: ImportedRecipeDraft;
    targetLanguage: 'es';
  }): Promise<ImportedRecipeDraft> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('No active Supabase session for recipe import');
    }

    const { data, error } = await supabase.functions.invoke<ImportRecipeAiResponse>(
      'import-recipe-with-ai',
      {
        body,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    );

    if (error) {
      if (error instanceof FunctionsHttpError) {
        const details = await this.readFunctionErrorDetails(error);
        console.error('AI recipe import request failed', {
          name: error.name,
          message: error.message,
          details,
        });
      } else {
        console.error('AI recipe import request failed', error);
      }
      throw error;
    }

    if (!data?.recipe) {
      throw new Error('AI recipe import returned no recipe');
    }

    return data.recipe;
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }

        reject(new Error('Image data URL could not be created'));
      };
      reader.onerror = () => reject(reader.error ?? new Error('Image could not be read'));
      reader.readAsDataURL(blob);
    });
  }

  private async readFunctionErrorDetails(error: FunctionsHttpError): Promise<unknown> {
    try {
      const response = error.context;

      if (!response) {
        return null;
      }

      const clonedResponse = response.clone();
      const contentType = clonedResponse.headers.get('content-type') ?? '';

      if (contentType.includes('application/json')) {
        return await clonedResponse.json();
      }

      return await clonedResponse.text();
    } catch {
      return null;
    }
  }
}
