export interface OptimizeImageOptions {
  maxWidth: number;
  maxHeight?: number;
  quality: number;
  outputType?: 'image/webp' | 'image/jpeg';
}

export interface OptimizedImageResult {
  blob: Blob;
  width: number;
  height: number;
}

export const IMAGE_SIZES = {
  thumbnail: { maxWidth: 400, quality: 0.7 },
  medium: { maxWidth: 800, quality: 0.75 },
  full: { maxWidth: 1600, quality: 0.8 },
} as const;

export type ImageSizeKey = keyof typeof IMAGE_SIZES;

export async function optimizeImage(
  file: File | Blob,
  options: OptimizeImageOptions
): Promise<OptimizedImageResult> {
  const imageBitmap = await createImageBitmap(file);

  try {
    return await optimizeImageBitmap(imageBitmap, options);
  } finally {
    imageBitmap.close();
  }
}

export async function optimizeImageVariants(
  file: File | Blob,
  outputType: OptimizeImageOptions['outputType'] = 'image/webp',
): Promise<Record<ImageSizeKey, OptimizedImageResult>> {
  const imageBitmap = await createImageBitmap(file);

  try {
    const entries = await Promise.all(
      (Object.entries(IMAGE_SIZES) as [ImageSizeKey, (typeof IMAGE_SIZES)[ImageSizeKey]][]).map(
        async ([sizeKey, sizeOptions]) => [
          sizeKey,
          await optimizeImageBitmap(imageBitmap, {
            ...sizeOptions,
            maxHeight: sizeOptions.maxWidth,
            outputType,
          }),
        ],
      ),
    );

    return Object.fromEntries(entries) as Record<ImageSizeKey, OptimizedImageResult>;
  } finally {
    imageBitmap.close();
  }
}

async function optimizeImageBitmap(
  imageBitmap: ImageBitmap,
  options: OptimizeImageOptions,
): Promise<OptimizedImageResult> {
  const maxHeight = options.maxHeight ?? options.maxWidth;
  const { width, height } = resizeDimensions(
    imageBitmap.width,
    imageBitmap.height,
    options.maxWidth,
    maxHeight,
  );

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No se pudo crear el contexto del canvas');
  }

  ctx.drawImage(imageBitmap, 0, 0, width, height);

  const outputType = options.outputType ?? 'image/webp';

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, outputType, options.quality);
  });

  if (!blob) {
    throw new Error('No se pudo optimizar la imagen');
  }

  return {
    blob,
    width,
    height,
  };
}

function resizeDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const widthRatio = maxWidth / originalWidth;
  const heightRatio = maxHeight / originalHeight;
  const ratio = Math.min(widthRatio, heightRatio, 1);

  return {
    width: Math.round(originalWidth * ratio),
    height: Math.round(originalHeight * ratio),
  };
}
