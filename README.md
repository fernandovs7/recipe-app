# RecipeApp

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.0.3.

## Node version

This project is most stable with Node.js `22.12.0` or newer `24.5.0+`.

If you hit crashes during `ng build` or `ng serve` with Node `24.4.x`, switch to the version in `.nvmrc`:

```bash
nvm use
```

Or install it first if needed:

```bash
nvm install
```

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Firebase setup

The app uses Firebase project `recipe-app-a7be0` for Auth, Firestore, Storage, Cloud Functions, and Hosting. Firestore does not pause for inactivity. Billing, Google sign-in, the authorized domains (`localhost`, `recipe-app-a7be0.web.app`, `recipe-app-a7be0.firebaseapp.com`, `cocinario.app`), the Firestore database, and the Storage bucket are already in place. The web config is in `src/environments/environment.ts`. Firestore and Storage rules are deployed from `firestore.rules` and `storage.rules`.

The import function still needs the OpenAI secret, then a functions deploy:

```bash
firebase functions:secrets:set OPENAI_API_KEY
firebase deploy --only functions
```

After that deploy, if Firebase prints a Cloud Run URL instead of the `cloudfunctions.net` URL, put that URL in `environment.firebase.importRecipeUrl`.

Pro access is the custom claim `accountTier: "pro"`. The migration script sets it for users who were pro in Supabase. The client cannot grant that claim to itself.

## Supabase to Firebase migration

Copy the live Supabase users, recipes, and images into Firebase. Match users by email. Someone who has not signed in to this Firebase project with Google yet is skipped; sign in once and run the script again. Re-running is safe: each recipe is written to `users/{firebaseUid}/recipes/{supabaseRecipeId}` with `legacySupabaseId`.

```bash
SUPABASE_URL="https://your-project.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
FIREBASE_SERVICE_ACCOUNT_PATH="./service-account.json" \
FIREBASE_STORAGE_BUCKET="recipe-app-a7be0.firebasestorage.app" \
npm run migrate:supabase-to-firebase -- --dry-run
```

Remove `--dry-run` for the real copy. The service-account JSON and the Supabase service-role key stay on the machine that runs the script. `GOOGLE_APPLICATION_CREDENTIALS` can be used instead of `FIREBASE_SERVICE_ACCOUNT_PATH`.

## Firebase to Supabase migration

To migrate historical data from Firebase into Supabase:

1. Add the legacy id column once in Supabase:

```sql
alter table public.recipes
add column if not exists legacy_firebase_id text unique;
```

2. Create a Firebase service account JSON with access to Firestore, Auth, and Storage.

3. Run a dry run first:

```bash
SUPABASE_URL="https://your-project.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
FIREBASE_SERVICE_ACCOUNT_PATH="./service-account.json" \
FIREBASE_STORAGE_BUCKET="recipe-app-a7be0.firebasestorage.app" \
npm run migrate:firebase-to-supabase -- --dry-run
```

4. If the dry run looks good, run the real migration:

```bash
SUPABASE_URL="https://your-project.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
FIREBASE_SERVICE_ACCOUNT_PATH="./service-account.json" \
FIREBASE_STORAGE_BUCKET="recipe-app-a7be0.firebasestorage.app" \
npm run migrate:firebase-to-supabase
```

Notes:

- The script matches Firebase users to Supabase users by email.
- Users who have not signed into Supabase yet will be skipped.
- Recipe images are copied from Firebase Storage into the Supabase `recipes` bucket.
- Re-running the script is safe after adding `legacy_firebase_id`, because it upserts on that field.
