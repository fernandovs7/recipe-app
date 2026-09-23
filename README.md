# RecipeApp

RecipeApp is an Angular 21 personal recipe manager backed by Firebase. The active application uses Google Authentication, Firestore, Storage, Cloud Functions, and Firebase Hosting. Supabase is not part of the runtime; the remaining Supabase files and dependency exist only for historical migration tooling.

## Requirements

- Node.js 22.12.0, as pinned in `.nvmrc`, or Node.js 24.5.0 or newer. Angular build and serve can crash on Node 24.4.x.
- npm 11.4.2, as pinned in `package.json`.
- Firebase CLI for deployment and Firebase operations.

```bash
nvm use
npm ci
npm --prefix functions ci
```

## Development

Start the development server at `http://localhost:4200`:

```bash
npm start
```

Create a production build in `dist/recipe-app/browser`:

```bash
npm run build
```

Run unit tests once with Vitest:

```bash
npm test -- --watch=false
```

Run one test file or filter test names:

```bash
npm test -- --watch=false --include src/app/app.spec.ts
npm test -- --watch=false --filter '<regex>'
```

There is currently no lint script or end-to-end test target.

## Firebase architecture

The default Firebase project is `recipe-app-a7be0`, configured in `.firebaserc`.

- `src/environments/environment.ts` contains the public Firebase web configuration and the HTTPS endpoint for AI recipe import. The frontend does not load Firebase settings from `.env` files.
- `src/app/core/firebase.config.ts` initializes Auth, Firestore, and Storage.
- Recipes are stored at `users/{uid}/recipes/{recipeId}`; `users/{uid}` stores the `defaultRecipeSeeded` profile flag.
- Recipe images are stored under `recipes/{uid}/` as thumbnail, medium, and full WebP variants.
- `firestore.rules`, `firestore.indexes.json`, and `storage.rules` define the database and storage access policy.
- `functions/src/index.ts` implements the `importRecipeWithAi` Cloud Function. It validates the Firebase ID token and requires the custom claim `accountTier: "pro"`.
- `firebase.json` configures Functions, Firestore, Storage, and Hosting. Hosting serves `dist/recipe-app/browser` with an SPA rewrite.

The Firebase web API key is a public client identifier, not a server secret. Keep service-account files and `OPENAI_API_KEY` out of the frontend and out of version control.

## Deploy

Install the Firebase CLI if it is not already available, authenticate, and select the configured project:

```bash
npm install -g firebase-tools
firebase login
firebase use recipe-app-a7be0
```

Install dependencies and verify both builds:

```bash
nvm use
npm ci
npm --prefix functions ci
npm run build
npm --prefix functions run build
```

Set `OPENAI_API_KEY` before the first Functions deploy, and run the same command whenever the secret must be rotated:

```bash
firebase functions:secrets:set OPENAI_API_KEY
```

Deploy Hosting, Cloud Functions, Firestore rules and indexes, and Storage rules together:

```bash
firebase deploy
```

`firebase.json` also builds the Functions package automatically before a Functions deploy. For targeted deployments, use:

```bash
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules,firestore:indexes,storage
```

After the first Functions deploy, confirm that `environment.firebase.importRecipeUrl` matches the HTTPS endpoint reported for `importRecipeWithAi`. If it changes, update `src/environments/environment.ts`, rebuild the Angular app, and deploy Hosting again.

Google sign-in also requires the Google provider to be enabled and each deployed domain to be authorized in the Firebase console.

## Historical Supabase migration

The application no longer connects to Supabase. `scripts/migrate-supabase-to-firebase.mjs` remains only to copy historical Supabase users, recipes, images, and pro status into Firebase. It matches users by email; users must sign in to Firebase with Google at least once before they can be matched.

Always run a dry run first:

```bash
SUPABASE_URL="https://your-project.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
FIREBASE_SERVICE_ACCOUNT_PATH="./service-account.json" \
FIREBASE_STORAGE_BUCKET="recipe-app-a7be0.firebasestorage.app" \
npm run migrate:supabase-to-firebase -- --dry-run
```

Remove `--dry-run` only after reviewing the summary. `GOOGLE_APPLICATION_CREDENTIALS` can be used instead of `FIREBASE_SERVICE_ACCOUNT_PATH`. Supabase service-role keys and Firebase service-account files are server-only secrets.
