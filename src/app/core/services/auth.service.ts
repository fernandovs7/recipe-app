import { Injectable, signal } from '@angular/core';
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
  user = signal<User | null>(null);
  loading = signal(true);

  constructor() {
    this.initAuth();
  }

  private async initAuth(): Promise<void> {
    try {
      await setPersistence(auth, browserLocalPersistence);

      // Importante para completar correctamente el flujo redirect
      await getRedirectResult(auth).catch((error) => {
        console.error('Redirect result error:', error);
      });
    } catch (error) {
      console.error('Auth init error:', error);
    } finally {
      onAuthStateChanged(auth, (user) => {
        this.user.set(user);
        this.loading.set(false);
        console.log('Auth state changed:', user);
      });
    }
  }

  async loginWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();

    provider.setCustomParameters({
      prompt: 'select_account',
    });

    if (this.isMobileOrTablet()) {
      await signInWithRedirect(auth, provider);
      return;
    }

    await signInWithPopup(auth, provider);
  }

  async logout(): Promise<void> {
    await signOut(auth);
  }

  private isMobileOrTablet(): boolean {
    const userAgent = navigator.userAgent || navigator.vendor;

    return /iPhone|iPad|iPod|Android/i.test(userAgent);
  }
}
