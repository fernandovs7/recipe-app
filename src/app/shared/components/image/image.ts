import { Component, computed, effect, input, signal } from '@angular/core';
import { ImageData } from './image-data';

@Component({
  selector: 'app-image',
  templateUrl: './image.html',
  styleUrl: './image.scss',
})
export class ImageComponent {
  private static readonly loadedImageUrls = new Set<string>();

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
  isLoaded = signal(false);
  hasTerminalError = signal(false);
  private lastImageKey: string | null = null;

  // Decorative images should not expose alternative text to assistive tech.
  resolvedAlt = computed(() => (this.decorative() ? '' : (this.image().alt ?? '')));

  fallbackSrc = computed(() => this.image().fallback ?? 'assets/images/shared/image-fallback.png');
  usesGeneratedSources = computed(() => this.shouldUseGeneratedSources(this.image().src));
  primarySrc = computed(() =>
    this.usesGeneratedSources() ? `${this.image().src}.jpg` : this.image().src,
  );
  resolvedSizes = computed(() => this.image().sizes ?? '100vw');
  effectiveLoading = computed<'lazy' | 'eager'>(() =>
    this.priority() ? 'eager' : this.loading(),
  );
  fetchPriority = computed<'high' | 'auto'>(() => (this.priority() ? 'high' : 'auto'));

  // Maps component inputs to utility classes used by the template.
  objectClass = computed(() => (this.mode() === 'contain' ? 'object-contain' : 'object-cover'));
  roundedClass = computed(() => (this.rounded() ? 'rounded-xl' : ''));
  finalClass = computed(() => `${this.objectClass()} ${this.roundedClass()} w-full h-full`);

  // Builds the image sources assuming the same base path exists in multiple formats.
  imgSrc = computed(() => (this.hasError() ? this.fallbackSrc() : this.primarySrc()));
  imgSrcSet = computed(() => (this.hasError() ? null : (this.image().srcset ?? null)));
  avifSrc = computed(() => `${this.image().src}.avif`);
  webpSrc = computed(() => `${this.image().src}.webp`);

  constructor() {
    effect(() => {
      const image = this.image();
      const nextImageKey = `${image.src}|${image.fallback ?? ''}`;

      if (this.lastImageKey === nextImageKey) {
        return;
      }

      this.lastImageKey = nextImageKey;
      this.hasError.set(false);
      this.hasTerminalError.set(false);
      this.isLoaded.set(ImageComponent.loadedImageUrls.has(this.primarySrc()));
    });
  }

  onLoad(): void {
    ImageComponent.loadedImageUrls.add(this.imgSrc());
    this.isLoaded.set(true);
  }

  onError(): void {
    // First failure swaps to the fallback. If that also fails, stop the loading shimmer.
    if (this.hasError()) {
      this.hasTerminalError.set(true);
      return;
    }

    this.hasError.set(true);
    this.isLoaded.set(false);
  }

  private shouldUseGeneratedSources(src: string): boolean {
    return !/^https?:\/\//i.test(src) && !/\.[a-z0-9]+(?:$|\?)/i.test(src);
  }
}
