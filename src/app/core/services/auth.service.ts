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
  private readonly logPrefix = '[auth-flow]';
  user = signal<User | null>(null);
  loading = signal(true);
  private resolveAuthReady: (() => void) | null = null;
  private authReadyPromise = new Promise<void>((resolve) => {
    this.resolveAuthReady = resolve;
  });
  private authStateResolved = false;
  private redirectResultChecked = false;

  constructor() {
    console.log(this.logPrefix, 'service:init', {
      path: window.location.pathname,
      search: window.location.search,
    });

    onAuthStateChanged(auth, (user) => {
      this.user.set(user);
      this.authStateResolved = true;
      this.markAuthReadyIfPossible();
      console.log(this.logPrefix, 'onAuthStateChanged', {
        uid: user?.uid ?? null,
        email: user?.email ?? null,
        path: window.location.pathname,
      });
    });

    this.initAuth();
  }

  private async initAuth(): Promise<void> {
    try {
      console.log(this.logPrefix, 'initAuth:start');
      await setPersistence(auth, browserLocalPersistence);
      console.log(this.logPrefix, 'initAuth:persistence-set');

      // Importante para completar correctamente el flujo redirect
      const redirectResult = await getRedirectResult(auth).catch((error) => {
        console.error(this.logPrefix, 'getRedirectResult:error', error);
        return null;
      });

      console.log(this.logPrefix, 'getRedirectResult:resolved', {
        hasResult: Boolean(redirectResult),
        uid: redirectResult?.user?.uid ?? null,
        email: redirectResult?.user?.email ?? null,
        operationType: redirectResult?.operationType ?? null,
      });

      if (redirectResult?.user) {
        this.user.set(redirectResult.user);
        console.log(this.logPrefix, 'getRedirectResult:navigate-app');
        await this.router.navigate(['/app']);
      }
    } catch (error) {
      console.error(this.logPrefix, 'initAuth:error', error);
    } finally {
      this.redirectResultChecked = true;
      console.log(this.logPrefix, 'initAuth:finally', {
        authStateResolved: this.authStateResolved,
        redirectResultChecked: this.redirectResultChecked,
      });
      this.markAuthReadyIfPossible();
    }
  }

  waitForAuthReady(): Promise<void> {
    return this.authReadyPromise;
  }

  private markAuthReadyIfPossible(): void {
    if (!this.authStateResolved || !this.redirectResultChecked) {
      console.log(this.logPrefix, 'markAuthReadyIfPossible:waiting', {
        authStateResolved: this.authStateResolved,
        redirectResultChecked: this.redirectResultChecked,
      });
      return;
    }

    this.loading.set(false);
    console.log(this.logPrefix, 'markAuthReadyIfPossible:ready', {
      uid: this.user()?.uid ?? null,
      path: window.location.pathname,
    });
    this.resolveAuthReady?.();
    this.resolveAuthReady = null;
  }

  async loginWithGoogle(): Promise<'popup' | 'redirect'> {
    const provider = new GoogleAuthProvider();

    provider.setCustomParameters({
      prompt: 'select_account',
    });

    try {
      console.log(this.logPrefix, 'loginWithGoogle:popup-attempt', {
        mobileOrTablet: this.isMobileOrTablet(),
      });
      await signInWithPopup(auth, provider);
      console.log(this.logPrefix, 'loginWithGoogle:popup-success');
      return 'popup';
    } catch (error) {
      const errorCode =
        typeof error === 'object' && error && 'code' in error ? String(error.code) : 'unknown';

      console.warn(this.logPrefix, 'loginWithGoogle:popup-error', {
        code: errorCode,
        error,
      });

      const shouldFallbackToRedirect =
        errorCode === 'auth/popup-blocked' ||
        errorCode === 'auth/operation-not-supported-in-this-environment' ||
        errorCode === 'auth/popup-closed-by-user';

      if (!shouldFallbackToRedirect) {
        throw error;
      }
    }

    console.log(this.logPrefix, 'loginWithGoogle:redirect-fallback');
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
