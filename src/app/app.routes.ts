import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
import { authGuard } from './core/guads/auth-guard';
import { RecipesHome } from './features/recipes/pages/recipes-home/recipes-home';
import { AuthenticatedLayout } from './layout/authenticated-layout/authenticated-layout';
import { CreateRecipe } from './features/recipes/pages/create-recipe/create-recipe';
import { ViewRecipe } from './features/recipes/pages/view-recipe/view-recipe';
import { EditRecipe } from './features/recipes/pages/edit-recipe/edit-recipe';
import { RecipesList } from './features/recipes/pages/recipes-list/recipes-list';

export const routes: Routes = [
  {
    path: 'login',
    component: Login,
  },
  {
    path: 'app',
    canActivate: [authGuard],
    component: AuthenticatedLayout,
    children: [
      {
        path: 'home',
        component: RecipesHome,
      },
      {
        path: 'recipes',
        canActivate: [authGuard],
        component: RecipesList,
      },
      {
        path: 'recipes/new',
        canActivate: [authGuard],
        component: CreateRecipe,
      },
      {
        path: 'recipes/:id',
        canActivate: [authGuard],
        component: ViewRecipe,
      },
      {
        path: 'recipes/:id/edit',
        canActivate: [authGuard],
        component: EditRecipe,
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
