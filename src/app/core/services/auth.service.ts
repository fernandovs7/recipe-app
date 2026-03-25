import { Injectable, inject, signal } from '@angular/core';
import { AuthChangeEvent, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../supabase.config';

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
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
    supabase.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
      if (event === 'SIGNED_OUT') {
        this.user.set(null);
      } else {
        this.user.set(this.mapUser(session?.user ?? null));
      }

      this.markAuthReady();
    });

    this.initAuth();
  }

  private async initAuth(): Promise<void> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      this.user.set(this.mapUser(session?.user ?? null));
    } finally {
      this.markAuthReady();
    }
  }

  waitForAuthReady(): Promise<void> {
    return this.authReadyPromise;
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

  async loginWithGoogle(): Promise<'popup' | 'redirect'> {
    const redirectTo = `${window.location.origin}/app`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      throw error;
    }

    return 'redirect';
  }

  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  }

  private mapUser(user: SupabaseUser | null): AuthUser | null {
    if (!user) {
      return null;
    }

    const metadata = user.user_metadata;
    const displayName =
      this.getMetadataString(metadata, 'full_name') ??
      this.getMetadataString(metadata, 'name') ??
      this.getMetadataString(metadata, 'user_name') ??
      user.email ??
      null;
    const photoURL =
      this.getMetadataString(metadata, 'avatar_url') ??
      this.getMetadataString(metadata, 'picture') ??
      null;

    return {
      uid: user.id,
      displayName,
      email: user.email ?? null,
      photoURL,
    };
  }

  private getMetadataString(metadata: unknown, key: string): string | null {
    if (!metadata || typeof metadata !== 'object') {
      return null;
    }

    const record = metadata as Record<string, unknown>;
    const value = record[key];
    return typeof value === 'string' && value.trim() ? value : null;
  }
}
