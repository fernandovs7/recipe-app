import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.waitForAuthReady().then(() => {
    console.log('[auth-flow]', 'authGuard:evaluate', {
      path: state.url,
      hasUser: Boolean(authService.user()),
      loading: authService.loading(),
    });

    if (authService.user()) {
      return true;
    }

    console.log('[auth-flow]', 'authGuard:redirect-login', {
      path: state.url,
    });
    return router.createUrlTree(['/login']);
  });
};

export const guestGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.waitForAuthReady().then(() => {
    console.log('[auth-flow]', 'guestGuard:evaluate', {
      path: state.url,
      hasUser: Boolean(authService.user()),
      loading: authService.loading(),
    });

    if (authService.user()) {
      console.log('[auth-flow]', 'guestGuard:redirect-app', {
        path: state.url,
      });
      return router.createUrlTree(['/app']);
    }

    return true;
  });
};
