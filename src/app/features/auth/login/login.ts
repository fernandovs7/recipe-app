import { Component, effect, inject } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';
import { ImageComponent } from '../../../shared/components/image/image';
import { ImageData } from '../../../shared/components/image/image-data';
import { IconComponent } from '../../../shared/components/icon/icon';

@Component({
  selector: 'app-login',
  imports: [ImageComponent, IconComponent],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private authService = inject(AuthService);
  private router = inject(Router);
  readonly currentYear = new Date().getFullYear();

  heroImage: ImageData = {
    src: 'assets/images/shared/login-hero-image',
    alt: 'Imagen decorativa para la pantalla de inicio de sesion',
    width: 960,
    height: 1280,
    fallback: 'assets/images/shared/login.jpeg',
  };

  constructor() {
    effect(() => {
      console.log('[auth-flow]', 'login:effect', {
        loading: this.authService.loading(),
        hasUser: Boolean(this.authService.user()),
        path: window.location.pathname,
      });

      if (this.authService.loading()) {
        return;
      }

      if (this.authService.user()) {
        console.log('[auth-flow]', 'login:effect:navigate-app');
        this.router.navigate(['/app']);
      }
    });
  }

  async login() {
    console.log('[auth-flow]', 'login:click');
    const result = await this.authService.loginWithGoogle();

    if (result === 'popup') {
      console.log('[auth-flow]', 'login:popup:navigate-app');
      this.router.navigate(['/app']);
    }
  }

  logout() {
    this.authService.logout();
     this.router.navigate(['/login']);
  }
}
