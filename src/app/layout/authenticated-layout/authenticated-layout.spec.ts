import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { AuthenticatedLayout } from './authenticated-layout';

describe('AuthenticatedLayout', () => {
  let component: AuthenticatedLayout;
  let fixture: ComponentFixture<AuthenticatedLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthenticatedLayout],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            user: signal(null),
            logout: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ThemeService,
          useValue: {
            preference: signal('light'),
            isDark: signal(false),
            toggleTheme: vi.fn(),
            setPreference: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthenticatedLayout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create the authenticated shell', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-floating-nav')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
  });
});
