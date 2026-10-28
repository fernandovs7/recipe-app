import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';
import { SeoService } from './core/seo/seo.service';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';

describe('App', () => {
  const loading = signal(true);
  const authService = {
    loading,
    user: signal(null),
  };
  const seoService = { init: vi.fn() };

  beforeEach(async () => {
    loading.set(true);
    seoService.init.mockClear();

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: SeoService, useValue: seoService },
        { provide: ThemeService, useValue: {} },
      ],
    }).compileComponents();
  });

  it('should create the app and initialize SEO', () => {
    const fixture = TestBed.createComponent(App);

    expect(fixture.componentInstance).toBeTruthy();
    expect(seoService.init).toHaveBeenCalledOnce();
  });

  it('should render the loading state until authentication is ready', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Cargando...');

    loading.set(false);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
  });
});
