import imageCompression from 'browser-image-compression';
import { THUMBNAIL_MAX_WIDTH, FULL_IMAGE_MAX_WIDTH } from '../types';

export async function compressImage(file: File): Promise<{ full: Blob; thumbnail: Blob }> {
  const [full, thumbnail] = await Promise.all([
    imageCompression(file, { maxWidthOrHeight: FULL_IMAGE_MAX_WIDTH, useWebWorker: true }),
    imageCompression(file, { maxWidthOrHeight: THUMBNAIL_MAX_WIDTH, useWebWorker: true }),
  ]);
  return { full, thumbnail };
}
