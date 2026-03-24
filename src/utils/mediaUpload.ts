import { supabase } from '../lib/supabase';
import { SUPABASE_URL } from '../config';

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/media-upload`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

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
  const headers = await getAuthHeaders();
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ files }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Upload URL request failed: ${res.status}`);
  }

  const { urls } = await res.json();
  return urls;
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
  const headers = await getAuthHeaders();
  const res = await fetch(FUNCTION_URL, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ keys }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `R2 delete failed: ${res.status}`);
  }
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
