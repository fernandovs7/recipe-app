import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guads/auth-guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
    title: 'Inicia sesion',
    data: {
      seo: {
        description: 'Accede a tu recetario personal y organiza tus recetas favoritas.',
        robots: 'noindex,nofollow',
      },
    },
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/authenticated-layout/authenticated-layout').then(
        (m) => m.AuthenticatedLayout,
      ),
    title: 'Recetario',
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('./features/recipes/pages/recipes-home/recipes-home').then(
            (m) => m.RecipesHome,
          ),
        title: 'Inicio',
        data: {
          seo: {
            description:
              'Vista general de tu recetario con recetas recientes, favoritas y sugerencias para cocinar.',
          },
        },
      },
      {
        path: 'recipes',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/recipes/pages/recipes-list/recipes-list').then((m) => m.RecipesList),
        title: 'Todas las recetas',
        data: {
          seo: {
            description:
              'Explora, filtra y administra toda tu biblioteca personal de recetas en un solo lugar.',
          },
        },
      },
      {
        path: 'recipes/new',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/recipes/pages/create-recipe/create-recipe').then(
            (m) => m.CreateRecipe,
          ),
        title: 'Nueva receta',
        data: {
          seo: {
            description:
              'Crea una nueva receta con ingredientes, pasos, tiempos, tags e imagen.',
          },
        },
      },
      {
        path: 'recipes/:id',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/recipes/pages/view-recipe/view-recipe').then((m) => m.ViewRecipe),
        title: 'Detalle de receta',
        data: {
          seo: {
            description:
              'Consulta ingredientes, pasos, tiempos y notas de una receta guardada en tu recetario.',
          },
        },
      },
      {
        path: 'recipes/:id/edit',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/recipes/pages/edit-recipe/edit-recipe').then((m) => m.EditRecipe),
        title: 'Editar receta',
        data: {
          seo: {
            description:
              'Actualiza la informacion de una receta y mantén tu recetario siempre organizado.',
          },
        },
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: 'privacy',
    loadComponent: () =>
      import('./features/legal/legal-page/legal-page').then((m) => m.LegalPage),
    title: 'Politica de privacidad',
    data: {
      document: 'privacy',
      seo: {
        description:
          'Consulta como Cocinario App recopila, usa y protege la informacion relacionada con tu cuenta y tus recetas.',
      },
    },
  },
  {
    path: 'terms',
    loadComponent: () =>
      import('./features/legal/legal-page/legal-page').then((m) => m.LegalPage),
    title: 'Terminos del servicio',
    data: {
      document: 'terms',
      seo: {
        description:
          'Revisa las condiciones de uso de Cocinario App para gestionar tu recetario personal.',
      },
    },
  },
  {
    path: '',
    redirectTo: 'app',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'app',
  },
];
