import type { MediaTag, TaggedPlayer } from '../types';
import { MAX_IMAGE_UPLOAD_BYTES } from '../types';
import { R2_PUBLIC_URL } from '../config';
import { supabase } from '../lib/supabase';
import { compressImage } from './imageCompression';

interface PresignedUrl {
  key: string;
  uploadUrl: string;
  publicUrl: string;
}

export interface UploadFileEntry {
  id: string;
  file: File;
  caption: string;
  tags: MediaTag[];
  taggedPlayers: TaggedPlayer[];
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
  files: { key: string; contentType: string; size: number }[],
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
 * Display URL for a stored media path. New rows store bare R2 keys; rows
 * created before the key migration stored full public URLs, which pass
 * through untouched.
 */
export function mediaUrl(pathOrKey: string): string {
  if (pathOrKey.startsWith('http')) return pathOrKey;
  return `${R2_PUBLIC_URL}/${pathOrKey}`;
}

/**
 * Extract the R2 object key from a stored media path (bare key or, for
 * pre-migration rows, a full public URL).
 */
export function keyFromPublicUrl(pathOrKey: string): string | null {
  if (!pathOrKey.startsWith('http')) return pathOrKey;
  try {
    const url = new URL(pathOrKey);
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
  trophyId: number | null = null,
): Promise<void> {
  const id = entry.id;
  const compressed = await compressImage(entry.file);
  const fullBlob = compressed.full;
  const thumbBlob = compressed.thumbnail;
  const aspectRatio = compressed.aspectRatio;
  const fullContentType = 'image/jpeg';
  const thumbContentType = 'image/jpeg';

  signal?.throwIfAborted();

  if (fullBlob.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error(`El archivo es demasiado grande (máximo ${Math.round(MAX_IMAGE_UPLOAD_BYTES / 1024 / 1024)} MB).`);
  }

  const fullKey = `full/${id}.jpg`;
  const thumbKey = `thumb/${id}.jpg`;

  // Retry idempotency: a previous attempt may have gotten as far as inserting
  // the media row (e.g. failing only on tags). Re-requesting presigned URLs
  // for keys that a row already references would be rejected by the edge
  // function's overwrite protection, so skip straight to the tag inserts.
  const { data: existingRow, error: existingError } = await supabase
    .from('media')
    .select('id')
    .eq('storage_path', fullKey)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  let mediaId: number;
  if (existingRow) {
    mediaId = existingRow.id;
  } else {
    const urls = await getUploadUrls(
      [
        { key: fullKey, contentType: fullContentType, size: fullBlob.size },
        { key: thumbKey, contentType: thumbContentType, size: thumbBlob.size },
      ],
      signal,
    );

    await Promise.all([
      uploadToR2(urls[0].uploadUrl, fullBlob, fullContentType, signal),
      uploadToR2(urls[1].uploadUrl, thumbBlob, thumbContentType, signal),
    ]);

    signal?.throwIfAborted();

    // Store bare R2 keys; display URLs are built client-side (mediaUrl).
    const { data: mediaRow, error: insertError } = await supabase
      .from('media')
      .insert({
        event_id: eventId,
        trophy_id: trophyId,
        storage_path: fullKey,
        thumbnail_path: thumbKey,
        caption: entry.caption || null,
        taken_at: date,
        aspect_ratio: aspectRatio,
      })
      .select()
      .single();

    if (insertError || !mediaRow) throw new Error(insertError?.message ?? 'Error al guardar la foto.');
    mediaId = mediaRow.id;
  }

  // Tag inserts are upserts so a retried upload never fails on duplicates.
  if (entry.tags.length > 0) {
    const assignments = entry.tags.map((tag) => ({
      media_id: mediaId,
      tag_id: tag.id,
    }));
    const { error: tagError } = await supabase
      .from('media_tag_assignments')
      .upsert(assignments, { onConflict: 'media_id,tag_id', ignoreDuplicates: true });
    if (tagError) throw new Error(tagError.message);
  }

  if (entry.taggedPlayers.length > 0) {
    const playerAssignments = entry.taggedPlayers.map((player) => ({
      media_id: mediaId,
      player_id: player.id,
    }));
    const { error: playerTagError } = await supabase
      .from('media_player_tags')
      .upsert(playerAssignments, { onConflict: 'media_id,player_id', ignoreDuplicates: true });
    if (playerTagError) throw new Error(playerTagError.message);
  }
}
