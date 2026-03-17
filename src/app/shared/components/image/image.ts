import { NgOptimizedImage } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { ImageData } from './image-data';

@Component({
  selector: 'app-image',
  imports: [NgOptimizedImage],
  templateUrl: './image.html',
  styleUrl: './image.scss',
})
export class ImageComponent {
  // Core image data travels together as a single object.
  image = input.required<ImageData>();

  // Optional behavior flags for fallback, loading, fit mode, and presentation.
  priority = input<boolean>(false);
  loading = input<'lazy' | 'eager'>('lazy');
  mode = input<'cover' | 'contain'>('cover');
  rounded = input<boolean>(false);
  decorative = input<boolean>(false);

  // Tracks when the main image fails so we can swap to the fallback source.
  hasError = signal(false);

  // Decorative images should not expose alternative text to assistive tech.
  resolvedAlt = computed(() => (this.decorative() ? '' : (this.image().alt ?? '')));

  // The raster source is used by the <img> fallback when AVIF/WebP are unavailable.
  rasterSrc = computed(() => this.image().fallback ?? `${this.image().src}.jpg`);
  fallbackSrc = computed(() => this.image().fallback ?? 'assets/images/shared/image-fallback.jpg');
  effectiveLoading = computed<'lazy' | 'eager'>(() =>
    this.priority() ? 'eager' : this.loading(),
  );
  fetchPriority = computed<'high' | 'auto'>(() => (this.priority() ? 'high' : 'auto'));

  // Maps component inputs to utility classes used by the template.
  objectClass = computed(() => (this.mode() === 'contain' ? 'object-contain' : 'object-cover'));
  roundedClass = computed(() => (this.rounded() ? 'rounded-xl' : ''));
  finalClass = computed(() => `${this.objectClass()} ${this.roundedClass()} w-full h-full`);

  // Builds the image sources assuming the same base path exists in multiple formats.
  imgSrc = computed(() => (this.hasError() ? this.fallbackSrc() : this.rasterSrc()));
  avifSrc = computed(() => `${this.image().src}.avif`);
  webpSrc = computed(() => `${this.image().src}.webp`);

  onError(): void {
    // When loading fails, switch the rendered JPG source to the fallback image.
    this.hasError.set(true);
  }
}
