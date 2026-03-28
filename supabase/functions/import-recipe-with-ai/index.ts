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

    const payload = (await req.json()) as {
      rawText?: string;
      draft?: ImportedRecipeDraft;
      targetLanguage?: string;
    };

    const rawText = payload.rawText?.trim() ?? '';
    const draft = payload.draft;
    const targetLanguage = payload.targetLanguage?.trim() || 'es';

    if (!rawText || !draft) {
      return json({ error: 'Invalid payload' }, 400);
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
                  'You transform OCR-extracted recipe text into clean recipe JSON. If the source is in English, translate the final recipe to Spanish. Keep ingredient amounts faithful, keep culinary meaning natural, and do not invent missing data. Use concise neutral Spanish. Output only the schema fields.',
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: JSON.stringify({
                  targetLanguage,
                  draft,
                  rawText,
                  instructions: [
                    'Use the OCR text as the main source of truth.',
                    'Use the draft only as fallback scaffolding.',
                    'Return title, description, notes, ingredients and steps in Spanish when targetLanguage is es.',
                    'If a field is missing, return empty string, empty array, or null as appropriate.',
                    'Do not include markdown.',
                    'Do not merge ingredients with steps.',
                    'Normalize tags to lowercase ASCII words.',
                  ],
                }),
              },
            ],
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
            unit: ingredient.unit?.trim() ?? '',
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

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
