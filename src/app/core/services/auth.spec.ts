import { TestBed } from '@angular/core/testing';
import type { User } from 'firebase/auth';

import { AuthService, FIREBASE_AUTH_CLIENT, FirebaseAuthClient } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let authStateChanged: (user: User | null) => void;
  let authClient: FirebaseAuthClient;

  beforeEach(async () => {
    authClient = {
      getRedirectResult: vi.fn().mockResolvedValue(undefined),
      observeAuthState: vi.fn((callback) => {
        authStateChanged = callback;
      }),
      loginWithGoogle: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: FIREBASE_AUTH_CLIENT, useValue: authClient }],
    });
    service = TestBed.inject(AuthService);

    await vi.waitFor(() => expect(authClient.observeAuthState).toHaveBeenCalledOnce());
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
    expect(service.loading()).toBe(true);
  });

  it('should expose an authenticated pro user and finish loading', async () => {
    authStateChanged({
      uid: 'user-1',
      displayName: 'Ada Lovelace',
      email: 'ada@example.com',
      photoURL: null,
      getIdTokenResult: vi.fn().mockResolvedValue({ claims: { accountTier: 'pro' } }),
    } as unknown as User);

    await vi.waitFor(() => expect(service.loading()).toBe(false));

    expect(service.user()).toEqual({
      uid: 'user-1',
      displayName: 'Ada Lovelace',
      email: 'ada@example.com',
      photoURL: null,
      accountTier: 'pro',
    });
  });

  it('should sign in and sign out through Firebase Auth', async () => {
    await expect(service.loginWithGoogle()).resolves.toBe('popup');
    await service.logout();

    expect(authClient.loginWithGoogle).toHaveBeenCalledOnce();
    expect(authClient.logout).toHaveBeenCalledOnce();
  });
});
