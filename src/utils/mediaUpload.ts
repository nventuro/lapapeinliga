import type { MediaTag } from '../types';
import { supabase } from '../lib/supabase';
import { compressImage } from './imageCompression';
import { extractFirstFrame, getVideoAspectRatio } from './videoProcessing';

interface PresignedUrl {
  key: string;
  uploadUrl: string;
  publicUrl: string;
}

export interface UploadFileEntry {
  id: string;
  file: File;
  preview: string;
  caption: string;
  tags: MediaTag[];
  isVideo: boolean;
  processedBlob: Blob | null;
}

async function extractError(error: unknown): Promise<string> {
  if (error && typeof error === 'object' && 'context' in error) {
    const ctx = (error as { context: unknown }).context;
    if (ctx instanceof Response) {
      try {
        const body = await ctx.json();
        return body.error ?? body.message ?? ctx.statusText;
      } catch {
        return ctx.statusText;
      }
    }
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Request presigned R2 upload URLs from the Edge Function.
 */
export async function getUploadUrls(
  files: { key: string; contentType: string }[],
  signal?: AbortSignal,
): Promise<PresignedUrl[]> {
  signal?.throwIfAborted();
  const { data, error } = await supabase.functions.invoke('media-upload', {
    method: 'POST',
    body: { files },
  });

  if (error) throw new Error(await extractError(error));
  return data.urls;
}

/**
 * Upload a blob directly to R2 via a presigned URL.
 */
export async function uploadToR2(
  uploadUrl: string, blob: Blob, contentType: string, signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': contentType },
    signal,
  });

  if (!res.ok) {
    throw new Error(`R2 upload failed: ${res.status}`);
  }
}

/**
 * Delete objects from R2 via the Edge Function.
 */
export async function deleteFromR2(keys: string[]): Promise<void> {
  const { error } = await supabase.functions.invoke('media-upload', {
    method: 'DELETE',
    body: { keys },
  });

  if (error) throw new Error(await extractError(error));
}

/**
 * Extract the R2 object key from a public URL.
 */
export function keyFromPublicUrl(publicUrl: string): string | null {
  // Format: https://pub-xxx.r2.dev/{key}
  try {
    const url = new URL(publicUrl);
    return url.pathname.slice(1); // Remove leading /
  } catch {
    return null;
  }
}

/**
 * Upload a single file end-to-end: compress/process → presigned URLs → R2 upload → DB insert.
 * Pure async function, no React state. Used by the upload queue.
 */
export async function uploadSingleFile(
  entry: UploadFileEntry,
  eventId: number | null,
  date: string,
  signal?: AbortSignal,
): Promise<void> {
  const id = entry.id;
  let fullBlob: Blob;
  let thumbBlob: Blob;
  let fullContentType: string;
  let aspectRatio: number;
  const thumbContentType = 'image/jpeg';

  if (entry.isVideo) {
    fullBlob = entry.processedBlob ?? entry.file;
    fullContentType = 'video/webm';
    thumbBlob = await extractFirstFrame(entry.file);
    aspectRatio = await getVideoAspectRatio(entry.file);
  } else {
    const compressed = await compressImage(entry.file);
    fullBlob = compressed.full;
    thumbBlob = compressed.thumbnail;
    aspectRatio = compressed.aspectRatio;
    fullContentType = 'image/jpeg';
  }

  signal?.throwIfAborted();

  const fullKey = entry.isVideo ? `video/${id}.webm` : `full/${id}.jpg`;
  const thumbKey = `thumb/${id}.jpg`;

  const urls = await getUploadUrls(
    [
      { key: fullKey, contentType: fullContentType },
      { key: thumbKey, contentType: thumbContentType },
    ],
    signal,
  );

  await Promise.all([
    uploadToR2(urls[0].uploadUrl, fullBlob, fullContentType, signal),
    uploadToR2(urls[1].uploadUrl, thumbBlob, thumbContentType, signal),
  ]);

  signal?.throwIfAborted();

  const { data: mediaRow, error: insertError } = await supabase
    .from('media')
    .insert({
      event_id: eventId,
      storage_path: urls[0].publicUrl,
      thumbnail_path: urls[1].publicUrl,
      caption: entry.caption || null,
      taken_at: date,
      media_type: entry.isVideo ? 'video' : 'image',
      aspect_ratio: aspectRatio,
    })
    .select()
    .single();

  if (insertError) throw new Error(insertError.message);

  if (entry.tags.length > 0 && mediaRow) {
    const assignments = entry.tags.map((tag) => ({
      media_id: mediaRow.id,
      tag_id: tag.id,
    }));
    const { error: tagError } = await supabase
      .from('media_tag_assignments')
      .insert(assignments);
    if (tagError) throw new Error(tagError.message);
  }
}
