export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const IMAGE_OPTIMIZATION_OPTIONS = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.8,
  outputType: 'image/webp' as const,
};
