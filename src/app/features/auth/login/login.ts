import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ImageComponent } from '../../../shared/components/image/image';
import { ImageData } from '../../../shared/components/image/image-data';
import { IconComponent } from '../../../shared/components/icon/icon';

@Component({
  selector: 'app-login',
  imports: [ImageComponent, IconComponent, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private authService = inject(AuthService);
  private router = inject(Router);
  readonly currentYear = new Date().getFullYear();
  readonly errorMessage = signal<string | null>(null);

  heroImage: ImageData = {
    src: 'assets/images/shared/login-hero-image',
    alt: 'Imagen decorativa para la pantalla de inicio de sesion',
    width: 960,
    height: 1280,
    fallback: 'assets/images/shared/login.jpeg',
  };

  constructor() {
    effect(() => {
      if (this.authService.loading()) {
        return;
      }

      if (this.authService.user()) {
        this.router.navigate(['/app']);
      }
    });
  }

  async login() {
    this.errorMessage.set(null);

    try {
      await this.authService.loginWithGoogle();
    } catch (error) {
      console.error('Google sign-in failed', error);
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }

      if (code === 'auth/popup-blocked') {
        this.errorMessage.set(
          'El navegador bloqueó la ventana de Google. Permite ventanas emergentes e inténtalo de nuevo.',
        );
        return;
      }

      this.errorMessage.set('No se pudo iniciar sesión con Google. Inténtalo de nuevo.');
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
