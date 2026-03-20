export interface OptimizeImageOptions {
  maxWidth: number;
  maxHeight?: number;
  quality: number;
  minQuality?: number;
  maxBytes?: number;
  outputType?: 'image/webp' | 'image/jpeg';
}

export interface OptimizedImageResult {
  blob: Blob;
  width: number;
  height: number;
}

interface ImageSizeConfig {
  maxWidth: number;
  maxHeight?: number;
  quality: number;
  minQuality: number;
  maxBytes: number;
}

const KiB = 1024;
const QUALITY_STEP = 0.06;
const RESIZE_STEP = 0.9;
const MIN_DIMENSION_RATIO = 0.82;

export const IMAGE_SIZES = {
  thumbnail: { maxWidth: 320, quality: 0.72, minQuality: 0.58, maxBytes: 45 * KiB },
  medium: { maxWidth: 720, quality: 0.74, minQuality: 0.6, maxBytes: 140 * KiB },
  full: {
    maxWidth: 1800,
    maxHeight: 2200,
    quality: 0.84,
    minQuality: 0.74,
    maxBytes: 700 * KiB,
  },
} as const satisfies Record<string, ImageSizeConfig>;

export type ImageSizeKey = keyof typeof IMAGE_SIZES;

export async function optimizeImage(
  file: File | Blob,
  options: OptimizeImageOptions,
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
            maxHeight: 'maxHeight' in sizeOptions ? sizeOptions.maxHeight : sizeOptions.maxWidth,
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
  const outputType = options.outputType ?? 'image/webp';
  const maxHeight = options.maxHeight ?? options.maxWidth;
  const targetDimensions = resizeDimensions(
    imageBitmap.width,
    imageBitmap.height,
    options.maxWidth,
    maxHeight,
  );

  let currentDimensions = targetDimensions;
  let currentQuality = options.quality;
  const minQuality = options.minQuality ?? Math.min(options.quality, 0.6);
  const minDimensions = {
    width: Math.max(1, Math.round(targetDimensions.width * MIN_DIMENSION_RATIO)),
    height: Math.max(1, Math.round(targetDimensions.height * MIN_DIMENSION_RATIO)),
  };

  let bestBlob = await renderOptimizedBlob(imageBitmap, currentDimensions, currentQuality, outputType);

  while (
    options.maxBytes &&
    bestBlob.size > options.maxBytes &&
    currentQuality - QUALITY_STEP >= minQuality
  ) {
    currentQuality = roundQuality(currentQuality - QUALITY_STEP);
    bestBlob = await renderOptimizedBlob(imageBitmap, currentDimensions, currentQuality, outputType);
  }

  while (
    options.maxBytes &&
    bestBlob.size > options.maxBytes &&
    (currentDimensions.width > minDimensions.width || currentDimensions.height > minDimensions.height)
  ) {
    currentDimensions = {
      width: Math.max(minDimensions.width, Math.round(currentDimensions.width * RESIZE_STEP)),
      height: Math.max(minDimensions.height, Math.round(currentDimensions.height * RESIZE_STEP)),
    };

    bestBlob = await renderOptimizedBlob(imageBitmap, currentDimensions, currentQuality, outputType);

    while (
      bestBlob.size > options.maxBytes &&
      currentQuality - QUALITY_STEP >= minQuality
    ) {
      currentQuality = roundQuality(currentQuality - QUALITY_STEP);
      bestBlob = await renderOptimizedBlob(imageBitmap, currentDimensions, currentQuality, outputType);
    }
  }

  return {
    blob: bestBlob,
    width: currentDimensions.width,
    height: currentDimensions.height,
  };
}

async function renderOptimizedBlob(
  imageBitmap: ImageBitmap,
  dimensions: { width: number; height: number },
  quality: number,
  outputType: 'image/webp' | 'image/jpeg',
): Promise<Blob> {
  const canvas = drawBitmapToCanvas(imageBitmap, dimensions.width, dimensions.height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, outputType, quality);
  });

  if (!blob) {
    throw new Error('No se pudo optimizar la imagen');
  }

  return blob;
}

function drawBitmapToCanvas(
  imageBitmap: ImageBitmap,
  targetWidth: number,
  targetHeight: number,
): HTMLCanvasElement {
  let sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = imageBitmap.width;
  sourceCanvas.height = imageBitmap.height;

  let sourceContext = sourceCanvas.getContext('2d');

  if (!sourceContext) {
    throw new Error('No se pudo crear el contexto del canvas');
  }

  sourceContext.imageSmoothingEnabled = true;
  sourceContext.imageSmoothingQuality = 'high';
  sourceContext.drawImage(imageBitmap, 0, 0);

  while (
    sourceCanvas.width * 0.5 > targetWidth &&
    sourceCanvas.height * 0.5 > targetHeight
  ) {
    const nextCanvas = document.createElement('canvas');
    nextCanvas.width = Math.max(targetWidth, Math.round(sourceCanvas.width * 0.5));
    nextCanvas.height = Math.max(targetHeight, Math.round(sourceCanvas.height * 0.5));

    const nextContext = nextCanvas.getContext('2d');

    if (!nextContext) {
      throw new Error('No se pudo crear el contexto del canvas');
    }

    nextContext.imageSmoothingEnabled = true;
    nextContext.imageSmoothingQuality = 'high';
    nextContext.drawImage(sourceCanvas, 0, 0, nextCanvas.width, nextCanvas.height);
    sourceCanvas = nextCanvas;
    sourceContext = nextContext;
  }

  if (sourceCanvas.width === targetWidth && sourceCanvas.height === targetHeight) {
    return sourceCanvas;
  }

  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = targetWidth;
  targetCanvas.height = targetHeight;

  const targetContext = targetCanvas.getContext('2d');

  if (!targetContext) {
    throw new Error('No se pudo crear el contexto del canvas');
  }

  targetContext.imageSmoothingEnabled = true;
  targetContext.imageSmoothingQuality = 'high';
  targetContext.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);

  return targetCanvas;
}

function resizeDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const widthRatio = maxWidth / originalWidth;
  const heightRatio = maxHeight / originalHeight;
  const ratio = Math.min(widthRatio, heightRatio, 1);

  return {
    width: Math.max(1, Math.round(originalWidth * ratio)),
    height: Math.max(1, Math.round(originalHeight * ratio)),
  };
}

function roundQuality(value: number): number {
  return Math.round(value * 100) / 100;
}
