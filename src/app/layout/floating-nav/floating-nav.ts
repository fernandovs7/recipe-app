import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../../shared/components/icon/icon';

@Component({
  selector: 'app-floating-nav',
  imports: [CommonModule, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './floating-nav.html',
  styleUrl: './floating-nav.scss',
})
export class FloatingNav {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  menuOpen = signal(false);
  profileOpen = signal(false);

  readonly navItems = [
    { label: 'Inicio', link: '/app/home', exact: true, icon: 'house' },
    { label: 'Recetas', link: '/app/recipes', exact: true, icon: 'book-open' },
    { label: 'Agregar Receta', link: '/app/recipes/new', exact: true, icon: 'square-pen' },
  ];

  readonly user = this.authService.user;

  toggleMenu(): void {
    this.menuOpen.update((value) => !value);
    if (this.menuOpen()) {
      this.closeProfile();
    }
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  toggleProfile(): void {
    this.closeMenu();
    this.profileOpen.update((value) => !value);
  }

  closeProfile(): void {
    this.profileOpen.set(false);
  }

  closeOverlays(): void {
    this.closeMenu();
    this.closeProfile();
  }

  async logout(): Promise<void> {
    await this.authService.logout();
    this.closeOverlays();
    await this.router.navigate(['/login']);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeOverlays();
    }
  }
}
