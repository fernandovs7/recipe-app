import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';

import { AuthUser, AuthService } from '../services/auth.service';
import { authGuard, guestGuard } from './auth-guard';

describe('authentication guards', () => {
  const user = signal<AuthUser | null>(null);
  const authService = {
    user,
    waitForAuthReady: vi.fn().mockResolvedValue(undefined),
  };

  const executeGuard = (guard: CanActivateFn): Promise<boolean | UrlTree> =>
    TestBed.runInInjectionContext(
      () =>
        guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot) as Promise<
          boolean | UrlTree
        >,
    );

  beforeEach(() => {
    user.set(null);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }],
    });
  });

  it('allows authenticated users into protected routes', async () => {
    user.set({
      uid: 'user-1',
      displayName: 'Ada',
      email: 'ada@example.com',
      photoURL: null,
      accountTier: 'basic',
    });

    await expect(executeGuard(authGuard)).resolves.toBe(true);
  });

  it('redirects unauthenticated users to login', async () => {
    const result = await executeGuard(authGuard);
    expect((result as UrlTree).toString()).toBe('/login');
  });

  it('allows unauthenticated users into guest routes', async () => {
    await expect(executeGuard(guestGuard)).resolves.toBe(true);
  });

  it('redirects authenticated users away from guest routes', async () => {
    user.set({
      uid: 'user-1',
      displayName: 'Ada',
      email: 'ada@example.com',
      photoURL: null,
      accountTier: 'pro',
    });

    const result = await executeGuard(guestGuard);
    expect((result as UrlTree).toString()).toBe('/app');
  });
});
