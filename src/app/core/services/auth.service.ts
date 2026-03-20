import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  GoogleAuthProvider,
  User,
  browserLocalPersistence,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase.config';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private router = inject(Router);
  user = signal<User | null>(null);
  loading = signal(true);
  private resolveAuthReady: (() => void) | null = null;
  private authReadyPromise = new Promise<void>((resolve) => {
    this.resolveAuthReady = resolve;
  });
  private authStateResolved = false;
  private redirectResultChecked = false;

  constructor() {
    onAuthStateChanged(auth, (user) => {
      this.user.set(user);
      this.authStateResolved = true;
      this.markAuthReadyIfPossible();
    });

    this.initAuth();
  }

  private async initAuth(): Promise<void> {
    try {
      await setPersistence(auth, browserLocalPersistence);

      // Importante para completar correctamente el flujo redirect
      const redirectResult = await getRedirectResult(auth).catch(() => null);

      if (redirectResult?.user) {
        this.user.set(redirectResult.user);
        await this.router.navigate(['/app']);
      }
    } finally {
      this.redirectResultChecked = true;
      this.markAuthReadyIfPossible();
    }
  }

  waitForAuthReady(): Promise<void> {
    return this.authReadyPromise;
  }

  private markAuthReadyIfPossible(): void {
    if (!this.authStateResolved || !this.redirectResultChecked) {
      return;
    }

    this.loading.set(false);
    this.resolveAuthReady?.();
    this.resolveAuthReady = null;
  }

  async loginWithGoogle(): Promise<'popup' | 'redirect'> {
    const provider = new GoogleAuthProvider();

    provider.setCustomParameters({
      prompt: 'select_account',
    });

    try {
      await signInWithPopup(auth, provider);
      return 'popup';
    } catch (error) {
      const errorCode =
        typeof error === 'object' && error && 'code' in error ? String(error.code) : 'unknown';

      const shouldFallbackToRedirect =
        errorCode === 'auth/popup-blocked' ||
        errorCode === 'auth/operation-not-supported-in-this-environment' ||
        errorCode === 'auth/popup-closed-by-user';

      if (!shouldFallbackToRedirect) {
        throw error;
      }
    }

    await signInWithRedirect(auth, provider);
    return 'redirect';
  }

  async logout(): Promise<void> {
    await signOut(auth);
  }
  private isMobileOrTablet(): boolean {
    const userAgent = navigator.userAgent || navigator.vendor;

    return /iPhone|iPad|iPod|Android/i.test(userAgent);
  }
}
