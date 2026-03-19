import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
import { authGuard, guestGuard } from './core/guads/auth-guard';
import { RecipesHome } from './features/recipes/pages/recipes-home/recipes-home';
import { AuthenticatedLayout } from './layout/authenticated-layout/authenticated-layout';
import { CreateRecipe } from './features/recipes/pages/create-recipe/create-recipe';
import { ViewRecipe } from './features/recipes/pages/view-recipe/view-recipe';
import { EditRecipe } from './features/recipes/pages/edit-recipe/edit-recipe';
import { RecipesList } from './features/recipes/pages/recipes-list/recipes-list';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    component: Login,
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
    component: AuthenticatedLayout,
    title: 'Recetario',
    children: [
      {
        path: 'home',
        component: RecipesHome,
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
        component: RecipesList,
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
        component: CreateRecipe,
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
        component: ViewRecipe,
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
        component: EditRecipe,
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
    path: '',
    redirectTo: 'app',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'app',
  },
];
