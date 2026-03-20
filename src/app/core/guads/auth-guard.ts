import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.waitForAuthReady().then(() => {
    if (authService.user()) {
      return true;
    }

    return router.createUrlTree(['/login']);
  });
};

export const guestGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.waitForAuthReady().then(() => {
    if (authService.user()) {
      return router.createUrlTree(['/app']);
    }

    return true;
  });
};
