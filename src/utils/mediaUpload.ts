import { supabase } from '../lib/supabase';

interface PresignedUrl {
  key: string;
  uploadUrl: string;
  publicUrl: string;
}

/**
 * Request presigned R2 upload URLs from the Edge Function.
 */
export async function getUploadUrls(
  files: { key: string; contentType: string }[],
): Promise<PresignedUrl[]> {
  const { data, error } = await supabase.functions.invoke('media-upload', {
    method: 'POST',
    body: { files },
  });

  if (error) throw new Error(error.message);
  return data.urls;
}

/**
 * Upload a blob directly to R2 via a presigned URL.
 */
export async function uploadToR2(uploadUrl: string, blob: Blob, contentType: string): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': contentType },
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

  if (error) throw new Error(error.message);
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
