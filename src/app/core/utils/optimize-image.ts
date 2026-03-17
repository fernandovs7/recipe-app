export interface OptimizeImageOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  outputType?: 'image/webp' | 'image/jpeg';
}

export interface OptimizedImageResult {
  blob: Blob;
  width: number;
  height: number;
}

export async function optimizeImage(
  file: File,
  options: OptimizeImageOptions
): Promise<OptimizedImageResult> {
  const imageBitmap = await createImageBitmap(file);

  const { width, height } = resizeDimensions(
    imageBitmap.width,
    imageBitmap.height,
    options.maxWidth,
    options.maxHeight
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

  imageBitmap.close();

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
