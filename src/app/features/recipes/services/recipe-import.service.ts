import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { firebaseAuth } from '../../../core/firebase.config';
import { ImportedRecipeDraft } from '../utils/extract-recipe-from-image';
import { optimizeImage } from '../../../core/utils/optimize-image';

interface ImportRecipeAiResponse {
  recipe: ImportedRecipeDraft;
  error?: string;
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
    const user = firebaseAuth.currentUser;

    if (!user) {
      throw new Error('No active Firebase session for recipe import');
    }

    const accessToken = await user.getIdToken();
    const response = await fetch(environment.firebase.importRecipeUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json().catch(() => null)) as ImportRecipeAiResponse | null;

    if (!response.ok) {
      console.error('AI recipe import request failed', {
        status: response.status,
        payload,
      });
      throw new Error(payload?.error ?? `AI recipe import failed (${response.status})`);
    }

    if (!payload?.recipe) {
      throw new Error('AI recipe import returned no recipe');
    }

    return payload.recipe;
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
}
