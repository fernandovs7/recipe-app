# Repository Guide

## Toolchain and verification

- This is one Angular 21 application, not a multi-project workspace. Use npm; `package-lock.json` is authoritative and `package.json` pins npm 11.4.2.
- Use `nvm use` (Node 22.12.0). The README records Angular build/serve crashes on Node 24.4.x; if using Node 24, use 24.5.0 or newer.
- `npm start` serves the development build at `http://localhost:4200`; `npm run build` is the production build and writes `dist/recipe-app/browser`.
- Run all unit tests once with `npm test -- --watch=false`. Focus a file with `npm test -- --watch=false --include src/path/file.spec.ts` or test names with `--filter '<regex>'`.
- A focused test still compiles every file included by `tsconfig.spec.json`. Currently all test commands are blocked by stale scaffold imports in `auth.spec.ts`, `recipe.spec.ts`, and `image.spec.ts`; do not attribute those errors to unrelated changes.
- `npm run build` currently succeeds with pre-existing budget warnings for the initial bundle and `features/auth/login/login.scss`. `npx tsc -p tsconfig.app.json --noEmit` is the fast app-only typecheck.
- There is no lint script or configured e2e target.
- Prettier settings live in `package.json`: 100-column width, single quotes, and the Angular parser for HTML.

## Application boundaries

- `src/main.ts` bootstraps the standalone `App`; global providers are in `app.config.ts`, and `app.routes.ts` owns lazy feature entrypoints. Authenticated recipe pages are children of `/app`.
- `core/` owns Firebase, auth, theme, SEO, models, and browser utilities; `features/` owns user flows; `layout/` owns the authenticated shell; `shared/` owns reusable UI. The existing guard directory is misspelled `core/guads`; account for that path when searching or changing imports.
- Firebase project `recipe-app-a7be0` is the live backend: Google Auth, Firestore, Storage, and the `importRecipeWithAi` Cloud Function. The browser client reads the checked-in public web config from `src/environments/environment.ts`; there is no frontend `.env` loading or Angular file replacement.
- `RecipeService` is the persistence boundary. Recipes are camelCase documents at `users/{uid}/recipes/{recipeId}`. The profile document `users/{uid}` stores `defaultRecipeSeeded`. Images live at `recipes/{uid}/{assetId}-{thumbnail|medium|full}.webp` and are removed with the recipe. Keep the model, form mapping, and image cleanup paths in sync. Pro access is the custom claim `accountTier: "pro"`; do not let the client write it.
- Firestore and Storage rules are `firestore.rules` and `storage.rules`. A user can read and write only their own profile, recipes, and image prefix.
- AI image import calls `environment.firebase.importRecipeUrl`, implemented by `functions/src/index.ts`. The function checks the Firebase ID token and rejects users without the pro claim. `OPENAI_API_KEY` is a Functions secret.
- `functions/` is a separate Node 22 npm package with its own lockfile. Build it with `npm --prefix functions run build`; Firebase runs that build automatically before deploying Functions.
- Supabase is not part of the application runtime. The root `@supabase/supabase-js` dependency, `supabase/`, and both `scripts/*supabase*.mjs` files remain only as migration history. The app calls neither the old Deno function nor a Supabase client.
- `scripts/migrate-supabase-to-firebase.mjs` copies historical Supabase users, recipes, images, and pro status into Firebase by email. Run `npm run migrate:supabase-to-firebase -- --dry-run` first. `scripts/migrate-firebase-to-supabase.mjs` is the obsolete reverse script. Service-role keys and Firebase service-account JSON are server-only secrets.

## Repository conventions

- Treat `docs/best-practices.md` as the guidance for new Angular code even where older files differ: standalone is implicit (do not add `standalone: true`), use signals and `input()`/`output()`, `inject()`, native template control flow, `OnPush`, host metadata instead of `@HostListener`/`@HostBinding`, and class/style bindings instead of `ngClass`/`ngStyle`.
- New UI must meet the documented WCAG AA/AXE requirement. Use `NgOptimizedImage` for ordinary static images, but keep base64/data URLs and the existing responsive `<app-image>` pipeline on their purpose-built paths.
- Tailwind 4 is CSS-first: `src/tailwind.css` defines the theme fonts and class-based `.dark` variant and is loaded before `src/styles.scss`. Do not introduce a Tailwind config file merely to change these tokens.
- Firebase Hosting serves `dist/recipe-app/browser` with an SPA rewrite; keep that output path aligned with `angular.json` and `firebase.json`.
