import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import {
  GoogleAuthProvider,
  User,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { firebaseAuth } from '../firebase.config';

export interface FirebaseAuthClient {
  getRedirectResult(): Promise<void>;
  observeAuthState(callback: (user: User | null) => void): void;
  loginWithGoogle(): Promise<void>;
  logout(): Promise<void>;
}

export const FIREBASE_AUTH_CLIENT = new InjectionToken<FirebaseAuthClient>('FIREBASE_AUTH_CLIENT', {
  providedIn: 'root',
  factory: () => ({
    async getRedirectResult(): Promise<void> {
      await getRedirectResult(firebaseAuth);
    },
    observeAuthState(callback: (user: User | null) => void): void {
      onAuthStateChanged(firebaseAuth, callback);
    },
    async loginWithGoogle(): Promise<void> {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account',
      });
      await signInWithPopup(firebaseAuth, provider);
    },
    async logout(): Promise<void> {
      await signOut(firebaseAuth);
    },
  }),
});

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  accountTier: 'basic' | 'pro';
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly authClient = inject(FIREBASE_AUTH_CLIENT);
  user = signal<AuthUser | null>(null);
  loading = signal(true);
  private resolveAuthReady: (() => void) | null = null;
  private authReadyPromise = new Promise<void>((resolve) => {
    this.resolveAuthReady = resolve;
  });
  private authReadyResolved = false;

  constructor() {
    void this.initAuth();
  }

  waitForAuthReady(): Promise<void> {
    return this.authReadyPromise;
  }

  async loginWithGoogle(): Promise<'popup' | 'redirect'> {
    await this.authClient.loginWithGoogle();
    return 'popup';
  }

  async logout(): Promise<void> {
    await this.authClient.logout();
  }

  private async initAuth(): Promise<void> {
    try {
      await this.authClient.getRedirectResult();
    } catch (error) {
      console.error('Google sign-in redirect failed', error);
    }

    this.authClient.observeAuthState((user) => {
      void this.applyAuthUser(user);
    });
  }

  private async applyAuthUser(user: User | null): Promise<void> {
    try {
      if (!user) {
        this.user.set(null);
        return;
      }

      let accountTier: 'basic' | 'pro' = 'basic';

      try {
        const token = await user.getIdTokenResult();
        accountTier = token.claims['accountTier'] === 'pro' ? 'pro' : 'basic';
      } catch (error) {
        console.error('No se pudo leer el plan de la cuenta.', error);
      }

      this.user.set({
        uid: user.uid,
        displayName: user.displayName ?? user.email ?? null,
        email: user.email,
        photoURL: user.photoURL,
        accountTier,
      });
    } finally {
      this.markAuthReady();
    }
  }

  private markAuthReady(): void {
    if (this.authReadyResolved) {
      return;
    }

    this.authReadyResolved = true;
    this.loading.set(false);
    this.resolveAuthReady?.();
    this.resolveAuthReady = null;
  }
}
