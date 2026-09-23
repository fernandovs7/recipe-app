import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

if (!process.env.FIREBASE_SERVICE_ACCOUNT_PATH && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error('Set FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS');
}

const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET ?? 'recipes';
const FIREBASE_STORAGE_BUCKET =
  process.env.FIREBASE_STORAGE_BUCKET ?? 'recipe-app-a7be0.firebasestorage.app';
const DRY_RUN = process.argv.includes('--dry-run');

const credential = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  ? admin.credential.cert(
      JSON.parse(await readFile(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH), 'utf8')),
    )
  : admin.credential.applicationDefault();

admin.initializeApp({
  credential,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  projectId: 'recipe-app-a7be0',
});

const firestore = admin.firestore();
const auth = admin.auth();
const bucket = admin.storage().bucket();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const copiedObjects = new Map();

async function listAllSupabaseUsers() {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw error;
    }

    const batch = data?.users ?? [];
    users.push(...batch);

    if (batch.length < 1000) {
      break;
    }

    page += 1;
  }

  return users;
}

async function listRecipesForUser(userId) {
  const recipes = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', userId)
      .range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    const batch = data ?? [];
    recipes.push(...batch);

    if (batch.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return recipes;
}

function metadataString(metadata, key) {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function isProUser(user) {
  const candidates = [
    metadataString(user.app_metadata, 'account_tier'),
    metadataString(user.app_metadata, 'tier'),
    metadataString(user.app_metadata, 'plan'),
    metadataString(user.user_metadata, 'account_tier'),
    metadataString(user.user_metadata, 'tier'),
    metadataString(user.user_metadata, 'plan'),
  ];

  return candidates.some((value) => value?.toLowerCase() === 'pro');
}

function isManagedStoragePath(objectPath) {
  return typeof objectPath === 'string' && objectPath.startsWith('recipes/');
}

function remapStoragePath(objectPath, supabaseUserId, firebaseUserId) {
  const prefix = `recipes/${supabaseUserId}/`;

  if (objectPath.startsWith(prefix)) {
    return `recipes/${firebaseUserId}/${objectPath.slice(prefix.length)}`;
  }

  const fileName = objectPath.split('/').pop();
  return `recipes/${firebaseUserId}/${fileName}`;
}

function contentTypeForPath(objectPath) {
  if (objectPath.endsWith('.webp')) {
    return 'image/webp';
  }

  if (objectPath.endsWith('.jpg') || objectPath.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  if (objectPath.endsWith('.png')) {
    return 'image/png';
  }

  return 'application/octet-stream';
}

function firebaseDownloadUrl(objectPath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}

async function copyStorageObject(sourcePath, destPath, summary) {
  const cacheKey = `${sourcePath}=>${destPath}`;

  if (copiedObjects.has(cacheKey)) {
    return copiedObjects.get(cacheKey);
  }

  if (DRY_RUN) {
    console.log(`[dry-run] Would copy storage ${sourcePath} -> ${destPath}`);
    copiedObjects.set(cacheKey, null);
    summary.images += 1;
    return null;
  }

  const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).download(sourcePath);

  if (error || !data) {
    console.warn(`Storage object not found in Supabase: ${sourcePath}`);
    copiedObjects.set(cacheKey, null);
    return null;
  }

  const token = randomUUID();
  const buffer = Buffer.from(await data.arrayBuffer());

  await bucket.file(destPath).save(buffer, {
    resumable: false,
    metadata: {
      contentType: contentTypeForPath(destPath),
      cacheControl: 'public, max-age=31536000',
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  const url = firebaseDownloadUrl(destPath, token);
  copiedObjects.set(cacheKey, url);
  summary.images += 1;
  return url;
}

async function rewriteImage(image, supabaseUserId, firebaseUserId, summary) {
  if (!image) {
    return null;
  }

  const next = { ...image };

  if (isManagedStoragePath(image.path)) {
    const path = remapStoragePath(image.path, supabaseUserId, firebaseUserId);
    const url = await copyStorageObject(image.path, path, summary);
    next.path = path;
    next.url = url ?? image.url;
  }

  if (!image.variants) {
    return next;
  }

  const variants = {};

  for (const [key, variant] of Object.entries(image.variants)) {
    if (!variant || !isManagedStoragePath(variant.path)) {
      variants[key] = variant;
      continue;
    }

    const path = remapStoragePath(variant.path, supabaseUserId, firebaseUserId);
    const url = await copyStorageObject(variant.path, path, summary);
    variants[key] = {
      ...variant,
      path,
      url: url ?? variant.url,
    };
  }

  next.variants = variants;
  return next;
}

function mapRecipeDocument(row, firebaseUserId, image) {
  return {
    legacySupabaseId: row.id,
    userId: firebaseUserId,
    title: row.title ?? '',
    description: row.description ?? null,
    notes: row.notes ?? null,
    ingredients: row.ingredients ?? [],
    steps: row.steps ?? [],
    image,
    servings: row.servings ?? null,
    prepTimeMinutes: row.prep_time_minutes ?? null,
    cookTimeMinutes: row.cook_time_minutes ?? null,
    totalTimeMinutes: row.total_time_minutes ?? null,
    category: row.category ?? null,
    tags: row.tags ?? [],
    favorite: Boolean(row.favorite),
    createdAt: Number(row.created_at ?? Date.now()),
    updatedAt: Number(row.updated_at ?? Date.now()),
  };
}

async function setProClaim(uid) {
  const user = await auth.getUser(uid);
  await auth.setCustomUserClaims(uid, {
    ...(user.customClaims ?? {}),
    accountTier: 'pro',
  });
}

async function main() {
  const supabaseUsers = await listAllSupabaseUsers();
  const summary = {
    users: supabaseUsers.length,
    matched: 0,
    skippedMissingFirebaseUser: 0,
    proClaims: 0,
    recipes: 0,
    images: 0,
  };

  for (const user of supabaseUsers) {
    const email = user.email?.trim().toLowerCase();

    if (!email) {
      console.warn(`Skipping Supabase user ${user.id}: no email`);
      summary.skippedMissingFirebaseUser += 1;
      continue;
    }

    let firebaseUser;

    try {
      firebaseUser = await auth.getUserByEmail(email);
    } catch (error) {
      if (error?.code === 'auth/user-not-found') {
        console.warn(
          `Skipping ${email}: no Firebase Auth user yet. Sign in with Google, then re-run.`,
        );
        summary.skippedMissingFirebaseUser += 1;
        continue;
      }

      throw error;
    }

    summary.matched += 1;
    const recipes = await listRecipesForUser(user.id);
    const defaultRecipeSeeded = user.user_metadata?.default_recipe_seeded === true;

    if (DRY_RUN) {
      console.log(
        `[dry-run] Would copy ${recipes.length} recipe(s) for ${email} -> users/${firebaseUser.uid}`,
      );
    } else {
      await firestore
        .collection('users')
        .doc(firebaseUser.uid)
        .set({ defaultRecipeSeeded }, { merge: true });
    }

    if (isProUser(user)) {
      if (DRY_RUN) {
        console.log(`[dry-run] Would set pro claim for ${email}`);
      } else {
        await setProClaim(firebaseUser.uid);
      }

      summary.proClaims += 1;
    }

    for (const row of recipes) {
      const image = await rewriteImage(row.image ?? null, user.id, firebaseUser.uid, summary);
      const document = mapRecipeDocument(row, firebaseUser.uid, image);

      if (DRY_RUN) {
        console.log(
          `[dry-run] Would upsert users/${firebaseUser.uid}/recipes/${row.id} (${document.title})`,
        );
      } else {
        await firestore
          .collection('users')
          .doc(firebaseUser.uid)
          .collection('recipes')
          .doc(row.id)
          .set(document);
        console.log(`Copied recipe ${row.id} -> users/${firebaseUser.uid}/recipes/${row.id}`);
      }

      summary.recipes += 1;
    }
  }

  console.log(`\n${DRY_RUN ? 'Dry run' : 'Migration'} summary`);
  console.log(JSON.stringify(summary, null, 2));
}

await main();
