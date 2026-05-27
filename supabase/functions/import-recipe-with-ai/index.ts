import { createClient } from 'jsr:@supabase/supabase-js@2';

interface ImportedRecipeIngredient {
  name: string;
  quantity: string | null;
  unit: string;
  notes: string;
}

interface ImportedRecipeStep {
  instruction: string;
}

interface ImportedRecipeDraft {
  title: string;
  description: string;
  notes: string;
  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  category: string;
  tags: string[];
  ingredients: ImportedRecipeIngredient[];
  steps: ImportedRecipeStep[];
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const recipeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    notes: { type: 'string' },
    servings: { type: ['integer', 'null'] },
    prepTimeMinutes: { type: ['integer', 'null'] },
    cookTimeMinutes: { type: ['integer', 'null'] },
    category: { type: 'string' },
    tags: {
      type: 'array',
      items: { type: 'string' },
    },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          quantity: { type: ['string', 'null'] },
          unit: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['name', 'quantity', 'unit', 'notes'],
      },
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          instruction: { type: 'string' },
        },
        required: ['instruction'],
      },
    },
  },
  required: [
    'title',
    'description',
    'notes',
    'servings',
    'prepTimeMinutes',
    'cookTimeMinutes',
    'category',
    'tags',
    'ingredients',
    'steps',
  ],
} as const;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    const authHeader = req.headers.get('Authorization');

    if (!supabaseUrl || !supabaseAnonKey || !openAiApiKey) {
      return json({ error: 'Missing server configuration' }, 500);
    }

    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (!isProUser(user)) {
      return json({ error: 'Pro plan required' }, 403);
    }

    const payload = (await req.json()) as {
      imageDataUrl?: string;
      rawText?: string;
      draft?: ImportedRecipeDraft;
      targetLanguage?: string;
    };

    const imageDataUrl = payload.imageDataUrl?.trim() ?? '';
    const rawText = payload.rawText?.trim() ?? '';
    const draft = payload.draft;
    const targetLanguage = payload.targetLanguage?.trim() || 'es';

    if (!imageDataUrl && !rawText && !draft) {
      return json({ error: 'Invalid payload' }, 400);
    }

    const userContent: Array<Record<string, unknown>> = [
      {
        type: 'input_text',
        text: JSON.stringify({
          targetLanguage,
          draft,
          rawText,
          instructions: [
            'If an image is provided, use the image as the primary source of truth.',
            'If the image is rotated, mentally rotate it to read it correctly.',
            'Extract only the recipe shown in the photo, ignoring page numbers, side notes, unrelated paragraphs, decorative text, and repeated fragments.',
            'Return title, description, notes, ingredients and steps in Spanish when targetLanguage is es.',
            'Translate English recipe content into natural Spanish.',
            'Use the OCR text and draft only as fallback scaffolding when the image is unclear.',
            'If a field is missing, return empty string, empty array, or null as appropriate.',
            'Do not include markdown.',
            'Do not merge ingredients with steps.',
            'For ingredient units, use only this allowed set when possible: gr, kg, ml, cda, cdta, taza, unidad(s).',
            'Normalize grams and gram variants to gr.',
            'Normalize cup and cups to taza.',
            'Normalize tablespoon variants to cda and teaspoon variants to cdta.',
            'Normalize unit, piece, pieces, clove, cloves, slice, slices, egg, eggs to unidad(s) when no better allowed unit applies.',
            'Do not convert taza to gr unless the original recipe explicitly provides grams or another weight value for that same ingredient.',
            'Normalize tags to lowercase ASCII words.',
          ],
        }),
      },
    ];

    if (imageDataUrl) {
      userContent.push({
        type: 'input_image',
        image_url: imageDataUrl,
        detail: 'high',
      });
    }

    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text:
                  'You extract recipes from photos and OCR text into clean recipe JSON. The image may be rotated or photographed at an angle. Read carefully, translate English recipe content into Spanish when requested, keep ingredient amounts faithful, keep culinary meaning natural, and do not invent missing data. Output only the schema fields.',
              },
            ],
          },
          {
            role: 'user',
            content: userContent,
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'translated_recipe',
            strict: true,
            schema: recipeSchema,
          },
        },
      }),
    });

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();
      console.error('OpenAI request failed', errorText);
      return json({ error: 'OpenAI request failed', details: errorText }, 502);
    }

    const responseData = await openAiResponse.json();
    const responseText = extractOutputText(responseData);

    if (!responseText) {
      return json({ error: 'OpenAI returned no text output' }, 502);
    }

    const recipe = sanitizeRecipe(JSON.parse(responseText) as ImportedRecipeDraft);
    return json({ recipe }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('import-recipe-with-ai unexpected error', error);
    return json({ error: message }, 500);
  }
});

