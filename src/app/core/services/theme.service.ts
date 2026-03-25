import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'system';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'cocinario-theme';
  private mediaQueryList: MediaQueryList | null = null;
  private readonly handleSystemThemeChange = (event: MediaQueryListEvent) => {
    if (this.preference() === 'system') {
      this.systemMode.set(event.matches ? 'dark' : 'light');
    }
  };

  readonly preference = signal<ThemePreference>(this.resolveStoredPreference());
  readonly systemMode = signal<ThemeMode>(this.resolveSystemMode());
  readonly mode = computed<ThemeMode>(() => {
    const preference = this.preference();
    return preference === 'system' ? this.systemMode() : preference;
  });
  readonly isDark = computed(() => this.mode() === 'dark');

  constructor() {
    this.setupSystemThemeListener();

    effect(() => {
      this.applyTheme(this.mode());
    });
  }

  toggleTheme(): void {
    const nextMode = this.mode() === 'dark' ? 'light' : 'dark';
    this.setPreference(nextMode);
  }

  setPreference(preference: ThemePreference): void {
    this.preference.set(preference);
    this.persistPreference(preference);
  }

  private applyTheme(theme: ThemeMode): void {
    const root = this.document.documentElement;
    const metaThemeColor = this.document.querySelector('meta[name="theme-color"]');
    const themeColor = theme === 'dark' ? '#17110f' : '#fffaf4';

    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    metaThemeColor?.setAttribute('content', themeColor);
  }

  private resolveStoredPreference(): ThemePreference {
    if (typeof window === 'undefined') {
      return this.document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }

    const storedTheme = window.localStorage.getItem(this.storageKey);

    if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
      return storedTheme;
    }

    return 'system';
  }

  private resolveSystemMode(): ThemeMode {
    if (typeof window === 'undefined') {
      return this.document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private setupSystemThemeListener(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQueryList.addEventListener('change', this.handleSystemThemeChange);
  }

  private persistPreference(preference: ThemePreference): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(this.storageKey, preference);
  }
}
