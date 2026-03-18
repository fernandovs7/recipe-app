import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { filter } from 'rxjs';

export interface RouteSeoData {
  description?: string;
  robots?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SeoService {
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  private readonly appName = 'Cocinario App';
  private readonly defaultTitle = 'Tu recetario personal';
  private readonly defaultDescription =
    'Guarda recetas, organiza ingredientes y vuelve a tus platos favoritos en un solo lugar.';

  init(): void {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.applyRouteSeo());

    this.applyRouteSeo();
  }

  private applyRouteSeo(): void {
    const route = this.getDeepestRoute(this.router.routerState.snapshot.root);
    const routeTitle = route.title;
    const seo = (route.data['seo'] as RouteSeoData | undefined) ?? {};
    const resolvedTitle =
      typeof routeTitle === 'string' && routeTitle.trim()
        ? `${routeTitle} | ${this.appName}`
        : `${this.defaultTitle} | ${this.appName}`;
    const resolvedDescription = seo.description?.trim() || this.defaultDescription;
    const resolvedRobots = seo.robots?.trim() || 'index,follow';

    this.title.setTitle(resolvedTitle);
    this.meta.updateTag({ name: 'description', content: resolvedDescription });
    this.meta.updateTag({ name: 'robots', content: resolvedRobots });
    this.meta.updateTag({ property: 'og:title', content: resolvedTitle });
    this.meta.updateTag({ property: 'og:description', content: resolvedDescription });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
  }

  private getDeepestRoute(snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
    let current = snapshot;

    while (current.firstChild) {
      current = current.firstChild;
    }

    return current;
  }
}
