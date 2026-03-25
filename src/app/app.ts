import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { SeoService } from './core/seo/seo.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('recipe-app');

  authService = inject(AuthService);
  private readonly seoService = inject(SeoService);
  private readonly _themeService = inject(ThemeService);

  constructor() {
    this.seoService.init();
  }
}
