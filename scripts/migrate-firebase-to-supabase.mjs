import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';

const requiredEnv = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'FIREBASE_SERVICE_ACCOUNT_PATH',
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET ?? 'recipes';
const FIREBASE_STORAGE_BUCKET =
  process.env.FIREBASE_STORAGE_BUCKET ?? 'recipe-app-a7be0.firebasestorage.app';
const FIREBASE_COLLECTION = process.env.FIREBASE_COLLECTION ?? 'recipes';
const DRY_RUN = process.argv.includes('--dry-run');

const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: FIREBASE_STORAGE_BUCKET,
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

function buildSupabaseUserIndex(users) {
  const index = new Map();

  for (const user of users) {
    const email = user.email?.trim().toLowerCase();
    if (email) {
      index.set(email, user.id);
    }
  }

  return index;
}

async function resolveFirebaseUserProfile(uid, cache) {
  if (cache.has(uid)) {
    return cache.get(uid);
  }

  try {
    const user = await auth.getUser(uid);
    const profile = {
      uid,
      email: user.email?.trim().toLowerCase() ?? null,
    };
    cache.set(uid, profile);
    return profile;
  } catch (error) {
    console.warn(`Skipping Firebase auth lookup for ${uid}: ${error.message}`);
    const profile = { uid, email: null };
    cache.set(uid, profile);
    return profile;
  }
}

function mapRecipeRow(doc, supabaseUserId) {
  const data = doc.data();

  return {
    legacy_firebase_id: doc.id,
    user_id: supabaseUserId,
    title: data.title,
    description: data.description ?? null,
    notes: data.notes ?? null,
    ingredients: data.ingredients ?? [],
    steps: data.steps ?? [],
    image: data.image ?? null,
    servings: data.servings ?? null,
    prep_time_minutes: data.prepTimeMinutes ?? null,
    cook_time_minutes: data.cookTimeMinutes ?? null,
    total_time_minutes: data.totalTimeMinutes ?? null,
    category: data.category ?? null,
    tags: data.tags ?? [],
    favorite: Boolean(data.favorite),
    created_at: Number(data.createdAt ?? Date.now()),
    updated_at: Number(data.updatedAt ?? Date.now()),
  };
}

function collectImagePaths(image) {
  if (!image) {
    return [];
  }

  const paths = [image.path];

  for (const variant of Object.values(image.variants ?? {})) {
    if (variant?.path) {
      paths.push(variant.path);
    }
  }

  return [...new Set(paths.filter(Boolean))];
}

async function migrateStorageObject(objectPath) {
  const sourceFile = bucket.file(objectPath);
  const [exists] = await sourceFile.exists();

  if (!exists) {
    console.warn(`Storage object not found in Firebase: ${objectPath}`);
    return;
  }

  if (DRY_RUN) {
    return;
  }

  const [buffer] = await sourceFile.download();
  const [metadata] = await sourceFile.getMetadata();
  const contentType = metadata.contentType ?? 'application/octet-stream';
  const cacheControl = metadata.cacheControl ?? 'public,max-age=31536000,immutable';

  const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(objectPath, buffer, {
    contentType,
    cacheControl,
    upsert: true,
  });

  if (error) {
    throw error;
  }
}

async function buildSupabaseImage(image) {
  if (!image) {
    return null;
  }

  for (const imagePath of collectImagePaths(image)) {
    await migrateStorageObject(imagePath);
  }

  const toPublicUrl = (objectPath) => {
    const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(objectPath);
    return data.publicUrl;
  };

  return {
    ...image,
    url: image.path ? toPublicUrl(image.path) : image.url,
    variants: image.variants
      ? Object.fromEntries(
          Object.entries(image.variants).map(([key, variant]) => [
            key,
            variant
              ? {
                  ...variant,
                  url: variant.path ? toPublicUrl(variant.path) : variant.url,
                }
              : variant,
          ]),
        )
      : image.variants,
  };
}

async function main() {
  const supabaseUsers = await listAllSupabaseUsers();
  const supabaseUserIndex = buildSupabaseUserIndex(supabaseUsers);
  const firebaseUserCache = new Map();

  const snapshot = await firestore.collection(FIREBASE_COLLECTION).get();
  const summary = {
    total: snapshot.size,
    migrated: 0,
    skipped: 0,
    skippedMissingUser: 0,
  };

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const firebaseUserId = String(data.userId ?? '');

    if (!firebaseUserId) {
      console.warn(`Skipping recipe ${doc.id}: missing userId`);
      summary.skipped += 1;
      continue;
    }

    const firebaseUser = await resolveFirebaseUserProfile(firebaseUserId, firebaseUserCache);
    const supabaseUserId = firebaseUser.email ? supabaseUserIndex.get(firebaseUser.email) : null;

    if (!supabaseUserId) {
      console.warn(
        `Skipping recipe ${doc.id}: no Supabase user found for Firebase user ${firebaseUserId} (${firebaseUser.email ?? 'no-email'})`,
      );
      summary.skipped += 1;
      summary.skippedMissingUser += 1;
      continue;
    }

    const image = await buildSupabaseImage(data.image ?? null);
    const row = mapRecipeRow(doc, supabaseUserId);
    row.image = image;

    if (DRY_RUN) {
      console.log(`[dry-run] Would migrate recipe ${doc.id} -> user ${supabaseUserId}`);
      summary.migrated += 1;
      continue;
    }

    const { error } = await supabase.from('recipes').upsert(row, {
      onConflict: 'legacy_firebase_id',
    });

    if (error) {
      throw error;
    }

    console.log(`Migrated recipe ${doc.id}`);
    summary.migrated += 1;
  }

  console.log('\nMigration summary');
  console.log(JSON.stringify(summary, null, 2));
}

await main();
