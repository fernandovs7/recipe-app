import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { FloatingNav } from './floating-nav';

describe('FloatingNav', () => {
  let component: FloatingNav;
  let fixture: ComponentFixture<FloatingNav>;
  const authService = {
    user: signal(null),
    logout: vi.fn().mockResolvedValue(undefined),
  };
  const themeService = {
    preference: signal<'light' | 'dark' | 'system'>('light'),
    isDark: signal(false),
    toggleTheme: vi.fn(),
    setPreference: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FloatingNav],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: ThemeService, useValue: themeService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FloatingNav);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should keep menu and profile overlays mutually exclusive', () => {
    component.toggleMenu();
    expect(component.menuOpen()).toBe(true);

    component.toggleProfile();
    expect(component.menuOpen()).toBe(false);
    expect(component.profileOpen()).toBe(true);
  });
});