function extractOutputText(responseData: Record<string, unknown>): string {
  const directText = responseData.output_text;

  if (typeof directText === 'string' && directText.trim()) {
    return directText;
  }

  const output = Array.isArray(responseData.output) ? responseData.output : [];

  for (const item of output) {
    const record = item as Record<string, unknown>;
    const content = Array.isArray(record.content) ? record.content : [];

    for (const part of content) {
      const contentPart = part as Record<string, unknown>;
      const text = contentPart.text;

      if (typeof text === 'string' && text.trim()) {
        return text;
      }
    }
  }

  return '';
}

function sanitizeRecipe(recipe: ImportedRecipeDraft): ImportedRecipeDraft {
  return {
    title: recipe.title?.trim() ?? '',
    description: recipe.description?.trim() ?? '',
    notes: recipe.notes?.trim() ?? '',
    servings: typeof recipe.servings === 'number' ? recipe.servings : null,
    prepTimeMinutes: typeof recipe.prepTimeMinutes === 'number' ? recipe.prepTimeMinutes : null,
    cookTimeMinutes: typeof recipe.cookTimeMinutes === 'number' ? recipe.cookTimeMinutes : null,
    category: recipe.category?.trim() ?? '',
    tags: Array.isArray(recipe.tags)
      ? recipe.tags
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean)
      : [],
    ingredients: Array.isArray(recipe.ingredients)
      ? recipe.ingredients
          .map((ingredient) => ({
            name: ingredient.name?.trim() ?? '',
            quantity: ingredient.quantity?.trim() || null,
            unit: normalizeIngredientUnit(ingredient.unit),
            notes: ingredient.notes?.trim() ?? '',
          }))
          .filter((ingredient) => ingredient.name)
      : [],
    steps: Array.isArray(recipe.steps)
      ? recipe.steps
          .map((step) => ({
            instruction: step.instruction?.trim() ?? '',
          }))
          .filter((step) => step.instruction)
      : [],
  };
}

function isProUser(user: { app_metadata?: unknown; user_metadata?: unknown }): boolean {
  const candidates = [
    getMetadataString(user.app_metadata, 'account_tier'),
    getMetadataString(user.app_metadata, 'tier'),
    getMetadataString(user.app_metadata, 'plan'),
    getMetadataString(user.user_metadata, 'account_tier'),
    getMetadataString(user.user_metadata, 'tier'),
    getMetadataString(user.user_metadata, 'plan'),
  ];

  return candidates.some((value) => value?.toLowerCase() === 'pro');
}

function getMetadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  const value = record[key];

  return typeof value === 'string' && value.trim() ? value : null;
}

function normalizeIngredientUnit(unit: string | undefined): string {
  const normalized = unit?.trim().toLowerCase() ?? '';

  if (!normalized) {
    return '';
  }

  if (
    [
      'g',
      'gr',
      'grs',
      'gram',
      'grams',
      'gramo',
      'gramos',
    ].includes(normalized)
  ) {
    return 'gr';
  }

  if (
    [
      'kg',
      'kilo',
      'kilos',
      'kilogram',
      'kilograms',
      'kilogramo',
      'kilogramos',
    ].includes(normalized)
  ) {
    return 'kg';
  }

  if (
    [
      'ml',
      'milliliter',
      'milliliters',
      'millilitre',
      'millilitres',
      'mililitro',
      'mililitros',
    ].includes(normalized)
  ) {
    return 'ml';
  }

  if (
    [
      'tbsp',
      'tablespoon',
      'tablespoons',
      'cda',
      'cdas',
      'cucharada',
      'cucharadas',
    ].includes(normalized)
  ) {
    return 'cda';
  }

  if (
    [
      'tsp',
      'teaspoon',
      'teaspoons',
      'cdta',
      'cdtas',
      'cucharadita',
      'cucharaditas',
    ].includes(normalized)
  ) {
    return 'cdta';
  }

  if (
    [
      'cup',
      'cups',
      'taza',
      'tazas',
    ].includes(normalized)
  ) {
    return 'taza';
  }

  if (
    [
      'unit',
      'units',
      'piece',
      'pieces',
      'unidad',
      'unidades',
      'clove',
      'cloves',
      'diente',
      'dientes',
      'slice',
      'slices',
      'rebanada',
      'rebanadas',
      'egg',
      'eggs',
      'huevo',
      'huevos',
    ].includes(normalized)
  ) {
    return 'unidad(s)';
  }

  if (
    [
      'gr',
      'kg',
      'ml',
      'cda',
      'cdta',
      'taza',
      'unidad(s)',
    ].includes(normalized)
  ) {
    return normalized;
  }

  return '';
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
