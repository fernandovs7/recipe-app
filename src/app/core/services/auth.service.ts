import { Injectable, signal } from '@angular/core';
import {
  GoogleAuthProvider,
  User,
  getRedirectResult,
  onAuthStateChanged,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { firebaseAuth } from '../firebase.config';

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
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account',
    });

    await signInWithRedirect(firebaseAuth, provider);
    return 'redirect';
  }

  async logout(): Promise<void> {
    await signOut(firebaseAuth);
  }

  private async initAuth(): Promise<void> {
    try {
      await getRedirectResult(firebaseAuth);
    } catch (error) {
      console.error('Google sign-in redirect failed', error);
    }

    onAuthStateChanged(firebaseAuth, (user) => {
      void this.applyAuthUser(user);
    });
  }

  private async applyAuthUser(user: User | null): Promise<void> {
    try {
      if (!user) {
        this.user.set(null);
        return;
      }

      const token = await user.getIdTokenResult();
      const accountTier = token.claims['accountTier'] === 'pro' ? 'pro' : 'basic';

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
