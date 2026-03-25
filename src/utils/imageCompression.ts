import imageCompression from 'browser-image-compression';
import { THUMBNAIL_MAX_WIDTH, FULL_IMAGE_MAX_WIDTH } from '../types';

interface CompressResult {
  full: Blob;
  thumbnail: Blob;
  aspectRatio: number;
}

/** Load an image blob/file and return its natural dimensions. */
function getImageDimensions(src: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image for dimensions'));
    };
    img.src = URL.createObjectURL(src);
  });
}

export async function compressImage(file: File): Promise<CompressResult> {
  // Measure original aspect ratio before compression
  const { width, height } = await getImageDimensions(file);
  const aspectRatio = width / height;

  // Run sequentially to reduce peak memory usage on mobile devices
  const full = await imageCompression(file, { maxWidthOrHeight: FULL_IMAGE_MAX_WIDTH, useWebWorker: true });
  const thumbnail = await imageCompression(file, { maxWidthOrHeight: THUMBNAIL_MAX_WIDTH, useWebWorker: true });
  return { full, thumbnail, aspectRatio };
}
